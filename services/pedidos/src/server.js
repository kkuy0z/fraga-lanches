"use strict";

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
});

const express = require("express");
const db = require("./database");

const pedidosRoutes = require("./routes/pedidos");
const adminPedidosRoutes = require("./routes/adminPedidos");
const { iniciarExpiracaoPix, pararExpiracaoPix } = require("./services/expiracaoPix");

const app = express();

iniciarExpiracaoPix();
const PORT = Number(process.env.PEDIDOS_PORT || 4003);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");

    return res.json({
      servico: "pedidos",
      status: "online",
      banco: "conectado",
    });
  } catch (erro) {
    console.error("[Pedidos] Erro no health check:", erro.message);

    return res.status(503).json({
      servico: "pedidos",
      status: "indisponivel",
      banco: "desconectado",
    });
  }
});

// ======================================================
// ROTAS DE PEDIDOS E PIX
// ======================================================

app.use("/api/cliente/pedidos", pedidosRoutes);
app.use("/api/pedidos", pedidosRoutes);
app.use("/api/admin/pedidos", adminPedidosRoutes);

// ======================================================
// ROTA NÃO ENCONTRADA
// ======================================================

app.use((req, res) => {
  return res.status(404).json({
    mensagem: "Rota não encontrada no serviço de pedidos.",
  });
});

// ======================================================
// TRATAMENTO DE ERROS
// ======================================================

app.use((erro, req, res, next) => {
  console.error("[Pedidos] Erro:", erro);

  if (res.headersSent) {
    return next(erro);
  }

  return res.status(500).json({
    mensagem: "Erro interno no serviço de pedidos.",
  });
});

// ======================================================
// INICIALIZAÇÃO
// ======================================================

const servidor = app.listen(PORT, "0.0.0.0", () => {
  console.log("------------------------------------");
  console.log("FRAGA LANCHES - MICROSSERVIÇO PEDIDOS");
  console.log("------------------------------------");
  console.log(`Porta: ${PORT}`);
  console.log("Pedidos: /api/cliente/pedidos");
  console.log("PIX: integrado ao serviço de pedidos");
  console.log("Admin: /api/admin/pedidos");
  console.log("Saúde: /health");
  console.log("------------------------------------");
});

// ======================================================
// ENCERRAMENTO SEGURO
// ======================================================

let encerrando = false;

async function encerrar(sinal) {
  if (encerrando) return;
  encerrando = true;

  console.log(`[Pedidos] Encerrando serviço (${sinal})...`);

  servidor.close(async () => {
    try {
      pararExpiracaoPix();
      await db.end();
      console.log("[Pedidos] Banco desconectado.");
      process.exit(0);
    } catch (erro) {
      console.error("[Pedidos] Erro ao encerrar banco:", erro.message);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error("[Pedidos] Encerramento forçado.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", () => encerrar("SIGINT"));
process.on("SIGTERM", () => encerrar("SIGTERM"));

servidor.on("error", (erro) => {
  console.error("[Pedidos] Erro no servidor:", erro);
  process.exit(1);
});
