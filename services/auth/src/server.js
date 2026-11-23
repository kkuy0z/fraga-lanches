"use strict";

const path = require("path");
const dotenv = require("dotenv");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

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

// Validacao interna de sessao para o Gateway WebSocket.
// A consulta de usuario ativo permanece sob responsabilidade do Auth.
app.get("/internal/session", async (req, res) => {
  const esperado = process.env.INTERNAL_SERVICE_SECRET;
  const recebido = req.headers["x-internal-service-secret"];

  if (
    !esperado ||
    typeof recebido !== "string" ||
    Buffer.byteLength(recebido) !== Buffer.byteLength(esperado) ||
    !crypto.timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado))
  ) {
    return res.status(401).json({ mensagem: "Servico interno nao autorizado." });
  }

  const cookies = req.headers.cookie || "";
  const item = cookies.split(";").map((parte) => parte.trim()).find((parte) => parte.startsWith("fraga_session="));
  if (!item) return res.status(401).json({ mensagem: "Sessao nao encontrada." });

  let token;
  try {
    token = decodeURIComponent(item.slice("fraga_session=".length));
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (!payload || !payload.id) {
      return res.status(401).json({ mensagem: "Sessao invalida." });
    }

    const [usuarios] = await db.query(
      "SELECT id, nome, email, tipo, ativo FROM usuarios WHERE id = ? LIMIT 1",
      [payload.id],
    );

    if (!usuarios.length || !usuarios[0].ativo) {
      return res.status(401).json({ mensagem: "Usuario inexistente ou inativo." });
    }

    const usuario = usuarios[0];
    return res.json({
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo,
      },
    });
  } catch (erro) {
    return res.status(401).json({ mensagem: "Sessao invalida ou expirada." });
  }
});


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
