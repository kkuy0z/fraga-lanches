
"use strict";

const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../database");

const router = express.Router();

function lerCookie(req, nome) {
    const cookies = req.headers.cookie || "";

    for (const item of cookies.split(";")) {
        const partes = item.trim().split("=");

        if (partes.shift() === nome) {
            return decodeURIComponent(partes.join("="));
        }
    }

    return null;
}

function exigirCliente(req, res, next) {
    const token = lerCookie(req, "fraga_session");

    if (!token) {
        return res.status(401).json({
            mensagem: "Faça login para continuar."
        });
    }

    try {
        const usuario = jwt.verify(token, process.env.JWT_SECRET);

        if (usuario.tipo !== "cliente") {
            return res.status(403).json({
                mensagem: "Acesso permitido somente ao cliente."
            });
        }

        req.usuario = usuario;
        next();
    } catch (erro) {
        return res.status(401).json({
            mensagem: "Sessão inválida ou expirada."
        });
    }
}

router.get("/", exigirCliente, async (req, res) => {
    try {
        const usuarioId = req.usuario.id;

        const [indicadores] = await db.execute(`
            SELECT
                COUNT(*) AS pedidosTotal,

                SUM(
                    CASE
                        WHEN status IN (
                            'novo',
                            'em_preparo',
                            'pronto',
                            'saiu_para_entrega'
                        )
                        THEN 1 ELSE 0
                    END
                ) AS emAndamento,

                SUM(
                    CASE
                        WHEN status = 'concluido'
                        THEN 1 ELSE 0
                    END
                ) AS concluidos,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status <> 'cancelado'
                            THEN total ELSE 0
                        END
                    ), 0
                ) AS totalGasto

            FROM pedidos
            WHERE usuario_id = ?
        `, [usuarioId]);

        const [pedidos] = await db.execute(`
            SELECT
                id,
                DATE_FORMAT(data_pedido, '%d/%m/%Y às %H:%i') AS data,
                status,
                tipo_entrega,
                subtotal,
                taxa_entrega,
                desconto,
                total
            FROM pedidos
            WHERE usuario_id = ?
            ORDER BY data_pedido DESC, id DESC
            LIMIT 6
        `, [usuarioId]);

        let itens = [];

        if (pedidos.length > 0) {
            const ids = pedidos.map(pedido => pedido.id);
            const placeholders = ids.map(() => "?").join(",");

            const [resultadoItens] = await db.query(`
                SELECT
                    pedido_id,
                    nome_produto,
                    quantidade,
                    preco_unitario,
                    subtotal,
                    personalizacao
                FROM itens_pedido
                WHERE pedido_id IN (${placeholders})
                ORDER BY id ASC
            `, ids);

            itens = resultadoItens;
        }

        const pedidosFormatados = pedidos.map(pedido => ({
            ...pedido,
            total: Number(pedido.total),
            subtotal: Number(pedido.subtotal),
            taxa_entrega: Number(pedido.taxa_entrega || 0),
            desconto: Number(pedido.desconto || 0),
            itens: itens
                .filter(item => item.pedido_id === pedido.id)
                .map(item => ({
                    nome: item.nome_produto,
                    quantidade: Number(item.quantidade),
                    preco: Number(item.preco_unitario),
                    subtotal: Number(item.subtotal),
                    personalizacao: item.personalizacao
                }))
        }));

        const pedidoAtual = pedidosFormatados.find(pedido =>
            ["novo", "em_preparo", "pronto", "saiu_para_entrega"]
                .includes(pedido.status)
        ) || null;

        return res.json({
            usuario: {
                nome: req.usuario.nome
            },
            indicadores: {
                pedidosTotal: Number(indicadores[0].pedidosTotal || 0),
                emAndamento: Number(indicadores[0].emAndamento || 0),
                concluidos: Number(indicadores[0].concluidos || 0),
                totalGasto: Number(indicadores[0].totalGasto || 0)
            },
            pedidoAtual,
            pedidosRecentes: pedidosFormatados
        });

    } catch (erro) {
        console.error("Erro no dashboard do cliente:", erro);

        return res.status(500).json({
            mensagem: "Não foi possível carregar seu dashboard."
        });
    }
});

module.exports = router;
