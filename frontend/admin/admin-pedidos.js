
const API = "/api/admin/pedidos";
const API_AUTH = "/api/auth";

const tbody = document.getElementById("tbodyPedidos");
const buscaPedido = document.getElementById("buscaPedido");
const filtroStatus = document.getElementById("filtroStatus");
const filtroPagamento = document.getElementById("filtroPagamento");
const dataInicio = document.getElementById("dataInicio");
const dataFim = document.getElementById("dataFim");
const btnLimparFiltros = document.getElementById("btnLimparFiltros");

const emptyState = document.getElementById("emptyState");
const pagination = document.getElementById("pagination");

const pedidoModal = document.getElementById("pedidoModal");
const pedidoModalBody = document.getElementById("pedidoModalBody");
const pedidoModalTitulo = document.getElementById("pedidoModalTitulo");

const statusModal = document.getElementById("statusModal");
const statusForm = document.getElementById("statusForm");
const statusPedidoId = document.getElementById("statusPedidoId");
const novoStatus = document.getElementById("novoStatus");

let pedidos = [];

const STATUS = {
    novo: "Novo",
    em_preparo: "Em preparo",
    pronto: "Pronto",
    saiu_para_entrega: "Saiu para entrega",
    concluido: "Concluído",
    cancelado: "Cancelado"
};

const FORMAS_PAGAMENTO = {
    pix: "PIX",
    cartao: "Cartão",
    dinheiro: "Dinheiro"
};

const STATUS_CLASSES = {
    novo: "badge-warning",
    em_preparo: "badge-info",
    pronto: "badge-success",
    saiu_para_entrega: "badge-info",
    concluido: "badge-success",
    cancelado: "badge-danger"
};

function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[caractere]);
}

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function formatarData(data) {
    if (!data) return "-";

    const dataObj = new Date(data);

    if (Number.isNaN(dataObj.getTime())) return "-";

    return dataObj.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function mostrarMensagem(mensagem) {
    alert(mensagem);
}

function obterStatus(status) {
    return STATUS[status] || status || "Desconhecido";
}

function obterClasseStatus(status) {
    return STATUS_CLASSES[status] || "badge-secondary";
}

function obterFormaPagamento(forma) {
    return FORMAS_PAGAMENTO[forma] || forma || "Não informado";
}

async function requisicao(url, opcoes = {}) {
    const resposta = await fetch(url, {
        credentials: "same-origin",
        ...opcoes,
        headers: {
            "Content-Type": "application/json",
            ...(opcoes.headers || {})
        }
    });

    let dados = {};

    try {
        dados = await resposta.json();
    } catch {
        dados = {};
    }

    if (resposta.status === 401 || resposta.status === 403) {
        window.location.href = "/admin/admin-login.html";
        throw new Error("Sessão inválida ou sem permissão.");
    }

    if (!resposta.ok) {
        throw new Error(dados.mensagem || "Não foi possível concluir a operação.");
    }

    return dados;
}

// AUTENTICAÇÃO

async function carregarUsuario() {
    try {
        const dados = await requisicao(`${API_AUTH}/me`);
        const usuario = dados.usuario;

        if (!usuario || usuario.tipo !== "admin") {
            window.location.href = "/admin/admin-login.html";
            return;
        }

        const nome = usuario.nome || "Administrador";

        const userName = document.getElementById("userName");
        const userAvatar = document.getElementById("userAvatar");
        const dropdownUserName = document.getElementById("dropdownUserName");

        if (userName) userName.textContent = nome;
        if (userAvatar) userAvatar.textContent = nome.charAt(0).toUpperCase();
        if (dropdownUserName) dropdownUserName.textContent = nome;

    } catch (erro) {
        console.error("Erro ao carregar administrador:", erro);
    }
}

function configurarMenu() {
    const userButton = document.getElementById("userButton");
    const userDropdown = document.getElementById("userDropdown");
    const logoutBtn = document.getElementById("logoutBtn");

    if (userButton && userDropdown) {
        userButton.addEventListener("click", () => {
            const aberto = userDropdown.classList.toggle("active");
            userButton.setAttribute("aria-expanded", String(aberto));
        });

        document.addEventListener("click", evento => {
            if (
                !userButton.contains(evento.target) &&
                !userDropdown.contains(evento.target)
            ) {
                userDropdown.classList.remove("active");
                userButton.setAttribute("aria-expanded", "false");
            }
        });
    }

    logoutBtn?.addEventListener("click", async () => {
        try {
            await requisicao(`${API_AUTH}/logout`, { method: "POST" });
            window.location.href = "/admin/admin-login.html";
        } catch (erro) {
            mostrarMensagem(erro.message);
        }
    });

    const navToggle = document.getElementById("adminNavToggle");
    const nav = document.getElementById("adminNav");

    navToggle?.addEventListener("click", () => {
        const aberto = nav.classList.toggle("active");
        navToggle.setAttribute("aria-expanded", String(aberto));
    });
}

// PEDIDOS

async function carregarPedidos() {
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="text-center py-4">Carregando pedidos...</td>
        </tr>
    `;

    emptyState?.classList.add("hidden");

    try {
        const parametros = new URLSearchParams();

        if (buscaPedido?.value.trim()) {
            parametros.set("busca", buscaPedido.value.trim());
        }

        if (filtroStatus?.value) {
            parametros.set("status", filtroStatus.value);
        }

        if (filtroPagamento?.value) {
            parametros.set("pagamento", filtroPagamento.value);
        }

        if (dataInicio?.value) {
            parametros.set("dataInicio", dataInicio.value);
        }

        if (dataFim?.value) {
            parametros.set("dataFim", dataFim.value);
        }

        if (dataInicio?.value && dataFim?.value && dataInicio.value > dataFim.value) {
            throw new Error("A data inicial não pode ser posterior à data final.");
        }

        const query = parametros.toString();
        const resultado = await requisicao(query ? `${API}?${query}` : API);

        pedidos = Array.isArray(resultado) ? resultado : resultado.pedidos || [];

        renderizarPedidos();

    } catch (erro) {
        console.error("Erro ao carregar pedidos:", erro);

        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    ${escaparHTML(erro.message)}
                </td>
            </tr>
        `;
    }
}

function renderizarPedidos() {
    if (!tbody) return;

    if (pedidos.length === 0) {
        tbody.innerHTML = "";
        emptyState?.classList.remove("hidden");
        if (pagination) pagination.style.display = "none";
        return;
    }

    emptyState?.classList.add("hidden");

    tbody.innerHTML = pedidos.map(pedido => {
        const id = Number(pedido.id);

        return `
            <tr>
                <td><strong>#${id}</strong></td>
                <td>${escaparHTML(pedido.cliente_nome)}</td>
                <td>${escaparHTML(formatarData(pedido.data_pedido))}</td>
                <td>${pedido.tipo_entrega === "entrega" ? "Entrega" : "Retirada"}</td>
                <td>
                    <span class="badge ${obterClasseStatus(pedido.status)}">
                        ${escaparHTML(obterStatus(pedido.status))}
                    </span>
                </td>
                <td>${escaparHTML(obterFormaPagamento(pedido.forma_pagamento))}</td>
                <td><strong>${formatarMoeda(pedido.total)}</strong></td>
                <td>
                    <div class="d-flex" style="gap: 8px; flex-wrap: wrap;">
                        <button type="button" class="btn btn-secondary btn-sm"
                            data-acao="detalhes" data-id="${id}">
                            Detalhes
                        </button>

                        ${["concluido", "cancelado"].includes(pedido.status) ? "" : `
                            <button type="button" class="btn btn-primary btn-sm"
                                data-acao="status" data-id="${id}">
                                Status
                            </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    if (pagination) pagination.style.display = "none";
}

// MODAL DE STATUS

function abrirModalStatus(id) {
    const pedido = pedidos.find(item => Number(item.id) === Number(id));

    if (!pedido || !statusModal || !statusForm) {
        mostrarMensagem("Não foi possível abrir o modal do pedido.");
        return;
    }

    statusForm.reset();

    statusPedidoId.value = pedido.id;
    novoStatus.value = pedido.status;

    statusModal.classList.add("show");

    console.log("Modal de status aberto:", id, pedido.status);
}

function fecharModalStatus() {
    if (!statusModal || !statusForm) return;

    statusModal.classList.remove("show");
    statusForm.reset();
}

async function alterarStatus(evento) {
    evento.preventDefault();

    const id = statusPedidoId.value;
    const status = novoStatus.value;

    if (!id || !status || !STATUS[status]) {
        mostrarMensagem("Selecione um status válido.");
        return;
    }

    const pedido = pedidos.find(item => Number(item.id) === Number(id));

    if (!pedido) {
        mostrarMensagem("Pedido não encontrado.");
        return;
    }

    if (pedido.status === status) {
        mostrarMensagem("Selecione um status diferente do atual.");
        return;
    }

    const btn = document.getElementById("btnConfirmarStatus");

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Salvando...";
    }

    try {
        const resultado = await requisicao(`${API}/${id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status })
        });

        fecharModalStatus();

        await carregarPedidos();

        mostrarMensagem(resultado.mensagem || "Status atualizado com sucesso!");

    } catch (erro) {
        console.error("Erro ao alterar status:", erro);
        mostrarMensagem(erro.message);

    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Alterar status";
        }
    }
}

// MODAL DE DETALHES

async function abrirDetalhes(id) {
    if (!pedidoModal || !pedidoModalBody || !pedidoModalTitulo) return;

    try {
        pedidoModalBody.innerHTML = "<p>Carregando detalhes...</p>";
        pedidoModalTitulo.textContent = `Pedido #${id}`;

        pedidoModal.classList.add("show");

        const dados = await requisicao(`${API}/${id}`);

        const pedido = dados.pedido;
        const itens = dados.itens || [];
        const pagamentos = dados.pagamentos || [];
        const historico = dados.historico || [];

        const endereco = pedido.endereco_id
            ? [
                pedido.rua,
                pedido.numero,
                pedido.bairro,
                pedido.cidade,
                pedido.complemento
            ].filter(Boolean).join(", ")
            : "Retirada no estabelecimento";

        pedidoModalBody.innerHTML = `
            <div class="pedido-detalhes">

                <div class="form-row">
                    <div class="form-group">
                        <strong>Cliente</strong>
                        <p>${escaparHTML(pedido.cliente_nome)}</p>
                    </div>
                    <div class="form-group">
                        <strong>Telefone</strong>
                        <p>${escaparHTML(pedido.cliente_telefone || "-")}</p>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <strong>E-mail</strong>
                        <p>${escaparHTML(pedido.cliente_email || "-")}</p>
                    </div>
                    <div class="form-group">
                        <strong>Data do pedido</strong>
                        <p>${escaparHTML(formatarData(pedido.data_pedido))}</p>
                    </div>
                </div>

                <div class="form-group">
                    <strong>Endereço / Entrega</strong>
                    <p>${escaparHTML(endereco)}</p>
                </div>

                <div class="form-group">
                    <strong>Status</strong>
                    <p>
                        <span class="badge ${obterClasseStatus(pedido.status)}">
                            ${escaparHTML(obterStatus(pedido.status))}
                        </span>
                    </p>
                </div>

                <hr>

                <h3>Itens do pedido</h3>

                ${itens.length ? `
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Produto</th>
                                    <th>Quantidade</th>
                                    <th>Preço</th>
                                    <th>Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itens.map(item => `
                                    <tr>
                                        <td>
                                            <strong>${escaparHTML(item.nome_produto)}</strong>
                                            ${item.personalizacao ? `<p>${escaparHTML(item.personalizacao)}</p>` : ""}
                                        </td>
                                        <td>${Number(item.quantidade)}</td>
                                        <td>${formatarMoeda(item.preco_unitario)}</td>
                                        <td>${formatarMoeda(item.subtotal)}</td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>
                    </div>
                ` : "<p>Nenhum item encontrado.</p>"}

                <hr>

                <h3>Resumo financeiro</h3>
                <p>Subtotal: <strong>${formatarMoeda(pedido.subtotal)}</strong></p>
                <p>Taxa de entrega: <strong>${formatarMoeda(pedido.taxa_entrega)}</strong></p>
                <p>Desconto: <strong>${formatarMoeda(pedido.desconto)}</strong></p>
                <h3>Total: ${formatarMoeda(pedido.total)}</h3>

                <hr>

                <h3>Pagamento</h3>

                ${pagamentos.length ? pagamentos.map(pagamento => `
                    <div class="form-group">
                        <p>Forma: <strong>${escaparHTML(obterFormaPagamento(pagamento.forma_pagamento))}</strong></p>
                        <p>Valor: <strong>${formatarMoeda(pagamento.valor)}</strong></p>
                        <p>Status: <strong>${escaparHTML(pagamento.status)}</strong></p>
                        <p>Data: ${escaparHTML(formatarData(pagamento.data_pagamento))}</p>
                    </div>
                `).join("") : "<p>Nenhum pagamento registrado.</p>"}

                <hr>

                <h3>Observações</h3>
                <p>${escaparHTML(pedido.observacoes || "Nenhuma observação.")}</p>

                <hr>

                <h3>Histórico do pedido</h3>

                ${historico.length ? historico.map(item => `
                    <div class="form-group">
                        <strong>${escaparHTML(obterStatus(item.status_novo))}</strong>
                        <p>
                            ${escaparHTML(item.status_anterior ? obterStatus(item.status_anterior) : "Criação do pedido")}
                            →
                            ${escaparHTML(obterStatus(item.status_novo))}
                        </p>
                        <small>
                            ${escaparHTML(item.usuario_nome || "Sistema")}
                            • ${escaparHTML(formatarData(item.data_alteracao))}
                        </small>
                    </div>
                `).join("") : "<p>Nenhuma alteração registrada.</p>"}

            </div>
        `;

    } catch (erro) {
        console.error("Erro ao carregar detalhes:", erro);
        pedidoModalBody.innerHTML = `<p>${escaparHTML(erro.message)}</p>`;
    }
}

function fecharModalDetalhes() {
    pedidoModal?.classList.remove("show");
}

// EVENTOS

function configurarTabela() {
    if (!tbody) return;

    tbody.addEventListener("click", evento => {
        const botao = evento.target.closest("[data-acao]");
        if (!botao) return;

        const id = Number(botao.dataset.id);

        if (botao.dataset.acao === "detalhes") {
            abrirDetalhes(id);
        }

        if (botao.dataset.acao === "status") {
            abrirModalStatus(id);
        }
    });
}

function configurarModais() {
    statusForm?.addEventListener("submit", alterarStatus);

    document.getElementById("pedidoModalClose")
        ?.addEventListener("click", fecharModalDetalhes);

    document.getElementById("pedidoModalFechar")
        ?.addEventListener("click", fecharModalDetalhes);

    document.getElementById("btnCancelarStatus")
        ?.addEventListener("click", fecharModalStatus);

    document.getElementById("statusModalClose")
        ?.addEventListener("click", fecharModalStatus);

    pedidoModal?.addEventListener("click", evento => {
        if (evento.target === pedidoModal) {
            fecharModalDetalhes();
        }
    });

    statusModal?.addEventListener("click", evento => {
        if (evento.target === statusModal) {
            fecharModalStatus();
        }
    });

    document.addEventListener("keydown", evento => {
        if (evento.key === "Escape") {
            fecharModalDetalhes();
            fecharModalStatus();
        }
    });
}

function configurarFiltros() {
    let temporizadorBusca;

    buscaPedido?.addEventListener("input", () => {
        clearTimeout(temporizadorBusca);
        temporizadorBusca = setTimeout(carregarPedidos, 350);
    });

    filtroStatus?.addEventListener("change", carregarPedidos);
    filtroPagamento?.addEventListener("change", carregarPedidos);
    dataInicio?.addEventListener("change", carregarPedidos);
    dataFim?.addEventListener("change", carregarPedidos);

    btnLimparFiltros?.addEventListener("click", () => {
        if (buscaPedido) buscaPedido.value = "";
        if (filtroStatus) filtroStatus.value = "";
        if (filtroPagamento) filtroPagamento.value = "";
        if (dataInicio) dataInicio.value = "";
        if (dataFim) dataFim.value = "";

        carregarPedidos();
    });
}

// INICIALIZAÇÃO

async function iniciar() {
    configurarMenu();
    configurarModais();
    configurarTabela();
    configurarFiltros();

    await carregarUsuario();
    await carregarPedidos();
}

document.addEventListener("DOMContentLoaded", iniciar);
