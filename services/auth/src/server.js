"use strict";

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
});

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET precisa ter pelo menos 32 caracteres.");
}

const express = require("express");
const db = require("./database");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.AUTH_PORT || 4001;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");

    res.json({
      servico: "auth",
      status: "online",
      banco: "conectado",
    });
  } catch (erro) {
    console.error("[Auth] Erro no banco:", erro.message);

    res.status(503).json({
      servico: "auth",
      status: "indisponivel",
      banco: "desconectado",
    });
  }
});

app.use("/api/auth", authRoutes);

app.listen(PORT, () => {
  console.log(`[Auth] Serviço iniciado na porta ${PORT}`);
});
