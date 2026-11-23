"use strict";

const db = require("../database");

const INTERVALO_VERIFICACAO = 5000;
const LIMITE_POR_CICLO = 50;

let temporizador = null;
let executando = false;

// ======================================================
// EXPIRAÇÃO DE UMA INTENÇÃO PIX
// ======================================================

async function processarIntencaoPixExpirada(intencaoPixId, websocket) {
  const conexao = await db.getConnection();

  let intencaoExpirada = null;

  try {
    await conexao.beginTransaction();

    // Bloqueia a intenção para evitar concorrência com a aprovação.
    const [intencoes] = await conexao.query(
      `SELECT
         id,
         usuario_id,
         codigo_referencia,
         status,
         expira_em
       FROM intencoes_pix
       WHERE id = ?
       FOR UPDATE`,
      [intencaoPixId],
    );

    if (intencoes.length === 0) {
      await conexao.rollback();
      return;
    }

    const intencao = intencoes[0];

    // Só expira intenções que ainda estão pendentes.
    if (intencao.status !== "pendente") {
      await conexao.rollback();
      return;
    }

    // O próprio MySQL verifica o prazo.
    const [resultado] = await conexao.query(
      `UPDATE intencoes_pix
       SET status = 'expirado'
       WHERE id = ?
         AND status = 'pendente'
         AND expira_em <= NOW()`,
      [intencaoPixId],
    );

    if (resultado.affectedRows === 0) {
      await conexao.rollback();
      return;
    }

    intencaoExpirada = {
      id: intencao.id,
      usuarioId: intencao.usuario_id,
      codigoReferencia: intencao.codigo_referencia,
    };

    await conexao.commit();
  } catch (erro) {
    try {
      await conexao.rollback();
    } catch (erroRollback) {
      console.error(
        "Erro ao desfazer transação de expiração da intenção PIX:",
        erroRollback,
      );
    }

    throw erro;
  } finally {
    conexao.release();
  }

  // Eventos somente depois da confirmação da transação.
  if (intencaoExpirada && websocket) {
    try {
      websocket.emitirParaUsuario(intencaoExpirada.usuarioId, {
        evento: "intencao_pix_expirada",
        intencaoPixId: intencaoExpirada.id,
        codigoReferencia: intencaoExpirada.codigoReferencia,
        status: "expirado",
      });
    } catch (erro) {
      console.error("Erro ao emitir expiração PIX para o cliente:", erro);
    }

    try {
      websocket.emitirParaTipos(["admin", "atendente"], {
        evento: "intencao_pix_expirada",
        intencaoPixId: intencaoExpirada.id,
        codigoReferencia: intencaoExpirada.codigoReferencia,
        status: "expirado",
      });
    } catch (erro) {
      console.error("Erro ao emitir expiração PIX para a equipe:", erro);
    }
  }
}

// ======================================================
// VERIFICAÇÃO DAS INTENÇÕES PIX EXPIRADAS
// ======================================================

async function verificarIntencoesPixExpiradas(websocket) {
  if (executando) {
    return;
  }

  executando = true;

  try {
    const [intencoes] = await db.query(
      `SELECT id
       FROM intencoes_pix
       WHERE status = 'pendente'
         AND expira_em <= NOW()
       ORDER BY expira_em ASC
       LIMIT ?`,
      [LIMITE_POR_CICLO],
    );

    for (const intencao of intencoes) {
      try {
        await processarIntencaoPixExpirada(intencao.id, websocket);
      } catch (erro) {
        console.error(`Erro ao expirar a intenção PIX ${intencao.id}:`, erro);
      }
    }
  } catch (erro) {
    console.error("Erro ao consultar intenções PIX expiradas:", erro);
  } finally {
    executando = false;
  }
}

// ======================================================
// INICIALIZAÇÃO DO SERVIÇO
// ======================================================

function iniciarExpiracaoPix(websocket) {
  if (temporizador) {
    return;
  }

  console.log("Serviço de expiração de intenções PIX iniciado.");

  // Executa uma verificação imediatamente.
  verificarIntencoesPixExpiradas(websocket);

  // Continua verificando a cada 5 segundos.
  temporizador = setInterval(() => {
    verificarIntencoesPixExpiradas(websocket);
  }, INTERVALO_VERIFICACAO);
}

module.exports = {
  iniciarExpiracaoPix,
};
