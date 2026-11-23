"use strict";

const express = require("express");
const router = express.Router();

const db = require("../database");
const autenticarEquipe = require("../middleware/autenticarEquipe");

router.use(autenticarEquipe);

// ======================================================
// ENVIAR NOTIFICAÇÃO EM TEMPO REAL
// ======================================================

function emitirNotificacao(req, usuarioId, notificacao) {
  try {
    const websocket = req.app.locals.websocket;

    if (websocket && typeof websocket.emitirParaUsuario === "function") {
      websocket.emitirParaUsuario(usuarioId, {
        tipo: "notificacao_criada",
        notificacao,
      });
    }
  } catch (erro) {
    console.error("Erro ao emitir notificação:", erro);
  }
}

// ======================================================
// LISTAR ENTREGADORES ATIVOS
// ======================================================

router.get("/entregadores", async (req, res) => {
  try {
    const [entregadores] = await db.query(`
      SELECT id, nome, telefone
      FROM usuarios
      WHERE tipo = 'entregador'
        AND ativo = 1
      ORDER BY nome ASC
    `);

    return res.json({ entregadores });
  } catch (erro) {
    console.error("Erro ao listar entregadores:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível carregar os entregadores.",
    });
  }
});

// ======================================================
// CONSULTAR ATRIBUIÇÃO DE UM PEDIDO
// ======================================================

router.get("/:pedidoId", async (req, res) => {
  try {
    const pedidoId = Number(req.params.pedidoId);

    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({
        mensagem: "ID do pedido inválido.",
      });
    }

    const [entregas] = await db.query(
      `
        SELECT
          e.id,
          e.pedido_id,
          e.entregador_id,
          e.status,
          e.data_saida,
          e.data_entrega,
          u.nome AS entregador_nome
        FROM entregas e
        LEFT JOIN usuarios u ON u.id = e.entregador_id
        WHERE e.pedido_id = ?
        LIMIT 1
      `,
      [pedidoId],
    );

    return res.json({
      entrega: entregas[0] || null,
    });
  } catch (erro) {
    console.error("Erro ao consultar atribuição:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível consultar a atribuição.",
    });
  }
});

// ======================================================
// ATRIBUIR OU REATRIBUIR ENTREGA
// ======================================================

router.post("/", async (req, res) => {
  console.log("[ATRIBUICOES] POST recebido:", req.body);
  const pedidoId = Number(req.body.pedidoId);
  const entregadorId = Number(req.body.entregadorId);

  if (
    !Number.isInteger(pedidoId) ||
    pedidoId <= 0 ||
    !Number.isInteger(entregadorId) ||
    entregadorId <= 0
  ) {
    return res.status(400).json({
      mensagem: "Informe um pedido e um entregador válidos.",
    });
  }

  let conexao;
  let notificacoesEmitir = [];

  try {
    conexao = await db.getConnection();
    await conexao.beginTransaction();

    // --------------------------------------------------
    // 1. BLOQUEAR E CONSULTAR PEDIDO
    // --------------------------------------------------

    const [pedidosEncontrados] = await conexao.query(
      `
        SELECT id, usuario_id, status, tipo_entrega
        FROM pedidos
        WHERE id = ?
        FOR UPDATE
      `,
      [pedidoId],
    );

    const pedido = pedidosEncontrados[0];

    if (!pedido) {
      await conexao.rollback();

      return res.status(404).json({
        mensagem: "Pedido não encontrado.",
      });
    }

    if (pedido.tipo_entrega !== "entrega") {
      await conexao.rollback();

      return res.status(400).json({
        mensagem:
          "Pedidos de retirada não podem ser atribuídos a entregadores.",
      });
    }

    if (pedido.status !== "pronto") {
      await conexao.rollback();

      return res.status(400).json({
        mensagem: "Somente pedidos com status Pronto podem ser atribuídos.",
      });
    }

    // --------------------------------------------------
    // 2. VALIDAR ENTREGADOR
    // --------------------------------------------------

    const [entregadores] = await conexao.query(
      `
        SELECT id, nome
        FROM usuarios
        WHERE id = ?
          AND tipo = 'entregador'
          AND ativo = 1
        LIMIT 1
      `,
      [entregadorId],
    );

    const entregador = entregadores[0];

    if (!entregador) {
      await conexao.rollback();

      return res.status(404).json({
        mensagem: "Entregador não encontrado ou inativo.",
      });
    }

    // --------------------------------------------------
    // 3. CONSULTAR ENTREGA EXISTENTE
    // --------------------------------------------------

    const [entregas] = await conexao.query(
      `
        SELECT id, status, entregador_id
        FROM entregas
        WHERE pedido_id = ?
        FOR UPDATE
      `,
      [pedidoId],
    );

    const entregaExistente = entregas[0];

    if (
      entregaExistente &&
      !["pendente", "atribuida"].includes(entregaExistente.status)
    ) {
      await conexao.rollback();

      return res.status(409).json({
        mensagem:
          "Esta entrega já foi iniciada ou finalizada e não pode ser reatribuída.",
      });
    }

    const houveNovaAtribuicao =
      !entregaExistente ||
      Number(entregaExistente.entregador_id) !== entregadorId;

    console.log("[ATRIBUICOES] Diagnóstico:", {
      pedidoId,
      entregadorId,
      entregaExistente,
      houveNovaAtribuicao,
      clienteId: pedido.usuario_id,
    });
    // --------------------------------------------------
    // 4. SALVAR ATRIBUIÇÃO
    // --------------------------------------------------

    if (entregaExistente) {
      await conexao.query(
        `
          UPDATE entregas
          SET entregador_id = ?,
              status = 'atribuida'
          WHERE id = ?
        `,
        [entregadorId, entregaExistente.id],
      );
    } else {
      await conexao.query(
        `
          INSERT INTO entregas (
            pedido_id,
            entregador_id,
            status
          )
          VALUES (?, ?, 'atribuida')
        `,
        [pedidoId, entregadorId],
      );
    }

    // --------------------------------------------------
    // 5. NOTIFICAR ENTREGADOR E CLIENTE
    // --------------------------------------------------

    if (houveNovaAtribuicao) {
      console.log("[ATRIBUICOES] Iniciando criação das notificações.");
      const notificacoes = [
        {
          usuarioId: Number(entregadorId),
          tipo: "nova_entrega_atribuida",
          titulo: "Nova entrega atribuída",
          mensagem: `Você recebeu uma nova entrega referente ao pedido #${pedidoId}.`,
        },
        {
          usuarioId: Number(pedido.usuario_id),
          tipo: "pedido_atribuido_entregador",
          titulo: "Pedido encaminhado para entrega",
          mensagem: `Seu pedido #${pedidoId} foi atribuído a um entregador e está aguardando a saída para entrega.`,
        },
      ];

      for (const notificacao of notificacoes) {
        await conexao.query(
          `
            INSERT INTO notificacoes (
              usuario_id,
              pedido_id,
              tipo,
              titulo,
              mensagem,
              lida,
              data_criacao
            )
            VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE
              titulo = VALUES(titulo),
              mensagem = VALUES(mensagem),
              lida = 0,
              data_criacao = CURRENT_TIMESTAMP
          `,
          [
            notificacao.usuarioId,
            pedidoId,
            notificacao.tipo,
            notificacao.titulo,
            notificacao.mensagem,
          ],
        );

        console.log(
          "[ATRIBUICOES] Notificação gravada:",
          notificacao.tipo,
          "Usuário:",
          notificacao.usuarioId,
        );
        notificacoesEmitir.push({
          usuarioId: notificacao.usuarioId,
          notificacao: {
            usuario_id: notificacao.usuarioId,
            pedido_id: pedidoId,
            tipo: notificacao.tipo,
            titulo: notificacao.titulo,
            mensagem: notificacao.mensagem,
            lida: 0,
          },
        });
      }
    }

    // --------------------------------------------------
    // 6. CONFIRMAR TRANSAÇÃO
    // --------------------------------------------------

    await conexao.commit();

    // --------------------------------------------------
    // 7. EMITIR NOTIFICAÇÕES WEBSOCKET
    // --------------------------------------------------

    for (const item of notificacoesEmitir) {
      emitirNotificacao(req, item.usuarioId, item.notificacao);
    }

    return res.json({
      mensagem: "Entregador atribuído com sucesso!",
      pedidoId,
      entregador: {
        id: entregador.id,
        nome: entregador.nome,
      },
      notificacoesEnviadas: notificacoesEmitir.length,
    });
  } catch (erro) {
    if (conexao) {
      try {
        await conexao.rollback();
      } catch (erroRollback) {
        console.error("Erro ao desfazer atribuição:", erroRollback);
      }
    }

    console.error("Erro ao atribuir entregador:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível atribuir o entregador.",
    });
  } finally {
    if (conexao) {
      conexao.release();
    }
  }
});

module.exports = router;
