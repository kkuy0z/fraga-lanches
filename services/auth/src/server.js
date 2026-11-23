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

// API interna: Auth é o único serviço autorizado a consultar a identidade dos usuários.
function servicoInternoAutorizado(req) {
  const esperado = process.env.INTERNAL_SERVICE_SECRET;
  const recebido = req.headers["x-internal-service-secret"];
  return Boolean(
    esperado &&
    typeof recebido === "string" &&
    Buffer.byteLength(recebido) === Buffer.byteLength(esperado) &&
    crypto.timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado))
  );
}

function exigirServicoInterno(req, res, next) {
  if (!servicoInternoAutorizado(req)) {
    return res.status(401).json({ mensagem: "Serviço interno não autorizado." });
  }
  return next();
}

// Validação de sessão centralizada. Nenhum outro serviço precisa conhecer JWT_SECRET.
app.get("/internal/session", exigirServicoInterno, async (req, res) => {
  const cookies = req.headers.cookie || "";
  const item = cookies.split(";").map((parte) => parte.trim()).find((parte) => parte.startsWith("fraga_session="));
  if (!item) return res.status(401).json({ mensagem: "Sessão não encontrada." });

  let payload;
  try {
    const token = decodeURIComponent(item.slice("fraga_session=".length));
    payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload || !payload.id) return res.status(401).json({ mensagem: "Sessão inválida." });
  } catch {
    return res.status(401).json({ mensagem: "Sessão inválida ou expirada." });
  }

  try {
    const [usuarios] = await db.query(
      "SELECT id, nome, email, tipo, ativo FROM usuarios WHERE id = ? LIMIT 1",
      [payload.id],
    );
    if (!usuarios.length || Number(usuarios[0].ativo) !== 1) {
      return res.status(401).json({ mensagem: "Usuário inexistente ou inativo." });
    }
    const usuario = usuarios[0];
    return res.json({ usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, tipo: usuario.tipo } });
  } catch (erro) {
    console.error("[Auth] Falha ao consultar sessão:", erro.message);
    return res.status(503).json({ mensagem: "Banco de identidade indisponível." });
  }
});

// Consulta interna de perfis em lote para substituir JOINs em usuarios nos demais serviços.
app.get("/internal/users", exigirServicoInterno, async (req, res) => {
  const bruto = String(req.query.ids || "");
  const ids = bruto.split(",").filter(Boolean).map(Number);
  if (!ids.length || ids.length > 100 || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    return res.status(400).json({ mensagem: "Informe de 1 a 100 IDs de usuário válidos." });
  }
  try {
    const placeholders = ids.map(() => "?").join(",");
    const [usuarios] = await db.query(
      `SELECT id, nome, email, telefone, tipo, ativo, data_cadastro FROM usuarios WHERE id IN (${placeholders})`,
      ids,
    );
    return res.json({ usuarios });
  } catch (erro) {
    console.error("[Auth] Falha ao consultar perfis internos:", erro.message);
    return res.status(503).json({ mensagem: "Banco de identidade indisponível." });
  }
});

app.patch("/internal/users/:id/profile", exigirServicoInterno, async (req, res) => {
  const id = Number(req.params.id);
  const nome = String(req.body.nome || "").trim();
  const telefone = String(req.body.telefone || "").trim();
  if (!Number.isSafeInteger(id) || id <= 0 || nome.length < 2 || nome.length > 100 || telefone.length > 20) {
    return res.status(400).json({ mensagem: "Dados de perfil inválidos." });
  }
  if (telefone) {
    const digitos = telefone.replace(/\D/g, "");
    if (digitos.length < 10 || digitos.length > 15) {
      return res.status(400).json({ mensagem: "Telefone inválido." });
    }
  }
  try {
    const [resultado] = await db.query(
      "UPDATE usuarios SET nome = ?, telefone = ? WHERE id = ? AND tipo = 'entregador' AND ativo = 1",
      [nome, telefone || null, id],
    );
    if (resultado.affectedRows !== 1) {
      const [existentes] = await db.query("SELECT id FROM usuarios WHERE id = ? AND tipo = 'entregador' AND ativo = 1 LIMIT 1", [id]);
      if (!existentes.length) return res.status(404).json({ mensagem: "Entregador não encontrado ou inativo." });
    }
    const [usuarios] = await db.query(
      "SELECT id, nome, email, telefone, tipo, data_cadastro FROM usuarios WHERE id = ? LIMIT 1",
      [id],
    );
    return res.json({ usuario: usuarios[0] });
  } catch (erro) {
    console.error("[Auth] Falha ao atualizar perfil interno:", erro.message);
    return res.status(503).json({ mensagem: "Banco de identidade indisponível." });
  }
});

app.get("/internal/users/count", exigirServicoInterno, async (req, res) => {
  const tipo = String(req.query.tipo || "").trim();
  const ativo = req.query.ativo === undefined ? null : Number(req.query.ativo);
  if (!["admin", "atendente", "cozinha", "entregador", "cliente"].includes(tipo) || (ativo !== null && ![0, 1].includes(ativo))) {
    return res.status(400).json({ mensagem: "Filtros de contagem inválidos." });
  }
  try {
    const condicoes = ["tipo = ?"];
    const parametros = [tipo];
    if (ativo !== null) { condicoes.push("ativo = ?"); parametros.push(ativo); }
    const [resultado] = await db.query(`SELECT COUNT(*) AS total FROM usuarios WHERE ${condicoes.join(" AND ")}`, parametros);
    return res.json({ total: Number(resultado[0].total || 0) });
  } catch (erro) {
    console.error("[Auth] Falha ao contar usuários:", erro.message);
    return res.status(503).json({ mensagem: "Banco de identidade indisponível." });
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
