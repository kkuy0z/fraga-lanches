"use strict";

const express = require("express");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
});

const db = require("./database");

const carrinhoRoutes = require("./routes/carrinho");
const clientePerfilRoutes = require("./routes/clientePerfil");
const clienteDashboardRoutes = require("./routes/clienteDashboard");

const app = express();
const PORT = 4010;

app.disable("x-powered-by");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");

    return res.json({
      servico: "clientes",
      status: "online",
      banco: "conectado",
    });
  } catch (erro) {
    return res.status(503).json({
      servico: "clientes",
      status: "degradado",
      banco: "indisponivel",
    });
  }
});

app.use("/api/cliente/carrinho", carrinhoRoutes);
app.use("/api/cliente/perfil", clientePerfilRoutes);
app.use("/api/cliente/dashboard", clienteDashboardRoutes);

app.use((req, res) => {
  res.status(404).json({
    mensagem: "Rota não encontrada no serviço de clientes.",
  });
});

const servidor = app.listen(PORT, "0.0.0.0", () => {
  console.log("------------------------------------");
  console.log("FRAGA LANCHES - CLIENTES");
  console.log("------------------------------------");
  console.log("Porta:", PORT);
});

let encerrando = false;

async function encerrar() {
  if (encerrando) return;
  encerrando = true;

  console.log("[Clientes] Encerrando serviço...");

  servidor.close(async () => {
    try {
      await db.end();
    } catch (erro) {
      console.error("[Clientes] Erro ao fechar banco:", erro.message);
    }

    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);
