"use strict";

const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const dotenv = require("dotenv");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { WebSocketServer, WebSocket } = require("ws");

// O Gateway usa somente configuracoes compartilhadas; nao acessa o MySQL.
dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

if (!process.env.INTERNAL_SERVICE_SECRET) {
  throw new Error("[Gateway] INTERNAL_SERVICE_SECRET nao configurada.");
}

const app = express();
const PORT = Number(process.env.PORT || 3000);
const frontendPath = path.resolve(__dirname, "../../frontend");

app.disable("x-powered-by");

// ------------------------------------------------------
// PROXY REVERSO: todas as APIs de negocio pertencem aos
// microsservicos. O Gateway preserva as URLs publicas.
// ------------------------------------------------------

const servicos = [
  {
    nome: "Pedidos",
    target: "http://127.0.0.1:4003",
    paths: ["/api/cliente/pedidos", "/api/pedidos", "/api/admin/pedidos"],
  },
  {
    nome: "Catalogo",
    target: "http://127.0.0.1:4002",
    paths: ["/api/cardapio", "/api/formas-pagamento"],
  },
  {
    nome: "Auth",
    target: "http://127.0.0.1:4001",
    paths: ["/api/auth"],
  },
  {
    nome: "Entregas",
    target: "http://127.0.0.1:4004",
    paths: ["/api/admin/atribuicoes", "/api/admin/entrega", "/api/admin/horarios", "/api/entregador"],
  },
  {
    nome: "Cozinha",
    target: "http://127.0.0.1:4005",
    paths: ["/api/cozinha/pedidos"],
  },
  {
    nome: "Notificacoes",
    target: "http://127.0.0.1:4006",
    paths: ["/api/notificacoes", "/api/cliente/notificacoes"],
  },
  {
    nome: "Avaliacoes",
    target: "http://127.0.0.1:4007",
    paths: ["/api/avaliacoes/publicas", "/api/admin/avaliacoes", "/api/cliente/avaliacoes"],
  },
  {
    nome: "Administracao",
    target: "http://127.0.0.1:4008",
    paths: ["/api/admin/categorias", "/api/admin/produtos", "/api/admin/dashboard", "/api/admin/pagamentos"],
  },
  {
    nome: "Atendimento",
    target: "http://127.0.0.1:4009",
    paths: ["/api/atendente/pedidos"],
  },
  {
    nome: "Clientes",
    target: "http://127.0.0.1:4010",
    paths: ["/api/cliente/carrinho", "/api/cliente/perfil", "/api/cliente/dashboard"],
  },
];

for (const servico of servicos) {
  app.use(createProxyMiddleware({
    target: servico.target,
    changeOrigin: true,
    pathFilter: servico.paths,
    timeout: 15000,
    proxyTimeout: 15000,
    on: {
      error: (erro, req, res) => {
        console.error(`[Gateway -> ${servico.nome}]:`, erro.message);
        if (!res.headersSent) {
          res.status(503).json({
            mensagem: `Servico ${servico.nome.toLowerCase()} temporariamente indisponivel.`,
          });
        }
      },
    },
  }));
}

// Parsers depois dos proxies para nao consumir o corpo das requisicoes proxied.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

// ------------------------------------------------------
// EVENTOS INTERNOS: microsservicos publicam eventos;
// Gateway apenas os distribui pelas conexoes WebSocket.
// ------------------------------------------------------

app.post("/internal/events", (req, res) => {
  const configurado = process.env.INTERNAL_SERVICE_SECRET;
  const recebido = req.headers["x-internal-service-secret"];

  if (
    !configurado ||
    typeof recebido !== "string" ||
    Buffer.byteLength(recebido) !== Buffer.byteLength(configurado) ||
    !crypto.timingSafeEqual(Buffer.from(recebido), Buffer.from(configurado))
  ) {
    return res.status(401).json({ mensagem: "Comunicacao interna nao autorizada." });
  }

  const { destino, usuarioId, tipos, evento } = req.body || {};
  if (!evento || typeof evento !== "object" || Array.isArray(evento)) {
    return res.status(400).json({ mensagem: "Evento invalido." });
  }

  if (destino === "usuario" && usuarioId != null) {
    return res.json({ sucesso: true, enviados: emitirParaUsuario(usuarioId, evento) });
  }

  if (destino === "equipe" && Array.isArray(tipos) && tipos.length > 0) {
    return res.json({ sucesso: true, enviados: emitirParaTipos(tipos, evento) });
  }

  return res.status(400).json({ mensagem: "Destino de evento invalido." });
});

// ------------------------------------------------------
// HEALTH DO GATEWAY: consulta os health checks dos servicos,
// sem abrir conexao direta com o banco de dados.
// ------------------------------------------------------

app.get("/api/status", async (req, res) => {
  const resultados = await Promise.all(servicos.map(async (servico) => {
    const porta = new URL(servico.target).port;
    try {
      const resposta = await fetch(`http://127.0.0.1:${porta}/health`, {
        signal: AbortSignal.timeout(2500),
      });
      const dados = await resposta.json().catch(() => ({}));
      return { servico: servico.nome, status: resposta.ok ? "online" : "indisponivel", http: resposta.status, ...dados };
    } catch {
      return { servico: servico.nome, status: "indisponivel" };
    }
  }));

  const todosOnline = resultados.every((item) => item.status === "online");
  return res.status(todosOnline ? 200 : 503).json({
    servidor: "online",
    arquitetura: "microsservicos",
    status: todosOnline ? "online" : "degradado",
    servicos: resultados,
  });
});

// ------------------------------------------------------
// FRONTEND ESTATICO
// ------------------------------------------------------

app.use(express.static(frontendPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "inicio.html"));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

function obterCookie(req, nome) {
  const cookies = req.headers.cookie || "";
  const cookie = cookies.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${nome}=`));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.substring(nome.length + 1));
  } catch {
    return null;
  }
}

// A validacao de JWT e do estado do usuario pertence ao microsservico Auth.
// O Gateway apenas encaminha a sessao para validacao interna.
async function autenticarConexao(req) {
  const cookie = req.headers.cookie || "";
  if (!obterCookie(req, "fraga_session")) throw new Error("Sessao nao encontrada.");

  const resposta = await fetch("http://127.0.0.1:4001/internal/session", {
    method: "GET",
    headers: {
      cookie,
      "x-internal-service-secret": process.env.INTERNAL_SERVICE_SECRET,
    },
    signal: AbortSignal.timeout(5000),
  });

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok || !dados.usuario || !dados.usuario.id || !dados.usuario.tipo) {
    throw new Error(dados.mensagem || "Sessao invalida.");
  }

  return dados.usuario;
}

function origemPermitida(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

server.on("upgrade", async (req, socket, head) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname !== "/ws") {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      return socket.destroy();
    }
    if (!origemPermitida(req)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      return socket.destroy();
    }

    const usuario = await autenticarConexao(req);
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.usuario = usuario;
      wss.emit("connection", ws, req);
    });
  } catch (erro) {
    console.warn("[Gateway WebSocket] Conexao recusada:", erro.message);
    if (!socket.destroyed) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  }
});

wss.on("connection", (ws) => {
  const usuario = ws.usuario;
  ws.send(JSON.stringify({
    evento: "conexao_estabelecida",
    mensagem: "Conexao em tempo real estabelecida.",
  }));

  ws.on("message", () => {
    // Clientes nao podem publicar eventos internos pelo WebSocket.
  });
  ws.on("error", (erro) => {
    console.error(`[Gateway WebSocket] Usuario ${usuario.id}:`, erro.message);
  });
});

function enviarEvento(ws, evento) {
  if (ws.readyState !== WebSocket.OPEN) return false;
  try {
    ws.send(JSON.stringify(evento));
    return true;
  } catch (erro) {
    console.error("[Gateway WebSocket] Falha ao enviar evento:", erro.message);
    return false;
  }
}

function emitirParaUsuario(usuarioId, evento) {
  let enviados = 0;
  for (const ws of wss.clients) {
    if (ws.usuario && String(ws.usuario.id) === String(usuarioId) && enviarEvento(ws, evento)) enviados++;
  }
  return enviados;
}

function emitirParaTipos(tipos, evento) {
  const permitidos = Array.isArray(tipos) ? tipos : [tipos];
  let enviados = 0;
  for (const ws of wss.clients) {
    if (ws.usuario && permitidos.includes(ws.usuario.tipo) && enviarEvento(ws, evento)) enviados++;
  }
  return enviados;
}

server.listen(PORT, "0.0.0.0", () => {
  console.log("[Gateway] HTTP:", `http://localhost:${PORT}`);
  console.log("[Gateway] WebSocket:", `ws://localhost:${PORT}/ws`);
  console.log("[Gateway] APIs encaminhadas para 10 microsservicos.");
});

server.on("error", (erro) => {
  console.error("[Gateway] Erro HTTP:", erro);
  process.exitCode = 1;
});
