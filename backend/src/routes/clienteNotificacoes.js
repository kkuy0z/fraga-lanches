"use strict";

const express = require("express");
const router = express.Router();

const db = require("../database");
const autenticar = require("../middleware/autenticar");

router.use(autenticar);

// ======================================================
// LISTAR NOTIFICAÇÕES DO CLIENTE
// ======================================================

router.get("/", async (req, res) => {
  try {
    const usuarioId = req.usuario.id;

    const [notificacoes] = await db.query(
      `
        SELECT
          id,
          pedido_id,
          tipo,
          titulo,
          mensagem,
          lida,
          data_criacao
        FROM notificacoes
        WHERE usuario_id = ?
        ORDER BY data_criacao DESC, id DESC
        LIMIT 30
      `,
      [usuarioId],
    );

    return res.json({
      notificacoes,
    });
  } catch (erro) {
    console.error("Erro ao listar notificações:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível carregar as notificações.",
    });
  }
});

// ======================================================
// CONFIRMAR RECEBIMENTO DO PEDIDO
// ======================================================

router.patch("/pedidos/:pedidoId/confirmar-recebimento", async (req, res) => {
  const pedidoId = Number(req.params.pedidoId);
  const usuarioId = req.usuario.id;

  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return res.status(400).json({
      mensagem: "Identificador do pedido inválido.",
    });
  }

  let conexao;
  let transacaoIniciada = false;
  let transacaoFinalizada = false;

  try {
    conexao = await db.getConnection();

    await conexao.beginTransaction();
    transacaoIniciada = true;

    // ==================================================
    // BUSCAR PEDIDO E ENTREGA
    // ==================================================

    const [pedidos] = await conexao.query(
      `
        SELECT
          p.id,
          p.usuario_id,
          p.status AS status_pedido,

          e.id AS entrega_id,
          e.status AS status_entrega,
          e.data_confirmacao_recebimento

        FROM pedidos p

        INNER JOIN entregas e
          ON e.pedido_id = p.id

        WHERE p.id = ?
          AND p.usuario_id = ?

        FOR UPDATE
      `,
      [pedidoId, usuarioId],
    );

    if (!pedidos.length) {
      await conexao.rollback();
      transacaoFinalizada = true;

      return res.status(404).json({
        mensagem: "Pedido não encontrado.",
      });
    }

    const pedido = pedidos[0];

    // ==================================================
    // VERIFICAR SE JÁ FOI CONFIRMADO
    // ==================================================

    if (
      pedido.status_pedido === "concluido" &&
      pedido.data_confirmacao_recebimento
    ) {
      await conexao.commit();
      transacaoFinalizada = true;

      return res.json({
        mensagem: "O recebimento deste pedido já foi confirmado.",
        pedidoId,
        status: "concluido",
      });
    }

    // ==================================================
    // VALIDAR STATUS DA ENTREGA
    // ==================================================

    if (pedido.status_entrega !== "entregue") {
      await conexao.rollback();
      transacaoFinalizada = true;

      return res.status(409).json({
        mensagem: "O entregador ainda não informou que realizou a entrega.",
      });
    }

    // ==================================================
    // VALIDAR STATUS DO PEDIDO
    // ==================================================

    if (pedido.status_pedido !== "saiu_para_entrega") {
      await conexao.rollback();
      transacaoFinalizada = true;

      return res.status(409).json({
        mensagem: "Este pedido não está aguardando confirmação.",
      });
    }

    // ==================================================
    // VERIFICAR NOTIFICAÇÃO
    // ==================================================

    const [notificacoes] = await conexao.query(
      `
        SELECT id
        FROM notificacoes
        WHERE pedido_id = ?
          AND usuario_id = ?
          AND tipo = 'entrega_informada'
        LIMIT 1
        FOR UPDATE
      `,
      [pedidoId, usuarioId],
    );

    if (!notificacoes.length) {
      await conexao.rollback();
      transacaoFinalizada = true;

      return res.status(409).json({
        mensagem:
          "A notificação de confirmação deste pedido não foi encontrada.",
      });
    }

    // ==================================================
    // CONCLUIR PEDIDO
    // ==================================================

    const [resultadoPedido] = await conexao.query(
      `
        UPDATE pedidos
        SET status = 'concluido'
        WHERE id = ?
          AND usuario_id = ?
          AND status = 'saiu_para_entrega'
      `,
      [pedidoId, usuarioId],
    );

    if (resultadoPedido.affectedRows !== 1) {
      throw new Error("Não foi possível atualizar o status do pedido.");
    }

    // ==================================================
    // REGISTRAR CONFIRMAÇÃO DO RECEBIMENTO
    // ==================================================

    const [resultadoEntrega] = await conexao.query(
      `
        UPDATE entregas
        SET data_confirmacao_recebimento = NOW()
        WHERE id = ?
          AND status = 'entregue'
          AND data_confirmacao_recebimento IS NULL
      `,
      [pedido.entrega_id],
    );

    if (resultadoEntrega.affectedRows !== 1) {
      throw new Error("Não foi possível registrar a confirmação da entrega.");
    }

    // ==================================================
    // REGISTRAR HISTÓRICO
    // ==================================================

    await conexao.query(
      `
        INSERT INTO historico_pedidos (
          pedido_id,
          usuario_id,
          status_anterior,
          status_novo,
          data_alteracao
        )
        VALUES (?, ?, 'saiu_para_entrega', 'concluido', NOW())
      `,
      [pedidoId, usuarioId],
    );

    // ==================================================
    // MARCAR NOTIFICAÇÃO COMO LIDA
    // ==================================================

    await conexao.query(
      `
        UPDATE notificacoes
        SET lida = TRUE
        WHERE pedido_id = ?
          AND usuario_id = ?
          AND tipo = 'entrega_informada'
      `,
      [pedidoId, usuarioId],
    );

    // ==================================================
    // FINALIZAR TRANSAÇÃO
    // ==================================================

    await conexao.commit();
    transacaoFinalizada = true;

    return res.json({
      mensagem: "Recebimento confirmado. Pedido concluído com sucesso!",
      pedidoId,
      status: "concluido",
    });
  } catch (erro) {
    if (conexao && transacaoIniciada && !transacaoFinalizada) {
      try {
        await conexao.rollback();
        transacaoFinalizada = true;
      } catch (erroRollback) {
        console.error(
          "Erro ao desfazer confirmação de recebimento:",
          erroRollback,
        );
      }
    }

    console.error("Erro ao confirmar recebimento:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível confirmar o recebimento.",
    });
  } finally {
    if (conexao) {
      conexao.release();
    }
  }
});

module.exports = router;
