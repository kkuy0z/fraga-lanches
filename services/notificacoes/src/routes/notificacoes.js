"use strict";

const express = require("express");
const router = express.Router();

const db = require("../database");
const autenticar = require("../middleware/autenticar");

router.use(autenticar);

// ======================================================
// LISTAR NOTIFICAÇÕES DO USUÁRIO AUTENTICADO
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

    const [contagem] = await db.query(
      `
        SELECT COUNT(*) AS naoLidas
        FROM notificacoes
        WHERE usuario_id = ?
          AND lida = FALSE
      `,
      [usuarioId],
    );

    return res.json({
      notificacoes,
      naoLidas: Number(contagem[0].naoLidas),
    });
  } catch (erro) {
    console.error("[NOTIFICAÇÕES] Erro ao listar:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível carregar as notificações.",
    });
  }
});

// ======================================================
// MARCAR TODAS COMO LIDAS
// ======================================================

router.patch("/lidas", async (req, res) => {
  try {
    const usuarioId = req.usuario.id;

    const [resultado] = await db.query(
      `
        UPDATE notificacoes
        SET lida = TRUE
        WHERE usuario_id = ?
          AND lida = FALSE
      `,
      [usuarioId],
    );

    return res.json({
      mensagem: "Todas as notificações foram marcadas como lidas.",
      atualizadas: resultado.affectedRows,
      naoLidas: 0,
    });
  } catch (erro) {
    console.error("[NOTIFICAÇÕES] Erro ao marcar todas como lidas:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível atualizar as notificações.",
    });
  }
});

// ======================================================
// MARCAR UMA NOTIFICAÇÃO COMO LIDA
// ======================================================

router.patch("/:id/lida", async (req, res) => {
  const notificacaoId = Number(req.params.id);
  const usuarioId = req.usuario.id;

  if (!Number.isInteger(notificacaoId) || notificacaoId <= 0) {
    return res.status(400).json({
      mensagem: "Identificador da notificação inválido.",
    });
  }

  try {
    const [resultado] = await db.query(
      `
        UPDATE notificacoes
        SET lida = TRUE
        WHERE id = ?
          AND usuario_id = ?
      `,
      [notificacaoId, usuarioId],
    );

    if (resultado.affectedRows === 0) {
      const [existentes] = await db.query(
        `
          SELECT id
          FROM notificacoes
          WHERE id = ?
            AND usuario_id = ?
          LIMIT 1
        `,
        [notificacaoId, usuarioId],
      );

      if (!existentes.length) {
        return res.status(404).json({
          mensagem: "Notificação não encontrada.",
        });
      }
    }

    return res.json({
      mensagem: "Notificação marcada como lida.",
      notificacaoId,
    });
  } catch (erro) {
    console.error("[NOTIFICAÇÕES] Erro ao marcar como lida:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível atualizar a notificação.",
    });
  }
});

module.exports = router;
