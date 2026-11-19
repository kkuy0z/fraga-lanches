const categoriasFiltro = document.getElementById("categoriasFiltro");
const cardapioGrid = document.getElementById("cardapioGrid");
const emptyState = document.getElementById("emptyState");
const pagination = document.getElementById("pagination");

let categoriaSelecionada = null;
let produtos = [];

async function carregarCategorias() {
    try {
        const resposta = await fetch("/api/cardapio/categorias");

        if (!resposta.ok) {
            throw new Error("Erro ao carregar categorias.");
        }

        const categorias = await resposta.json();

        categoriasFiltro.innerHTML = "";

        const botaoTodos = document.createElement("button");
        botaoTodos.type = "button";
        botaoTodos.textContent = "Todos";
        botaoTodos.classList.add("categoria-ativa");

        botaoTodos.addEventListener("click", () => {
            categoriaSelecionada = null;
            atualizarCategoriaAtiva(botaoTodos);
            carregarProdutos();
        });

        categoriasFiltro.appendChild(botaoTodos);

        categorias.forEach(categoria => {
            const botao = document.createElement("button");

            botao.type = "button";
            botao.textContent = categoria.nome;

            botao.addEventListener("click", () => {
                categoriaSelecionada = categoria.id;
                atualizarCategoriaAtiva(botao);
                carregarProdutos();
            });

            categoriasFiltro.appendChild(botao);
        });

    } catch (erro) {
        console.error(erro);
        categoriasFiltro.textContent = "Não foi possível carregar as categorias.";
    }
}

function atualizarCategoriaAtiva(botaoSelecionado) {
    categoriasFiltro.querySelectorAll("button").forEach(botao => {
        botao.classList.remove("categoria-ativa");
    });

    botaoSelecionado.classList.add("categoria-ativa");
}

async function carregarProdutos() {
    try {
        cardapioGrid.innerHTML = "<p>Carregando produtos...</p>";
        emptyState.classList.add("hidden");

        let url = "/api/cardapio/produtos";

        if (categoriaSelecionada !== null) {
            url += `?categoria=${encodeURIComponent(categoriaSelecionada)}`;
        }

        const resposta = await fetch(url);

        if (!resposta.ok) {
            throw new Error("Erro ao carregar produtos.");
        }

        produtos = await resposta.json();

        renderizarProdutos();

    } catch (erro) {
        console.error(erro);
        cardapioGrid.textContent = "Não foi possível carregar o cardápio.";
    }
}

function renderizarProdutos() {
    cardapioGrid.innerHTML = "";

    if (produtos.length === 0) {
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");

    produtos.forEach(produto => {
        const artigo = document.createElement("article");
        artigo.classList.add("produto-card");

        const imagem = document.createElement("img");
        imagem.src = produto.imagem || "/img/produto-sem-imagem.png";
        imagem.alt = produto.nome;
        imagem.loading = "lazy";

        imagem.addEventListener("error", () => {
            imagem.src = "/img/produto-sem-imagem.png";
        }, { once: true });

        const nome = document.createElement("h2");
        nome.textContent = produto.nome;

        const descricao = document.createElement("p");
        descricao.textContent = produto.descricao || "";

        const preco = document.createElement("p");
        preco.textContent = Number(produto.preco).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });

        const botao = document.createElement("button");
        botao.type = "button";
        botao.textContent = "Ver adicionais";

        botao.addEventListener("click", () => {
            carregarAdicionais(produto.id);
        });

        artigo.append(imagem, nome, descricao, preco, botao);
        cardapioGrid.appendChild(artigo);
    });
}

async function carregarAdicionais(produtoId) {
    try {
        const resposta = await fetch(
            `/api/cardapio/produtos/${produtoId}/adicionais`
        );

        if (!resposta.ok) {
            throw new Error("Erro ao carregar adicionais.");
        }

        const adicionais = await resposta.json();

        if (adicionais.length === 0) {
            alert("Este produto não possui adicionais disponíveis.");
            return;
        }

        const mensagem = adicionais.map(adicional => {
            const preco = Number(adicional.preco).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL"
            });

            return `${adicional.nome} - ${preco}`;
        }).join("\n");

        alert(`Adicionais disponíveis:\n\n${mensagem}`);

    } catch (erro) {
        console.error(erro);
        alert("Não foi possível carregar os adicionais.");
    }
}

async function iniciarCardapio() {
    await carregarCategorias();
    await carregarProdutos();
}

iniciarCardapio();
