"use strict";

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const API_AVALIACOES = "/api/cliente/avaliacoes";

// ======================================================
// ESTADO
// ======================================================

let pedidoEmAvaliacao = null;
let avaliacaoCarregando = false;

// ======================================================
// AUXILIARES
// ======================================================

function escaparHTMLAvaliacao(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caractere) => {
    const entidades = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return entidades[caractere];
  });
}

async function requisicaoAvaliacao(url, opcoes = {}) {
  const resposta = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...opcoes,
    headers: {
      Accept: "application/json",
      ...(opcoes.body ? { "Content-Type": "application/json" } : {}),
      ...(opcoes.headers || {}),
    },
  });

  let dados = {};

  try {
    dados = await resposta.json();
  } catch {
    dados = {};
  }

  if (resposta.status === 401) {
    window.location.href = "/cadastro/login.html";
    throw new Error("Sua sessão expirou.");
  }

  if (!resposta.ok) {
    throw new Error(dados.mensagem || "Não foi possível realizar a operação.");
  }

  return dados;
}

function mensagemAvaliacao(texto, tipo = "info") {
  if (typeof window.mostrarMensagem === "function") {
    window.mostrarMensagem(texto, tipo);
    return;
  }

  window.alert(texto);
}

// ======================================================
// IDENTIFICAR PEDIDOS CONCLUÍDOS NA TABELA
// ======================================================

function adicionarBotoesAvaliar() {
  const tabela = document.getElementById("tbodyPedidos");

  if (!tabela) return;

  tabela.querySelectorAll("tr").forEach((linha) => {
    const celulas = linha.querySelectorAll("td");

    if (celulas.length < 6) return;

    const status = celulas[2].textContent.trim().toLowerCase();

    if (status !== "concluído" && status !== "concluido") {
      return;
    }

    const idTexto = celulas[0].textContent.replace("#", "").trim();
    const pedidoId = Number(idTexto);

    if (!Number.isInteger(pedidoId) || pedidoId <= 0) return;

    const areaAcoes = celulas[5];

    if (areaAcoes.querySelector(".btn-avaliar-pedido")) return;

    const botao = document.createElement("button");

    botao.type = "button";
    botao.className = "btn btn-primary btn-avaliar-pedido";
    botao.dataset.id = String(pedidoId);
    botao.textContent = "Avaliar pedido";

    botao.style.marginTop = "6px";

    areaAcoes.appendChild(botao);
  });
}

// ======================================================
// CONSULTAR AVALIAÇÃO
// ======================================================

async function carregarAvaliacao(pedidoId) {
  return requisicaoAvaliacao(
    `${API_AVALIACOES}/${encodeURIComponent(pedidoId)}`,
  );
}

// ======================================================
// CRIAR INTERFACE DE AVALIAÇÃO
// ======================================================

function criarInterfaceAvaliacao(pedidoId, dados) {
  const secao = document.createElement("section");

  secao.id = "secaoAvaliacaoPedido";

  secao.style.cssText = `
    margin-top: 16px;
    padding: 16px;
    border: 1px solid rgba(245, 197, 66, .30);
    border-radius: 12px;
    background: #191919;
  `;

  const avaliacao = dados.avaliacao;

  if (avaliacao) {
    const status = avaliacao.status;

    const statusTexto = {
      pendente: "Aguardando aprovação administrativa",
      aprovada: "Sua avaliação foi aprovada",
      rejeitada: "Sua avaliação foi rejeitada",
    };

    const cor = {
      pendente: "#f5c542",
      aprovada: "#86efac",
      rejeitada: "#fca5a5",
    };

    secao.innerHTML = `
      <h3 style="
        margin:0 0 12px;
        color:#f5c542;
        font-family:Anton,sans-serif;
        font-size:19px;
        font-weight:400;
      ">
        Sua avaliação
      </h3>

      <p style="margin:6px 0;color:#f5f5f5">
        <strong>Nota:</strong>
        ${Number(avaliacao.nota)}/5
      </p>

      <p style="margin:6px 0;color:#f5f5f5">
        <strong>Comentário:</strong>
        ${escaparHTMLAvaliacao(avaliacao.comentario || "Sem comentário.")}
      </p>

      <p style="
        margin:12px 0 0;
        color:${cor[status] || "#f5f5f5"};
        font-size:12px;
        font-weight:700;
      ">
        ${escaparHTMLAvaliacao(statusTexto[status] || status)}
      </p>

      ${
        status === "rejeitada" && avaliacao.motivo_rejeicao
          ? `
            <p style="margin-top:10px;color:#fca5a5;font-size:12px">
              <strong>Motivo:</strong>
              ${escaparHTMLAvaliacao(avaliacao.motivo_rejeicao)}
            </p>
          `
          : ""
      }
    `;

    return secao;
  }

  if (!dados.podeAvaliar) {
    secao.innerHTML = `
      <h3 style="color:#f5c542;font-family:Anton,sans-serif;font-weight:400">
        Avaliação indisponível
      </h3>

      <p style="color:#a5a5a5;font-size:13px">
        Este pedido ainda não está disponível para avaliação.
      </p>
    `;

    return secao;
  }

  secao.innerHTML = `
    <h3 style="
      margin:0 0 8px;
      color:#f5c542;
      font-family:Anton,sans-serif;
      font-size:20px;
      font-weight:400;
    ">
      Avalie seu pedido
    </h3>

    <p style="
      margin:0 0 16px;
      color:#a5a5a5;
      font-size:12px;
      line-height:1.5;
    ">
      Conte como foi sua experiência com a Fraga Lanches.
      Sua avaliação será analisada antes de ser publicada.
    </p>

    <div style="margin-bottom:14px">
      <label
        for="notaAvaliacao"
        style="
          display:block;
          margin-bottom:7px;
          color:#e5e5e5;
          font-size:12px;
          font-weight:700;
        "
      >
        Sua nota
      </label>

      <select
        id="notaAvaliacao"
        class="form-select"
        style="width:100%"
        required
      >
        <option value="">Selecione uma nota</option>
        <option value="5">5 - Excelente</option>
        <option value="4">4 - Muito bom</option>
        <option value="3">3 - Bom</option>
        <option value="2">2 - Regular</option>
        <option value="1">1 - Ruim</option>
      </select>
    </div>

    <div style="margin-bottom:14px">
      <label
        for="comentarioAvaliacao"
        style="
          display:block;
          margin-bottom:7px;
          color:#e5e5e5;
          font-size:12px;
          font-weight:700;
        "
      >
        Comentário (opcional)
      </label>

      <textarea
        id="comentarioAvaliacao"
        maxlength="2000"
        placeholder="Escreva sobre sua experiência..."
        style="
          display:block;
          width:100%;
          min-height:100px;
          padding:12px;
          border:1px solid #383838;
          border-radius:8px;
          outline:none;
          background:#121212;
          color:#f5f5f5;
          font-family:Montserrat,sans-serif;
          font-size:13px;
          resize:vertical;
        "
      ></textarea>

      <small style="display:block;margin-top:5px;color:#888">
        Máximo de 2.000 caracteres.
      </small>
    </div>

    <button
      type="button"
      class="btn btn-primary"
      id="btnEnviarAvaliacao"
      data-pedido-id="${Number(pedidoId)}"
    >
      Enviar avaliação
    </button>
  `;

  return secao;
}

// ======================================================
// EXIBIR AVALIAÇÃO NO MODAL
// ======================================================

async function exibirAvaliacao(pedidoId) {
  const modalBody = document.getElementById("pedidoModalBody");

  if (!modalBody || avaliacaoCarregando) return;

  const detalhes = modalBody.querySelector(".pedido-detalhes");

  if (!detalhes) return;

  const statusPedido = detalhes.querySelector("h3")?.textContent || "";

  if (!statusPedido.includes(`#${pedidoId}`)) return;

  pedidoEmAvaliacao = Number(pedidoId);
  avaliacaoCarregando = true;

  const secaoAnterior = detalhes.querySelector("#secaoAvaliacaoPedido");

  if (secaoAnterior) {
    secaoAnterior.remove();
  }

  const carregando = document.createElement("section");

  carregando.id = "secaoAvaliacaoPedido";
  carregando.innerHTML = `
    <p style="color:#a5a5a5;font-size:13px">
      Carregando informações da avaliação...
    </p>
  `;

  detalhes.appendChild(carregando);

  try {
    const dados = await carregarAvaliacao(pedidoId);

    if (pedidoEmAvaliacao !== Number(pedidoId)) return;

    const interfaceAvaliacao = criarInterfaceAvaliacao(pedidoId, dados);

    carregando.replaceWith(interfaceAvaliacao);
  } catch (erro) {
    console.error("Erro ao carregar avaliação:", erro);

    carregando.innerHTML = `
      <p style="color:#fca5a5;font-size:13px">
        ${escaparHTMLAvaliacao(erro.message)}
      </p>
    `;
  } finally {
    avaliacaoCarregando = false;
  }
}

// ======================================================
// ABRIR PEDIDO PARA AVALIAR
// ======================================================

function abrirPedidoParaAvaliar(pedidoId) {
  const modal = document.getElementById("pedidoModal");

  if (!modal) return;

  const botaoDetalhes = document.querySelector(
    `.btn-ver-pedido[data-id="${CSS.escape(String(pedidoId))}"]`,
  );

  if (!botaoDetalhes) {
    mensagemAvaliacao("Não foi possível localizar este pedido.", "erro");
    return;
  }

  botaoDetalhes.click();

  const observador = new MutationObserver(() => {
    const modalBody = document.getElementById("pedidoModalBody");

    if (!modalBody) return;

    const titulo = modalBody.querySelector(".pedido-detalhes h3");

    if (!titulo || !titulo.textContent.includes(`#${pedidoId}`)) {
      return;
    }

    observador.disconnect();

    exibirAvaliacao(pedidoId);
  });

  observador.observe(document.getElementById("pedidoModalBody"), {
    childList: true,
    subtree: true,
  });

  setTimeout(() => observador.disconnect(), 10000);
}

// ======================================================
// ENVIAR AVALIAÇÃO
// ======================================================

async function enviarAvaliacao(pedidoId) {
  const notaElemento = document.getElementById("notaAvaliacao");
  const comentarioElemento = document.getElementById("comentarioAvaliacao");
  const botao = document.getElementById("btnEnviarAvaliacao");

  if (!notaElemento || !comentarioElemento || !botao) return;

  const nota = Number(notaElemento.value);
  const comentario = comentarioElemento.value.trim();

  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    mensagemAvaliacao("Selecione uma nota entre 1 e 5.", "erro");
    return;
  }

  if (comentario.length > 2000) {
    mensagemAvaliacao("O comentário ultrapassou o limite permitido.", "erro");
    return;
  }

  botao.disabled = true;
  botao.textContent = "Enviando...";

  try {
    const resultado = await requisicaoAvaliacao(
      `${API_AVALIACOES}/${encodeURIComponent(pedidoId)}`,
      {
        method: "POST",
        body: JSON.stringify({
          nota,
          comentario,
        }),
      },
    );

    mensagemAvaliacao(
      resultado.mensagem || "Avaliação enviada com sucesso!",
      "sucesso",
    );

    await exibirAvaliacao(pedidoId);
  } catch (erro) {
    console.error("Erro ao enviar avaliação:", erro);

    mensagemAvaliacao(erro.message, "erro");

    botao.disabled = false;
    botao.textContent = "Enviar avaliação";
  }
}

// ======================================================
// EVENTOS
// ======================================================

document.addEventListener("click", (evento) => {
  const botaoAvaliar = evento.target.closest(".btn-avaliar-pedido");

  if (botaoAvaliar) {
    abrirPedidoParaAvaliar(Number(botaoAvaliar.dataset.id));
    return;
  }

  const botaoEnviar = evento.target.closest("#btnEnviarAvaliacao");

  if (botaoEnviar) {
    enviarAvaliacao(Number(botaoEnviar.dataset.pedidoId));
  }
});

// ======================================================
// OBSERVAR ATUALIZAÇÕES DA TABELA
// ======================================================

function observarTabelaPedidos() {
  const tabela = document.getElementById("tbodyPedidos");

  if (!tabela) return;

  const observador = new MutationObserver(() => {
    adicionarBotoesAvaliar();
  });

  observador.observe(tabela, {
    childList: true,
    subtree: true,
  });

  adicionarBotoesAvaliar();
}

// ======================================================
// INICIALIZAÇÃO
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
  observarTabelaPedidos();
});
