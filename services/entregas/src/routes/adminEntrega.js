"use strict";

const express = require("express");
const router = express.Router();

const db = require("../database");
const autenticarAdmin = require("../middleware/autenticarAdmin");

router.use(autenticarAdmin);

// ======================================================
// FUNÇÕES AUXILIARES
// ======================================================

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function validarValorMonetario(valor, campo) {
  if (
    valor === undefined ||
    valor === null ||
    valor === "" ||
    !Number.isFinite(Number(valor)) ||
    Number(valor) < 0
  ) {
    throw new Error(
      `${campo} deve ser um valor numérico maior ou igual a zero.`,
    );
  }

  const centavos = Math.round(Number(valor) * 100);

  if (!Number.isSafeInteger(centavos)) {
    throw new Error(`${campo} possui um valor inválido.`);
  }

  return centavos;
}

function validarTempo(valor) {
  const tempo = Number(valor);

  if (!Number.isInteger(tempo) || tempo < 1 || tempo > 1440) {
    throw new Error(
      "O tempo médio deve ser um número inteiro entre 1 e 1440 minutos.",
    );
  }

  return tempo;
}

function validarNomeBairro(valor) {
  if (typeof valor !== "string") {
    throw new Error("Informe o nome do bairro.");
  }

  const nome = valor.trim().replace(/\s+/g, " ");

  if (nome.length < 2 || nome.length > 100) {
    throw new Error("O nome do bairro deve ter entre 2 e 100 caracteres.");
  }

  return nome;
}

function converterDinheiro(valorCentavos) {
  return (valorCentavos / 100).toFixed(2);
}

function responderErro(res, erro, mensagemPadrao) {
  console.error(mensagemPadrao, erro);

  if (erro.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      mensagem: "Já existe um bairro cadastrado com esse nome.",
    });
  }

  if (
    (erro.message && erro.message.startsWith("Informe")) ||
    (erro.message &&
      (erro.message.includes("deve ser") ||
        erro.message.includes("O nome") ||
        erro.message.includes("Informe")))
  ) {
    return res.status(400).json({
      mensagem: erro.message,
    });
  }

  return res.status(500).json({
    mensagem: mensagemPadrao,
  });
}

// ======================================================
// CARREGAR CONFIGURAÇÕES E BAIRROS
// GET /api/admin/entrega
// ======================================================

router.get("/", async (req, res) => {
  try {
    const [configuracoes] = await db.query(`
      SELECT
        id,
        taxa_padrao,
        valor_minimo,
        tempo_medio_minutos,
        atualizado_em
      FROM configuracoes_entrega
      WHERE id = 1
      LIMIT 1
    `);

    if (!configuracoes.length) {
      return res.status(500).json({
        mensagem:
          "As configurações de entrega ainda não foram inicializadas no banco.",
      });
    }

    const [bairros] = await db.query(`
      SELECT
        id,
        nome,
        taxa_final,
        ativo,
        criado_em,
        atualizado_em
      FROM bairros_entrega
      ORDER BY nome ASC
    `);

    return res.json({
      configuracoes: configuracoes[0],
      bairros,
    });
  } catch (erro) {
    console.error("Erro ao carregar configurações de entrega:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível carregar as configurações de entrega.",
    });
  }
});

// ======================================================
// SALVAR CONFIGURAÇÕES GERAIS
// PUT /api/admin/entrega/configuracoes
// ======================================================

router.put("/configuracoes", async (req, res) => {
  try {
    const taxaPadraoCentavos = validarValorMonetario(
      req.body.taxa_padrao,
      "Taxa padrão",
    );

    const valorMinimoCentavos = validarValorMonetario(
      req.body.valor_minimo,
      "Valor mínimo",
    );

    const tempoMedio = validarTempo(req.body.tempo_medio_minutos);

    await db.query(
      `
        INSERT INTO configuracoes_entrega (
          id,
          taxa_padrao,
          valor_minimo,
          tempo_medio_minutos
        )
        VALUES (1, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          taxa_padrao = VALUES(taxa_padrao),
          valor_minimo = VALUES(valor_minimo),
          tempo_medio_minutos = VALUES(tempo_medio_minutos)
      `,
      [
        converterDinheiro(taxaPadraoCentavos),
        converterDinheiro(valorMinimoCentavos),
        tempoMedio,
      ],
    );

    const [resultado] = await db.query(`
      SELECT
        id,
        taxa_padrao,
        valor_minimo,
        tempo_medio_minutos,
        atualizado_em
      FROM configuracoes_entrega
      WHERE id = 1
      LIMIT 1
    `);

    return res.json({
      mensagem: "Configurações de entrega salvas com sucesso.",
      configuracoes: resultado[0],
    });
  } catch (erro) {
    return responderErro(
      res,
      erro,
      "Não foi possível salvar as configurações de entrega.",
    );
  }
});

// ======================================================
// CADASTRAR BAIRRO
// POST /api/admin/entrega/bairros
// ======================================================

router.post("/bairros", async (req, res) => {
  try {
    const nome = validarNomeBairro(req.body.nome);

    const taxaCentavos = validarValorMonetario(
      req.body.taxa_final,
      "Taxa do bairro",
    );

    const ativo =
      req.body.ativo === undefined
        ? true
        : req.body.ativo === true ||
          req.body.ativo === 1 ||
          req.body.ativo === "1";

    const [existentes] = await db.query(`SELECT id, nome FROM bairros_entrega`);

    const nomeNormalizado = normalizarTexto(nome);

    const duplicado = existentes.some(
      (bairro) => normalizarTexto(bairro.nome) === nomeNormalizado,
    );

    if (duplicado) {
      return res.status(409).json({
        mensagem: "Já existe um bairro cadastrado com esse nome.",
      });
    }

    const [resultado] = await db.query(
      `
        INSERT INTO bairros_entrega (
          nome,
          taxa_final,
          ativo
        )
        VALUES (?, ?, ?)
      `,
      [nome, converterDinheiro(taxaCentavos), ativo],
    );

    const [novoBairro] = await db.query(
      `
        SELECT id, nome, taxa_final, ativo, criado_em, atualizado_em
        FROM bairros_entrega
        WHERE id = ?
        LIMIT 1
      `,
      [resultado.insertId],
    );

    return res.status(201).json({
      mensagem: "Bairro cadastrado com sucesso.",
      bairro: novoBairro[0],
    });
  } catch (erro) {
    return responderErro(res, erro, "Não foi possível cadastrar o bairro.");
  }
});

// ======================================================
// EDITAR BAIRRO
// PUT /api/admin/entrega/bairros/:id
// ======================================================

router.put("/bairros/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        mensagem: "ID do bairro inválido.",
      });
    }

    const nome = validarNomeBairro(req.body.nome);

    const taxaCentavos = validarValorMonetario(
      req.body.taxa_final,
      "Taxa do bairro",
    );

    if (
      typeof req.body.ativo !== "boolean" &&
      req.body.ativo !== 0 &&
      req.body.ativo !== 1 &&
      req.body.ativo !== "0" &&
      req.body.ativo !== "1"
    ) {
      return res.status(400).json({
        mensagem: "Informe se o bairro está ativo ou inativo.",
      });
    }

    const ativo =
      req.body.ativo === true || req.body.ativo === 1 || req.body.ativo === "1";

    const [bairros] = await db.query(
      `
        SELECT id, nome
        FROM bairros_entrega
        WHERE id = ?
        LIMIT 1
      `,
      [id],
    );

    if (!bairros.length) {
      return res.status(404).json({
        mensagem: "Bairro não encontrado.",
      });
    }

    const [existentes] = await db.query(
      `
        SELECT id, nome
        FROM bairros_entrega
        WHERE id <> ?
      `,
      [id],
    );

    const nomeNormalizado = normalizarTexto(nome);

    const duplicado = existentes.some(
      (bairro) => normalizarTexto(bairro.nome) === nomeNormalizado,
    );

    if (duplicado) {
      return res.status(409).json({
        mensagem: "Já existe outro bairro cadastrado com esse nome.",
      });
    }

    await db.query(
      `
        UPDATE bairros_entrega
        SET
          nome = ?,
          taxa_final = ?,
          ativo = ?
        WHERE id = ?
      `,
      [nome, converterDinheiro(taxaCentavos), ativo, id],
    );

    const [atualizado] = await db.query(
      `
        SELECT id, nome, taxa_final, ativo, criado_em, atualizado_em
        FROM bairros_entrega
        WHERE id = ?
        LIMIT 1
      `,
      [id],
    );

    return res.json({
      mensagem: "Bairro atualizado com sucesso.",
      bairro: atualizado[0],
    });
  } catch (erro) {
    return responderErro(res, erro, "Não foi possível atualizar o bairro.");
  }
});

// ======================================================
// EXCLUIR BAIRRO
// DELETE /api/admin/entrega/bairros/:id
// ======================================================

router.delete("/bairros/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        mensagem: "ID do bairro inválido.",
      });
    }

    const [bairros] = await db.query(
      `
        SELECT id, nome
        FROM bairros_entrega
        WHERE id = ?
        LIMIT 1
      `,
      [id],
    );

    if (!bairros.length) {
      return res.status(404).json({
        mensagem: "Bairro não encontrado.",
      });
    }

    await db.query(`DELETE FROM bairros_entrega WHERE id = ?`, [id]);

    return res.json({
      mensagem: `Bairro "${bairros[0].nome}" excluído com sucesso.`,
    });
  } catch (erro) {
    console.error("Erro ao excluir bairro:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível excluir o bairro.",
    });
  }
});

module.exports = router;
