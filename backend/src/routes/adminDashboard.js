
const express = require("express");
const router = express.Router();

const db = require("../database");
const autenticarAdmin = require("../middleware/autenticarAdmin");

router.use(autenticarAdmin);

// GET /api/admin/dashboard
router.get("/", async (req, res) => {
    try {
        const [
            [pedidosHoje],
            [pedidosEntregues],
            [pedidosPendentes],
            [produtosAtivos],
            [categoriasAtivas],
            [clientesCadastrados],
            [pedidosRecentes]
        ] = await Promise.all([

            // Pedidos realizados hoje
            db.query(`
                SELECT COUNT(*) AS total
                FROM pedidos
                WHERE data_pedido >= CURDATE()
                  AND data_pedido < CURDATE() + INTERVAL 1 DAY
            `),

            // Pedidos concluídos
            db.query(`
                SELECT COUNT(*) AS total
                FROM pedidos
                WHERE status = 'concluido'
            `),

            // Pedidos ainda em andamento
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

            // Produtos disponíveis
            db.query(`
                SELECT COUNT(*) AS total
                FROM produtos
                WHERE disponivel = 1
            `),

            // Categorias ativas
            db.query(`
                SELECT COUNT(*) AS total
                FROM categorias
                WHERE ativo = 1
            `),

            // Clientes cadastrados e ativos
            db.query(`
                SELECT COUNT(*) AS total
                FROM usuarios
                WHERE tipo = 'cliente'
                  AND ativo = 1
            `),

            // Últimos 8 pedidos
            db.query(`
                SELECT
                    p.id,
                    p.data_pedido,
                    p.status,
                    p.total,
                    u.nome AS cliente
                FROM pedidos p
                INNER JOIN usuarios u
                    ON u.id = p.usuario_id
                ORDER BY p.data_pedido DESC, p.id DESC
                LIMIT 8
            `)
        ]);

        res.json({
            estatisticas: {
                pedidosHoje: Number(pedidosHoje[0].total),
                pedidosEntregues: Number(pedidosEntregues[0].total),
                pedidosPendentes: Number(pedidosPendentes[0].total),
                produtosAtivos: Number(produtosAtivos[0].total),
                categorias: Number(categoriasAtivas[0].total),
                clientes: Number(clientesCadastrados[0].total)
            },
            pedidosRecentes
        });

    } catch (erro) {
        console.error("Erro ao carregar dashboard:", erro);

        res.status(500).json({
            mensagem: "Não foi possível carregar os dados do dashboard."
        });
    }
});

module.exports = router;
