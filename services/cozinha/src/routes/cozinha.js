"use strict";

const express = require("express");
const router = express.Router();

const db = require("../database");
const autenticarCozinha = require("../../../_shared/autenticar")(["cozinha"]);
const { consultarUsuarios } = require("../../../_shared/auth-client");

const STATUS_COZINHA = ["novo", "em_preparo", "pronto"];

router.use(autenticarCozinha);

// ======================================================
// AUTENTICAÇÃO DA COZINHA
// ======================================================

// ======================================================
// LISTAR PEDIDOS DA COZINHA
// ======================================================

router.get("/", async (req, res) => {
  try {
    const [pedidos] = await db.query(
      `
        SELECT
          p.id,
          p.usuario_id,
          p.data_pedido,
          p.status,
          p.tipo_entrega,
          p.observacoes

        FROM pedidos p

        WHERE p.status IN ('novo', 'em_preparo', 'pronto')

        ORDER BY
          FIELD(p.status, 'novo', 'em_preparo', 'pronto'),
          p.data_pedido ASC,
          p.id ASC
      `,
    );

    if (pedidos.length === 0) {
      return res.json([]);
    }

    const perfis = await consultarUsuarios(pedidos.map((pedido) => pedido.usuario_id).filter(Boolean));
    const nomesPorUsuario = new Map(perfis.map((usuario) => [Number(usuario.id), usuario.nome]));
    for (const pedido of pedidos) {
      pedido.cliente_nome = nomesPorUsuario.get(Number(pedido.usuario_id)) || "Cliente não informado";
    }

    const ids = pedidos.map((pedido) => pedido.id);
    const placeholders = ids.map(() => "?").join(",");

    const [itens] = await db.query(
      `
        SELECT
          id,
          pedido_id,
          produto_id,
          nome_produto,
          quantidade,
          personalizacao

        FROM itens_pedido

        WHERE pedido_id IN (${placeholders})

        ORDER BY id ASC
      `,
      ids,
    );

    const itensPorPedido = {};

    for (const item of itens) {
      if (!itensPorPedido[item.pedido_id]) {
        itensPorPedido[item.pedido_id] = [];
      }

      itensPorPedido[item.pedido_id].push(item);
    }

    const resultado = pedidos.map((pedido) => ({
      ...pedido,
      itens: itensPorPedido[pedido.id] || [],
    }));

    return res.json(resultado);
  } catch (erro) {
    console.error("Erro ao listar pedidos da cozinha:", erro);

    return res.status(500).json({
      mensagem: "Erro ao carregar pedidos da cozinha.",
    });
  }
});

// ======================================================
// DETALHES DE UM PEDIDO
// ======================================================

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        mensagem: "ID do pedido inválido.",
      });
    }

    const [pedidos] = await db.query(
      `
        SELECT
          p.id,
          p.usuario_id,
          p.data_pedido,
          p.status,
          p.tipo_entrega,
          p.observacoes

        FROM pedidos p

        WHERE p.id = ?
          AND p.status IN ('novo', 'em_preparo', 'pronto')

        LIMIT 1
      `,
      [id],
    );

    if (pedidos.length === 0) {
      return res.status(404).json({
        mensagem: "Pedido não encontrado na fila da cozinha.",
      });
    }

    const [perfil] = await consultarUsuarios([pedidos[0].usuario_id]);
    pedidos[0].cliente_nome = perfil?.nome || "Cliente não informado";

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

    return res.json({
      pedido: pedidos[0],
      itens,
    });
  } catch (erro) {
    console.error("Erro ao consultar pedido da cozinha:", erro);

    return res.status(500).json({
      mensagem: "Erro ao carregar os detalhes do pedido.",
    });
  }
});

// ======================================================
// ALTERAR STATUS DO PREPARO
// ======================================================

router.patch("/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      mensagem: "ID do pedido inválido.",
    });
  }

  if (!STATUS_COZINHA.includes(status)) {
    return res.status(400).json({
      mensagem: "Status inválido para a cozinha.",
    });
  }

  let conexao;
  let transacaoFinalizada = false;

  try {
    conexao = await db.getConnection();

    await conexao.beginTransaction();

    const [pedidos] = await conexao.query(
      `
        SELECT id, usuario_id, status, tipo_entrega
        FROM pedidos
        WHERE id = ?
        FOR UPDATE
      `,
      [id],
    );

    if (pedidos.length === 0) {
      await conexao.rollback();
      transacaoFinalizada = true;

      return res.status(404).json({
        mensagem: "Pedido não encontrado.",
      });
    }

    const pedido = pedidos[0];
    const statusAnterior = pedido.status;

    // SOMENTE NOVO -> EM PREPARO -> PRONTO

    const transicoesPermitidas = {
      novo: "em_preparo",
      em_preparo: "pronto",
    };

    if (transicoesPermitidas[statusAnterior] !== status) {
      await conexao.rollback();
      transacaoFinalizada = true;

      return res.status(409).json({
        mensagem: "Transição de status não permitida.",
        status_atual: statusAnterior,
        status_solicitado: status,
      });
    }

    await conexao.query(
      `
        UPDATE pedidos
        SET status = ?
        WHERE id = ?
      `,
      [status, id],
    );

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

    // ==================================================
    // CRIAR NOTIFICAÇÃO PARA O CLIENTE
    // ==================================================

    const notificacao = {
      usuarioId: pedido.usuario_id,
      pedidoId: id,
      tipo: status === "em_preparo" ? "pedido_em_preparo" : "pedido_pronto",
      titulo:
        status === "em_preparo"
          ? "Pedido em preparo"
          : pedido.tipo_entrega === "retirada"
            ? "Pedido pronto para retirada"
            : "Pedido pronto",
      mensagem:
        status === "em_preparo"
          ? `Seu pedido #${id} começou a ser preparado.`
          : pedido.tipo_entrega === "retirada"
            ? `Seu pedido #${id} está pronto! Você já pode retirá-lo em nosso estabelecimento.`
            : `Seu pedido #${id} está pronto e aguardando a próxima etapa.`,
    };

    await conexao.query(
      `
        INSERT INTO notificacoes (
          usuario_id,
          pedido_id,
          tipo,
          titulo,
          mensagem,
          lida,
          data_criacao
        )
        VALUES (?, ?, ?, ?, ?, 0, NOW())

        ON DUPLICATE KEY UPDATE
          titulo = VALUES(titulo),
          mensagem = VALUES(mensagem),
          lida = 0,
          data_criacao = NOW()
      `,
      [
        notificacao.usuarioId,
        notificacao.pedidoId,
        notificacao.tipo,
        notificacao.titulo,
        notificacao.mensagem,
      ],
    );

    await conexao.commit();
    transacaoFinalizada = true;

    // ==================================================
    // ENVIAR NOTIFICAÇÃO AO CLIENTE EM TEMPO REAL
    // ==================================================

    try {
      const websocket = req.app.locals.websocket;

      if (websocket && typeof websocket.emitirParaUsuario === "function") {
        websocket.emitirParaUsuario(notificacao.usuarioId, {
          tipo: "notificacao_criada",
          notificacao: {
            id: null,
            pedido_id: notificacao.pedidoId,
            tipo: notificacao.tipo,
            titulo: notificacao.titulo,
            mensagem: notificacao.mensagem,
            lida: 0,
            data_criacao: new Date().toISOString(),
          },
        });
      }
    } catch (erroWebSocket) {
      console.error("Erro ao enviar notificação ao cliente:", erroWebSocket);
    }

    // ==================================================
    // NOTIFICAR ATENDENTE E ADMINISTRADOR
    // ==================================================

    try {
      const websocket = req.app.locals.websocket;

      if (websocket && typeof websocket.emitirParaTipos === "function") {
        websocket.emitirParaTipos(["atendente", "admin"], {
          evento: "pedido_atualizado",
          pedidoId: id,
          statusAnterior,
          status,
          mensagem:
            status === "em_preparo"
              ? `O pedido #${id} começou a ser preparado.`
              : `O pedido #${id} está pronto.`,
        });
      }
    } catch (erroWebSocket) {
      console.error(
        "Erro ao notificar os painéis sobre a atualização da cozinha:",
        erroWebSocket,
      );
    }

    return res.json({
      mensagem: "Status do pedido atualizado com sucesso.",
      pedido_id: id,
      status_anterior: statusAnterior,
      status_novo: status,
      notificacao_cliente: {
        tipo: notificacao.tipo,
        titulo: notificacao.titulo,
      },
    });
  } catch (erro) {
    if (conexao && !transacaoFinalizada) {
      try {
        await conexao.rollback();
      } catch (erroRollback) {
        console.error("Erro ao desfazer transação:", erroRollback);
      }
    }

    console.error("Erro ao atualizar pedido da cozinha:", erro);

    return res.status(500).json({
      mensagem: "Erro ao atualizar o status do pedido.",
    });
  } finally {
    if (conexao) {
      conexao.release();
    }
  }
});

module.exports = router;
