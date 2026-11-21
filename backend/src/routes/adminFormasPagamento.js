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

// ======================================================
// UTILITÁRIOS
// ======================================================

function validarId(valor) {
  const id = Number(valor);

  return Number.isInteger(id) && id > 0 ? id : null;
}

function converterBooleano(valor, padrao = false) {
  if (valor === undefined || valor === null) {
    return padrao;
  }

  if (typeof valor === "boolean") {
    return valor;
  }

  if (valor === 1 || valor === "1" || valor === "true") {
    return true;
  }

  if (valor === 0 || valor === "0" || valor === "false") {
    return false;
  }

  return null;
}

function validarDados(body) {
  const nome = String(body.nome || "").trim();
  const tipo = String(body.tipo || "")
    .trim()
    .toLowerCase();

  const taxa = Number(body.taxa_percentual ?? 0);
  const prazo = Number(body.prazo_recebimento ?? 0);
  const ordem = Number(body.ordem_exibicao ?? 0);

  const ativo = converterBooleano(body.ativo, true);
  const online = converterBooleano(body.online, false);

  if (!nome || nome.length > 50) {
    return {
      erro: "Informe um nome com até 50 caracteres.",
    };
  }

  if (!TIPOS_PERMITIDOS.includes(tipo)) {
    return {
      erro: "Tipo de pagamento inválido.",
    };
  }

  if (
    !Number.isFinite(taxa) ||
    taxa < 0 ||
    taxa > 100 ||
    Math.round(taxa * 100) !== taxa * 100
  ) {
    return {
      erro: "A taxa percentual deve estar entre 0 e 100, com até duas casas decimais.",
    };
  }

  if (!Number.isSafeInteger(prazo) || prazo < 0) {
    return {
      erro: "O prazo de recebimento deve ser um número inteiro igual ou superior a zero.",
    };
  }

  if (!Number.isSafeInteger(ordem)) {
    return {
      erro: "A ordem de exibição deve ser um número inteiro.",
    };
  }

  if (ativo === null || online === null) {
    return {
      erro: "Os campos de situação e pagamento online são inválidos.",
    };
  }

  return {
    dados: {
      nome,
      tipo,
      taxa_percentual: taxa.toFixed(2),
      prazo_recebimento: prazo,
      ordem_exibicao: ordem,
      ativo: ativo ? 1 : 0,
      online: online ? 1 : 0,
    },
  };
}

async function verificarNomeDuplicado(nome, id = null) {
  let sql = `
    SELECT id
    FROM formas_pagamento
    WHERE LOWER(nome) = LOWER(?)
  `;

  const parametros = [nome];

  if (id !== null) {
    sql += " AND id <> ?";
    parametros.push(id);
  }

  sql += " LIMIT 1";

  const [resultado] = await db.query(sql, parametros);

  return resultado.length > 0;
}

// ======================================================
// LISTAR FORMAS DE PAGAMENTO
// GET /api/admin/pagamentos
// ======================================================

router.get("/", async (req, res) => {
  try {
    const busca = String(req.query.busca || "").trim();
    const filtroAtivo = req.query.ativo;

    let sql = `
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
      WHERE 1 = 1
    `;

    const parametros = [];

    if (busca) {
      sql += " AND nome LIKE ?";
      parametros.push(`%${busca}%`);
    }

    if (filtroAtivo === "1" || filtroAtivo === "0") {
      sql += " AND ativo = ?";
      parametros.push(Number(filtroAtivo));
    }

    sql += `
      ORDER BY ordem_exibicao ASC, nome ASC
    `;

    const [formasPagamento] = await db.query(sql, parametros);

    return res.json({
      formasPagamento,
    });
  } catch (erro) {
    console.error("Erro ao listar formas de pagamento:", erro);

    return res.status(500).json({
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
        mensagem: validacao.erro,
      });
    }

    const dados = validacao.dados;

    if (await verificarNomeDuplicado(dados.nome)) {
      return res.status(409).json({
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
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

    const [formas] = await db.query(
      `
        SELECT *
        FROM formas_pagamento
        WHERE id = ?
        LIMIT 1
      `,
      [resultado.insertId],
    );

    return res.status(201).json({
      mensagem: "Forma de pagamento cadastrada com sucesso.",
      formaPagamento: formas[0],
    });
  } catch (erro) {
    console.error("Erro ao cadastrar forma de pagamento:", erro);

    return res.status(500).json({
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
    const id = validarId(req.params.id);

    if (!id) {
      return res.status(400).json({
        mensagem: "ID de forma de pagamento inválido.",
      });
    }

    const validacao = validarDados(req.body);

    if (validacao.erro) {
      return res.status(400).json({
        mensagem: validacao.erro,
      });
    }

    const dados = validacao.dados;

    const [existentes] = await db.query(
      `
        SELECT id
        FROM formas_pagamento
        WHERE id = ?
        LIMIT 1
      `,
      [id],
    );

    if (!existentes.length) {
      return res.status(404).json({
        mensagem: "Forma de pagamento não encontrada.",
      });
    }

    if (await verificarNomeDuplicado(dados.nome, id)) {
      return res.status(409).json({
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

    const [formas] = await db.query(
      `
        SELECT *
        FROM formas_pagamento
        WHERE id = ?
        LIMIT 1
      `,
      [id],
    );

    return res.json({
      mensagem: "Forma de pagamento atualizada com sucesso.",
      formaPagamento: formas[0],
    });
  } catch (erro) {
    console.error("Erro ao atualizar forma de pagamento:", erro);

    return res.status(500).json({
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
    const id = validarId(req.params.id);

    if (!id) {
      return res.status(400).json({
        mensagem: "ID de forma de pagamento inválido.",
      });
    }

    const [existentes] = await db.query(
      `
        SELECT id, nome
        FROM formas_pagamento
        WHERE id = ?
        LIMIT 1
      `,
      [id],
    );

    if (!existentes.length) {
      return res.status(404).json({
        mensagem: "Forma de pagamento não encontrada.",
      });
    }

    await db.query(
      `
        DELETE FROM formas_pagamento
        WHERE id = ?
      `,
      [id],
    );

    return res.json({
      mensagem: "Forma de pagamento excluída com sucesso.",
    });
  } catch (erro) {
    console.error("Erro ao excluir forma de pagamento:", erro);

    return res.status(500).json({
      mensagem: "Erro ao excluir a forma de pagamento.",
    });
  }
});

module.exports = router;
