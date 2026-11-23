"use strict";

const express = require("express");
const db = require("../database");
const autenticarAdmin = require("../middleware/autenticarAdmin");

const router = express.Router();

router.use(autenticarAdmin);

// ======================================================
// LISTAR AVALIAÇÕES
// GET /api/admin/avaliacoes?status=pendente
// ======================================================

router.get("/", async (req, res) => {
  try {
    const statusPermitidos = ["pendente", "aprovada", "rejeitada"];
    const status = String(req.query.status || "").trim();
    const busca = String(req.query.busca || "").trim();

    const condicoes = [];
    const parametros = [];

    if (status) {
      if (!statusPermitidos.includes(status)) {
        return res.status(400).json({
          mensagem: "Filtro de status inválido.",
        });
      }

      condicoes.push("a.status = ?");
      parametros.push(status);
    }

    if (busca) {
      condicoes.push(`
        (
          CAST(a.id AS CHAR) LIKE ?
          OR CAST(a.pedido_id AS CHAR) LIKE ?
          OR u.nome LIKE ?
          OR a.comentario LIKE ?
        )
      `);

      const termo = `%${busca}%`;
      parametros.push(termo, termo, termo, termo);
    }

    const where = condicoes.length
      ? `WHERE ${condicoes.join(" AND ")}`
      : "";

    const [avaliacoes] = await db.query(
      `
        SELECT
          a.id,
          a.pedido_id,
          a.usuario_id,
          a.nota,
          a.comentario,
          a.status,
          a.moderado_por,
          a.data_moderacao,
          a.motivo_rejeicao,
          a.data_avaliacao,
          u.nome AS cliente_nome,
          moderador.nome AS moderador_nome
        FROM avaliacoes a
        INNER JOIN usuarios u
          ON u.id = a.usuario_id
        LEFT JOIN usuarios moderador
          ON moderador.id = a.moderado_por
        ${where}
        ORDER BY
          CASE
            WHEN a.status = 'pendente' THEN 0
            ELSE 1
          END,
          a.data_avaliacao DESC
      `,
      parametros,
    );

    return res.json({ avaliacoes });
  } catch (erro) {
    console.error("Erro ao listar avaliações:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível carregar as avaliações.",
    });
  }
});

// ======================================================
// MODERAR AVALIAÇÃO
// PATCH /api/admin/avaliacoes/:id/status
// ======================================================

router.patch("/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || "").trim();
  const motivo = String(req.body.motivo || "").trim();

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      mensagem: "Identificador de avaliação inválido.",
    });
  }

  if (!["aprovada", "rejeitada"].includes(status)) {
    return res.status(400).json({
      mensagem: "Ação de moderação inválida.",
    });
  }

  if (motivo.length > 500) {
    return res.status(400).json({
      mensagem: "O motivo deve ter no máximo 500 caracteres.",
    });
  }

  if (status === "rejeitada" && !motivo) {
    return res.status(400).json({
      mensagem: "Informe o motivo da rejeição.",
    });
  }

  try {
    const [resultado] = await db.query(
      `
        UPDATE avaliacoes
        SET
          status = ?,
          moderado_por = ?,
          data_moderacao = NOW(),
          motivo_rejeicao = ?
        WHERE id = ?
          AND status = 'pendente'
      `,
      [
        status,
        req.usuario.id,
        status === "rejeitada" ? motivo : null,
        id,
      ],
    );

    if (resultado.affectedRows !== 1) {
      const [existentes] = await db.query(
        "SELECT id, status FROM avaliacoes WHERE id = ? LIMIT 1",
        [id],
      );

      if (!existentes.length) {
        return res.status(404).json({
          mensagem: "Avaliação não encontrada.",
        });
      }

      return res.status(409).json({
        mensagem: "Esta avaliação já foi moderada.",
        statusAtual: existentes[0].status,
      });
    }

    return res.json({
      mensagem:
        status === "aprovada"
          ? "Avaliação aprovada com sucesso."
          : "Avaliação rejeitada com sucesso.",
      avaliacao: {
        id,
        status,
      },
    });
  } catch (erro) {
    console.error("Erro ao moderar avaliação:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível moderar a avaliação.",
    });
  }
});

module.exports = router;
