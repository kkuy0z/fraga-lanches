
const express = require("express");
const router = express.Router();
const db = require("../database");

// Listar categorias ativas
router.get("/categorias", async (req, res) => {
    try {
        const [categorias] = await db.query(`
            SELECT id, nome, descricao
            FROM categorias
            WHERE ativo = TRUE
            ORDER BY nome ASC
        `);

        res.json(categorias);
    } catch (erro) {
        console.error("Erro ao buscar categorias:", erro);
        res.status(500).json({
            mensagem: "Erro ao carregar categorias."
        });
    }
});

// Listar produtos disponíveis
router.get("/produtos", async (req, res) => {
    try {
        const { categoria } = req.query;

        let sql = `
            SELECT
                p.id,
                p.categoria_id,
                c.nome AS categoria,
                p.nome,
                p.descricao,
                p.imagem,
                p.preco
            FROM produtos p
            INNER JOIN categorias c ON c.id = p.categoria_id
            WHERE p.disponivel = TRUE
              AND c.ativo = TRUE
        `;

        const parametros = [];

        if (categoria) {
            sql += " AND p.categoria_id = ?";
            parametros.push(categoria);
        }

        sql += " ORDER BY p.nome ASC";

        const [produtos] = await db.query(sql, parametros);

        res.json(produtos);
    } catch (erro) {
        console.error("Erro ao buscar produtos:", erro);
        res.status(500).json({
            mensagem: "Erro ao carregar produtos."
        });
    }
});

// Buscar adicionais de um produto
router.get("/produtos/:id/adicionais", async (req, res) => {
    try {
        const produtoId = Number(req.params.id);

        if (!Number.isInteger(produtoId) || produtoId <= 0) {
            return res.status(400).json({
                mensagem: "ID de produto inválido."
            });
        }

        const [adicionais] = await db.query(`
            SELECT
                a.id,
                a.nome,
                a.preco
            FROM produto_adicionais pa
            INNER JOIN adicionais a
                ON a.id = pa.adicional_id
            WHERE pa.produto_id = ?
              AND a.disponivel = TRUE
            ORDER BY a.nome ASC
        `, [produtoId]);

        res.json(adicionais);
    } catch (erro) {
        console.error("Erro ao buscar adicionais:", erro);
        res.status(500).json({
            mensagem: "Erro ao carregar adicionais."
        });
    }
});

module.exports = router;
