"use strict";

const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const http = require("http");
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
const atendentePedidosRoutes = require("./routes/atendentePedidos");

const cozinhaRoutes = require("./routes/cozinha");

const adminAvaliacoesRoutes = require("./routes/adminAvaliacoes");
const adminAtribuicoesRoutes = require("./routes/adminAtribuicoes");
const entregadorRoutes = require("./routes/entregador");
const clienteNotificacoesRoutes = require("./routes/clienteNotificacoes");

const adminHorariosRoutes = require("./routes/adminHorarios");
const adminEntregaRoutes = require("./routes/adminEntrega");
const adminCategoriasRoutes = require("./routes/adminCategorias");
const adminProdutosRoutes = require("./routes/adminProdutos");
const adminPedidosRoutes = require("./routes/adminPedidos");
const adminDashboardRoutes = require("./routes/adminDashboard");
const notificacoesRoutes = require("./routes/notificacoes");
const clienteAvaliacoesRoutes = require("./routes/clienteAvaliacoes");
const formasPagamentoRoutes = require("./routes/formasPagamento");
const clientePerfilRoutes = require("./routes/clientePerfil");
const pedidosRoutes = require("./routes/pedidos");
const authRoutes = require("./routes/auth");
const cardapioRoutes = require("./routes/cardapio");
const carrinhoRoutes = require("./routes/carrinho");
const adminFormasPagamentoRoutes = require("./routes/adminFormasPagamento");

// ======================================================
// APLICAÇÃO
// ======================================================

const app = express();

const PORT = process.env.PORT || 3000;
const frontendPath = path.resolve(__dirname, "../../frontend");

// ======================================================
// MIDDLEWARES
// ======================================================

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ======================================================
// ROTAS ADMINISTRATIVAS
// ======================================================

app.use("/api/admin/avaliacoes", adminAvaliacoesRoutes);
app.use("/api/admin/atribuicoes", adminAtribuicoesRoutes);

app.use("/api/admin/horarios", adminHorariosRoutes);
app.use("/api/admin/entrega", adminEntregaRoutes);
app.use("/api/admin/categorias", adminCategoriasRoutes);
app.use("/api/admin/produtos", adminProdutosRoutes);
app.use("/api/admin/pedidos", adminPedidosRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/pagamentos", adminFormasPagamentoRoutes);

app.use("/api/formas-pagamento", formasPagamentoRoutes);

// ======================================================
// ROTAS DO CLIENTE
// ======================================================
app.use("/api/cliente/avaliacoes", clienteAvaliacoesRoutes);
app.use("/api/cliente/perfil", clientePerfilRoutes);
app.use("/api/cliente/pedidos", pedidosRoutes);
app.use("/api/cliente/carrinho", carrinhoRoutes);
app.use("/api/cliente/notificacoes", clienteNotificacoesRoutes);

// ======================================================
// ROTAS DO ENTREGADOR
// ======================================================

app.use("/api/entregador", entregadorRoutes);

// ======================================================
// ROTAS DO ATENDENTE
// ======================================================

app.use("/api/atendente/pedidos", atendentePedidosRoutes);

// ======================================================
// ROTAS DA COZINHA
// ======================================================

app.use("/api/cozinha/pedidos", cozinhaRoutes);

// ======================================================
// ROTAS GERAIS
// ======================================================

app.use("/api/notificacoes", notificacoesRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/cardapio", cardapioRoutes);
app.use("/api/pedidos", pedidosRoutes);

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
