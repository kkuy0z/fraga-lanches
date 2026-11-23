"use strict";

const express = require("express");
const router = express.Router();
const db = require("../database");

// Listar formas de pagamento ativas
router.get("/", async (req, res) => {
  try {
    const [formas] = await db.query(`
      SELECT
        id,
        nome,
        tipo,
        taxa_percentual,
        prazo_recebimento,
        ordem_exibicao,
        online
      FROM formas_pagamento
      WHERE ativo = 1
      ORDER BY ordem_exibicao ASC, nome ASC
    `);

    return res.json({
      formasPagamento: formas,
    });
  } catch (erro) {
    console.error("Erro ao listar formas de pagamento:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível carregar as formas de pagamento.",
    });
  }
});

module.exports = router;
