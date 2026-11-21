"use strict";

const express = require("express");
const router = express.Router();

const db = require("../database");
const autenticarAdmin = require("../middleware/autenticarAdmin");

router.use(autenticarAdmin);

const STATUS_VALIDOS = [
  "novo",
  "em_preparo",
  "pronto",
  "saiu_para_entrega",
  "concluido",
  "cancelado",
];

const FORMAS_PAGAMENTO = [
  "pix",
  "dinheiro",
  "credito",
  "debito",
  "boleto",
  "outro",
];

function validarData(data) {
  if (typeof data !== "string") {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return false;
  }

  const [ano, mes, dia] = data.split("-").map(Number);
  const dataObj = new Date(Date.UTC(ano, mes - 1, dia));

  return (
    dataObj.getUTCFullYear() === ano &&
    dataObj.getUTCMonth() === mes - 1 &&
    dataObj.getUTCDate() === dia
  );
}

// ======================================================
// LISTAR PEDIDOS
// ======================================================

router.get("/", async (req, res) => {
  try {
    const { busca, status, pagamento, dataInicio, dataFim } = req.query;

    if (status && !STATUS_VALIDOS.includes(status)) {
      return res.status(400).json({
        mensagem: "Status inválido.",
      });
    }

    if (pagamento && !FORMAS_PAGAMENTO.includes(pagamento)) {
      return res.status(400).json({
        mensagem: "Forma de pagamento inválida.",
      });
    }

    if (dataInicio && !validarData(dataInicio)) {
      return res.status(400).json({
        mensagem: "Data inicial inválida.",
      });
    }

    if (dataFim && !validarData(dataFim)) {
      return res.status(400).json({
        mensagem: "Data final inválida.",
      });
    }

    if (dataInicio && dataFim && dataInicio > dataFim) {
      return res.status(400).json({
        mensagem: "A data inicial não pode ser posterior à data final.",
      });
    }

    let sql = `
            SELECT
                p.id,
                p.usuario_id,
                p.endereco_id,
                p.data_pedido,
                p.status,
                p.tipo_entrega,
                p.subtotal,
                p.taxa_entrega,
                p.desconto,
                p.total,
                p.observacoes,

                u.nome AS cliente_nome,
                u.telefone AS cliente_telefone,

                pg.forma_pagamento,
                pg.tipo_cartao,
                pg.pagamento_status,
                pg.valor AS pagamento_valor,
                pg.codigo_transacao,
                pg.data_pagamento

            FROM pedidos p

            INNER JOIN usuarios u
                ON u.id = p.usuario_id

            LEFT JOIN (
                SELECT
                    pagamento_atual.id,
                    pagamento_atual.pedido_id,
                    pagamento_atual.forma_pagamento,
                    pagamento_atual.tipo_cartao,
                    pagamento_atual.status AS pagamento_status,
                    pagamento_atual.valor,
                    pagamento_atual.codigo_transacao,
                    pagamento_atual.data_pagamento

                FROM pagamentos pagamento_atual

                INNER JOIN (
                    SELECT
                        pedido_id,
                        MAX(id) AS ultimo_id
                    FROM pagamentos
                    GROUP BY pedido_id
                ) ultimo_pagamento
                    ON ultimo_pagamento.ultimo_id = pagamento_atual.id

            ) pg
                ON pg.pedido_id = p.id

            WHERE 1 = 1
        `;

    const parametros = [];

    // FILTRO POR STATUS DO PEDIDO
    if (status) {
      sql += " AND p.status = ?";
      parametros.push(status);
    }

    // FILTRO POR FORMA DE PAGAMENTO
    if (pagamento) {
      sql += " AND pg.forma_pagamento = ?";
      parametros.push(pagamento);
    }

    // BUSCA POR ID, CLIENTE OU TELEFONE
    if (busca && String(busca).trim()) {
      const termo = `%${String(busca).trim()}%`;

      sql += `
                AND (
                    CAST(p.id AS CHAR) LIKE ?
                    OR u.nome LIKE ?
                    OR u.telefone LIKE ?
                )
            `;

      parametros.push(termo, termo, termo);
    }

    // DATA INICIAL
    if (dataInicio) {
      sql += " AND p.data_pedido >= ?";
      parametros.push(`${dataInicio} 00:00:00`);
    }

    // DATA FINAL
    if (dataFim) {
      sql += " AND p.data_pedido < DATE_ADD(?, INTERVAL 1 DAY)";
      parametros.push(dataFim);
    }

    sql += `
            ORDER BY
                p.data_pedido DESC,
                p.id DESC
        `;

    const [pedidos] = await db.query(sql, parametros);

    return res.json(pedidos);
  } catch (erro) {
    console.error("Erro ao listar pedidos:", erro);

    return res.status(500).json({
      mensagem: "Erro ao carregar pedidos.",
    });
  }
});

// ======================================================
// DETALHES DO PEDIDO
// ======================================================

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        mensagem: "ID do pedido inválido.",
      });
    }

    // DADOS PRINCIPAIS DO PEDIDO
    const [pedidos] = await db.query(
      `
            SELECT
                p.*,

                u.nome AS cliente_nome,
                u.email AS cliente_email,
                u.telefone AS cliente_telefone,

                e.rua,
                e.numero,
                e.bairro,
                e.cidade,
                e.complemento

            FROM pedidos p

            INNER JOIN usuarios u
                ON u.id = p.usuario_id

            LEFT JOIN enderecos e
                ON e.id = p.endereco_id

            WHERE p.id = ?
            LIMIT 1
        `,
      [id],
    );

    if (pedidos.length === 0) {
      return res.status(404).json({
        mensagem: "Pedido não encontrado.",
      });
    }

    // ITENS DO PEDIDO
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
      [id],
    );

    // HISTÓRICO COMPLETO DE PAGAMENTOS
    const [pagamentos] = await db.query(
      `
            SELECT
                id,
                pedido_id,
                forma_pagamento,
                tipo_cartao,
                valor,
                status,
                codigo_transacao,
                data_pagamento

            FROM pagamentos

            WHERE pedido_id = ?

            ORDER BY id DESC
        `,
      [id],
    );

    // HISTÓRICO DE ALTERAÇÕES DO PEDIDO
    const [historico] = await db.query(
      `
            SELECT
                h.id,
                h.status_anterior,
                h.status_novo,
                h.data_alteracao,
                u.nome AS usuario_nome

            FROM historico_pedidos h

            LEFT JOIN usuarios u
                ON u.id = h.usuario_id

            WHERE h.pedido_id = ?

            ORDER BY
                h.data_alteracao DESC,
                h.id DESC
        `,
      [id],
    );

    return res.json({
      pedido: pedidos[0],
      itens,
      pagamentos,
      historico,
    });
  } catch (erro) {
    console.error("Erro ao consultar pedido:", erro);

    return res.status(500).json({
      mensagem: "Erro ao carregar detalhes do pedido.",
    });
  }
});

// ======================================================
// ALTERAR STATUS DO PEDIDO
// ======================================================

router.patch("/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      mensagem: "ID do pedido inválido.",
    });
  }

  if (!STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({
      mensagem: "Status inválido.",
    });
  }

  let conexao;

  try {
    conexao = await db.getConnection();

    await conexao.beginTransaction();

    const [pedidos] = await conexao.query(
      `
            SELECT
                id,
                status,
                tipo_entrega

            FROM pedidos

            WHERE id = ?

            FOR UPDATE
        `,
      [id],
    );

    if (pedidos.length === 0) {
      await conexao.rollback();

      return res.status(404).json({
        mensagem: "Pedido não encontrado.",
      });
    }

    const pedido = pedidos[0];
    const statusAnterior = pedido.status;

    // NÃO PERMITE REPETIR O MESMO STATUS
    if (statusAnterior === status) {
      await conexao.rollback();

      return res.status(400).json({
        mensagem: "O pedido já possui esse status.",
      });
    }

    // PEDIDOS FINALIZADOS NÃO PODEM SER ALTERADOS
    if (statusAnterior === "cancelado" || statusAnterior === "concluido") {
      await conexao.rollback();

      return res.status(409).json({
        mensagem: "Não é possível alterar um pedido finalizado ou cancelado.",
      });
    }

    // RETIRADA NÃO PODE SAIR PARA ENTREGA
    if (status === "saiu_para_entrega" && pedido.tipo_entrega !== "entrega") {
      await conexao.rollback();

      return res.status(400).json({
        mensagem: "Pedidos para retirada não podem sair para entrega.",
      });
    }

    // ATUALIZA O PEDIDO
    await conexao.query(
      `
            UPDATE pedidos

            SET status = ?

            WHERE id = ?
        `,
      [status, id],
    );

    // REGISTRA A ALTERAÇÃO NO HISTÓRICO
    await conexao.query(
      `
            INSERT INTO historico_pedidos (
                pedido_id,
                usuario_id,
                status_anterior,
                status_novo,
                data_alteracao
            )

            VALUES (?, ?, ?, ?, NOW())
        `,
      [id, req.usuario.id, statusAnterior, status],
    );

    await conexao.commit();

    return res.json({
      mensagem: "Status do pedido atualizado com sucesso.",
      pedido_id: id,
      status_anterior: statusAnterior,
      status_novo: status,
    });
  } catch (erro) {
    if (conexao) {
      await conexao.rollback();
    }

    console.error("Erro ao alterar status:", erro);

    return res.status(500).json({
      mensagem: "Erro ao atualizar status do pedido.",
    });
  } finally {
    if (conexao) {
      conexao.release();
    }
  }
});

module.exports = router;
