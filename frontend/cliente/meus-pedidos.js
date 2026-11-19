
"use strict";

const API = "/api/pedidos";

const tbody = document.getElementById("tbodyPedidos");
const emptyState = document.getElementById("emptyState");
const tabelaPedidos = document.getElementById("tabelaPedidos");

const filtroStatus = document.getElementById("filtroStatus");
const dataInicio = document.getElementById("dataInicio");
const dataFim = document.getElementById("dataFim");
const btnLimparFiltros = document.getElementById("btnLimparFiltros");

const pedidoModal = document.getElementById("pedidoModal");
const pedidoModalBody = document.getElementById("pedidoModalBody");
const pedidoModalClose = document.getElementById("pedidoModalClose");
const pedidoModalFechar = document.getElementById("pedidoModalFechar");

let pedidos = [];

const STATUS = {
    novo: "Novo",
    em_preparo: "Em preparo",
    pronto: "Pronto",
    saiu_para_entrega: "Saiu para entrega",
    concluido: "Concluído",
    cancelado: "Cancelado"
};

const STATUS_CLASSES = {
    novo: "status-novo",
    em_preparo: "status-preparo",
    pronto: "status-pronto",
    saiu_para_entrega: "status-entrega",
    concluido: "status-concluido",
    cancelado: "status-cancelado"
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
    if (!data) return "—";

    const dataObj = new Date(data);

    if (Number.isNaN(dataObj.getTime())) {
        return "—";
    }

    return dataObj.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatarDataInput(data) {
    if (!data) return "";

    const dataObj = new Date(data);

    if (Number.isNaN(dataObj.getTime())) {
        return "";
    }

    const ano = dataObj.getFullYear();
    const mes = String(dataObj.getMonth() + 1).padStart(2, "0");
    const dia = String(dataObj.getDate()).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
}

function obterNomeStatus(status) {
    return STATUS[status] || status || "Desconhecido";
}

function obterClasseStatus(status) {
    return STATUS_CLASSES[status] || "";
}

function exibirMensagemTabela(mensagem) {
    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center py-4">
                ${escaparHTML(mensagem)}
            </td>
        </tr>
    `;
}

async function requisicao(url) {
    const resposta = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
        headers: {
            "Accept": "application/json"
        }
    });

    let dados;

    try {
        dados = await resposta.json();
    } catch {
        dados = {};
    }

    if (resposta.status === 401) {
        window.location.href = "/cadastro/login.html";
        throw new Error("Sua sessão expirou. Faça login novamente.");
    }

    if (!resposta.ok) {
        throw new Error(
            dados.mensagem || dados.erro || "Não foi possível realizar a solicitação."
        );
    }

    return dados;
}

async function carregarPedidos() {
    exibirMensagemTabela("Carregando pedidos...");

    emptyState.classList.add("hidden");
    tabelaPedidos.style.display = "";

    try {
        const dados = await requisicao(`${API}/meus`);

        pedidos = Array.isArray(dados)
            ? dados
            : dados.pedidos || [];

        aplicarFiltros();

    } catch (erro) {
        console.error("Erro ao carregar pedidos:", erro);

        exibirMensagemTabela(erro.message);
    }
}

function aplicarFiltros() {
    const statusSelecionado = filtroStatus.value;
    const inicio = dataInicio.value;
    const fim = dataFim.value;

    const filtrados = pedidos.filter(pedido => {
        if (statusSelecionado && pedido.status !== statusSelecionado) {
            return false;
        }

        const dataPedido = formatarDataInput(pedido.data_pedido);

        if (inicio && dataPedido < inicio) {
            return false;
        }

        if (fim && dataPedido > fim) {
            return false;
        }

        return true;
    });

    renderizarPedidos(filtrados);
}

function renderizarPedidos(lista) {
    tbody.innerHTML = "";

    if (!lista.length) {
        tabelaPedidos.style.display = "none";
        emptyState.classList.remove("hidden");
        return;
    }

    tabelaPedidos.style.display = "";
    emptyState.classList.add("hidden");

    lista.forEach(pedido => {
        const linha = document.createElement("tr");

        const quantidadeItens = Number(
            pedido.quantidade_itens ?? pedido.total_itens ?? 0
        );

        linha.innerHTML = `
            <td>
                <strong>#${escaparHTML(pedido.id)}</strong>
            </td>

            <td>
                ${escaparHTML(formatarData(pedido.data_pedido))}
            </td>

            <td>
                <span class="status-badge ${escaparHTML(obterClasseStatus(pedido.status))}">
                    ${escaparHTML(obterNomeStatus(pedido.status))}
                </span>
            </td>

            <td>
                ${quantidadeItens}
            </td>

            <td>
                <strong>${formatarMoeda(pedido.total)}</strong>
            </td>

            <td>
                <button
                    type="button"
                    class="btn btn-secondary btn-detalhes"
                    data-id="${escaparHTML(pedido.id)}">

                    Ver detalhes
                </button>
            </td>
        `;

        tbody.appendChild(linha);
    });
}

async function abrirDetalhes(id) {
    pedidoModal.classList.remove("hidden");

    pedidoModalBody.innerHTML = `
        <p class="text-center py-4">Carregando detalhes do pedido...</p>
    `;

    try {
        const dados = await requisicao(`${API}/${encodeURIComponent(id)}`);

        const pedido = dados.pedido || dados;
        const itens = dados.itens || [];
        const historico = dados.historico || [];

        renderizarDetalhes(pedido, itens, historico);

    } catch (erro) {
        console.error("Erro ao carregar detalhes:", erro);

        pedidoModalBody.innerHTML = `
            <p class="text-center py-4">
                ${escaparHTML(erro.message)}
            </p>
        `;
    }
}

function renderizarDetalhes(pedido, itens, historico) {
    const endereco = pedido.endereco;

    const htmlEndereco = endereco
        ? `
            <p>
                ${escaparHTML(endereco.rua)},
                ${escaparHTML(endereco.numero)}
            </p>

            <p>
                ${escaparHTML(endereco.bairro)} -
                ${escaparHTML(endereco.cidade)}
            </p>

            ${endereco.complemento
                ? `<p>Complemento: ${escaparHTML(endereco.complemento)}</p>`
                : ""}
        `
        : "<p>Retirada no estabelecimento</p>";

    const htmlItens = itens.length
        ? itens.map(item => `
            <div class="pedido-item"
                style="display:flex; justify-content:space-between; gap:16px; padding:12px 0; border-bottom:1px solid var(--border-color, #333);">

                <div>
                    <strong>
                        ${Number(item.quantidade)}x
                        ${escaparHTML(item.nome_produto)}
                    </strong>

                    ${item.personalizacao
                        ? `<p>${escaparHTML(formatarPersonalizacao(item.personalizacao))}</p>`
                        : ""}
                </div>

                <strong>
                    ${formatarMoeda(item.subtotal)}
                </strong>
            </div>
        `).join("")
        : "<p>Nenhum item encontrado.</p>";

    const htmlHistorico = historico.length
        ? historico.map(registro => `
            <div style="padding:10px 0; border-bottom:1px solid var(--border-color, #333);">
                <strong>
                    ${escaparHTML(obterNomeStatus(registro.status_novo))}
                </strong>

                <p>
                    ${escaparHTML(formatarData(registro.data_alteracao))}
                </p>
            </div>
        `).join("")
        : "<p>Nenhuma atualização registrada.</p>";

    pedidoModalBody.innerHTML = `
        <div class="pedido-detalhes">

            <section style="margin-bottom:20px;">
                <h3>Pedido #${escaparHTML(pedido.id)}</h3>

                <p>
                    Data: ${escaparHTML(formatarData(pedido.data_pedido))}
                </p>

                <p>
                    Status:
                    <strong>
                        ${escaparHTML(obterNomeStatus(pedido.status))}
                    </strong>
                </p>

                <p>
                    Tipo:
                    ${pedido.tipo_entrega === "entrega"
                        ? "Entrega"
                        : "Retirada"}
                </p>
            </section>

            <section style="margin-bottom:20px;">
                <h3>Itens do pedido</h3>

                ${htmlItens}
            </section>

            <section style="margin-bottom:20px;">
                <h3>Endereço</h3>

                ${htmlEndereco}
            </section>

            <section style="margin-bottom:20px;">
                <h3>Pagamento</h3>

                <p>
                    Forma:
                    ${escaparHTML(pedido.forma_pagamento || "Não informado")}
                </p>

                <p>
                    Status:
                    ${escaparHTML(pedido.status_pagamento || "Pendente")}
                </p>
            </section>

            <section style="margin-bottom:20px;">
                <h3>Resumo</h3>

                <p>Subtotal: ${formatarMoeda(pedido.subtotal)}</p>
                <p>Entrega: ${formatarMoeda(pedido.taxa_entrega)}</p>
                <p>Desconto: ${formatarMoeda(pedido.desconto)}</p>

                <h3>Total: ${formatarMoeda(pedido.total)}</h3>
            </section>

            ${pedido.observacoes
                ? `
                    <section style="margin-bottom:20px;">
                        <h3>Observações</h3>
                        <p>${escaparHTML(pedido.observacoes)}</p>
                    </section>
                `
                : ""}

            <section>
                <h3>Histórico do pedido</h3>

                ${htmlHistorico}
            </section>

        </div>
    `;
}

function formatarPersonalizacao(valor) {
    try {
        const dados = typeof valor === "string"
            ? JSON.parse(valor)
            : valor;

        if (!Array.isArray(dados)) {
            return "";
        }

        return dados.map(adicional => adicional.nome).filter(Boolean).join(", ");
    } catch {
        return "";
    }
}

function fecharModal() {
    pedidoModal.classList.add("hidden");
}

function limparFiltros() {
    filtroStatus.value = "";
    dataInicio.value = "";
    dataFim.value = "";

    aplicarFiltros();
}

// Eventos dos filtros
filtroStatus.addEventListener("change", aplicarFiltros);
dataInicio.addEventListener("change", aplicarFiltros);
dataFim.addEventListener("change", aplicarFiltros);

btnLimparFiltros.addEventListener("click", limparFiltros);

// Abrir detalhes
tbody.addEventListener("click", event => {
    const botao = event.target.closest(".btn-detalhes");

    if (!botao) return;

    abrirDetalhes(botao.dataset.id);
});

// Fechar modal
pedidoModalClose.addEventListener("click", fecharModal);
pedidoModalFechar.addEventListener("click", fecharModal);

pedidoModal.addEventListener("click", event => {
    if (event.target === pedidoModal) {
        fecharModal();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        fecharModal();
    }
});

// Inicialização
document.addEventListener("DOMContentLoaded", carregarPedidos);
