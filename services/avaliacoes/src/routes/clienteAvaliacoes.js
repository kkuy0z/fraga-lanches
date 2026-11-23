"use strict";

const express = require("express");
const db = require("../database");
const autenticar = require("../middleware/autenticar");

const router = express.Router();

router.use(autenticar);

// ======================================================
// CONSULTAR AVALIAÇÃO DE UM PEDIDO
// GET /api/cliente/avaliacoes/:pedidoId
// ======================================================

router.get("/:pedidoId", async (req, res) => {
  const pedidoId = Number(req.params.pedidoId);
  const usuarioId = req.usuario.id;

  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return res.status(400).json({
      mensagem: "Pedido inválido.",
    });
  }

  try {
    const [pedidos] = await db.query(
      `
        SELECT id, status
        FROM pedidos
        WHERE id = ?
          AND usuario_id = ?
        LIMIT 1
      `,
      [pedidoId, usuarioId],
    );

    if (!pedidos.length) {
      return res.status(404).json({
        mensagem: "Pedido não encontrado.",
      });
    }

    const [avaliacoes] = await db.query(
      `
        SELECT
          id,
          pedido_id,
          nota,
          comentario,
          status,
          motivo_rejeicao,
          data_avaliacao,
          data_moderacao
        FROM avaliacoes
        WHERE pedido_id = ?
          AND usuario_id = ?
        LIMIT 1
      `,
      [pedidoId, usuarioId],
    );

    return res.json({
      pedido: pedidos[0],
      avaliacao: avaliacoes[0] || null,
      podeAvaliar: pedidos[0].status === "concluido" && avaliacoes.length === 0,
    });
  } catch (erro) {
    console.error("Erro ao consultar avaliação:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível consultar a avaliação.",
    });
  }
});

// ======================================================
// CADASTRAR AVALIAÇÃO
// POST /api/cliente/avaliacoes/:pedidoId
// ======================================================

router.post("/:pedidoId", async (req, res) => {
  const pedidoId = Number(req.params.pedidoId);
  const usuarioId = req.usuario.id;

  const nota = Number(req.body.nota);
  const comentario = String(req.body.comentario || "").trim();

  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return res.status(400).json({
      mensagem: "Pedido inválido.",
    });
  }

  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    return res.status(400).json({
      mensagem: "A nota deve ser um número inteiro entre 1 e 5.",
    });
  }

  if (comentario.length > 2000) {
    return res.status(400).json({
      mensagem: "O comentário deve ter no máximo 2.000 caracteres.",
    });
  }

  let conexao;
  let transacaoIniciada = false;

  try {
    conexao = await db.getConnection();

    await conexao.beginTransaction();
    transacaoIniciada = true;

    const [pedidos] = await conexao.query(
      `
        SELECT id, status
        FROM pedidos
        WHERE id = ?
          AND usuario_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [pedidoId, usuarioId],
    );

    if (!pedidos.length) {
      await conexao.rollback();
      transacaoIniciada = false;

      return res.status(404).json({
        mensagem: "Pedido não encontrado.",
      });
    }

    if (pedidos[0].status !== "concluido") {
      await conexao.rollback();
      transacaoIniciada = false;

      return res.status(409).json({
        mensagem: "Você só pode avaliar pedidos concluídos.",
      });
    }

    const [avaliacoesExistentes] = await conexao.query(
      `
        SELECT id
        FROM avaliacoes
        WHERE pedido_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [pedidoId],
    );

    if (avaliacoesExistentes.length) {
      await conexao.rollback();
      transacaoIniciada = false;

      return res.status(409).json({
        mensagem: "Este pedido já possui uma avaliação.",
      });
    }

    const [resultado] = await conexao.query(
      `
        INSERT INTO avaliacoes (
          pedido_id,
          usuario_id,
          nota,
          comentario,
          status,
          data_avaliacao
        )
        VALUES (?, ?, ?, ?, 'pendente', NOW())
      `,
      [pedidoId, usuarioId, nota, comentario || null],
    );

    await conexao.commit();
    transacaoIniciada = false;

    return res.status(201).json({
      mensagem: "Avaliação enviada! Ela ficará aguardando aprovação.",
      avaliacao: {
        id: resultado.insertId,
        pedido_id: pedidoId,
        nota,
        comentario: comentario || null,
        status: "pendente",
      },
    });
  } catch (erro) {
    if (transacaoIniciada && conexao) {
      try {
        await conexao.rollback();
      } catch (erroRollback) {
        console.error("Erro ao desfazer transação:", erroRollback);
      }
    }

    if (erro.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        mensagem: "Este pedido já possui uma avaliação.",
      });
    }

    console.error("Erro ao cadastrar avaliação:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível enviar sua avaliação.",
    });
  } finally {
    if (conexao) {
      conexao.release();
    }
  }
});

module.exports = router;
