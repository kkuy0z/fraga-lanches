"use strict";

const express = require("express");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../../backend/.env"),
});

const db = require("./database");

const adminCategoriasRoutes = require("./routes/adminCategorias");
const adminProdutosRoutes = require("./routes/adminProdutos");
const adminDashboardRoutes = require("./routes/adminDashboard");
const adminFormasPagamentoRoutes = require("./routes/adminFormasPagamento");

const app = express();
const PORT = 4008;

app.disable("x-powered-by");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

// O WebSocket continua centralizado no Gateway.
function enviarEventoGateway(destino, dados) {
  const segredo = process.env.INTERNAL_SERVICE_SECRET;

  if (!segredo) {
    console.error("[AdministraÃ§Ã£o] INTERNAL_SERVICE_SECRET nÃ£o configurada.");
    return;
  }

  fetch("http://127.0.0.1:3000/internal/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-service-secret": segredo,
    },
    body: JSON.stringify({
      destino,
      ...dados,
    }),
    signal: AbortSignal.timeout(5000),
  })
    .then((resposta) => {
      if (!resposta.ok) {
        console.error(
          "[AdministraÃ§Ã£o] Gateway recusou evento:",
          resposta.status
        );
      }
    })
    .catch((erro) => {
      console.error(
        "[AdministraÃ§Ã£o] Falha ao encaminhar evento:",
        erro.message
      );
    });
}

app.locals.websocket = {
  emitirParaUsuario(usuarioId, evento) {
    enviarEventoGateway("usuario", {
      usuarioId,
      evento,
    });
  },

  emitirParaTipos(tipos, evento) {
    enviarEventoGateway("equipe", {
      tipos,
      evento,
    });
  },
};

app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");

    res.json({
      servico: "administracao",
      status: "online",
      banco: "conectado",
    });
  } catch (erro) {
    res.status(503).json({
      servico: "administracao",
      status: "degradado",
      banco: "indisponivel",
    });
  }
});

app.use("/api/admin/categorias", adminCategoriasRoutes);
app.use("/api/admin/produtos", adminProdutosRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/pagamentos", adminFormasPagamentoRoutes);

const servidor = app.listen(PORT, "0.0.0.0", () => {
  console.log("------------------------------------");
  console.log("FRAGA LANCHES - ADMINISTRAÃ‡ÃƒO");
  console.log("------------------------------------");
  console.log("Porta:", PORT);
});

let encerrando = false;

async function encerrar() {
  if (encerrando) return;

  encerrando = true;

  console.log("[AdministraÃ§Ã£o] Encerrando serviÃ§o...");

  servidor.close(async () => {
    try {
      await db.end();
    } catch (erro) {
      console.error("[AdministraÃ§Ã£o] Erro ao fechar banco:", erro.message);
    }

    process.exit(0);
  });

  setTimeout(() => process.exit(1), 8000).unref();
}

process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);

module.exports = app;

