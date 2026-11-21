const express = require("express");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("ERRO: JWT_SECRET precisa ter pelo menos 32 caracteres.");
  process.exit(1);
}

const db = require("./database");

// Rotas
const adminPagamentosRoutes = require("./routes/adminPagamentos");
const adminHorariosRoutes = require("./routes/adminHorarios");
const adminEntregaRoutes = require("./routes/adminEntrega");
const adminCategoriasRoutes = require("./routes/adminCategorias");
const adminProdutosRoutes = require("./routes/adminProdutos");
const adminPedidosRoutes = require("./routes/adminPedidos");
const adminDashboardRoutes = require("./routes/adminDashboard");
const formasPagamentoRoutes = require("./routes/formasPagamento");

const clientePerfilRoutes = require("./routes/clientePerfil");
const pedidosRoutes = require("./routes/pedidos");
const authRoutes = require("./routes/auth");
const cardapioRoutes = require("./routes/cardapio");
const carrinhoRoutes = require("./routes/carrinho");
const adminFormasPagamentoRoutes = require("./routes/adminFormasPagamento");

const app = express();
const PORT = process.env.PORT || 3000;

const frontendPath = path.resolve(__dirname, "../../frontend");

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Rotas administrativas
app.use("/api/admin/pagamentos", adminPagamentosRoutes);
app.use("/api/admin/horarios", adminHorariosRoutes);
app.use("/api/admin/entrega", adminEntregaRoutes);
app.use("/api/admin/categorias", adminCategoriasRoutes);
app.use("/api/admin/produtos", adminProdutosRoutes);
app.use("/api/admin/pedidos", adminPedidosRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/pagamentos", adminFormasPagamentoRoutes);
app.use("/api/formas-pagamento", formasPagamentoRoutes);

// Rotas do cliente
app.use("/api/cliente/perfil", clientePerfilRoutes);
app.use("/api/cliente/pedidos", pedidosRoutes);
app.use("/api/cliente/carrinho", carrinhoRoutes);

// Rotas gerais
app.use("/api/auth", authRoutes);
app.use("/api/cardapio", cardapioRoutes);
app.use("/api/pedidos", pedidosRoutes);

// Status do servidor e banco
app.get("/api/status", async (req, res) => {
  try {
    await db.query("SELECT 1");

    res.json({
      servidor: "online",
      banco: "conectado",
    });
  } catch (erro) {
    console.error("Erro de conexão com MySQL:", erro);

    res.status(500).json({
      servidor: "online",
      banco: "desconectado",
    });
  }
});

// Arquivos estáticos do frontend
app.use(express.static(frontendPath));

// Página inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "inicio.html"));
});

// Inicialização
app.listen(PORT, () => {
  console.log("-----------------------------------");
  console.log("       FRAGA LANCHES");
  console.log("-----------------------------------");
  console.log(`Servidor: http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/admin/admin-dashboard.html`);
  console.log(`Cardápio: http://localhost:${PORT}/admin/admin-cardapio.html`);
  console.log("API: /api");
  console.log("-----------------------------------");
});
