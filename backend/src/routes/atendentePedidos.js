"use strict";

const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../database");

const router = express.Router();

const TIPOS_PERMITIDOS = ["atendente", "admin"];

const STATUS_VALIDOS = [
  "novo",
  "em_preparo",
  "pronto",
  "saiu_para_entrega",
  "concluido",
  "cancelado",
];

// ======================================================
// AUTENTICAÇÃO E AUTORIZAÇÃO
// ======================================================

function lerCookie(req, nome) {
  const cookies = req.headers.cookie || "";

  const cookie = cookies
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${nome}=`));

  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.substring(nome.length + 1));
  } catch {
    return null;
  }
}

async function autenticarAtendente(req, res, next) {
  const token = lerCookie(req, "fraga_session");

  if (!token) {
    return res.status(401).json({
      mensagem: "Você precisa fazer login.",
    });
  }

  try {
    const usuarioToken = jwt.verify(token, process.env.JWT_SECRET);

    const [usuarios] = await db.query(
      `SELECT id, nome, email, tipo, ativo
       FROM usuarios
       WHERE id = ?
       LIMIT 1`,
      [usuarioToken.id],
    );

    if (!usuarios.length || !usuarios[0].ativo) {
      return res.status(401).json({
        mensagem: "Usuário não encontrado ou inativo.",
      });
    }

    const usuario = usuarios[0];

    if (!TIPOS_PERMITIDOS.includes(usuario.tipo)) {
      return res.status(403).json({
        mensagem: "Acesso permitido somente para atendentes e administradores.",
      });
    }

    req.usuario = usuario;

    return next();
  } catch (erro) {
    if (
      erro.name === "JsonWebTokenError" ||
      erro.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        mensagem: "Sessão inválida ou expirada.",
      });
    }

    console.error("Erro na autenticação do atendente:", erro);

    return res.status(500).json({
      mensagem: "Erro ao verificar autenticação.",
    });
  }
}

router.use(autenticarAtendente);

// ======================================================
// RESUMO DOS PEDIDOS
// ======================================================

router.get("/resumo", async (req, res) => {
  try {
    const [resultado] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'novo' THEN 1 ELSE 0 END) AS novos,
        SUM(CASE WHEN status = 'em_preparo' THEN 1 ELSE 0 END) AS em_preparo,
        SUM(CASE WHEN status = 'pronto' THEN 1 ELSE 0 END) AS prontos,
        SUM(CASE
          WHEN status = 'saiu_para_entrega' THEN 1
          ELSE 0
        END) AS saiu_para_entrega,
        SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END) AS concluidos,
        SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END) AS cancelados
      FROM pedidos
      WHERE DATE(data_pedido) = CURDATE()
    `);

    const dados = resultado[0];

    return res.json({
      total: Number(dados.total || 0),
      novos: Number(dados.novos || 0),
      emPreparo: Number(dados.em_preparo || 0),
      prontos: Number(dados.prontos || 0),
      saiuParaEntrega: Number(dados.saiu_para_entrega || 0),
      concluidos: Number(dados.concluidos || 0),
      cancelados: Number(dados.cancelados || 0),
    });
  } catch (erro) {
    console.error("Erro ao carregar resumo do atendente:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível carregar o resumo dos pedidos.",
    });
  }
});

// ======================================================
// LISTAR PEDIDOS
// ======================================================

router.get("/", async (req, res) => {
  try {
    const status = String(req.query.status || "").trim();
    const busca = String(req.query.busca || "")
      .trim()
      .slice(0, 100);

    if (status && !STATUS_VALIDOS.includes(status)) {
      return res.status(400).json({
        mensagem: "Filtro de status inválido.",
      });
    }

    const parametros = [];
    const condicoes = [];

    if (status) {
      condicoes.push("p.status = ?");
      parametros.push(status);
    }

    if (busca) {
      const termoId = Number(busca);

      if (Number.isInteger(termoId) && termoId > 0) {
        condicoes.push("(p.id = ? OR u.nome LIKE ?)");
        parametros.push(termoId, `%${busca}%`);
      } else {
        condicoes.push("u.nome LIKE ?");
        parametros.push(`%${busca}%`);
      }
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";

    const [pedidos] = await db.query(
      `
        SELECT
          p.id,
          p.data_pedido,
          p.status,
          p.tipo_entrega,
          p.subtotal,
          p.taxa_entrega,
          p.desconto,
          p.total,
          p.observacoes,

          u.id AS cliente_id,
          u.nome AS cliente_nome,
          u.telefone AS cliente_telefone,

          pg.forma_pagamento,
          pg.status AS status_pagamento,

          e.rua,
          e.numero,
          e.bairro,
          e.cidade,
          e.complemento,

          (
            SELECT COALESCE(SUM(ip.quantidade), 0)
            FROM itens_pedido ip
            WHERE ip.pedido_id = p.id
          ) AS quantidade_itens

        FROM pedidos p

        INNER JOIN usuarios u
          ON u.id = p.usuario_id

        LEFT JOIN pagamentos pg
          ON pg.pedido_id = p.id

        LEFT JOIN enderecos e
          ON e.id = p.endereco_id

        ${where}

        ORDER BY
          CASE
            WHEN p.status = 'novo' THEN 1
            WHEN p.status = 'em_preparo' THEN 2
            WHEN p.status = 'pronto' THEN 3
            WHEN p.status = 'saiu_para_entrega' THEN 4
            ELSE 5
          END,
          p.data_pedido DESC
      `,
      parametros,
    );

    return res.json(pedidos);
  } catch (erro) {
    console.error("Erro ao listar pedidos do atendente:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível carregar os pedidos.",
    });
  }
});

// ======================================================
// CONSULTAR DETALHES DE UM PEDIDO
// ======================================================

router.get("/:id", async (req, res) => {
  try {
    const pedidoId = Number(req.params.id);

    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({
        mensagem: "ID de pedido inválido.",
      });
    }

    const [pedidos] = await db.query(
      `
        SELECT
          p.id,
          p.data_pedido,
          p.status,
          p.tipo_entrega,
          p.subtotal,
          p.taxa_entrega,
          p.desconto,
          p.total,
          p.observacoes,

          u.id AS cliente_id,
          u.nome AS cliente_nome,
          u.email AS cliente_email,
          u.telefone AS cliente_telefone,

          pg.forma_pagamento,
          pg.status AS status_pagamento,

          e.rua,
          e.numero,
          e.bairro,
          e.cidade,
          e.complemento

        FROM pedidos p

        INNER JOIN usuarios u
          ON u.id = p.usuario_id

        LEFT JOIN pagamentos pg
          ON pg.pedido_id = p.id

        LEFT JOIN enderecos e
          ON e.id = p.endereco_id

        WHERE p.id = ?
        LIMIT 1
      `,
      [pedidoId],
    );

    if (!pedidos.length) {
      return res.status(404).json({
        mensagem: "Pedido não encontrado.",
      });
    }

    const [itens] = await db.query(
      `
        SELECT
          id,
          produto_id,
          nome_produto,
          quantidade,
          preco_unitario,
          subtotal,
          personalizacao
        FROM itens_pedido
        WHERE pedido_id = ?
        ORDER BY id ASC
      `,
      [pedidoId],
    );

    const [historico] = await db.query(
      `
        SELECT
          h.status_anterior,
          h.status_novo,
          h.data_alteracao,
          u.nome AS responsavel
        FROM historico_pedidos h
        LEFT JOIN usuarios u
          ON u.id = h.usuario_id
        WHERE h.pedido_id = ?
        ORDER BY h.data_alteracao ASC
      `,
      [pedidoId],
    );

    return res.json({
      pedido: pedidos[0],
      itens,
      historico,
    });
  } catch (erro) {
    console.error("Erro ao consultar pedido do atendente:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível consultar os detalhes do pedido.",
    });
  }
});

module.exports = router;
