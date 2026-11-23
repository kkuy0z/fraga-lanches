"use strict";

const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const dotenv = require("dotenv");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { WebSocketServer, WebSocket } = require("ws");

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("ERRO: JWT_SECRET precisa ter pelo menos 32 caracteres.");
  process.exit(1);
}

const db = require("./database");
const { iniciarExpiracaoPix } = require("./services/expiracaoPix");

// ======================================================
// ROTAS
// ======================================================




// ======================================================
// APLICAÇÃO
// ======================================================

const app = express();

const PORT = process.env.PORT || 3000;
const frontendPath = path.resolve(__dirname, "../../frontend");

// ======================================================
// MIDDLEWARES E PROXIES DOS MICROSSERVIÇOS
// ======================================================

// PEDIDOS + PIX (:4003)
app.use(
  createProxyMiddleware({
    target: "http://127.0.0.1:4003",
    changeOrigin: true,
    pathFilter: ["/api/cliente/pedidos", "/api/pedidos", "/api/admin/pedidos"],
    timeout: 15000,
    proxyTimeout: 15000,
    on: {
      error: (erro, req, res) => {
        console.error("[Gateway Pedidos]:", erro.message);

        if (!res.headersSent) {
          res.status(503).json({
            mensagem: "Serviço de pedidos temporariamente indisponível.",
          });
        }
      },
    },
  }),
);

// CATÁLOGO (:4002)
app.use(
  createProxyMiddleware({
    target: "http://127.0.0.1:4002",
    changeOrigin: true,
    pathFilter: ["/api/cardapio", "/api/formas-pagamento"],
    timeout: 10000,
    proxyTimeout: 10000,
    on: {
      proxyReq: (proxyReq, req) => {
        console.log(
          `[Gateway → Catálogo :4002] ${req.method} ${req.originalUrl}`,
        );
      },
      error: (erro, req, res) => {
        console.error("[Gateway Catálogo]:", erro.message);

        if (!res.headersSent) {
          res.status(503).json({
            mensagem: "Serviço de catálogo temporariamente indisponível.",
          });
        }
      },
    },
  }),
);

// AUTENTICAÇÃO (:4001)
app.use(
  createProxyMiddleware({
    target: "http://127.0.0.1:4001",
    changeOrigin: true,
    pathFilter: ["/api/auth"],
    timeout: 10000,
    proxyTimeout: 10000,
    on: {
      proxyReq: (proxyReq, req) => {
        console.log(`[Gateway → Auth :4001] ${req.method} ${req.originalUrl}`);
      },
      error: (erro, req, res) => {
        console.error("[Gateway Auth]:", erro.message);

        if (!res.headersSent) {
          res.status(503).json({
            mensagem: "Serviço de autenticação temporariamente indisponível.",
          });
        }
      },
    },
  }),
);

// PARSERS: ficam depois dos proxies para preservar os corpos das requisições.

/* ======================================================
   MICROSSERVIÇOS ADICIONAIS
   As rotas antigas permanecem como fallback.
====================================================== */

app.use(createProxyMiddleware({
  target: "http://127.0.0.1:4004",
  changeOrigin: true,
  pathFilter: [
    "/api/admin/atribuicoes",
    "/api/admin/entrega",
    "/api/admin/horarios",
    "/api/entregador"
  ],
  timeout: 15000,
  proxyTimeout: 15000
}));

app.use(createProxyMiddleware({
  target: "http://127.0.0.1:4005",
  changeOrigin: true,
  pathFilter: [
    "/api/cozinha/pedidos"
  ],
  timeout: 15000,
  proxyTimeout: 15000
}));

app.use(createProxyMiddleware({
  target: "http://127.0.0.1:4006",
  changeOrigin: true,
  pathFilter: [
    "/api/notificacoes",
    "/api/cliente/notificacoes"
  ],
  timeout: 15000,
  proxyTimeout: 15000
}));

app.use(createProxyMiddleware({
  target: "http://127.0.0.1:4007",
  changeOrigin: true,
  pathFilter: [
    "/api/admin/avaliacoes",
    "/api/cliente/avaliacoes"
  ],
  timeout: 15000,
  proxyTimeout: 15000
}));

app.use(createProxyMiddleware({
  target: "http://127.0.0.1:4008",
  changeOrigin: true,
  pathFilter: [
    "/api/admin/categorias",
    "/api/admin/produtos",
    "/api/admin/dashboard",
    "/api/admin/pagamentos"
  ],
  timeout: 15000,
  proxyTimeout: 15000
}));

app.use(createProxyMiddleware({
  target: "http://127.0.0.1:4009",
  changeOrigin: true,
  pathFilter: [
    "/api/atendente/pedidos"
  ],
  timeout: 15000,
  proxyTimeout: 15000
}));


// CLIENTES (:4010)
app.use(createProxyMiddleware({
  target: "http://127.0.0.1:4010",
  changeOrigin: true,
  pathFilter: [
    "/api/cliente/carrinho",
    "/api/cliente/perfil",
    "/api/cliente/dashboard",
  ],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ======================================================
// COMUNICAÇÃO INTERNA DOS MICROSSERVIÇOS
// ======================================================

app.post("/internal/events", (req, res) => {
  const configurado = process.env.INTERNAL_SERVICE_SECRET;
  const recebido = req.headers["x-internal-service-secret"];

  if (
    !configurado ||
    typeof recebido !== "string" ||
    Buffer.byteLength(recebido) !== Buffer.byteLength(configurado) ||
    !crypto.timingSafeEqual(Buffer.from(recebido), Buffer.from(configurado))
  ) {
    return res.status(401).json({
      mensagem: "Comunicação interna não autorizada.",
    });
  }

  const { destino, usuarioId, tipos, evento } = req.body || {};
  const websocket = app.locals.websocket;

  if (
    !websocket ||
    !evento ||
    typeof evento !== "object" ||
    Array.isArray(evento)
  ) {
    return res.status(400).json({
      mensagem: "Evento inválido ou WebSocket indisponível.",
    });
  }

  if (destino === "usuario" && usuarioId != null) {
    websocket.emitirParaUsuario(usuarioId, evento);
    return res.json({ sucesso: true });
  }

  if (destino === "equipe" && Array.isArray(tipos) && tipos.length > 0) {
    websocket.emitirParaTipos(tipos, evento);
    return res.json({ sucesso: true });
  }

  return res.status(400).json({
    mensagem: "Destino de evento inválido.",
  });
});

// ======================================================
// ROTAS ADMINISTRATIVAS
// ======================================================



// ======================================================
// ROTAS DO CLIENTE
// ======================================================

// ======================================================
// ROTAS DO ENTREGADOR
// ======================================================


// ======================================================
// ROTAS DO ATENDENTE
// ======================================================


// ======================================================
// ROTAS DA COZINHA
// ======================================================


// ======================================================
// ROTAS GERAIS
// ======================================================


// ======================================================
// STATUS DO SERVIDOR E BANCO
// ======================================================

app.get("/api/status", async (req, res) => {
  try {
    await db.query("SELECT 1");

    return res.json({
      servidor: "online",
      banco: "conectado",
    });
  } catch (erro) {
    console.error("Erro de conexão com MySQL:", erro);

    return res.status(500).json({
      servidor: "online",
      banco: "desconectado",
    });
  }
});

// ======================================================
// ARQUIVOS ESTÁTICOS
// ======================================================

app.use(express.static(frontendPath));

// ======================================================
// PÁGINA INICIAL
// ======================================================

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "inicio.html"));
});

// ======================================================
// SERVIDOR HTTP
// ======================================================

const server = http.createServer(app);

// ======================================================
// WEBSOCKET
// ======================================================

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 1024 * 16,
});

// ======================================================
// AUTENTICAÇÃO WEBSOCKET
// ======================================================

function obterCookie(req, nome) {
  const cookies = req.headers.cookie || "";

  const cookie = cookies
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${nome}=`));

  if (!cookie) {
    return null;
  }

  try {
    return decodeURIComponent(cookie.substring(nome.length + 1));
  } catch {
    return null;
  }
}

async function autenticarConexao(req) {
  const token = obterCookie(req, "fraga_session");

  if (!token) {
    throw new Error("Sessão não encontrada.");
  }

  const usuarioToken = jwt.verify(token, process.env.JWT_SECRET);

  if (!usuarioToken || !usuarioToken.id) {
    throw new Error("Token inválido.");
  }

  const [usuarios] = await db.query(
    `SELECT id, nome, email, tipo, ativo
     FROM usuarios
     WHERE id = ?
     LIMIT 1`,
    [usuarioToken.id],
  );

  if (!usuarios.length) {
    throw new Error("Usuário não encontrado.");
  }

  const usuario = usuarios[0];

  if (!usuario.ativo) {
    throw new Error("Usuário inativo.");
  }

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    tipo: usuario.tipo,
  };
}

// ======================================================
// VALIDAÇÃO DA ORIGEM
// ======================================================

function origemPermitida(req) {
  const origin = req.headers.origin;

  // Clientes que não enviam Origin não são bloqueados por essa regra.
  if (!origin) {
    return true;
  }

  try {
    const url = new URL(origin);

    return url.host === req.headers.host;
  } catch {
    return false;
  }
}

// ======================================================
// HANDSHAKE WEBSOCKET
// ======================================================

server.on("upgrade", async (req, socket, head) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname !== "/ws") {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    if (!origemPermitida(req)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    const usuario = await autenticarConexao(req);

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.usuario = usuario;

      wss.emit("connection", ws, req);
    });
  } catch (erro) {
    console.warn("Conexão WebSocket recusada:", erro.message);

    if (!socket.destroyed) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  }
});

// ======================================================
// CONEXÕES AUTENTICADAS
// ======================================================

wss.on("connection", (ws) => {
  const usuario = ws.usuario;

  console.log(
    `[WebSocket] Conectado: ${usuario.nome} | ID: ${usuario.id} | Tipo: ${usuario.tipo}`,
  );

  ws.send(
    JSON.stringify({
      evento: "conexao_estabelecida",
      mensagem: "Conexão em tempo real estabelecida.",
    }),
  );

  ws.on("message", (mensagem) => {
    // O cliente não pode escolher destinatários ou emitir eventos internos.
    // Neste momento, o servidor não aceita comandos do frontend.
    console.log(`[WebSocket] Mensagem recebida do usuário ${usuario.id}.`);
  });

  ws.on("close", () => {
    console.log(
      `[WebSocket] Desconectado: ${usuario.nome} | ID: ${usuario.id}`,
    );
  });

  ws.on("error", (erro) => {
    console.error(
      `[WebSocket] Erro na conexão do usuário ${usuario.id}:`,
      erro.message,
    );
  });
});

// ======================================================
// ENVIO DE EVENTOS
// ======================================================

function enviarEvento(ws, evento) {
  if (ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  try {
    ws.send(JSON.stringify(evento));
    return true;
  } catch (erro) {
    console.error("Erro ao enviar evento WebSocket:", erro);
    return false;
  }
}

// Envia um evento somente para um usuário específico.
function emitirParaUsuario(usuarioId, evento) {
  let enviados = 0;

  for (const ws of wss.clients) {
    if (
      ws.usuario &&
      String(ws.usuario.id) === String(usuarioId) &&
      enviarEvento(ws, evento)
    ) {
      enviados++;
    }
  }

  return enviados;
}

// Envia um evento somente para usuários dos tipos informados.
function emitirParaTipos(tipos, evento) {
  const tiposPermitidos = Array.isArray(tipos) ? tipos : [tipos];

  let enviados = 0;

  for (const ws of wss.clients) {
    if (
      ws.usuario &&
      tiposPermitidos.includes(ws.usuario.tipo) &&
      enviarEvento(ws, evento)
    ) {
      enviados++;
    }
  }

  return enviados;
}

// Disponibiliza os métodos para as rotas Express.
app.locals.websocket = {
  emitirParaUsuario,
  emitirParaTipos,
};

iniciarExpiracaoPix(app.locals.websocket);

// ======================================================
// INICIALIZAÇÃO
// ======================================================

server.listen(PORT, () => {
  console.log("-----------------------------------");
  console.log("       FRAGA LANCHES");
  console.log("-----------------------------------");
  console.log(`Servidor: http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/admin/admin-dashboard.html`);
  console.log(`Cardápio: http://localhost:${PORT}/admin/admin-cardapio.html`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
  console.log("API: /api");
  console.log("-----------------------------------");
});

// ======================================================
// TRATAMENTO DE ERROS DO SERVIDOR
// ======================================================

server.on("error", (erro) => {
  console.error("Erro no servidor HTTP:", erro);
});
