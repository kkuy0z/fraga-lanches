"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const API = "/api/cliente/perfil";
  const VIACEP_API = "https://viacep.com.br/ws";

  const $ = (id) => document.getElementById(id);

  let enderecos = [];
  let enderecoExclusaoId = null;

  const elementos = {
    formDados: $("formDadosPessoais"),
    formSenha: $("formAlterarSenha"),
    formEndereco: $("enderecoForm"),

    nome: $("perfilNome"),
    email: $("perfilEmail"),
    telefone: $("perfilTelefone"),

    enderecoModal: $("enderecoModal"),
    enderecoModalTitulo: $("enderecoModalTitulo"),
    enderecoId: $("enderecoId"),
    cep: $("enderecoCep"),
    btnBuscarCep: $("btnBuscarCep"),
    rua: $("enderecoLogradouro"),
    numero: $("enderecoNumero"),
    bairro: $("enderecoBairro"),
    cidade: $("enderecoCidade"),
    complemento: $("enderecoComplemento"),

    enderecosList: $("enderecosList"),
    enderecosEmpty: $("enderecosEmptyState"),

    deleteModal: $("deleteEnderecoModal"),
    btnConfirmarDelete: $("btnConfirmarDeleteEndereco"),

    userName: $("userName"),
    dropdownUserName: $("dropdownUserName"),
    userAvatar: $("userAvatar"),

    logout: $("logoutBtn"),
  };

  /* =====================================================
       MENSAGENS
    ===================================================== */

  function mostrarMensagem(mensagem, tipo = "success") {
    let aviso = $("perfilFeedback");

    if (!aviso) {
      aviso = document.createElement("div");
      aviso.id = "perfilFeedback";
      aviso.setAttribute("role", "status");
      aviso.setAttribute("aria-live", "polite");

      const main = document.querySelector("main");

      if (main) {
        main.prepend(aviso);
      }
    }

    aviso.textContent = mensagem;

    aviso.style.padding = "14px 18px";
    aviso.style.margin = "15px auto";
    aviso.style.borderRadius = "8px";
    aviso.style.maxWidth = "1100px";
    aviso.style.fontWeight = "600";
    aviso.style.background = tipo === "error" ? "#5c1717" : "#244b25";
    aviso.style.color = "#ffffff";
    aviso.style.border =
      tipo === "error" ? "1px solid #b94b4b" : "1px solid #4d9950";

    aviso.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }

  /* =====================================================
       REQUISIÇÕES
    ===================================================== */

  async function requisicao(url, opcoes = {}) {
    const resposta = await fetch(url, {
      credentials: "same-origin",
      ...opcoes,
      headers: {
        ...(opcoes.body
          ? {
              "Content-Type": "application/json",
            }
          : {}),
        ...(opcoes.headers || {}),
      },
    });

    let dados = {};

    try {
      dados = await resposta.json();
    } catch {
      dados = {};
    }

    if (!resposta.ok) {
      throw new Error(
        dados.mensagem || "Não foi possível concluir a operação.",
      );
    }

    return dados;
  }

  /* =====================================================
       UTILITÁRIOS
    ===================================================== */

  function escaparHTML(valor) {
    return String(valor ?? "").replace(
      /[&<>"']/g,
      (caractere) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[caractere],
    );
  }

  function atualizarIdentificacao(usuario) {
    const nome = usuario.nome || "Cliente";
    const inicial = nome.trim().charAt(0).toUpperCase() || "?";

    if (elementos.userName) {
      elementos.userName.textContent = nome;
    }

    if (elementos.dropdownUserName) {
      elementos.dropdownUserName.textContent = nome;
    }

    if (elementos.userAvatar) {
      elementos.userAvatar.textContent = inicial;
    }
  }

  function abrirModal(modal) {
    if (!modal) return;

    modal.classList.remove("hidden");
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
  }

  function fecharModal(modal) {
    if (!modal) return;

    modal.classList.remove("show");
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  function formatarCEP(valor) {
    const numeros = String(valor || "")
      .replace(/\D/g, "")
      .slice(0, 8);

    if (numeros.length > 5) {
      return numeros.replace(/^(\d{5})(\d{1,3})$/, "$1-$2");
    }

    return numeros;
  }

  /* =====================================================
       BUSCAR CEP - VIACEP
    ===================================================== */

  async function buscarCEP() {
    if (!elementos.cep) return;

    const cep = elementos.cep.value.replace(/\D/g, "");

    if (cep.length !== 8) {
      mostrarMensagem("Digite um CEP válido com 8 números.", "error");

      elementos.cep.focus();
      return;
    }

    const botao = elementos.btnBuscarCep;
    const textoOriginal = botao?.textContent;

    try {
      if (botao) {
        botao.disabled = true;
        botao.textContent = "Buscando...";
      }

      const resposta = await fetch(`${VIACEP_API}/${cep}/json/`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!resposta.ok) {
        throw new Error("Não foi possível consultar o CEP.");
      }

      const dados = await resposta.json();

      if (dados.erro) {
        throw new Error("CEP não encontrado.");
      }

      if (elementos.rua) {
        elementos.rua.value = dados.logradouro || "";
      }

      if (elementos.bairro) {
        elementos.bairro.value = dados.bairro || "";
      }

      if (elementos.cidade) {
        elementos.cidade.value = dados.localidade || "";
      }

      mostrarMensagem("CEP encontrado! Endereço preenchido automaticamente.");

      if (elementos.numero) {
        elementos.numero.focus();
      }
    } catch (erro) {
      console.error("Erro ao consultar CEP:", erro);

      mostrarMensagem(
        erro.message === "Failed to fetch"
          ? "Não foi possível conectar ao ViaCEP. Verifique sua internet."
          : erro.message,
        "error",
      );
    } finally {
      if (botao) {
        botao.disabled = false;
        botao.textContent = textoOriginal || "Buscar CEP";
      }
    }
  }

  elementos.cep?.addEventListener("input", () => {
    elementos.cep.value = formatarCEP(elementos.cep.value);
  });

  elementos.btnBuscarCep?.addEventListener("click", buscarCEP);

  elementos.cep?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      buscarCEP();
    }
  });

  /* =====================================================
       CARREGAR PERFIL
    ===================================================== */

  async function carregarPerfil() {
    try {
      const dados = await requisicao(API);

      const usuario = dados.usuario;

      if (!usuario) {
        throw new Error("Não foi possível carregar os dados do perfil.");
      }

      if (elementos.nome) {
        elementos.nome.value = usuario.nome || "";
      }

      if (elementos.email) {
        elementos.email.value = usuario.email || "";
        elementos.email.readOnly = true;
      }

      if (elementos.telefone) {
        elementos.telefone.value = usuario.telefone || "";
      }

      atualizarIdentificacao(usuario);

      enderecos = Array.isArray(dados.enderecos) ? dados.enderecos : [];

      renderizarEnderecos();
    } catch (erro) {
      console.error("Erro ao carregar perfil:", erro);

      mostrarMensagem(erro.message, "error");

      if (
        erro.message.toLowerCase().includes("autenticação") ||
        erro.message.toLowerCase().includes("token") ||
        erro.message.toLowerCase().includes("sessão")
      ) {
        window.location.href = "/";
      }
    }
  }

  /* =====================================================
       ATUALIZAR DADOS PESSOAIS
    ===================================================== */

  elementos.formDados?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const telefoneDigitado = elementos.telefone?.value.trim() || "";
    const telefoneValidado = window.FragaTelefone
      ? window.FragaTelefone.validar(telefoneDigitado)
      : { valido: false, mensagem: "Validador de telefone ainda não carregou. Atualize a página." };
    if (!telefoneValidado.valido) {
      mostrarMensagem(telefoneValidado.mensagem || "Informe um telefone válido.", "error");
      elementos.telefone?.focus();
      return;
    }


    const botao = elementos.formDados.querySelector('button[type="submit"]');

    const textoOriginal = botao?.textContent;

    try {
      if (botao) {
        botao.disabled = true;
        botao.textContent = "Salvando...";
      }

      const dados = await requisicao(`${API}/dados`, {
        method: "PUT",
        body: JSON.stringify({
          nome: elementos.nome.value.trim(),
          telefone: telefoneValidado.numero || "",
        }),
      });

      if (dados.usuario) {
        atualizarIdentificacao(dados.usuario);
      }

      mostrarMensagem(
        dados.mensagem || "Dados pessoais atualizados com sucesso.",
      );
    } catch (erro) {
      mostrarMensagem(erro.message, "error");
    } finally {
      if (botao) {
        botao.disabled = false;
        botao.textContent = textoOriginal;
      }
    }
  });

  /* =====================================================
       ALTERAR SENHA
    ===================================================== */

  elementos.formSenha?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const senhaAtual = $("senhaAtual")?.value || "";
    const senhaNova = $("senhaNova")?.value || "";
    const senhaConfirmar = $("senhaConfirmar")?.value || "";

    if (senhaNova.length < 8 || senhaNova.length > 64) {
      mostrarMensagem(
        "A nova senha deve ter entre 8 e 64 caracteres.",
        "error",
      );
      return;
    }

    if (senhaNova !== senhaConfirmar) {
      mostrarMensagem("A confirmação da senha não corresponde.", "error");
      return;
    }

    const botao = elementos.formSenha.querySelector('button[type="submit"]');

    const textoOriginal = botao?.textContent;

    try {
      if (botao) {
        botao.disabled = true;
        botao.textContent = "Alterando...";
      }

      const dados = await requisicao(`${API}/senha`, {
        method: "PUT",
        body: JSON.stringify({
          senhaAtual,
          senhaNova,
          senhaConfirmar,
        }),
      });

      elementos.formSenha.reset();

      mostrarMensagem(dados.mensagem || "Senha alterada com sucesso.");
    } catch (erro) {
      mostrarMensagem(erro.message, "error");
    } finally {
      if (botao) {
        botao.disabled = false;
        botao.textContent = textoOriginal || "Alterar Senha";
      }
    }
  });

  /* =====================================================
       MOSTRAR / OCULTAR SENHAS
    ===================================================== */

  [
    ["toggleSenhaAtual", "senhaAtual"],
    ["toggleSenhaNova", "senhaNova"],
    ["toggleSenhaConfirmar", "senhaConfirmar"],
  ].forEach(([botaoId, campoId]) => {
    const botao = $(botaoId);
    const campo = $(campoId);

    botao?.addEventListener("click", () => {
      if (!campo) return;

      campo.type = campo.type === "password" ? "text" : "password";
    });
  });

  /* =====================================================
       ABAS
    ===================================================== */

  document.querySelectorAll("[data-tab]").forEach((botao) => {
    botao.addEventListener("click", () => {
      const aba = botao.dataset.tab;

      document.querySelectorAll("[data-tab]").forEach((item) => {
        item.classList.remove("active");
        item.setAttribute("aria-selected", "false");
      });

      document.querySelectorAll(".tab-panel").forEach((painel) => {
        painel.classList.remove("active");
        painel.classList.add("hidden");
      });

      botao.classList.add("active");
      botao.setAttribute("aria-selected", "true");

      const painel = $(`tab-${aba}`);

      if (painel) {
        painel.classList.remove("hidden");
        painel.classList.add("active");
      }
    });
  });

  /* =====================================================
       RENDERIZAR ENDEREÇOS
    ===================================================== */

  function renderizarEnderecos() {
    if (!elementos.enderecosList) return;

    elementos.enderecosList.innerHTML = "";

    if (!enderecos.length) {
      elementos.enderecosEmpty?.classList.remove("hidden");
      return;
    }

    elementos.enderecosEmpty?.classList.add("hidden");

    enderecos.forEach((endereco) => {
      const card = document.createElement("article");

      card.className = "card endereco-card";

      const complemento = endereco.complemento
        ? `<p><strong>Complemento:</strong> ${escaparHTML(endereco.complemento)}</p>`
        : "";

      card.innerHTML = `
                <div class="card-body">
                    <h3 class="card-title">
                        ${escaparHTML(endereco.rua)}
                    </h3>

                    <p>
                        <strong>Número:</strong>
                        ${escaparHTML(endereco.numero)}
                    </p>

                    <p>
                        <strong>Bairro:</strong>
                        ${escaparHTML(endereco.bairro)}
                    </p>

                    <p>
                        <strong>Cidade:</strong>
                        ${escaparHTML(endereco.cidade)}
                    </p>

                    ${complemento}

                    <div class="d-flex gap-2" style="margin-top: 18px; flex-wrap: wrap;">
                        <button
                            type="button"
                            class="btn btn-secondary"
                            data-editar="${Number(endereco.id)}">
                            Editar
                        </button>

                        <button
                            type="button"
                            class="btn btn-danger"
                            data-excluir="${Number(endereco.id)}">
                            Excluir
                        </button>
                    </div>
                </div>
            `;

      elementos.enderecosList.appendChild(card);
    });
  }

  /* =====================================================
       NOVO ENDEREÇO
    ===================================================== */

  function limparFormularioEndereco() {
    elementos.formEndereco?.reset();

    if (elementos.enderecoId) {
      elementos.enderecoId.value = "";
    }
  }

  $("btnNovoEndereco")?.addEventListener("click", () => {
    limparFormularioEndereco();

    if (elementos.enderecoModalTitulo) {
      elementos.enderecoModalTitulo.textContent = "Novo Endereço";
    }

    abrirModal(elementos.enderecoModal);
  });

  /* =====================================================
       EDITAR / EXCLUIR ENDEREÇO
    ===================================================== */

  elementos.enderecosList?.addEventListener("click", (event) => {
    const botaoEditar = event.target.closest("[data-editar]");

    if (botaoEditar) {
      const id = Number(botaoEditar.dataset.editar);

      const endereco = enderecos.find((item) => Number(item.id) === id);

      if (!endereco) return;

      limparFormularioEndereco();

      elementos.enderecoId.value = endereco.id;
      elementos.rua.value = endereco.rua || "";
      elementos.numero.value = endereco.numero || "";
      elementos.bairro.value = endereco.bairro || "";
      elementos.cidade.value = endereco.cidade || "";
      elementos.complemento.value = endereco.complemento || "";

      if (elementos.enderecoModalTitulo) {
        elementos.enderecoModalTitulo.textContent = "Editar Endereço";
      }

      abrirModal(elementos.enderecoModal);
      return;
    }

    const botaoExcluir = event.target.closest("[data-excluir]");

    if (botaoExcluir) {
      enderecoExclusaoId = Number(botaoExcluir.dataset.excluir);
      abrirModal(elementos.deleteModal);
    }
  });

  /* =====================================================
       SALVAR ENDEREÇO
    ===================================================== */

  elementos.formEndereco?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const id = elementos.enderecoId.value;

    const dadosEndereco = {
      rua: elementos.rua.value.trim(),
      numero: elementos.numero.value.trim(),
      bairro: elementos.bairro.value.trim(),
      cidade: elementos.cidade.value.trim(),
      complemento: elementos.complemento.value.trim(),
    };

    if (
      !dadosEndereco.rua ||
      !dadosEndereco.numero ||
      !dadosEndereco.bairro ||
      !dadosEndereco.cidade
    ) {
      mostrarMensagem("Preencha rua, número, bairro e cidade.", "error");
      return;
    }

    const botao = $("btnSalvarEndereco");
    const textoOriginal = botao?.textContent;

    try {
      if (botao) {
        botao.disabled = true;
        botao.textContent = "Salvando...";
      }

      const resultado = await requisicao(
        id ? `${API}/enderecos/${id}` : `${API}/enderecos`,
        {
          method: id ? "PUT" : "POST",
          body: JSON.stringify(dadosEndereco),
        },
      );

      fecharModal(elementos.enderecoModal);
      limparFormularioEndereco();

      await carregarPerfil();

      mostrarMensagem(resultado.mensagem || "Endereço salvo com sucesso.");
    } catch (erro) {
      mostrarMensagem(erro.message, "error");
    } finally {
      if (botao) {
        botao.disabled = false;
        botao.textContent = textoOriginal || "Salvar Endereço";
      }
    }
  });

  /* =====================================================
       EXCLUIR ENDEREÇO
    ===================================================== */

  elementos.btnConfirmarDelete?.addEventListener("click", async () => {
    if (!enderecoExclusaoId) return;

    try {
      elementos.btnConfirmarDelete.disabled = true;
      elementos.btnConfirmarDelete.textContent = "Excluindo...";

      const resultado = await requisicao(
        `${API}/enderecos/${enderecoExclusaoId}`,
        {
          method: "DELETE",
        },
      );

      fecharModal(elementos.deleteModal);

      enderecoExclusaoId = null;

      await carregarPerfil();

      mostrarMensagem(resultado.mensagem || "Endereço excluído com sucesso.");
    } catch (erro) {
      mostrarMensagem(erro.message, "error");
    } finally {
      elementos.btnConfirmarDelete.disabled = false;
      elementos.btnConfirmarDelete.textContent = "Excluir";
    }
  });

  /* =====================================================
       FECHAR MODAIS
    ===================================================== */

  $("enderecoModalClose")?.addEventListener("click", () => {
    fecharModal(elementos.enderecoModal);
  });

  $("btnCancelarEnderecoModal")?.addEventListener("click", () => {
    fecharModal(elementos.enderecoModal);
  });

  $("btnCancelarDeleteEndereco")?.addEventListener("click", () => {
    fecharModal(elementos.deleteModal);
    enderecoExclusaoId = null;
  });

  [elementos.enderecoModal, elementos.deleteModal].forEach((modal) => {
    modal?.addEventListener("click", (event) => {
      if (event.target === modal) {
        fecharModal(modal);
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      fecharModal(elementos.enderecoModal);
      fecharModal(elementos.deleteModal);
      enderecoExclusaoId = null;
    }
  });

  /* =====================================================
       MENU DO USUÁRIO
    ===================================================== */

  const userButton = $("userButton");
  const userDropdown = $("userDropdown");
  const userMenu = $("userMenu");

  userButton?.addEventListener("click", () => {
    const aberto = userButton.getAttribute("aria-expanded") === "true";

    userButton.setAttribute("aria-expanded", String(!aberto));

    if (userDropdown) {
      userDropdown.hidden = aberto;
    }
  });

  document.addEventListener("click", (event) => {
    if (userMenu && !userMenu.contains(event.target) && userDropdown) {
      userDropdown.hidden = true;
      userButton?.setAttribute("aria-expanded", "false");
    }
  });

  /* =====================================================
       SAIR DA CONTA
    ===================================================== */

  elementos.logout?.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch (erro) {
      console.error("Erro ao encerrar sessão:", erro);
    }

    window.location.href = "/";
  });

  /* =====================================================
       INICIALIZAÇÃO
    ===================================================== */

  carregarPerfil();
});



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

