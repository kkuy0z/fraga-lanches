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

const pedidosRoutes = require("./routes/pedidos");
const authRoutes = require("./routes/auth");
const cardapioRoutes = require("./routes/cardapio");
const adminCategoriasRoutes = require("./routes/adminCategorias");
const adminProdutosRoutes = require("./routes/adminProdutos");
const adminPedidosRoutes = require("./routes/adminPedidos");
const pedidosRoutes = require("./routes/pedidos");
const adminDashboardRoutes = require("./routes/adminDashboard");

const app = express();
const PORT = process.env.PORT || 3000;

const frontendPath = path.resolve(__dirname, "../../frontend");

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Rotas da API
app.use("/api/cliente/pedidos", pedidosRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/cardapio", cardapioRoutes);
app.use("/api/admin/categorias", adminCategoriasRoutes);
app.use("/api/admin/produtos", adminProdutosRoutes);
app.use("/api/admin/pedidos", adminPedidosRoutes);
app.use("/api/pedidos", pedidosRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);

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
  console.log("API: /api");
  console.log("-----------------------------------");
});
