"use strict";

const express = require("express");
const router = express.Router();

const db = require("../database");
const autenticarAdmin = require("../middleware/autenticarAdmin");

router.use(autenticarAdmin);

// ======================================================
// GET /api/admin/dashboard
// ======================================================

router.get("/", async (req, res) => {
  try {
    const [
      [pedidosHoje],
      [faturamentoHoje],
      [pedidosTotal],
      [faturamentoTotal],
      [pedidosEntregues],
      [pedidosPendentes],
      [produtosAtivos],
      [categoriasAtivas],
      [clientesCadastrados],
      [pedidosRecentes],
    ] = await Promise.all([
      // ------------------------------------------------
      // PEDIDOS REALIZADOS HOJE
      // ------------------------------------------------

      db.query(`
        SELECT COUNT(*) AS total
        FROM pedidos
        WHERE data_pedido >= CURDATE()
          AND data_pedido < CURDATE() + INTERVAL 1 DAY
      `),

      // ------------------------------------------------
      // FATURAMENTO DE HOJE
      // Somente pagamentos aprovados.
      // Pedidos cancelados não entram no faturamento.
      // EXISTS evita duplicação caso existam vários
      // registros de pagamento associados ao pedido.
      // ------------------------------------------------

      db.query(`
        SELECT COALESCE(SUM(p.total), 0) AS total
        FROM pedidos p
        WHERE p.data_pedido >= CURDATE()
          AND p.data_pedido < CURDATE() + INTERVAL 1 DAY
          AND p.status <> 'cancelado'
          AND EXISTS (
            SELECT 1
            FROM pagamentos pg
            WHERE pg.pedido_id = p.id
              AND pg.status = 'aprovado'
          )
      `),

      // ------------------------------------------------
      // TOTAL DE PEDIDOS REGISTRADOS
      // ------------------------------------------------
      db.query(`SELECT COUNT(*) AS total FROM pedidos`),

      // FATURAMENTO ACUMULADO: somente pagamentos aprovados.
      db.query(`
        SELECT COALESCE(SUM(p.total), 0) AS total
        FROM pedidos p
        WHERE p.status <> 'cancelado'
          AND EXISTS (
            SELECT 1 FROM pagamentos pg
            WHERE pg.pedido_id = p.id AND pg.status = 'aprovado'
          )
      `),

      // ------------------------------------------------
      // PEDIDOS CONCLUÍDOS
      // ------------------------------------------------

      db.query(`
        SELECT COUNT(*) AS total
        FROM pedidos
        WHERE status = 'concluido'
      `),

      // ------------------------------------------------
      // PEDIDOS PENDENTES / EM ANDAMENTO
      // ------------------------------------------------

      db.query(`
        SELECT COUNT(*) AS total
        FROM pedidos
        WHERE status IN (
          'novo',
          'em_preparo',
          'pronto',
          'saiu_para_entrega'
        )
      `),

      // ------------------------------------------------
      // PRODUTOS DISPONÍVEIS
      // ------------------------------------------------

      db.query(`
        SELECT COUNT(*) AS total
        FROM produtos
        WHERE disponivel = 1
      `),

      // ------------------------------------------------
      // CATEGORIAS ATIVAS
      // ------------------------------------------------

      db.query(`
        SELECT COUNT(*) AS total
        FROM categorias
        WHERE ativo = 1
      `),

      // ------------------------------------------------
      // CLIENTES CADASTRADOS
      // ------------------------------------------------

      db.query(`
        SELECT COUNT(*) AS total
        FROM usuarios
        WHERE tipo = 'cliente'
          AND ativo = 1
      `),

      // ------------------------------------------------
      // ÚLTIMOS 8 PEDIDOS
      // ------------------------------------------------

      db.query(`
        SELECT
          p.id,
          p.data_pedido,
          p.status,
          p.total,
          COALESCE(u.nome, 'Cliente não informado') AS cliente
        FROM pedidos p
        LEFT JOIN usuarios u
          ON u.id = p.usuario_id
        ORDER BY
          p.data_pedido DESC,
          p.id DESC
        LIMIT 8
      `),
    ]);

    // ==================================================
    // RESPOSTA
    // ==================================================

    res.json({
      estatisticas: {
        pedidosHoje: Number(pedidosHoje[0].total || 0),
        faturamentoHoje: Number(faturamentoHoje[0].total || 0),
        pedidosTotal: Number(pedidosTotal[0].total || 0),
        faturamentoTotal: Number(faturamentoTotal[0].total || 0),
        pedidosEntregues: Number(pedidosEntregues[0].total || 0),
        pedidosPendentes: Number(pedidosPendentes[0].total || 0),
        produtosAtivos: Number(produtosAtivos[0].total || 0),
        categorias: Number(categoriasAtivas[0].total || 0),
        clientes: Number(clientesCadastrados[0].total || 0),
      },

      pedidosRecentes,
    });
  } catch (erro) {
    console.error("Erro ao carregar dashboard:", erro);

    res.status(500).json({
      mensagem: "Não foi possível carregar os dados do dashboard.",
    });
  }
});

module.exports = router;
