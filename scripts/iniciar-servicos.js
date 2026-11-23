"use strict";

const path = require("path");
const fs = require("fs");
const net = require("net");
const { spawn } = require("child_process");

const raiz = path.resolve(__dirname, "..");

const servicos = [
  { nome: "Auth", pasta: "services/auth", porta: 4001 },
  { nome: "Catálogo", pasta: "services/catalogo", porta: 4002 },
  { nome: "Pedidos + PIX", pasta: "services/pedidos", porta: 4003 },
  { nome: "Entregas", pasta: "services/entregas", porta: 4004 },
  { nome: "Cozinha", pasta: "services/cozinha", porta: 4005 },
  { nome: "Notificações", pasta: "services/notificacoes", porta: 4006 },
  { nome: "Avaliações", pasta: "services/avaliacoes", porta: 4007 },
  { nome: "Administração", pasta: "services/administracao", porta: 4008 },
  { nome: "Atendimento", pasta: "services/atendimento", porta: 4009 },
  { nome: "Clientes", pasta: "services/clientes", porta: 4010 },
  { nome: "Gateway", pasta: "backend", porta: 3000 },
];

const processos = new Map();
let encerrando = false;

function verificarPorta(porta) {
  return new Promise((resolve) => {
    const socket = net.createConnection({
      host: "127.0.0.1",
      port: porta,
    });

    socket.setTimeout(1500);

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });

    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function aguardarPorta(servico, processo) {
  const inicio = Date.now();

  while (Date.now() - inicio < 30000) {
    if (encerrando) {
      throw new Error("Inicialização cancelada.");
    }

    if (processo && processo.exitCode !== null) {
      throw new Error(`${servico.nome} encerrou. Código: ${processo.exitCode}`);
    }

    if (await verificarPorta(servico.porta)) {
      console.log(`[OK] ${servico.nome} disponível na porta ${servico.porta}`);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Tempo esgotado aguardando ${servico.nome} na porta ${servico.porta}.`,
  );
}

function iniciarServico(servico) {
  const diretorio = path.join(raiz, servico.pasta);

  console.log(`\n[INICIANDO] ${servico.nome}`);

  const processo = spawn(process.execPath, ["src/server.js"], {
    cwd: diretorio,
    stdio: "inherit",
    env: process.env,
    windowsHide: true,
  });

  processos.set(servico.nome, processo);

  processo.once("error", (erro) => {
    console.error(`[ERRO] ${servico.nome}: ${erro.message}`);
    encerrar(1);
  });

  processo.once("exit", (codigo, sinal) => {
    processos.delete(servico.nome);

    if (!encerrando) {
      console.error(
        `[ERRO] ${servico.nome} encerrou. Código: ${codigo}; sinal: ${sinal}`,
      );
      encerrar(codigo === 0 ? 1 : codigo || 1);
    }
  });

  return processo;
}

async function iniciar() {
  console.log("========================================");
  console.log("       FRAGA LANCHES - MICROSSERVIÇOS");
  console.log("========================================");

  try {
    const arquivoEnv = path.join(raiz, ".env");
    if (!fs.existsSync(arquivoEnv)) {
      throw new Error("Arquivo .env nao encontrado na raiz. Copie .env.example para .env e configure o MySQL e os segredos.");
    }

    for (const servico of servicos) {
      if (await verificarPorta(servico.porta)) {
        console.log(
          `[AVISO] Porta ${servico.porta} já está ocupada. Verificando serviço...`,
        );

        await aguardarPorta(servico, null);
        continue;
      }

      const processo = iniciarServico(servico);
      await aguardarPorta(servico, processo);
    }

    console.log("\n========================================");
    console.log("TODOS OS SERVIÇOS ESTÃO DISPONÍVEIS");
    console.log("========================================");

    for (const servico of servicos) {
      const endereco =
        servico.porta === 3000
          ? "http://localhost:3000"
          : `http://localhost:${servico.porta}/health`;

      console.log(`${servico.nome}: ${endereco}`);
    }

    console.log("========================================");
    console.log(
      "Pressione Ctrl+C para encerrar os serviços iniciados por este processo.\n",
    );
  } catch (erro) {
    console.error("\n[FALHA NA INICIALIZAÇÃO]", erro.message);
    encerrar(1);
  }
}

function encerrar(codigo = 0) {
  if (encerrando) return;

  encerrando = true;

  console.log("\n[FRAGA] Encerrando serviços iniciados pelo inicializador...");

  for (const processo of processos.values()) {
    if (processo.exitCode === null && processo.signalCode === null) {
      processo.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    for (const processo of processos.values()) {
      if (processo.exitCode === null && processo.signalCode === null) {
        processo.kill("SIGKILL");
      }
    }

    process.exit(codigo);
  }, 3000);
}

process.on("SIGINT", () => encerrar(0));
process.on("SIGTERM", () => encerrar(0));

iniciar();
