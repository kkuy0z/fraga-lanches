"use strict";

const express = require("express");
const router = express.Router();

const db = require("../database");
const autenticarAdmin = require("../middleware/autenticarAdmin");

router.use(autenticarAdmin);

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const TIPOS_PERMITIDOS = [
  "dinheiro",
  "credito",
  "debito",
  "pix",
  "boleto",
  "outro",
];

function converterBooleano(valor, padrao = true) {
  if (valor === undefined || valor === null || valor === "") {
    return padrao;
  }

  return (
    valor === true ||
    valor === 1 ||
    valor === "1" ||
    valor === "true" ||
    valor === "on"
  );
}

function validarDados(body) {
  const nome = String(body.nome || "").trim();
  const tipo = String(body.tipo || "").trim();

  const taxa = Number(body.taxa_percentual ?? 0);
  const prazo = Number(body.prazo_recebimento ?? 0);
  const ordem = Number(body.ordem_exibicao ?? 0);

  if (!nome) {
    return { erro: "Informe o nome da forma de pagamento." };
  }

  if (nome.length > 50) {
    return { erro: "O nome deve ter no máximo 50 caracteres." };
  }

  if (!TIPOS_PERMITIDOS.includes(tipo)) {
    return { erro: "Tipo de pagamento inválido." };
  }

  if (!Number.isFinite(taxa) || taxa < 0 || taxa > 100) {
    return { erro: "A taxa deve estar entre 0 e 100." };
  }

  if (!Number.isInteger(prazo) || prazo < 0 || prazo > 3650) {
    return { erro: "O prazo deve ser um número inteiro entre 0 e 3650 dias." };
  }

  if (!Number.isInteger(ordem) || ordem < 0) {
    return { erro: "A ordem de exibição deve ser um número inteiro positivo." };
  }

  return {
    dados: {
      nome,
      tipo,
      taxa_percentual: taxa,
      prazo_recebimento: prazo,
      ordem_exibicao: ordem,
      ativo: converterBooleano(body.ativo),
      online: converterBooleano(body.online, false),
    },
  };
}

// ======================================================
// LISTAR FORMAS DE PAGAMENTO
// GET /api/admin/pagamentos
// ======================================================

router.get("/", async (req, res) => {
  try {
    const [formasPagamento] = await db.query(`
      SELECT
        id,
        nome,
        tipo,
        taxa_percentual,
        prazo_recebimento,
        ordem_exibicao,
        ativo,
        online,
        data_criacao,
        data_atualizacao
      FROM formas_pagamento
      ORDER BY ordem_exibicao ASC, nome ASC
    `);

    return res.json({
      sucesso: true,
      formasPagamento,
    });
  } catch (erro) {
    console.error("[ADMIN PAGAMENTOS] Erro ao listar:", erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao carregar as formas de pagamento.",
    });
  }
});

// ======================================================
// CADASTRAR FORMA DE PAGAMENTO
// POST /api/admin/pagamentos
// ======================================================

router.post("/", async (req, res) => {
  try {
    const validacao = validarDados(req.body);

    if (validacao.erro) {
      return res.status(400).json({
        sucesso: false,
        mensagem: validacao.erro,
      });
    }

    const dados = validacao.dados;

    const [existente] = await db.query(
      `
        SELECT id
        FROM formas_pagamento
        WHERE LOWER(nome) = LOWER(?)
        LIMIT 1
      `,
      [dados.nome],
    );

    if (existente.length > 0) {
      return res.status(409).json({
        sucesso: false,
        mensagem: "Já existe uma forma de pagamento com esse nome.",
      });
    }

    const [resultado] = await db.query(
      `
        INSERT INTO formas_pagamento (
          nome,
          tipo,
          taxa_percentual,
          prazo_recebimento,
          ordem_exibicao,
          ativo,
          online
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        dados.nome,
        dados.tipo,
        dados.taxa_percentual,
        dados.prazo_recebimento,
        dados.ordem_exibicao,
        dados.ativo,
        dados.online,
      ],
    );

    return res.status(201).json({
      sucesso: true,
      mensagem: "Forma de pagamento cadastrada com sucesso.",
      id: resultado.insertId,
    });
  } catch (erro) {
    console.error("[ADMIN PAGAMENTOS] Erro ao cadastrar:", erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao cadastrar a forma de pagamento.",
    });
  }
});

// ======================================================
// EDITAR FORMA DE PAGAMENTO
// PUT /api/admin/pagamentos/:id
// ======================================================

router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "ID da forma de pagamento inválido.",
      });
    }

    const validacao = validarDados(req.body);

    if (validacao.erro) {
      return res.status(400).json({
        sucesso: false,
        mensagem: validacao.erro,
      });
    }

    const dados = validacao.dados;

    const [existente] = await db.query(
      "SELECT id FROM formas_pagamento WHERE id = ? LIMIT 1",
      [id],
    );

    if (existente.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Forma de pagamento não encontrada.",
      });
    }

    const [duplicado] = await db.query(
      `
        SELECT id
        FROM formas_pagamento
        WHERE LOWER(nome) = LOWER(?)
          AND id <> ?
        LIMIT 1
      `,
      [dados.nome, id],
    );

    if (duplicado.length > 0) {
      return res.status(409).json({
        sucesso: false,
        mensagem: "Já existe outra forma de pagamento com esse nome.",
      });
    }

    await db.query(
      `
        UPDATE formas_pagamento
        SET
          nome = ?,
          tipo = ?,
          taxa_percentual = ?,
          prazo_recebimento = ?,
          ordem_exibicao = ?,
          ativo = ?,
          online = ?
        WHERE id = ?
      `,
      [
        dados.nome,
        dados.tipo,
        dados.taxa_percentual,
        dados.prazo_recebimento,
        dados.ordem_exibicao,
        dados.ativo,
        dados.online,
        id,
      ],
    );

    return res.json({
      sucesso: true,
      mensagem: "Forma de pagamento atualizada com sucesso.",
    });
  } catch (erro) {
    console.error("[ADMIN PAGAMENTOS] Erro ao editar:", erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao atualizar a forma de pagamento.",
    });
  }
});

// ======================================================
// EXCLUIR FORMA DE PAGAMENTO
// DELETE /api/admin/pagamentos/:id
// ======================================================

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "ID da forma de pagamento inválido.",
      });
    }

    const [existente] = await db.query(
      "SELECT id FROM formas_pagamento WHERE id = ? LIMIT 1",
      [id],
    );

    if (existente.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Forma de pagamento não encontrada.",
      });
    }

    await db.query("DELETE FROM formas_pagamento WHERE id = ?", [id]);

    return res.json({
      sucesso: true,
      mensagem: "Forma de pagamento excluída com sucesso.",
    });
  } catch (erro) {
    console.error("[ADMIN PAGAMENTOS] Erro ao excluir:", erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao excluir a forma de pagamento.",
    });
  }
});

module.exports = router;
