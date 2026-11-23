"use strict";

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
});

const express = require("express");
const db = require("./database");

const cardapioRoutes = require("./routes/cardapio");
const formasPagamentoRoutes = require("./routes/formasPagamento");

const app = express();

const PORT = Number(process.env.CATALOGO_PORT || 4002);

app.use(express.json());

app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");

    return res.json({
      servico: "catalogo",
      status: "online",
      banco: "conectado",
    });
  } catch (erro) {
    console.error("Erro ao verificar banco:", erro);

    return res.status(503).json({
      servico: "catalogo",
      status: "online",
      banco: "desconectado",
    });
  }
});

app.use("/api/cardapio", cardapioRoutes);
app.use("/api/formas-pagamento", formasPagamentoRoutes);

app.use((req, res) => {
  return res.status(404).json({
    mensagem: "Rota não encontrada no serviço de catálogo.",
  });
});

const servidor = app.listen(PORT, () => {
  console.log("------------------------------------");
  console.log("FRAGA LANCHES - MICROSSERVIÇO CATÁLOGO");
  console.log("------------------------------------");
  console.log(`Porta: ${PORT}`);
  console.log("Cardápio: /api/cardapio");
  console.log("Formas de pagamento: /api/formas-pagamento");
  console.log("Saúde: /health");
  console.log("------------------------------------");
});

async function encerrar() {
  console.log("Encerrando microsserviço Catálogo...");

  servidor.close(async () => {
    try {
      await db.end();
      process.exit(0);
    } catch (erro) {
      console.error("Erro ao encerrar conexão MySQL:", erro);
      process.exit(1);
    }
  });
}

process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);
