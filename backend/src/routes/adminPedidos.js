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
  "cartao",
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

      LEFT JOIN usuarios u
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

    if (status) {
      sql += " AND p.status = ?";
      parametros.push(status);
    }

    if (pagamento) {
      sql += " AND pg.forma_pagamento = ?";
      parametros.push(pagamento);
    }

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

    if (dataInicio) {
      sql += " AND p.data_pedido >= ?";
      parametros.push(`${dataInicio} 00:00:00`);
    }

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
// LISTAR INTENÇÕES PIX PENDENTES
// ======================================================

router.get("/pix/intencoes", async (req, res) => {
  try {
    const [intencoes] = await db.query(`
      SELECT
        i.id,
        i.codigo_referencia,
        i.usuario_id,
        i.endereco_id,
        i.tipo_entrega,
        i.subtotal,
        i.taxa_entrega,
        i.desconto,
        i.total,
        i.observacoes,
        i.status,
        i.criado_em,
        i.expira_em,

        u.nome AS cliente_nome,
        u.email AS cliente_email,
        u.telefone AS cliente_telefone,

        i.endereco_rua,
i.endereco_numero,
i.endereco_bairro,
i.endereco_cidade,
        e.rua,
        e.numero,
        e.bairro,
        e.cidade,
        e.complemento

      FROM intencoes_pix i

      LEFT JOIN usuarios u
  ON u.id = i.usuario_id

      LEFT JOIN enderecos e
        ON e.id = i.endereco_id

      WHERE i.status = 'pendente'
        AND i.expira_em > NOW()

      ORDER BY i.criado_em ASC
    `);

    if (intencoes.length === 0) {
      return res.json([]);
    }

    const ids = intencoes.map((item) => item.id);
    const placeholders = ids.map(() => "?").join(",");

    const [itens] = await db.query(
      `
        SELECT
          id,
          intencao_pix_id,
          produto_id,
          nome_produto,
          quantidade,
          preco_unitario,
          subtotal,
          personalizacao

        FROM itens_intencao_pix

        WHERE intencao_pix_id IN (${placeholders})

        ORDER BY id ASC
      `,
      ids,
    );

    const itensPorIntencao = new Map();

    for (const item of itens) {
      if (!itensPorIntencao.has(item.intencao_pix_id)) {
        itensPorIntencao.set(item.intencao_pix_id, []);
      }

      itensPorIntencao.get(item.intencao_pix_id).push(item);
    }

    return res.json(
      intencoes.map((intencao) => ({
        ...intencao,
        itens: itensPorIntencao.get(intencao.id) || [],
      })),
    );
  } catch (erro) {
    console.error("Erro ao listar intenções PIX:", erro);

    return res.status(500).json({
      mensagem: "Erro ao carregar intenções PIX.",
    });
  }
});

// ======================================================
// DETALHES DE UMA INTENÇÃO PIX
// ======================================================

router.get("/pix/intencoes/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        mensagem: "ID da intenção PIX inválido.",
      });
    }

    const [intencoes] = await db.query(
      `

SELECT
  i.*,

   u.nome AS cliente_nome,
  u.email AS cliente_email,
  u.telefone AS cliente_telefone,

  COALESCE(e.rua, i.endereco_rua) AS rua,
  COALESCE(e.numero, i.endereco_numero) AS numero,
  COALESCE(e.bairro, i.endereco_bairro) AS bairro,
  COALESCE(e.cidade, i.endereco_cidade) AS cidade,
  e.complemento

FROM intencoes_pix i

LEFT JOIN usuarios u
  ON u.id = i.usuario_id

LEFT JOIN enderecos e
  ON e.id = i.endereco_id

WHERE i.id = ?
LIMIT 1

      `,
      [id],
    );

    if (intencoes.length === 0) {
      return res.status(404).json({
        mensagem: "Intenção PIX não encontrada.",
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

        FROM itens_intencao_pix

        WHERE intencao_pix_id = ?

        ORDER BY id ASC
      `,
      [id],
    );

    return res.json({
      intencao: intencoes[0],
      itens,
    });
  } catch (erro) {
    console.error("Erro ao consultar intenção PIX:", erro);

    return res.status(500).json({
      mensagem: "Erro ao carregar detalhes da intenção PIX.",
    });
  }
});

// ======================================================
// APROVAR INTENÇÃO PIX E CRIAR PEDIDO OFICIAL
// ======================================================

router.post("/pix/intencoes/:id/aprovar", async (req, res) => {
  const id = Number(req.params.id);
  const administradorId = Number(req.usuario?.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      mensagem: "ID da intenção PIX inválido.",
    });
  }

  if (!Number.isInteger(administradorId) || administradorId <= 0) {
    return res.status(401).json({
      mensagem: "Administrador não identificado.",
    });
  }

  let conexao;
  let transacaoAberta = false;

  try {
    conexao = await db.getConnection();

    await conexao.beginTransaction();
    transacaoAberta = true;

    // BLOQUEIA A INTENÇÃO PARA EVITAR APROVAÇÕES DUPLICADAS
    const [intencoes] = await conexao.query(
      `
        SELECT *
        FROM intencoes_pix
        WHERE id = ?
        FOR UPDATE
      `,
      [id],
    );

    if (intencoes.length === 0) {
      await conexao.rollback();
      transacaoAberta = false;

      return res.status(404).json({
        mensagem: "Intenção PIX não encontrada.",
      });
    }

    const intencao = intencoes[0];

    if (intencao.status === "aprovado") {
      await conexao.rollback();
      transacaoAberta = false;

      if (!intencao.pedido_id) {
        console.error(
          `[PIX] Intenção ${id} está aprovada, mas não possui pedido vinculado.`,
        );

        return res.status(409).json({
          mensagem:
            "A intenção consta como aprovada, mas não possui um pedido vinculado. É necessária uma verificação administrativa.",
          status: "aprovado",
        });
      }

      return res.status(200).json({
        mensagem: "Esta intenção PIX já foi aprovada anteriormente.",
        intencao_pix_id: id,
        pedido_id: intencao.pedido_id,
        status: "aprovado",
        ja_aprovada: true,
      });
    }

    if (intencao.status !== "pendente") {
      await conexao.rollback();
      transacaoAberta = false;

      return res.status(409).json({
        mensagem: "Esta intenção PIX não está mais pendente.",
        status: intencao.status,
      });
    }

    // CONFERE A EXPIRAÇÃO DIRETAMENTE NO BANCO
    const [validade] = await conexao.query(
      `
        SELECT expira_em > NOW() AS dentro_do_prazo
        FROM intencoes_pix
        WHERE id = ?
      `,
      [id],
    );

    if (validade.length === 0 || Number(validade[0].dentro_do_prazo) !== 1) {
      await conexao.query(
        `
          UPDATE intencoes_pix
          SET status = 'expirado'
          WHERE id = ?
            AND status = 'pendente'
        `,
        [id],
      );

      await conexao.commit();
      transacaoAberta = false;

      return res.status(410).json({
        mensagem: "O prazo desta intenção PIX expirou.",
        status: "expirado",
      });
    }

    // BUSCA OS ITENS REGISTRADOS NA CRIAÇÃO DA INTENÇÃO
    const [itens] = await conexao.query(
      `
        SELECT
          produto_id,
          nome_produto,
          quantidade,
          preco_unitario,
          subtotal,
          personalizacao

        FROM itens_intencao_pix

        WHERE intencao_pix_id = ?

        ORDER BY id ASC
      `,
      [id],
    );

    if (itens.length === 0) {
      await conexao.rollback();
      transacaoAberta = false;

      return res.status(409).json({
        mensagem: "Esta intenção PIX não possui itens.",
      });
    }

    /*
      A aprovação só deve ser realizada após a conferência
      do recebimento diretamente no extrato bancário.

      Uma imagem de comprovante, isoladamente, não confirma
      que o dinheiro foi recebido.
    */

    if (!intencao.usuario_id) {
      await conexao.rollback();
      transacaoAberta = false;

      return res.status(409).json({
        mensagem:
          "Esta intenção PIX não pertence a um cliente cadastrado e não pode ser aprovada.",
      });
    }

    // CRIA O PEDIDO OFICIAL
    const [resultadoPedido] = await conexao.query(
      `
        INSERT INTO pedidos (
          usuario_id,
          endereco_id,
          endereco_rua,
          endereco_numero,
          endereco_bairro,
          endereco_cidade,
          data_pedido,
          status,
          tipo_entrega,
          subtotal,
          taxa_entrega,
          desconto,
          total,
          observacoes
        )
        VALUES (?, ?, ?, ?, ?, ?, NOW(), 'novo', ?, ?, ?, ?, ?, ?)
      `,
      [
        intencao.usuario_id,
        intencao.endereco_id,
        intencao.endereco_rua,
        intencao.endereco_numero,
        intencao.endereco_bairro,
        intencao.endereco_cidade,
        intencao.tipo_entrega,
        intencao.subtotal,
        intencao.taxa_entrega,
        intencao.desconto,
        intencao.total,
        intencao.observacoes,
      ],
    );

    const pedidoId = resultadoPedido.insertId;

    // COPIA OS ITENS PARA O PEDIDO OFICIAL
    for (const item of itens) {
      await conexao.query(
        `
          INSERT INTO itens_pedido (
            pedido_id,
            produto_id,
            nome_produto,
            quantidade,
            preco_unitario,
            subtotal,
            personalizacao
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          pedidoId,
          item.produto_id,
          item.nome_produto,
          item.quantidade,
          item.preco_unitario,
          item.subtotal,
          item.personalizacao,
        ],
      );
    }

    // REGISTRA O PAGAMENTO PIX COMO APROVADO
    const [resultadoPagamento] = await conexao.query(
      `
        INSERT INTO pagamentos (
          pedido_id,
          forma_pagamento,
          valor,
          status,
          data_pagamento,
          expira_em
        )
        VALUES (?, 'pix', ?, 'aprovado', NOW(), NULL)
      `,
      [pedidoId, intencao.total],
    );

    const pagamentoId = resultadoPagamento.insertId;

    // HISTÓRICO DO PEDIDO
    await conexao.query(
      `
        INSERT INTO historico_pedidos (
          pedido_id,
          usuario_id,
          status_anterior,
          status_novo,
          data_alteracao
        )
        VALUES (?, ?, NULL, 'novo', NOW())
      `,
      [pedidoId, administradorId],
    );

    // HISTÓRICO DO PAGAMENTO
    await conexao.query(
      `
        INSERT INTO historico_pagamentos (
          pagamento_id,
          pedido_id,
          usuario_id,
          status_anterior,
          status_novo
        )
        VALUES (?, ?, ?, 'pendente', 'aprovado')
      `,
      [pagamentoId, pedidoId, administradorId],
    );

    // VINCULA A INTENÇÃO AO PEDIDO CRIADO
    const [resultadoIntencao] = await conexao.query(
      `
        UPDATE intencoes_pix

        SET
          status = 'aprovado',
          aprovado_em = NOW(),
          aprovado_por = ?,
          pedido_id = ?

        WHERE id = ?
          AND status = 'pendente'
          AND expira_em > NOW()
      `,
      [administradorId, pedidoId, id],
    );

    if (resultadoIntencao.affectedRows !== 1) {
      throw new Error(
        "Não foi possível atualizar a intenção PIX. A aprovação foi cancelada.",
      );
    }

    // NOTIFICA O CLIENTE

    // NOTIFICA O CLIENTE SOMENTE SE FOR CADASTRADO
    if (intencao.usuario_id !== null) {
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
        `,
        [
          intencao.usuario_id,
          pedidoId,
          "pix_aprovado",
          "Pagamento PIX confirmado",
          `Seu pagamento foi confirmado. O pedido #${pedidoId} foi criado.`,
        ],
      );
    }

    await conexao.commit();
    transacaoAberta = false;

    return res.status(201).json({
      mensagem: "PIX confirmado e pedido criado com sucesso.",
      intencao_pix_id: id,
      pedido_id: pedidoId,
      pagamento_id: pagamentoId,
      status: "aprovado",
    });
  } catch (erro) {
    if (conexao && transacaoAberta) {
      try {
        await conexao.rollback();
      } catch (erroRollback) {
        console.error("Erro ao desfazer aprovação PIX:", erroRollback);
      }
    }

    console.error("Erro ao aprovar intenção PIX:", erro);

    return res.status(500).json({
      mensagem: "Erro ao aprovar intenção PIX.",
    });
  } finally {
    if (conexao) {
      conexao.release();
    }
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
  let transacaoAberta = false;

  try {
    conexao = await db.getConnection();

    await conexao.beginTransaction();
    transacaoAberta = true;

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
      transacaoAberta = false;

      return res.status(404).json({
        mensagem: "Pedido não encontrado.",
      });
    }

    const pedido = pedidos[0];
    const statusAnterior = pedido.status;

    if (statusAnterior === status) {
      await conexao.rollback();
      transacaoAberta = false;

      return res.status(400).json({
        mensagem: "O pedido já possui esse status.",
      });
    }

    if (statusAnterior === "cancelado" || statusAnterior === "concluido") {
      await conexao.rollback();
      transacaoAberta = false;

      return res.status(409).json({
        mensagem: "Não é possível alterar um pedido finalizado ou cancelado.",
      });
    }

    if (status === "saiu_para_entrega" && pedido.tipo_entrega !== "entrega") {
      await conexao.rollback();
      transacaoAberta = false;

      return res.status(400).json({
        mensagem: "Pedidos para retirada não podem sair para entrega.",
      });
    }

    // BLOQUEIA O AVANÇO CASO EXISTA UM PAGAMENTO PIX PENDENTE
    if (
      ["em_preparo", "pronto", "saiu_para_entrega", "concluido"].includes(
        status,
      )
    ) {
      const [pixPendente] = await conexao.query(
        `
          SELECT id
          FROM pagamentos
          WHERE pedido_id = ?
            AND forma_pagamento = 'pix'
            AND status = 'pendente'
          ORDER BY id DESC
          LIMIT 1
          FOR UPDATE
        `,
        [id],
      );

      if (pixPendente.length > 0) {
        await conexao.rollback();
        transacaoAberta = false;

        return res.status(409).json({
          mensagem:
            "O pedido possui um PIX pendente. Confirme o recebimento antes de avançar.",
        });
      }
    }

    // EXIGE PAGAMENTO APROVADO ANTES DE CONCLUIR
    if (status === "concluido") {
      const [pagamentos] = await conexao.query(
        `
          SELECT id, status, forma_pagamento
          FROM pagamentos
          WHERE pedido_id = ?
          ORDER BY id DESC
          LIMIT 1
          FOR UPDATE
        `,
        [id],
      );

      if (pagamentos.length === 0 || pagamentos[0].status !== "aprovado") {
        await conexao.rollback();
        transacaoAberta = false;

        return res.status(409).json({
          mensagem: "Não é possível concluir o pedido sem pagamento aprovado.",
        });
      }
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
      [id, Number(req.usuario.id), statusAnterior, status],
    );

    await conexao.commit();
    transacaoAberta = false;

    return res.json({
      mensagem: "Status do pedido atualizado com sucesso.",
      pedido_id: id,
      status_anterior: statusAnterior,
      status_novo: status,
    });
  } catch (erro) {
    if (conexao && transacaoAberta) {
      try {
        await conexao.rollback();
      } catch (erroRollback) {
        console.error("Erro ao desfazer alteração de status:", erroRollback);
      }
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

// ======================================================
// CONFIRMAR RECEBIMENTO DE PAGAMENTO PRESENCIAL
// ======================================================

router.patch("/:id/pagamento", async (req, res) => {
  const id = Number(req.params.id);
  const administradorId = Number(req.usuario?.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      mensagem: "ID do pedido inválido.",
    });
  }

  if (!Number.isInteger(administradorId) || administradorId <= 0) {
    return res.status(401).json({
      mensagem: "Administrador não identificado.",
    });
  }

  let conexao;
  let transacaoAberta = false;

  try {
    conexao = await db.getConnection();

    await conexao.beginTransaction();
    transacaoAberta = true;

    const [pedidos] = await conexao.query(
      `
        SELECT
          id,
          status
        FROM pedidos
        WHERE id = ?
        FOR UPDATE
      `,
      [id],
    );

    if (pedidos.length === 0) {
      await conexao.rollback();
      transacaoAberta = false;

      return res.status(404).json({
        mensagem: "Pedido não encontrado.",
      });
    }

    const pedido = pedidos[0];

    const [pagamentos] = await conexao.query(
      `
        SELECT
          id,
          forma_pagamento,
          status
        FROM pagamentos
        WHERE pedido_id = ?
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [id],
    );

    if (pagamentos.length === 0) {
      await conexao.rollback();
      transacaoAberta = false;

      return res.status(404).json({
        mensagem: "Pagamento não encontrado para este pedido.",
      });
    }

    const pagamento = pagamentos[0];

    // PIX SÓ PODE SER APROVADO PELA ROTA DE INTENÇÕES PIX
    if (pagamento.forma_pagamento === "pix") {
      await conexao.rollback();
      transacaoAberta = false;

      return res.status(403).json({
        mensagem:
          "Pagamentos PIX devem ser confirmados pela aprovação da intenção PIX.",
      });
    }

    if (pagamento.status === "aprovado") {
      await conexao.rollback();
      transacaoAberta = false;

      return res.status(409).json({
        mensagem: "Este pagamento já foi aprovado.",
      });
    }

    if (pagamento.status !== "pendente") {
      await conexao.rollback();
      transacaoAberta = false;

      return res.status(409).json({
        mensagem: "Somente pagamentos pendentes podem ser confirmados.",
      });
    }

    const formasPresenciais = ["dinheiro", "cartao", "credito", "debito"];

    if (!formasPresenciais.includes(pagamento.forma_pagamento)) {
      await conexao.rollback();
      transacaoAberta = false;

      return res.status(403).json({
        mensagem:
          "Esta forma de pagamento não pode ser aprovada manualmente por esta rota.",
      });
    }

    if (!["pronto", "saiu_para_entrega"].includes(pedido.status)) {
      await conexao.rollback();
      transacaoAberta = false;

      return res.status(409).json({
        mensagem:
          "O pagamento presencial só pode ser confirmado quando o pedido estiver pronto ou em entrega.",
      });
    }

    const [resultadoPagamento] = await conexao.query(
      `
        UPDATE pagamentos
        SET
          status = 'aprovado',
          data_pagamento = NOW()
        WHERE id = ?
          AND status = 'pendente'
      `,
      [pagamento.id],
    );

    if (resultadoPagamento.affectedRows !== 1) {
      await conexao.rollback();
      transacaoAberta = false;

      return res.status(409).json({
        mensagem:
          "O pagamento não pode ser atualizado. Consulte o status atual.",
      });
    }

    await conexao.query(
      `
        INSERT INTO historico_pagamentos (
          pagamento_id,
          pedido_id,
          usuario_id,
          status_anterior,
          status_novo
        )
        VALUES (?, ?, ?, 'pendente', 'aprovado')
      `,
      [pagamento.id, id, administradorId],
    );

    await conexao.commit();
    transacaoAberta = false;

    return res.json({
      mensagem: "Recebimento do pagamento confirmado com sucesso.",
      pedido_id: id,
      pagamento_id: pagamento.id,
      forma_pagamento: pagamento.forma_pagamento,
      status: "aprovado",
    });
  } catch (erro) {
    if (conexao && transacaoAberta) {
      try {
        await conexao.rollback();
      } catch (erroRollback) {
        console.error(
          "Erro ao desfazer confirmação de pagamento:",
          erroRollback,
        );
      }
    }

    console.error("Erro ao confirmar pagamento:", erro);

    return res.status(500).json({
      mensagem: "Erro ao confirmar recebimento do pagamento.",
    });
  } finally {
    if (conexao) {
      conexao.release();
    }
  }
});

module.exports = router;
