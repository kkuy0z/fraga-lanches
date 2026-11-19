
const CHAVE_CARRINHO = "fraga_carrinho";

const lista = document.getElementById("carrinhoLista");
const vazio = document.getElementById("carrinhoVazio");
const acoes = document.getElementById("carrinhoAcoes");

const subtotalElemento = document.getElementById("resumoSubtotal");
const taxaElemento = document.getElementById("resumoTaxaEntrega");
const descontoElemento = document.getElementById("resumoDesconto");
const totalElemento = document.getElementById("resumoTotal");

const botaoLimpar = document.getElementById("btnLimparCarrinho");
const botaoFinalizar = document.getElementById("btnFinalizar");

function obterCarrinho() {
    try {
        return JSON.parse(localStorage.getItem(CHAVE_CARRINHO)) || [];
    } catch {
        return [];
    }
}

function salvarCarrinho(carrinho) {
    localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(carrinho));
}

function moeda(valor) {
    return Number(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function calcularSubtotal(carrinho) {
    return carrinho.reduce((total, item) => {
        const adicionais = (item.adicionais || []).reduce(
            (soma, adicional) => soma + Number(adicional.preco),
            0
        );

        return total + (
            (Number(item.preco) + adicionais) *
            Number(item.quantidade)
        );
    }, 0);
}

function renderizarCarrinho() {
    const carrinho = obterCarrinho();

    lista.innerHTML = "";

    if (carrinho.length === 0) {
        vazio.classList.remove("hidden");
        acoes.classList.add("hidden");
        botaoFinalizar.setAttribute("aria-disabled", "true");
        botaoFinalizar.style.pointerEvents = "none";
        botaoFinalizar.style.opacity = "0.5";
    } else {
        vazio.classList.add("hidden");
        acoes.classList.remove("hidden");
        botaoFinalizar.removeAttribute("aria-disabled");
        botaoFinalizar.style.pointerEvents = "";
        botaoFinalizar.style.opacity = "";
    }

    carrinho.forEach(item => {
        const artigo = document.createElement("article");
        artigo.className = "card";
        artigo.style.marginBottom = "16px";

        const conteudo = document.createElement("div");
        conteudo.className = "card-content";

        const nome = document.createElement("h3");
        nome.textContent = item.nome;

        const adicionais = document.createElement("p");
        adicionais.textContent = (item.adicionais || [])
            .map(adicional => adicional.nome)
            .join(", ") || "Sem adicionais";

        const precoUnitario = Number(item.preco) +
            (item.adicionais || []).reduce(
                (total, adicional) => total + Number(adicional.preco), 0
            );

        const preco = document.createElement("p");
        preco.textContent = `Preço unitário: ${moeda(precoUnitario)}`;

        const controles = document.createElement("div");
        controles.style.display = "flex";
        controles.style.alignItems = "center";
        controles.style.gap = "12px";
        controles.style.marginTop = "12px";

        const diminuir = document.createElement("button");
        diminuir.type = "button";
        diminuir.className = "btn btn-secondary";
        diminuir.textContent = "−";
        diminuir.setAttribute("aria-label", "Diminuir quantidade");

        diminuir.addEventListener("click", () => alterarQuantidade(item.chave, -1));

        const quantidade = document.createElement("strong");
        quantidade.textContent = item.quantidade;

        const aumentar = document.createElement("button");
        aumentar.type = "button";
        aumentar.className = "btn btn-secondary";
        aumentar.textContent = "+";
        aumentar.setAttribute("aria-label", "Aumentar quantidade");

        aumentar.addEventListener("click", () => alterarQuantidade(item.chave, 1));

        const remover = document.createElement("button");
        remover.type = "button";
        remover.className = "btn btn-danger";
        remover.textContent = "Remover";

        remover.addEventListener("click", () => removerItem(item.chave));

        const totalItem = document.createElement("p");
        totalItem.textContent = `Total: ${moeda(precoUnitario * item.quantidade)}`;

        controles.append(diminuir, quantidade, aumentar, remover);
        conteudo.append(nome, adicionais, preco, controles, totalItem);
        artigo.appendChild(conteudo);
        lista.appendChild(artigo);
    });

    const subtotal = calcularSubtotal(carrinho);

    subtotalElemento.textContent = moeda(subtotal);
    taxaElemento.textContent = moeda(0);
    descontoElemento.textContent = moeda(0);
    totalElemento.textContent = moeda(subtotal);
}

function alterarQuantidade(chave, diferenca) {
    const carrinho = obterCarrinho();
    const item = carrinho.find(produto => produto.chave === chave);

    if (!item) return;

    item.quantidade += diferenca;

    if (item.quantidade <= 0) {
        removerItem(chave);
        return;
    }

    salvarCarrinho(carrinho);
    renderizarCarrinho();
}

function removerItem(chave) {
    const carrinho = obterCarrinho().filter(item => item.chave !== chave);
    salvarCarrinho(carrinho);
    renderizarCarrinho();
}

botaoLimpar.addEventListener("click", () => {
    if (!confirm("Deseja realmente limpar o carrinho?")) return;

    salvarCarrinho([]);
    renderizarCarrinho();
});

renderizarCarrinho();
