
"use strict";

const express = require("express");
const db = require("../database");
const authRoutes = require("./auth");

const router = express.Router();
const autenticar = authRoutes.autenticar;

// Garante que somente clientes autenticados utilizem o carrinho.
function somenteCliente(req, res, next) {
    if (!req.usuario || req.usuario.tipo !== "cliente") {
        return res.status(403).json({
            mensagem: "Acesso permitido somente para clientes."
        });
    }

    next();
}

// Busca ou cria o carrinho do cliente.
async function obterCarrinho(usuarioId) {
    await db.execute(
        `INSERT IGNORE INTO carrinhos (usuario_id)
         VALUES (?)`,
        [usuarioId]
    );

    const [carrinhos] = await db.execute(
        `SELECT id
         FROM carrinhos
         WHERE usuario_id = ?
         LIMIT 1`,
        [usuarioId]
    );

    return carrinhos[0].id;
}

// Retorna os itens e calcula o total usando os preços do banco.
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
            p.disponivel,
            (ic.quantidade * p.preco) AS subtotal
         FROM itens_carrinho ic
         INNER JOIN produtos p ON p.id = ic.produto_id
         WHERE ic.carrinho_id = ?
         ORDER BY ic.id DESC`,
        [carrinhoId]
    );

    const total = itens.reduce(
        (soma, item) => soma + Number(item.subtotal),
        0
    );

    return {
        carrinho_id: carrinhoId,
        quantidade_itens: itens.reduce(
            (soma, item) => soma + Number(item.quantidade),
            0
        ),
        itens,
        total: Number(total.toFixed(2))
    };
}

if (typeof autenticar !== "function") {
    throw new Error(
        "Middleware autenticar não encontrado em routes/auth.js"
    );
}

router.use(autenticar, somenteCliente);

// GET /api/cliente/carrinho
// Consulta o carrinho do cliente.
router.get("/", async (req, res) => {
    try {
        const carrinho = await buscarCarrinho(req.usuario.id);

        return res.json(carrinho);
    } catch (erro) {
        console.error("Erro ao consultar carrinho:", erro);

        return res.status(500).json({
            mensagem: "Não foi possível carregar seu carrinho."
        });
    }
});

// POST /api/cliente/carrinho/itens
// Adiciona um produto ou aumenta sua quantidade.
router.post("/itens", async (req, res) => {
    try {
        const produtoId = Number(req.body.produto_id);
        const quantidade = Number(req.body.quantidade ?? 1);

        if (
            !Number.isInteger(produtoId) ||
            produtoId <= 0 ||
            !Number.isInteger(quantidade) ||
            quantidade < 1 ||
            quantidade > 99
        ) {
            return res.status(400).json({
                mensagem: "Produto ou quantidade inválidos."
            });
        }

        const [produtos] = await db.execute(
            `SELECT p.id
             FROM produtos p
             INNER JOIN categorias c
                ON c.id = p.categoria_id
             WHERE p.id = ?
               AND p.disponivel = TRUE
               AND c.ativo = TRUE
             LIMIT 1`,
            [produtoId]
        );

        if (produtos.length === 0) {
            return res.status(404).json({
                mensagem: "Produto indisponível ou não encontrado."
            });
        }

        const carrinhoId = await obterCarrinho(req.usuario.id);

        await db.execute(
            `INSERT INTO itens_carrinho
                (carrinho_id, produto_id, quantidade)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE
                quantidade = quantidade + VALUES(quantidade)`,
            [carrinhoId, produtoId, quantidade]
        );

        const [resultado] = await db.execute(
            `SELECT quantidade
             FROM itens_carrinho
             WHERE carrinho_id = ?
               AND produto_id = ?`,
            [carrinhoId, produtoId]
        );

        if (resultado[0].quantidade > 99) {
            await db.execute(
                `UPDATE itens_carrinho
                 SET quantidade = 99
                 WHERE carrinho_id = ?
                   AND produto_id = ?`,
                [carrinhoId, produtoId]
            );
        }

        return res.status(200).json({
            mensagem: "Produto adicionado ao carrinho.",
            carrinho: await buscarCarrinho(req.usuario.id)
        });
    } catch (erro) {
        console.error("Erro ao adicionar produto:", erro);

        return res.status(500).json({
            mensagem: "Não foi possível adicionar o produto."
        });
    }
});

// PATCH /api/cliente/carrinho/itens/:id
// Atualiza a quantidade de um item.
router.patch("/itens/:id", async (req, res) => {
    try {
        const itemId = Number(req.params.id);
        const quantidade = Number(req.body.quantidade);

        if (
            !Number.isInteger(itemId) ||
            itemId <= 0 ||
            !Number.isInteger(quantidade) ||
            quantidade < 1 ||
            quantidade > 99
        ) {
            return res.status(400).json({
                mensagem: "Quantidade ou item inválido."
            });
        }

        const carrinhoId = await obterCarrinho(req.usuario.id);

        const [resultado] = await db.execute(
            `UPDATE itens_carrinho
             SET quantidade = ?
             WHERE id = ?
               AND carrinho_id = ?`,
            [quantidade, itemId, carrinhoId]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensagem: "Item não encontrado no seu carrinho."
            });
        }

        return res.json({
            mensagem: "Quantidade atualizada.",
            carrinho: await buscarCarrinho(req.usuario.id)
        });
    } catch (erro) {
        console.error("Erro ao atualizar item:", erro);

        return res.status(500).json({
            mensagem: "Não foi possível atualizar a quantidade."
        });
    }
});

// DELETE /api/cliente/carrinho/itens/:id
// Remove um produto específico.
router.delete("/itens/:id", async (req, res) => {
    try {
        const itemId = Number(req.params.id);

        if (!Number.isInteger(itemId) || itemId <= 0) {
            return res.status(400).json({
                mensagem: "Item inválido."
            });
        }

        const carrinhoId = await obterCarrinho(req.usuario.id);

        const [resultado] = await db.execute(
            `DELETE FROM itens_carrinho
             WHERE id = ?
               AND carrinho_id = ?`,
            [itemId, carrinhoId]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensagem: "Item não encontrado no seu carrinho."
            });
        }

        return res.json({
            mensagem: "Produto removido do carrinho.",
            carrinho: await buscarCarrinho(req.usuario.id)
        });
    } catch (erro) {
        console.error("Erro ao remover item:", erro);

        return res.status(500).json({
            mensagem: "Não foi possível remover o produto."
        });
    }
});

// DELETE /api/cliente/carrinho
// Limpa todos os itens do carrinho.
router.delete("/", async (req, res) => {
    try {
        const carrinhoId = await obterCarrinho(req.usuario.id);

        await db.execute(
            `DELETE FROM itens_carrinho
             WHERE carrinho_id = ?`,
            [carrinhoId]
        );

        return res.json({
            mensagem: "Carrinho esvaziado.",
            carrinho: await buscarCarrinho(req.usuario.id)
        });
    } catch (erro) {
        console.error("Erro ao limpar carrinho:", erro);

        return res.status(500).json({
            mensagem: "Não foi possível limpar o carrinho."
        });
    }
});

module.exports = router;
