"use strict";

const express = require("express");
const router = express.Router();

const db = require("../database");
const autenticarEntregador = require("../middleware/autenticarEntregador");
const { parsePhoneNumberFromString } = require("libphonenumber-js/max");

router.use(autenticarEntregador);

// ======================================================
// WEBSOCKET
// ======================================================

function emitirEventoCliente(req, clienteId, evento) {
  try {
    const websocket = req.app.locals.websocket;

    if (!websocket || typeof websocket.emitirParaUsuario !== "function") {
      console.warn("[WebSocket] Serviço indisponível para emitir evento.");
      return;
    }

    websocket.emitirParaUsuario(clienteId, evento);
  } catch (erro) {
    // Uma falha no WebSocket não deve desfazer uma operação já confirmada.
    console.error("[WebSocket] Erro ao emitir evento:", erro);
  }
}

// ======================================================
// NOTIFICAR ATENDENTE E ADMINISTRADOR
// ======================================================

function emitirEventoEquipe(req, evento) {
  try {
    const websocket = req.app.locals.websocket;

    if (!websocket || typeof websocket.emitirParaTipos !== "function") {
      console.warn("[WebSocket] Serviço indisponível para notificar equipe.");
      return;
    }

    websocket.emitirParaTipos(["atendente", "admin"], evento);
  } catch (erro) {
    console.error("[WebSocket] Erro ao notificar equipe:", erro);
  }
}

// ======================================================
// PERFIL
// ======================================================

router.get("/perfil", async (req, res) => {
  try {
    const [usuarios] = await db.query(
      `SELECT id, nome, email, telefone, tipo, data_cadastro
       FROM usuarios
       WHERE id = ? AND tipo = 'entregador' AND ativo = 1
       LIMIT 1`,
      [req.usuario.id],
    );

    if (!usuarios.length) {
      return res.status(404).json({
        mensagem: "Entregador não encontrado.",
      });
    }

    return res.json({ usuario: usuarios[0] });
  } catch (erro) {
    console.error("Erro ao carregar perfil:", erro);

    return res.status(500).json({
      mensagem: "Erro ao carregar perfil.",
    });
  }
});

router.patch("/perfil", async (req, res) => {
  try {
    const nome = String(req.body.nome || "").trim();
    const telefone = String(req.body.telefone || "").trim();

    if (nome.length < 2 || nome.length > 100) {
      return res.status(400).json({
        mensagem: "O nome deve ter entre 2 e 100 caracteres.",
      });
    }

    let telefoneNormalizado = null;
    if (telefone) {
      const parsed = parsePhoneNumberFromString(
        telefone,
        telefone.startsWith("+") ? undefined : "BR",
      );
      if (
        !parsed ||
        !parsed.isValid() ||
        parsed.number.replace(/\D/g, "").length > 15 ||
        (parsed.country === "BR" && parsed.nationalNumber.length !== 11)
      ) {
        return res.status(400).json({
          mensagem: "Número inválido. Confira o DDD e o código do país.",
        });
      }
      telefoneNormalizado = parsed.number;
    }

    const [usuarios] = await db.query(
      `SELECT id
       FROM usuarios
       WHERE id = ? AND tipo = 'entregador' AND ativo = 1
       LIMIT 1`,
      [req.usuario.id],
    );

    if (!usuarios.length) {
      return res.status(404).json({
        mensagem: "Entregador não encontrado.",
      });
    }

    await db.query(
      `UPDATE usuarios
       SET nome = ?, telefone = ?
       WHERE id = ? AND tipo = 'entregador' AND ativo = 1`,
      [nome, telefoneNormalizado, req.usuario.id],
    );

    const [atualizado] = await db.query(
      `SELECT id, nome, email, telefone, tipo, data_cadastro
       FROM usuarios
       WHERE id = ?
       LIMIT 1`,
      [req.usuario.id],
    );

    return res.json({
      mensagem: "Perfil atualizado com sucesso.",
      usuario: atualizado[0],
    });
  } catch (erro) {
    console.error("Erro ao atualizar perfil:", erro);

    return res.status(500).json({
      mensagem: "Erro ao atualizar perfil.",
    });
  }
});

// ======================================================
// LISTAR ENTREGAS DO ENTREGADOR AUTENTICADO
// ======================================================

router.get("/entregas", async (req, res) => {
  try {
    const [entregas] = await db.query(
      `SELECT
          e.id AS entrega_id,
          e.status AS status_entrega,
          e.data_saida,
          e.data_entrega,
          e.data_confirmacao_recebimento,

          p.id AS pedido_id,
          p.status AS status_pedido,
          p.data_pedido,
          p.tipo_entrega,
          p.subtotal,
          p.taxa_entrega,
          p.desconto,
          p.total,
          p.observacoes,

          u.nome AS cliente_nome,
          u.telefone AS cliente_telefone,

          en.rua,
          en.numero,
          en.bairro,
          en.cidade,
          en.complemento

       FROM entregas e

       INNER JOIN pedidos p
          ON p.id = e.pedido_id

       INNER JOIN usuarios u
          ON u.id = p.usuario_id

       LEFT JOIN enderecos en
          ON en.id = p.endereco_id

       WHERE e.entregador_id = ?

       ORDER BY
          CASE
            WHEN e.status = 'em_andamento' THEN 1
            WHEN e.status = 'atribuida' THEN 2
            WHEN e.status = 'pendente' THEN 3
            WHEN e.status = 'entregue' THEN 4
            ELSE 5
          END,
          e.id DESC`,
      [req.usuario.id],
    );

    if (!entregas.length) {
      return res.json({ entregas: [] });
    }

    const idsPedidos = entregas.map((entrega) => entrega.pedido_id);
    const placeholders = idsPedidos.map(() => "?").join(",");

    const [itens] = await db.query(
      `SELECT
          pedido_id,
          nome_produto,
          quantidade,
          preco_unitario,
          subtotal,
          personalizacao
       FROM itens_pedido
       WHERE pedido_id IN (${placeholders})
       ORDER BY id ASC`,
      idsPedidos,
    );

    const entregasComItens = entregas.map((entrega) => ({
      ...entrega,
      itens: itens.filter((item) => item.pedido_id === entrega.pedido_id),
    }));

    return res.json({
      entregas: entregasComItens,
    });
  } catch (erro) {
    console.error("Erro ao listar entregas:", erro);

    return res.status(500).json({
      mensagem: "Erro ao carregar entregas.",
    });
  }
});

// ======================================================
// INICIAR ENTREGA
// ======================================================

router.patch("/entregas/:id/iniciar", async (req, res) => {
  const entregaId = Number(req.params.id);

  if (!Number.isInteger(entregaId) || entregaId <= 0) {
    return res.status(400).json({
      mensagem: "Identificador de entrega inválido.",
    });
  }

  let conexao;
  let transacaoFinalizada = false;

  try {
    conexao = await db.getConnection();
    await conexao.beginTransaction();

    const [entregas] = await conexao.query(
      `SELECT
          e.id,
          e.pedido_id,
          e.status AS status_entrega,
          p.usuario_id AS cliente_id,
          p.status AS status_pedido
       FROM entregas e
       INNER JOIN pedidos p ON p.id = e.pedido_id
       WHERE e.id = ?
         AND e.entregador_id = ?
       FOR UPDATE`,
      [entregaId, req.usuario.id],
    );

    if (!entregas.length) {
      await conexao.rollback();
      transacaoFinalizada = true;

      return res.status(404).json({
        mensagem: "Entrega não encontrada ou não atribuída a você.",
      });
    }

    const entrega = entregas[0];

    if (entrega.status_entrega !== "atribuida") {
      await conexao.rollback();
      transacaoFinalizada = true;

      return res.status(400).json({
        mensagem: "Esta entrega não está disponível para início.",
      });
    }

    if (entrega.status_pedido !== "pronto") {
      await conexao.rollback();
      transacaoFinalizada = true;

      return res.status(400).json({
        mensagem: "O pedido ainda não está pronto para sair.",
      });
    }

    const [resultadoEntrega] = await conexao.query(
      `UPDATE entregas
       SET status = 'em_andamento',
           data_saida = NOW()
       WHERE id = ?
         AND entregador_id = ?
         AND status = 'atribuida'`,
      [entregaId, req.usuario.id],
    );

    if (resultadoEntrega.affectedRows !== 1) {
      await conexao.rollback();
      transacaoFinalizada = true;

      return res.status(409).json({
        mensagem: "Não foi possível iniciar esta entrega. Atualize o painel.",
      });
    }

    const [resultadoPedido] = await conexao.query(
      `UPDATE pedidos
       SET status = 'saiu_para_entrega'
       WHERE id = ?
         AND status = 'pronto'`,
      [entrega.pedido_id],
    );

    if (resultadoPedido.affectedRows !== 1) {
      await conexao.rollback();
      transacaoFinalizada = true;

      return res.status(409).json({
        mensagem: "O status do pedido foi alterado. Atualize o painel.",
      });
    }

    await conexao.query(
      `INSERT INTO historico_pedidos
       (pedido_id, usuario_id, status_anterior, status_novo, data_alteracao)
       VALUES (?, ?, ?, ?, NOW())`,
      [
        entrega.pedido_id,
        req.usuario.id,
        entrega.status_pedido,
        "saiu_para_entrega",
      ],
    );

    await conexao.commit();
    transacaoFinalizada = true;

    // Evento emitido somente depois da confirmação da transação.
    // Notifica o cliente.
    emitirEventoCliente(req, entrega.cliente_id, {
      evento: "pedido_atualizado",
      pedidoId: entrega.pedido_id,
      status: "saiu_para_entrega",
      mensagem: `Seu pedido #${entrega.pedido_id} saiu para entrega.`,
    });

    // Notifica atendente e administrador.
    emitirEventoEquipe(req, {
      evento: "pedido_atualizado",
      pedidoId: entrega.pedido_id,
      status: "saiu_para_entrega",
      mensagem: `O pedido #${entrega.pedido_id} saiu para entrega.`,
    });

    return res.json({
      mensagem: "Entrega iniciada com sucesso.",
    });
  } catch (erro) {
    if (conexao && !transacaoFinalizada) {
      try {
        await conexao.rollback();
      } catch (erroRollback) {
        console.error("Erro ao desfazer transação:", erroRollback);
      }
    }

    console.error("Erro ao iniciar entrega:", erro);

    return res.status(500).json({
      mensagem: "Erro ao iniciar entrega.",
    });
  } finally {
    if (conexao) conexao.release();
  }
});

// ======================================================
// ENTREGADOR INFORMA QUE REALIZOU A ENTREGA
// ======================================================

router.patch("/entregas/:id/finalizar", async (req, res) => {
  const entregaId = Number(req.params.id);

  if (!Number.isInteger(entregaId) || entregaId <= 0) {
    return res.status(400).json({
      mensagem: "Identificador de entrega inválido.",
    });
  }

  let conexao;
  let transacaoFinalizada = false;

  try {
    conexao = await db.getConnection();
    await conexao.beginTransaction();

    const [entregas] = await conexao.query(
      `SELECT
          e.id,
          e.pedido_id,
          e.status AS status_entrega,
          p.usuario_id AS cliente_id,
          p.status AS status_pedido
       FROM entregas e
       INNER JOIN pedidos p ON p.id = e.pedido_id
       WHERE e.id = ?
         AND e.entregador_id = ?
       FOR UPDATE`,
      [entregaId, req.usuario.id],
    );

    if (!entregas.length) {
      await conexao.rollback();
      transacaoFinalizada = true;

      return res.status(404).json({
        mensagem: "Entrega não encontrada ou não atribuída a você.",
      });
    }

    const entrega = entregas[0];

    if (entrega.status_entrega !== "em_andamento") {
      await conexao.rollback();
      transacaoFinalizada = true;

      return res.status(400).json({
        mensagem: "Esta entrega não está em andamento.",
      });
    }

    if (entrega.status_pedido !== "saiu_para_entrega") {
      await conexao.rollback();
      transacaoFinalizada = true;

      return res.status(400).json({
        mensagem: "O status do pedido não permite finalizar a entrega.",
      });
    }

    // Registra que o entregador informou a realização da entrega.
    const [resultadoEntrega] = await conexao.query(
      `UPDATE entregas
       SET status = 'entregue',
           data_entrega = NOW()
       WHERE id = ?
         AND entregador_id = ?
         AND status = 'em_andamento'`,
      [entregaId, req.usuario.id],
    );

    if (resultadoEntrega.affectedRows !== 1) {
      await conexao.rollback();
      transacaoFinalizada = true;

      return res.status(409).json({
        mensagem: "Não foi possível registrar a entrega. Atualize o painel.",
      });
    }

    // Cria uma notificação persistente para o cliente.
    // Não sobrescreve uma notificação que já exista.
    await conexao.query(
      `INSERT INTO notificacoes
       (usuario_id, pedido_id, tipo, titulo, mensagem)
       VALUES (?, ?, 'entrega_informada', ?, ?)
       ON DUPLICATE KEY UPDATE
          id = id`,
      [
        entrega.cliente_id,
        entrega.pedido_id,
        "Entrega realizada",
        `O entregador informou que o pedido #${entrega.pedido_id} foi entregue. Confirme o recebimento no seu painel.`,
      ],
    );

    // O pedido permanece como saiu_para_entrega.
    // Somente o cliente poderá confirmar o recebimento.

    await conexao.commit();
    transacaoFinalizada = true;

    // Notifica o cliente.
    emitirEventoCliente(req, entrega.cliente_id, {
      evento: "entrega_informada",
      pedidoId: entrega.pedido_id,
      statusEntrega: "entregue",
      statusPedido: "saiu_para_entrega",
      mensagem: `O entregador informou que o pedido #${entrega.pedido_id} foi entregue. Confirme o recebimento.`,
    });

    // Notifica atendente e administrador.
    emitirEventoEquipe(req, {
      evento: "entrega_informada",
      pedidoId: entrega.pedido_id,
      statusEntrega: "entregue",
      statusPedido: "saiu_para_entrega",
      mensagem: `O entregador informou que o pedido #${entrega.pedido_id} foi entregue.`,
    });

    return res.json({
      mensagem:
        "Entrega registrada. O cliente foi notificado para confirmar o recebimento.",
    });
  } catch (erro) {
    if (conexao && !transacaoFinalizada) {
      try {
        await conexao.rollback();
      } catch (erroRollback) {
        console.error("Erro ao desfazer transação:", erroRollback);
      }
    }

    console.error("Erro ao registrar entrega:", erro);

    return res.status(500).json({
      mensagem: "Erro ao registrar a entrega.",
    });
  } finally {
    if (conexao) conexao.release();
  }
});


// ======================================================
// FINANCEIRO DO ENTREGADOR
// ======================================================
// A remuneração é fixa em R$ 7,00 e só é contabilizada
// depois que o cliente confirma o recebimento do pedido.
router.get("/financeiro", async (req, res) => {
  try {
    const valorPorEntrega = 7.00;

    const [resumo] = await db.query(
      `SELECT
          COUNT(*) AS quantidade_entregas,
          COALESCE(COUNT(*) * ?, 0.00) AS total_ganho
       FROM entregas e
       INNER JOIN pedidos p
          ON p.id = e.pedido_id
       WHERE e.entregador_id = ?
         AND e.status = 'entregue'
         AND e.data_confirmacao_recebimento IS NOT NULL
         AND p.status = 'concluido'`,
      [valorPorEntrega, req.usuario.id],
    );

    const [historico] = await db.query(
      `SELECT
          e.id AS entrega_id,
          p.id AS pedido_id,
          e.data_confirmacao_recebimento AS data_conclusao,
          ? AS valor_ganho
       FROM entregas e
       INNER JOIN pedidos p
          ON p.id = e.pedido_id
       WHERE e.entregador_id = ?
         AND e.status = 'entregue'
         AND e.data_confirmacao_recebimento IS NOT NULL
         AND p.status = 'concluido'
       ORDER BY e.data_confirmacao_recebimento DESC, e.id DESC`,
      [valorPorEntrega, req.usuario.id],
    );

    return res.json({
      valorPorEntrega,
      quantidadeEntregas: Number(resumo[0]?.quantidade_entregas || 0),
      totalGanho: Number(resumo[0]?.total_ganho || 0),
      historico,
    });
  } catch (erro) {
    console.error("Erro ao carregar financeiro do entregador:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível carregar seu financeiro.",
    });
  }
});

module.exports = router;
