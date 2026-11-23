"use strict";

const express = require("express");
const db = require("../database");
const authRoutes = require("../../../auth/src/routes/auth");

const router = express.Router();
const autenticar = authRoutes.autenticar;

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const QUANTIDADE_MINIMA = 1;
const QUANTIDADE_MAXIMA = 99;

// ======================================================
// AUTENTICAÇÃO E PERMISSÕES
// ======================================================

function somenteCliente(req, res, next) {
  if (!req.usuario || req.usuario.tipo !== "cliente") {
    return res.status(403).json({
      mensagem: "Acesso permitido somente para clientes.",
    });
  }

  next();
}

if (typeof autenticar !== "function") {
  throw new Error("Middleware autenticar não encontrado em routes/auth.js");
}

router.use(autenticar, somenteCliente);

// ======================================================
// UTILITÁRIOS
// ======================================================

function numeroValido(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function formatarValor(valor) {
  return Number(numeroValido(valor).toFixed(2));
}

function validarQuantidade(valor) {
  const quantidade = Number(valor);

  return (
    Number.isInteger(quantidade) &&
    quantidade >= QUANTIDADE_MINIMA &&
    quantidade <= QUANTIDADE_MAXIMA
  );
}

// ======================================================
// OBTER OU CRIAR CARRINHO
// ======================================================

async function obterCarrinho(usuarioId) {
  await db.execute(
    `INSERT IGNORE INTO carrinhos (usuario_id)
     VALUES (?)`,
    [usuarioId],
  );

  const [carrinhos] = await db.execute(
    `SELECT id
     FROM carrinhos
     WHERE usuario_id = ?
     LIMIT 1`,
    [usuarioId],
  );

  if (!carrinhos.length) {
    throw new Error("Não foi possível obter o carrinho do cliente.");
  }

  return carrinhos[0].id;
}

// ======================================================
// BUSCAR ITENS E ADICIONAIS DO CARRINHO
// ======================================================

async function buscarCarrinho(usuarioId) {
  const carrinhoId = await obterCarrinho(usuarioId);

  const [itens] = await db.execute(
    `SELECT
        ic.id,
        ic.produto_id,
        ic.quantidade,
        p.nome,
        p.descricao,
        p.imagem,
        p.preco,
        p.disponivel
     FROM itens_carrinho ic
     INNER JOIN produtos p
        ON p.id = ic.produto_id
     WHERE ic.carrinho_id = ?
     ORDER BY ic.id DESC`,
    [carrinhoId],
  );

  if (!itens.length) {
    return {
      carrinho_id: carrinhoId,
      quantidade_itens: 0,
      itens: [],
      total: 0,
    };
  }

  const idsItens = itens.map((item) => Number(item.id));
  const placeholders = idsItens.map(() => "?").join(",");

  const [adicionais] = await db.execute(
    `SELECT
        ica.id,
        ica.item_carrinho_id,
        ica.adicional_id,
        ica.nome_adicional AS nome,
        ica.preco
     FROM item_carrinho_adicionais ica
     WHERE ica.item_carrinho_id IN (${placeholders})
     ORDER BY ica.id ASC`,
    idsItens,
  );

  // Organiza os adicionais por item do carrinho.
  const adicionaisPorItem = new Map();

  for (const adicional of adicionais) {
    const itemId = Number(adicional.item_carrinho_id);

    if (!adicionaisPorItem.has(itemId)) {
      adicionaisPorItem.set(itemId, []);
    }

    adicionaisPorItem.get(itemId).push({
      id: adicional.adicional_id,
      nome: adicional.nome,
      preco: formatarValor(adicional.preco),
    });
  }

  let totalCarrinho = 0;
  let quantidadeItens = 0;

  const itensFormatados = itens.map((item) => {
    const quantidade = Number(item.quantidade);
    const precoProduto = numeroValido(item.preco);

    const adicionaisItem = adicionaisPorItem.get(Number(item.id)) || [];

    const totalAdicionais = adicionaisItem.reduce(
      (soma, adicional) => soma + adicional.preco,
      0,
    );

    const precoUnitario = precoProduto + totalAdicionais;
    const subtotal = precoUnitario * quantidade;

    totalCarrinho += subtotal;
    quantidadeItens += quantidade;

    return {
      ...item,
      quantidade,
      preco: formatarValor(precoProduto),
      adicionais: adicionaisItem,
      preco_adicionais: formatarValor(totalAdicionais),
      preco_unitario: formatarValor(precoUnitario),
      subtotal: formatarValor(subtotal),
    };
  });

  return {
    carrinho_id: carrinhoId,
    quantidade_itens: quantidadeItens,
    itens: itensFormatados,
    total: formatarValor(totalCarrinho),
  };
}

// ======================================================
// GET /api/cliente/carrinho
// CONSULTAR CARRINHO
// ======================================================

router.get("/", async (req, res) => {
  try {
    const carrinho = await buscarCarrinho(req.usuario.id);

    return res.json(carrinho);
  } catch (erro) {
    console.error("Erro ao consultar carrinho:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível carregar seu carrinho.",
    });
  }
});

// ======================================================
// POST /api/cliente/carrinho/itens
// ADICIONAR PRODUTO COM ADICIONAIS
// ======================================================

router.post("/itens", async (req, res) => {
  let conexao;
  let transacaoIniciada = false;

  try {
    const produtoId = Number(req.body.produto_id);
    const quantidade = Number(req.body.quantidade ?? 1);

    const adicionaisRecebidos = req.body.adicionais ?? [];

    console.log("\n========== NOVO ITEM NO CARRINHO ==========");
    console.log("Cliente:", req.usuario.id);
    console.log("Produto:", produtoId);
    console.log("Quantidade:", quantidade);
    console.log("Adicionais recebidos:", adicionaisRecebidos);

    // --------------------------------------------------
    // VALIDAR PRODUTO E QUANTIDADE
    // --------------------------------------------------

    if (
      !Number.isInteger(produtoId) ||
      produtoId <= 0 ||
      !validarQuantidade(quantidade)
    ) {
      return res.status(400).json({
        mensagem: "Produto ou quantidade inválidos.",
      });
    }

    // --------------------------------------------------
    // VALIDAR LISTA DE ADICIONAIS
    // --------------------------------------------------

    if (
      !Array.isArray(adicionaisRecebidos) ||
      adicionaisRecebidos.some(
        (id) =>
          (typeof id !== "number" && typeof id !== "string") ||
          String(id).trim() === "" ||
          !Number.isInteger(Number(id)) ||
          Number(id) <= 0,
      )
    ) {
      return res.status(400).json({
        mensagem: "Lista de adicionais inválida.",
      });
    }

    const adicionaisIds = adicionaisRecebidos.map(Number);

    if (new Set(adicionaisIds).size !== adicionaisIds.length) {
      return res.status(400).json({
        mensagem:
          "Não é permitido selecionar o mesmo adicional mais de uma vez.",
      });
    }

    console.log("Adicionais convertidos:", adicionaisIds);

    // --------------------------------------------------
    // VERIFICAR DISPONIBILIDADE DO PRODUTO
    // --------------------------------------------------

    const [produtos] = await db.execute(
      `SELECT
          p.id,
          p.nome,
          p.preco
       FROM produtos p
       INNER JOIN categorias c
          ON c.id = p.categoria_id
       WHERE p.id = ?
         AND p.disponivel = TRUE
         AND c.ativo = TRUE
       LIMIT 1`,
      [produtoId],
    );

    if (!produtos.length) {
      return res.status(404).json({
        mensagem: "Produto indisponível ou não encontrado.",
      });
    }

    // --------------------------------------------------
    // BUSCAR E VALIDAR ADICIONAIS NO BANCO
    // --------------------------------------------------

    let adicionaisValidos = [];

    if (adicionaisIds.length > 0) {
      const placeholders = adicionaisIds.map(() => "?").join(",");

      const [resultadoAdicionais] = await db.execute(
        `SELECT
            a.id,
            a.nome,
            a.preco
         FROM produto_adicionais pa
         INNER JOIN adicionais a
            ON a.id = pa.adicional_id
         WHERE pa.produto_id = ?
           AND a.disponivel = TRUE
           AND a.id IN (${placeholders})`,
        [produtoId, ...adicionaisIds],
      );

      if (resultadoAdicionais.length !== adicionaisIds.length) {
        return res.status(400).json({
          mensagem:
            "Um ou mais adicionais não estão disponíveis para este produto.",
        });
      }

      adicionaisValidos = resultadoAdicionais;

      // Mantém a ordem de seleção feita pelo cliente.
      const mapaAdicionais = new Map(
        adicionaisValidos.map((adicional) => [Number(adicional.id), adicional]),
      );

      adicionaisValidos = adicionaisIds.map((id) => mapaAdicionais.get(id));

      console.log(
        "Adicionais validados:",
        adicionaisValidos.map((adicional) => ({
          id: adicional.id,
          nome: adicional.nome,
          preco: adicional.preco,
        })),
      );
    }

    // --------------------------------------------------
    // OBTER CARRINHO
    // --------------------------------------------------

    const carrinhoId = await obterCarrinho(req.usuario.id);

    console.log("Carrinho ID:", carrinhoId);

    // --------------------------------------------------
    // INICIAR TRANSAÇÃO
    // --------------------------------------------------

    conexao = await db.getConnection();

    await conexao.beginTransaction();
    transacaoIniciada = true;

    console.log("Transação iniciada.");

    // --------------------------------------------------
    // INSERIR ITEM DO CARRINHO
    // --------------------------------------------------

    const [resultadoItem] = await conexao.execute(
      `INSERT INTO itens_carrinho
          (carrinho_id, produto_id, quantidade)
       VALUES (?, ?, ?)`,
      [carrinhoId, produtoId, quantidade],
    );

    const itemCarrinhoId = resultadoItem.insertId;

    if (!itemCarrinhoId) {
      throw new Error("Não foi possível criar o item do carrinho.");
    }

    console.log("Item criado:", itemCarrinhoId);

    // --------------------------------------------------
    // INSERIR ADICIONAIS DO ITEM
    // --------------------------------------------------

    for (const adicional of adicionaisValidos) {
      console.log("Inserindo adicional:", {
        itemCarrinhoId,
        adicionalId: adicional.id,
        nome: adicional.nome,
        preco: adicional.preco,
      });

      const [resultadoAdicional] = await conexao.execute(
        `INSERT INTO item_carrinho_adicionais
            (
              item_carrinho_id,
              adicional_id,
              nome_adicional,
              preco
            )
         VALUES (?, ?, ?, ?)`,
        [itemCarrinhoId, adicional.id, adicional.nome, adicional.preco],
      );

      if (resultadoAdicional.affectedRows !== 1) {
        throw new Error(
          `Não foi possível salvar o adicional ${adicional.nome}.`,
        );
      }
    }

    // --------------------------------------------------
    // CONFIRMAR TRANSAÇÃO
    // --------------------------------------------------

    await conexao.commit();
    transacaoIniciada = false;

    console.log("Transação confirmada com sucesso.");
    console.log("==========================================\n");

    // Libera a conexão antes de consultar novamente o carrinho.
    conexao.release();
    conexao = null;

    const carrinho = await buscarCarrinho(req.usuario.id);

    return res.status(201).json({
      mensagem: "Produto adicionado ao carrinho.",
      carrinho,
    });
  } catch (erro) {
    // --------------------------------------------------
    // DESFAZER TRANSAÇÃO EM CASO DE ERRO
    // --------------------------------------------------

    if (conexao && transacaoIniciada) {
      try {
        await conexao.rollback();
        console.log("Transação desfeita.");
      } catch (erroRollback) {
        console.error("Erro ao desfazer transação:", erroRollback);
      }

      transacaoIniciada = false;
    }

    // --------------------------------------------------
    // LOG COMPLETO DO ERRO
    // --------------------------------------------------

    console.error("\n========== ERRO AO ADICIONAR PRODUTO ==========");
    console.error("Mensagem:", erro.message);
    console.error("Código:", erro.code);
    console.error("Número:", erro.errno);
    console.error("SQL:", erro.sql);
    console.error("SQL State:", erro.sqlState);
    console.error("Stack:", erro.stack);
    console.error("===============================================\n");

    return res.status(500).json({
      mensagem: "Não foi possível adicionar o produto.",
    });
  } finally {
    if (conexao) {
      conexao.release();
    }
  }
});

// ======================================================
// PATCH /api/cliente/carrinho/itens/:id
// ATUALIZAR QUANTIDADE
// ======================================================

router.patch("/itens/:id", async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    const quantidade = Number(req.body.quantidade);

    if (
      !Number.isInteger(itemId) ||
      itemId <= 0 ||
      !validarQuantidade(quantidade)
    ) {
      return res.status(400).json({
        mensagem: "Quantidade ou item inválido.",
      });
    }

    const carrinhoId = await obterCarrinho(req.usuario.id);

    const [resultado] = await db.execute(
      `UPDATE itens_carrinho
       SET quantidade = ?
       WHERE id = ?
         AND carrinho_id = ?`,
      [quantidade, itemId, carrinhoId],
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        mensagem: "Item não encontrado no seu carrinho.",
      });
    }

    const carrinho = await buscarCarrinho(req.usuario.id);

    return res.json({
      mensagem: "Quantidade atualizada.",
      carrinho,
    });
  } catch (erro) {
    console.error("Erro ao atualizar item:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível atualizar a quantidade.",
    });
  }
});

// ======================================================
// DELETE /api/cliente/carrinho/itens/:id
// REMOVER ITEM
// ======================================================

router.delete("/itens/:id", async (req, res) => {
  try {
    const itemId = Number(req.params.id);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({
        mensagem: "Item inválido.",
      });
    }

    const carrinhoId = await obterCarrinho(req.usuario.id);

    const [resultado] = await db.execute(
      `DELETE FROM itens_carrinho
       WHERE id = ?
         AND carrinho_id = ?`,
      [itemId, carrinhoId],
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        mensagem: "Item não encontrado no seu carrinho.",
      });
    }

    // A FK de item_carrinho_adicionais possui ON DELETE CASCADE.
    const carrinho = await buscarCarrinho(req.usuario.id);

    return res.json({
      mensagem: "Produto removido do carrinho.",
      carrinho,
    });
  } catch (erro) {
    console.error("Erro ao remover item:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível remover o produto.",
    });
  }
});

// ======================================================
// DELETE /api/cliente/carrinho
// LIMPAR CARRINHO
// ======================================================

router.delete("/", async (req, res) => {
  try {
    const carrinhoId = await obterCarrinho(req.usuario.id);

    await db.execute(
      `DELETE FROM itens_carrinho
       WHERE carrinho_id = ?`,
      [carrinhoId],
    );

    const carrinho = await buscarCarrinho(req.usuario.id);

    return res.json({
      mensagem: "Carrinho esvaziado.",
      carrinho,
    });
  } catch (erro) {
    console.error("Erro ao limpar carrinho:", erro);

    return res.status(500).json({
      mensagem: "Não foi possível limpar o carrinho.",
    });
  }
});

module.exports = router;
