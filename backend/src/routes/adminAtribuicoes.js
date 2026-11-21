"use strict";

const express = require("express");
const router = express.Router();

const db = require("../database");
const autenticarAdmin = require("../middleware/autenticarAdmin");

router.use(autenticarAdmin);

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

  try {
    conexao = await db.getConnection();
    await conexao.beginTransaction();

    // Bloqueia o pedido durante a operação.
    const [pedidosEncontrados] = await conexao.query(
      `
        SELECT id, status, tipo_entrega
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

    // Confirma que o entregador existe e está ativo.
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

    // Verifica se já existe uma entrega para o pedido.
    const [entregas] = await conexao.query(
      `
        SELECT id, status
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

    await conexao.commit();

    return res.json({
      mensagem: "Entregador atribuído com sucesso!",
      pedidoId,
      entregador: {
        id: entregador.id,
        nome: entregador.nome,
      },
    });
  } catch (erro) {
    if (conexao) {
      await conexao.rollback();
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
