"use strict";

const db = require("../database");

const INTERVALO_VERIFICACAO = 5000;
const LIMITE_POR_CICLO = 50;

let temporizador = null;
let executando = false;

async function emitirEvento(destino, dados) {
  const segredo = process.env.INTERNAL_SERVICE_SECRET;
  if (!segredo) {
    console.error("[Pedidos/PIX] INTERNAL_SERVICE_SECRET nao configurada.");
    return;
  }

  try {
    const resposta = await fetch("http://127.0.0.1:3000/internal/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-secret": segredo,
      },
      body: JSON.stringify({ destino, ...dados }),
      signal: AbortSignal.timeout(5000),
    });

    if (!resposta.ok) {
      console.error("[Pedidos/PIX] Gateway recusou evento:", resposta.status);
    }
  } catch (erro) {
    console.error("[Pedidos/PIX] Falha ao publicar evento:", erro.message);
  }
}

async function processarIntencaoPixExpirada(intencaoPixId) {
  const conexao = await db.getConnection();
  let expirada = null;

  try {
    await conexao.beginTransaction();

    const [intencoes] = await conexao.query(
      `SELECT id, usuario_id, codigo_referencia, status
       FROM intencoes_pix
       WHERE id = ?
       FOR UPDATE`,
      [intencaoPixId],
    );

    if (!intencoes.length || intencoes[0].status !== "pendente") {
      await conexao.rollback();
      return;
    }

    const [resultado] = await conexao.query(
      `UPDATE intencoes_pix
       SET status = 'expirado'
       WHERE id = ?
         AND status = 'pendente'
         AND expira_em <= NOW()`,
      [intencaoPixId],
    );

    if (resultado.affectedRows !== 1) {
      await conexao.rollback();
      return;
    }

    expirada = {
      id: intencoes[0].id,
      usuarioId: intencoes[0].usuario_id,
      codigoReferencia: intencoes[0].codigo_referencia,
    };

    await conexao.commit();
  } catch (erro) {
    try {
      await conexao.rollback();
    } catch (rollbackError) {
      console.error("[Pedidos/PIX] Falha no rollback:", rollbackError.message);
    }
    throw erro;
  } finally {
    conexao.release();
  }

  if (!expirada) return;

  const evento = {
    evento: "intencao_pix_expirada",
    intencaoPixId: expirada.id,
    codigoReferencia: expirada.codigoReferencia,
    status: "expirado",
  };

  if (expirada.usuarioId != null) {
    await emitirEvento("usuario", {
      usuarioId: expirada.usuarioId,
      evento,
    });
  }

  await emitirEvento("equipe", {
    tipos: ["admin", "atendente"],
    evento,
  });
}

async function verificarIntencoesPixExpiradas() {
  if (executando) return;
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
        await processarIntencaoPixExpirada(intencao.id);
      } catch (erro) {
        console.error(`[Pedidos/PIX] Erro ao expirar intencao ${intencao.id}:`, erro.message);
      }
    }
  } catch (erro) {
    console.error("[Pedidos/PIX] Erro na verificacao de expiracao:", erro.message);
  } finally {
    executando = false;
  }
}

function iniciarExpiracaoPix() {
  if (temporizador) return;

  console.log("[Pedidos/PIX] Expiracao automatica iniciada (intervalo de 5s).");
  verificarIntencoesPixExpiradas();
  temporizador = setInterval(verificarIntencoesPixExpiradas, INTERVALO_VERIFICACAO);
}

function pararExpiracaoPix() {
  if (!temporizador) return;
  clearInterval(temporizador);
  temporizador = null;
}

module.exports = {
  iniciarExpiracaoPix,
  pararExpiracaoPix,
};
