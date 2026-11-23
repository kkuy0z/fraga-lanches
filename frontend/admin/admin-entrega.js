"use strict";

// ======================================================
// INICIALIZAÇÃO
// ======================================================

function iniciarAdminEntrega() {
  console.log("[ADMIN ENTREGA] Inicializando...");

  // ELEMENTOS
  const formConfig = document.getElementById("formConfigEntrega");
  const taxaEntregaInput = document.getElementById("taxaEntrega");
  const valorMinimoInput = document.getElementById("valorMinimoEntrega");
  const tempoMedioInput = document.getElementById("tempoMedioEntrega");
  const btnSalvarConfig = document.getElementById("btnSalvarConfigEntrega");

  const tabelaBairros = document.getElementById("tabelaBairros");
  const tbodyBairros = document.getElementById("tbodyBairros");
  const emptyStateBairros = document.getElementById("emptyStateBairros");
  const btnNovoBairro = document.getElementById("btnNovoBairro");

  const bairroModal = document.getElementById("bairroModal");
  const bairroForm = document.getElementById("bairroForm");
  const bairroModalTitulo = document.getElementById("bairroModalTitulo");
  const bairroIdInput = document.getElementById("bairroId");
  const bairroNomeInput = document.getElementById("bairroNome");
  const bairroTaxaInput = document.getElementById("bairroTaxaExtra");
  const bairroAtivoInput = document.getElementById("bairroAtivo");

  const btnSalvarBairro = document.getElementById("btnSalvarBairro");
  const bairroModalClose = document.getElementById("bairroModalClose");
  const btnCancelarBairro = document.getElementById("btnCancelarBairro");

  const deleteBairroModal = document.getElementById("deleteBairroModal");
  const deleteBairroNome = document.getElementById("deleteBairroNome");
  const btnCancelarDeleteBairro = document.getElementById(
    "btnCancelarDeleteBairro",
  );
  const btnConfirmarDeleteBairro = document.getElementById(
    "btnConfirmarDeleteBairro",
  );

  // VALIDAR ELEMENTOS
  const obrigatorios = {
    formConfig,
    taxaEntregaInput,
    valorMinimoInput,
    tempoMedioInput,
    btnSalvarConfig,
    tabelaBairros,
    tbodyBairros,
    emptyStateBairros,
    btnNovoBairro,
    bairroModal,
    bairroForm,
    bairroModalTitulo,
    bairroIdInput,
    bairroNomeInput,
    bairroTaxaInput,
    bairroAtivoInput,
    btnSalvarBairro,
    bairroModalClose,
    btnCancelarBairro,
    deleteBairroModal,
    deleteBairroNome,
    btnCancelarDeleteBairro,
    btnConfirmarDeleteBairro,
  };

  const ausentes = Object.entries(obrigatorios)
    .filter(([, elemento]) => !elemento)
    .map(([nome]) => nome);

  if (ausentes.length) {
    console.error("[ADMIN ENTREGA] Elementos ausentes:", ausentes);
    alert(
      "Erro ao iniciar a página. Elementos ausentes: " + ausentes.join(", "),
    );
    return;
  }

  // ESTADO
  const API = "/api/admin/entrega";

  let bairros = [];
  let bairroParaExcluir = null;
  let carregando = false;

  // ======================================================
  // UTILITÁRIOS
  // ======================================================

  function escaparHTML(valor) {
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

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function converterNumero(valor) {
    const numero = Number(valor);

    if (!Number.isFinite(numero) || numero < 0) {
      return null;
    }

    return Math.round(numero * 100) / 100;
  }

  function mensagem(texto, tipo = "info") {
    alert(tipo === "erro" ? "Erro: " + texto : texto);
  }

  async function requisicao(url, opcoes = {}) {
    const resposta = await fetch(url, {
      ...opcoes,
      credentials: "same-origin",
      headers: {
        ...(opcoes.headers || {}),
        "Content-Type": "application/json",
      },
    });

    const texto = await resposta.text();

    let dados = {};

    if (texto) {
      try {
        dados = JSON.parse(texto);
      } catch {
        throw new Error("O servidor retornou uma resposta inválida.");
      }
    }

    if (!resposta.ok) {
      throw new Error(
        dados.mensagem ||
          `Não foi possível concluir a operação. HTTP ${resposta.status}.`,
      );
    }

    return dados;
  }

  function definirCarregamento(botao, estado, textoOriginal) {
    if (!botao) return;

    botao.disabled = estado;
    botao.style.opacity = estado ? "0.65" : "";
    botao.style.cursor = estado ? "wait" : "";

    if (estado) {
      if (!botao.dataset.textoOriginal) {
        botao.dataset.textoOriginal = botao.textContent.trim();
      }

      botao.textContent = "Aguarde...";
    } else {
      botao.textContent =
        textoOriginal || botao.dataset.textoOriginal || botao.textContent;
    }
  }

  // ======================================================
  // CONTROLE DOS MODAIS
  // ======================================================

  function abrirModalBairro(bairro = null) {
    bairroForm.reset();
    bairroIdInput.value = "";

    if (bairro) {
      bairroModalTitulo.textContent = "Editar Bairro";
      bairroIdInput.value = bairro.id;
      bairroNomeInput.value = bairro.nome;
      bairroTaxaInput.value = Number(bairro.taxa_final).toFixed(2);

      bairroAtivoInput.checked =
        bairro.ativo === true || Number(bairro.ativo) === 1;
    } else {
      bairroModalTitulo.textContent = "Novo Bairro";
      bairroTaxaInput.value = "0.00";
      bairroAtivoInput.checked = true;
    }

    bairroModal.classList.remove("hidden");
    bairroModal.style.display = "flex";
    bairroModal.setAttribute("aria-hidden", "false");

    document.body.style.overflow = "hidden";

    console.log("[ADMIN ENTREGA] Modal aberto.");

    requestAnimationFrame(() => {
      bairroNomeInput.focus();
    });
  }

  function fecharModalBairro() {
    bairroModal.classList.add("hidden");
    bairroModal.style.display = "none";
    bairroModal.setAttribute("aria-hidden", "true");

    document.body.style.overflow = "";

    bairroForm.reset();
    bairroIdInput.value = "";
  }

  function abrirModalExclusao(bairro) {
    bairroParaExcluir = bairro;

    deleteBairroNome.textContent = bairro.nome;

    deleteBairroModal.classList.remove("hidden");
    deleteBairroModal.style.display = "flex";
    deleteBairroModal.setAttribute("aria-hidden", "false");

    document.body.style.overflow = "hidden";
  }

  function fecharModalExclusao() {
    bairroParaExcluir = null;

    deleteBairroModal.classList.add("hidden");
    deleteBairroModal.style.display = "none";
    deleteBairroModal.setAttribute("aria-hidden", "true");

    document.body.style.overflow = "";
  }

  // Garantir estado inicial dos modais
  bairroModal.classList.add("hidden");
  bairroModal.style.display = "none";

  deleteBairroModal.classList.add("hidden");
  deleteBairroModal.style.display = "none";

  // ======================================================
  // CARREGAR CONFIGURAÇÕES
  // ======================================================

  async function carregarConfiguracoes() {
    const dados = await requisicao(API);

    if (!dados.configuracoes) {
      throw new Error("Configurações de entrega não encontradas.");
    }

    const config = dados.configuracoes;

    taxaEntregaInput.value = Number(config.taxa_padrao).toFixed(2);
    valorMinimoInput.value = Number(config.valor_minimo).toFixed(2);
    tempoMedioInput.value = config.tempo_medio_minutos;

    bairros = Array.isArray(dados.bairros) ? dados.bairros : [];

    renderizarBairros();

    console.log("[ADMIN ENTREGA] Configurações carregadas.");
  }

  // ======================================================
  // RENDERIZAR BAIRROS
  // ======================================================

  function renderizarBairros() {
    tbodyBairros.innerHTML = "";

    if (bairros.length === 0) {
      emptyStateBairros.classList.remove("hidden");

      tbodyBairros.innerHTML = `
        <tr>
          <td colspan="4" class="text-center py-4">
            Nenhum bairro cadastrado.
          </td>
        </tr>
      `;

      return;
    }

    emptyStateBairros.classList.add("hidden");

    bairros.forEach((bairro) => {
      const ativo = bairro.ativo === true || Number(bairro.ativo) === 1;

      const linha = document.createElement("tr");

      linha.innerHTML = `
        <td>${escaparHTML(bairro.nome)}</td>

        <td>
          <strong>${formatarMoeda(bairro.taxa_final)}</strong>
        </td>

        <td>
          ${
            ativo
              ? '<span class="badge badge-info">Ativo</span>'
              : '<span class="badge">Inativo</span>'
          }
        </td>

        <td>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button
              type="button"
              class="btn btn-secondary"
              data-acao="editar"
              data-id="${Number(bairro.id)}"
            >
              Editar
            </button>

            <button
              type="button"
              class="btn btn-danger"
              data-acao="excluir"
              data-id="${Number(bairro.id)}"
            >
              Excluir
            </button>
          </div>
        </td>
      `;

      tbodyBairros.appendChild(linha);
    });
  }

  // ======================================================
  // EVENTO: NOVO BAIRRO
  // ======================================================

  btnNovoBairro.addEventListener("click", (evento) => {
    evento.preventDefault();
    evento.stopPropagation();

    console.log("[ADMIN ENTREGA] Clique em Adicionar Bairro.");

    if (carregando) return;

    abrirModalBairro();
  });

  // ======================================================
  // EVENTOS: FECHAR MODAIS
  // ======================================================

  bairroModalClose.addEventListener("click", fecharModalBairro);
  btnCancelarBairro.addEventListener("click", fecharModalBairro);

  bairroModal.addEventListener("click", (evento) => {
    if (evento.target === bairroModal) {
      fecharModalBairro();
    }
  });

  btnCancelarDeleteBairro.addEventListener("click", fecharModalExclusao);

  deleteBairroModal.addEventListener("click", (evento) => {
    if (evento.target === deleteBairroModal) {
      fecharModalExclusao();
    }
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
      if (!bairroModal.classList.contains("hidden")) {
        fecharModalBairro();
      }

      if (!deleteBairroModal.classList.contains("hidden")) {
        fecharModalExclusao();
      }
    }
  });

  // ======================================================
  // SALVAR CONFIGURAÇÕES GERAIS
  // ======================================================

  formConfig.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    if (carregando) return;

    const taxaPadrao = converterNumero(taxaEntregaInput.value);
    const valorMinimo = converterNumero(valorMinimoInput.value);
    const tempoMedio = Number(tempoMedioInput.value);

    if (taxaPadrao === null) {
      mensagem("Informe uma taxa padrão válida.", "erro");
      taxaEntregaInput.focus();
      return;
    }

    if (valorMinimo === null) {
      mensagem("Informe um valor mínimo válido.", "erro");
      valorMinimoInput.focus();
      return;
    }

    if (!Number.isInteger(tempoMedio) || tempoMedio < 1 || tempoMedio > 1440) {
      mensagem(
        "O tempo médio deve ser um número inteiro entre 1 e 1440 minutos.",
        "erro",
      );

      tempoMedioInput.focus();
      return;
    }

    try {
      carregando = true;
      definirCarregamento(btnSalvarConfig, true);

      const resposta = await requisicao(`${API}/configuracoes`, {
        method: "PUT",
        body: JSON.stringify({
          taxa_padrao: taxaPadrao,
          valor_minimo: valorMinimo,
          tempo_medio_minutos: tempoMedio,
        }),
      });

      await carregarConfiguracoes();

      mensagem(resposta.mensagem || "Configurações salvas com sucesso.");
    } catch (erro) {
      console.error("[ADMIN ENTREGA] Erro ao salvar configurações:", erro);
      mensagem(erro.message, "erro");
    } finally {
      carregando = false;
      definirCarregamento(btnSalvarConfig, false, "Salvar Configurações");
    }
  });

  // ======================================================
  // CADASTRAR / EDITAR BAIRRO
  // ======================================================

  bairroForm.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    if (carregando) return;

    const id = bairroIdInput.value.trim();
    const nome = bairroNomeInput.value.trim();
    const taxaFinal = converterNumero(bairroTaxaInput.value);

    if (nome.length < 2 || nome.length > 100) {
      mensagem("O nome do bairro deve ter entre 2 e 100 caracteres.", "erro");

      bairroNomeInput.focus();
      return;
    }

    if (taxaFinal === null) {
      mensagem("Informe uma taxa válida para o bairro.", "erro");
      bairroTaxaInput.focus();
      return;
    }

    const dadosBairro = {
      nome,
      taxa_final: taxaFinal,
      ativo: bairroAtivoInput.checked,
    };

    try {
      carregando = true;
      definirCarregamento(btnSalvarBairro, true);

      const url = id
        ? `${API}/bairros/${encodeURIComponent(id)}`
        : `${API}/bairros`;

      const resposta = await requisicao(url, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(dadosBairro),
      });

      fecharModalBairro();

      await carregarConfiguracoes();

      mensagem(
        resposta.mensagem ||
          (id
            ? "Bairro atualizado com sucesso."
            : "Bairro cadastrado com sucesso."),
      );
    } catch (erro) {
      console.error("[ADMIN ENTREGA] Erro ao salvar bairro:", erro);
      mensagem(erro.message, "erro");
    } finally {
      carregando = false;
      definirCarregamento(btnSalvarBairro, false, "Salvar Bairro");
    }
  });

  // ======================================================
  // EVENTOS DA TABELA: EDITAR / EXCLUIR
  // ======================================================

  tbodyBairros.addEventListener("click", (evento) => {
    const botao = evento.target.closest("button[data-acao]");

    if (!botao) return;

    const id = Number(botao.dataset.id);
    const acao = botao.dataset.acao;

    const bairro = bairros.find((item) => Number(item.id) === id);

    if (!bairro) {
      mensagem("Bairro não encontrado.", "erro");
      return;
    }

    if (acao === "editar") {
      abrirModalBairro(bairro);
    }

    if (acao === "excluir") {
      abrirModalExclusao(bairro);
    }
  });

  // ======================================================
  // EXCLUIR BAIRRO
  // ======================================================

  btnConfirmarDeleteBairro.addEventListener("click", async () => {
    if (!bairroParaExcluir || carregando) return;

    const id = bairroParaExcluir.id;

    try {
      carregando = true;

      definirCarregamento(btnConfirmarDeleteBairro, true);

      const resposta = await requisicao(
        `${API}/bairros/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        },
      );

      fecharModalExclusao();

      await carregarConfiguracoes();

      mensagem(resposta.mensagem || "Bairro excluído com sucesso.");
    } catch (erro) {
      console.error("[ADMIN ENTREGA] Erro ao excluir bairro:", erro);
      mensagem(erro.message, "erro");
    } finally {
      carregando = false;

      definirCarregamento(btnConfirmarDeleteBairro, false, "Excluir");
    }
  });

  // ======================================================
  // TEXTOS DA INTERFACE
  // ======================================================

  const cabecalhoTaxa = tabelaBairros.querySelector("thead th:nth-child(2)");

  if (cabecalhoTaxa) {
    cabecalhoTaxa.textContent = "Taxa Final (R$)";
  }

  const labelTaxa = document.querySelector('label[for="bairroTaxaExtra"]');

  if (labelTaxa) {
    labelTaxa.textContent = "Taxa Final (R$) *";
  }

  const ajudaTaxa = bairroTaxaInput.parentElement.querySelector(".form-help");

  if (ajudaTaxa) {
    ajudaTaxa.textContent =
      "Valor total da entrega para este bairro. Não é somado à taxa padrão.";
  }

  // ======================================================
  // INICIALIZAÇÃO DOS DADOS
  // ======================================================

  async function inicializar() {
    try {
      await carregarConfiguracoes();
    } catch (erro) {
      console.error("[ADMIN ENTREGA] Erro ao carregar dados:", erro);

      tbodyBairros.innerHTML = `
        <tr>
          <td colspan="4" class="text-center py-4">
            Não foi possível carregar os dados.
          </td>
        </tr>
      `;

      mensagem(erro.message, "erro");
    }
  }

  console.log("[ADMIN ENTREGA] Eventos registrados com sucesso.");

  inicializar();
}

// Funciona mesmo se o DOMContentLoaded já tiver ocorrido.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciarAdminEntrega, {
    once: true,
  });
} else {
  iniciarAdminEntrega();
}



/* =====================================================
   CENTRAL DE NOTIFICAÇÕES FRAGA LANCHES
   ===================================================== */
(function () {
    "use strict";

    if (window.fragaNotificacoesIniciado) return;
    window.fragaNotificacoesIniciado = true;

    function iniciarNotificacoes() {
        const cabecalho = document.querySelector(".header-actions");

        if (!cabecalho) return;

        if (document.querySelector(".fraga-notificacao")) return;

        const container = document.createElement("div");
        container.className = "fraga-notificacao";

        const botao = document.createElement("button");
        botao.className = "fraga-sino";
        botao.type = "button";
        botao.setAttribute("aria-label", "Notificações");
        botao.setAttribute("title", "Notificações");
        botao.textContent = "🔔";

        const contador = document.createElement("span");
        contador.className = "fraga-contador";

        const painel = document.createElement("div");
        painel.className = "fraga-painel-notificacoes";

        const topo = document.createElement("div");
        topo.className = "fraga-notificacoes-topo";

        const titulo = document.createElement("strong");
        titulo.textContent = "Notificações";

        const marcarTodas = document.createElement("button");
        marcarTodas.className = "fraga-marcar-todas";
        marcarTodas.type = "button";
        marcarTodas.textContent = "Marcar todas como lidas";

        const lista = document.createElement("div");
        lista.className = "fraga-lista-notificacoes";

        topo.append(titulo, marcarTodas);
        painel.append(topo, lista);
        container.append(botao, contador, painel);

        cabecalho.prepend(container);

        let notificacoes = [];

        function atualizarContador(valor) {
            const quantidade = Number(valor) || 0;

            contador.textContent = quantidade > 99 ? "99+" : quantidade;
            contador.style.display = quantidade > 0 ? "flex" : "none";
        }

        function formatarData(data) {
            if (!data) return "";

            const dataValida = new Date(data);

            if (Number.isNaN(dataValida.getTime())) return "";

            return dataValida.toLocaleString("pt-BR");
        }

        function renderizar(dados) {
            lista.replaceChildren();

            if (!Array.isArray(dados) || dados.length === 0) {
                const vazio = document.createElement("div");
                vazio.className = "fraga-notificacao-vazia";
                vazio.textContent = "Nenhuma notificação encontrada.";
                lista.appendChild(vazio);
                return;
            }

            dados.forEach(function (notificacao) {
                const item = document.createElement("div");

                item.className = "fraga-notificacao-item";

                if (!Number(notificacao.lida)) {
                    item.classList.add("nao-lida");
                }

                const tituloItem = document.createElement("strong");
                tituloItem.textContent = notificacao.titulo || "Notificação";

                const mensagem = document.createElement("p");
                mensagem.textContent = notificacao.mensagem || "";

                const data = document.createElement("small");
                data.textContent = formatarData(notificacao.data_criacao);

                item.append(tituloItem, mensagem, data);

                if (!Number(notificacao.lida)) {
                    item.addEventListener("click", async function () {
                        try {
                            const resposta = await fetch(
                                "/api/notificacoes/" +
                                encodeURIComponent(notificacao.id) +
                                "/lida",
                                {
                                    method: "PATCH",
                                    credentials: "same-origin"
                                }
                            );

                            if (resposta.ok) {
                                await carregarNotificacoes();
                            }
                        } catch (erro) {
                            console.error(
                                "[Notificações] Erro ao marcar como lida:",
                                erro
                            );
                        }
                    });
                }

                lista.appendChild(item);
            });
        }

        async function carregarNotificacoes() {
            try {
                const resposta = await fetch("/api/notificacoes", {
                    method: "GET",
                    credentials: "same-origin",
                    headers: {
                        "Accept": "application/json"
                    }
                });

                if (resposta.status === 401 || resposta.status === 403) {
                    return;
                }

                if (!resposta.ok) {
                    throw new Error("Falha ao carregar notificações.");
                }

                const dados = await resposta.json();

                notificacoes = Array.isArray(dados.notificacoes)
                    ? dados.notificacoes
                    : [];

                atualizarContador(dados.naoLidas);
                renderizar(notificacoes);

            } catch (erro) {
                console.error("[Notificações]", erro);
            }
        }

        botao.addEventListener("click", function (evento) {
            evento.stopPropagation();

            painel.classList.toggle("aberto");

            if (painel.classList.contains("aberto")) {
                carregarNotificacoes();
            }
        });

        painel.addEventListener("click", function (evento) {
            evento.stopPropagation();
        });

        document.addEventListener("click", function () {
            painel.classList.remove("aberto");
        });

        marcarTodas.addEventListener("click", async function () {
            try {
                const resposta = await fetch("/api/notificacoes/lidas", {
                    method: "PATCH",
                    credentials: "same-origin"
                });

                if (resposta.ok) {
                    await carregarNotificacoes();
                }
            } catch (erro) {
                console.error(
                    "[Notificações] Erro ao marcar todas:",
                    erro
                );
            }
        });

        function conectarWebSocket() {
            const protocolo =
                location.protocol === "https:" ? "wss:" : "ws:";

            const ws = new WebSocket(
                protocolo + "//" + location.host + "/ws"
            );

            ws.addEventListener("message", function () {
                carregarNotificacoes();
            });

            ws.addEventListener("close", function () {
                setTimeout(conectarWebSocket, 5000);
            });

            ws.addEventListener("error", function () {
                ws.close();
            });
        }

        carregarNotificacoes();
        conectarWebSocket();
    }

    function aguardarCabecalho() {
        const encontrar = () => {
            const area = document.querySelector(".header-actions");

            if (!area) return false;

            iniciarNotificacoes();
            return true;
        };

        if (encontrar()) return;

        const observador = new MutationObserver(() => {
            if (encontrar()) {
                observador.disconnect();
            }
        });

        observador.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            aguardarCabecalho,
            { once: true }
        );
    } else {
        aguardarCabecalho();
    }
})();

