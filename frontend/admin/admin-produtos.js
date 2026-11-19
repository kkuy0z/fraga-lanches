
const API_PRODUTOS = "/api/admin/produtos";
const API_CATEGORIAS = "/api/admin/categorias";

// ELEMENTOS
const form = document.getElementById("produtoForm");
const modal = document.getElementById("produtoModal");
const modalTitulo = document.getElementById("produtoModalTitulo");

const campoId = document.getElementById("produtoId");
const campoNome = document.getElementById("produtoNome");
const campoCategoria = document.getElementById("produtoCategoria");
const campoDescricao = document.getElementById("produtoDescricao");
const campoPreco = document.getElementById("produtoPreco");
const campoImagem = document.getElementById("produtoImagem");
const campoDisponivel = document.getElementById("produtoAtivo");

const tabela = document.getElementById("tbodyProdutos");
const busca = document.getElementById("buscaProduto");
const filtroCategoria = document.getElementById("filtroCategoria");
const filtroDisponibilidade = document.getElementById("filtroAtivo");

const btnNovo = document.getElementById("btnNovoProduto");
const btnPrimeiro = document.getElementById("btnPrimeiroProduto");
const btnSalvar = document.getElementById("btnSalvarProduto");
const btnFechar = document.getElementById("produtoModalClose");
const btnCancelar = document.getElementById("btnCancelarProduto");

const modalDelete = document.getElementById("deleteProdutoModal");
const deleteNome = document.getElementById("deleteProdutoNome");
const btnCancelarDelete = document.getElementById("btnCancelarDeleteProduto");
const btnConfirmarDelete = document.getElementById("btnConfirmarDeleteProduto");

const emptyState = document.getElementById("emptyState");

let produtos = [];
let categorias = [];
let produtoParaExcluir = null;

// REQUISIÇÕES
async function requisicao(url, opcoes = {}) {
    const resposta = await fetch(url, {
        ...opcoes,
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            ...(opcoes.headers || {})
        }
    });

    const dados = await resposta.json().catch(() => ({}));

    if (resposta.status === 401 || resposta.status === 403) {
        alert("Sua sessão expirou ou você não tem permissão.");
        window.location.href = "/admin/admin-login.html";
        throw new Error("Acesso não autorizado.");
    }

    if (!resposta.ok) {
        throw new Error(dados.mensagem || "Erro na operação.");
    }

    return dados;
}

// CARREGAR CATEGORIAS
async function carregarCategorias() {
    categorias = await requisicao(API_CATEGORIAS);

    campoCategoria.innerHTML =
        '<option value="">Selecione uma categoria</option>';

    filtroCategoria.innerHTML =
        '<option value="">Todas as categorias</option>';

    categorias.forEach(categoria => {
        const opcao = document.createElement("option");
        opcao.value = categoria.id;
        opcao.textContent = categoria.nome;

        campoCategoria.appendChild(opcao);

        const opcaoFiltro = document.createElement("option");
        opcaoFiltro.value = categoria.id;
        opcaoFiltro.textContent = categoria.nome;

        filtroCategoria.appendChild(opcaoFiltro);
    });
}

// CARREGAR PRODUTOS
async function carregarProdutos() {
    try {
        tabela.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    Carregando produtos...
                </td>
            </tr>
        `;

        produtos = await requisicao(API_PRODUTOS);

        renderizarProdutos();

    } catch (erro) {
        console.error("Erro ao carregar produtos:", erro);

        tabela.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    ${erro.message}
                </td>
            </tr>
        `;
    }
}

// RENDERIZAR PRODUTOS
function renderizarProdutos() {
    const termo = busca.value.trim().toLowerCase();
    const categoriaSelecionada = filtroCategoria.value;
    const disponibilidade = filtroDisponibilidade.value;

    const filtrados = produtos.filter(produto => {
        const correspondeNome =
            produto.nome.toLowerCase().includes(termo);

        const correspondeCategoria =
            !categoriaSelecionada ||
            String(produto.categoria_id) === categoriaSelecionada;

        const disponivel =
            produto.disponivel === true ||
            produto.disponivel === 1 ||
            produto.disponivel === "1";

        const correspondeDisponibilidade =
            !disponibilidade ||
            (disponibilidade === "disponivel" && disponivel) ||
            (disponibilidade === "indisponivel" && !disponivel);

        return correspondeNome &&
            correspondeCategoria &&
            correspondeDisponibilidade;
    });

    tabela.innerHTML = "";

    if (emptyState) {
        emptyState.classList.toggle("hidden", filtrados.length > 0);
    }

    if (filtrados.length === 0) {
        tabela.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    Nenhum produto encontrado.
                </td>
            </tr>
        `;
        return;
    }

    filtrados.forEach(produto => {
        const linha = document.createElement("tr");

        const celulaImagem = document.createElement("td");

        if (produto.imagem) {
            const imagem = document.createElement("img");
            imagem.src = produto.imagem;
            imagem.alt = produto.nome;
            imagem.width = 48;
            imagem.height = 48;
            imagem.style.objectFit = "cover";
            imagem.style.borderRadius = "8px";

            imagem.addEventListener("error", () => {
                imagem.style.display = "none";
            });

            celulaImagem.appendChild(imagem);
        } else {
            celulaImagem.textContent = "Sem imagem";
        }

        const celulaNome = document.createElement("td");
        celulaNome.textContent = produto.nome;

        const celulaCategoria = document.createElement("td");
        celulaCategoria.textContent =
            produto.categoria_nome || "Sem categoria";

        const celulaPreco = document.createElement("td");
        celulaPreco.textContent = Number(produto.preco).toLocaleString(
            "pt-BR",
            { style: "currency", currency: "BRL" }
        );

        const celulaStatus = document.createElement("td");
        const disponivel =
            produto.disponivel === true ||
            produto.disponivel === 1 ||
            produto.disponivel === "1";

        celulaStatus.textContent = disponivel
            ? "Disponível"
            : "Indisponível";

        const celulaAcoes = document.createElement("td");

        const btnEditar = document.createElement("button");
        btnEditar.type = "button";
        btnEditar.className = "btn btn-secondary";
        btnEditar.textContent = "Editar";
        btnEditar.addEventListener("click", () => editarProduto(produto));

        const btnExcluir = document.createElement("button");
        btnExcluir.type = "button";
        btnExcluir.className = "btn btn-danger";
        btnExcluir.textContent = "Excluir";
        btnExcluir.addEventListener("click", () => prepararExclusao(produto));

        celulaAcoes.append(btnEditar, btnExcluir);

        linha.append(
            celulaImagem,
            celulaNome,
            celulaCategoria,
            celulaPreco,
            celulaStatus,
            celulaAcoes
        );

        tabela.appendChild(linha);
    });
}

// ABRIR E FECHAR MODAL
function abrirModal() {
    modal.classList.remove("hidden");
}

function fecharModal() {
    modal.classList.add("hidden");
    form.reset();
    campoId.value = "";
    campoDisponivel.checked = true;
}

function fecharModalDelete() {
    modalDelete.classList.add("hidden");
    produtoParaExcluir = null;
}

// NOVO PRODUTO
function novoProduto() {
    form.reset();

    campoId.value = "";
    campoDisponivel.checked = true;

    modalTitulo.textContent = "Novo Produto";
    btnSalvar.textContent = "Salvar Produto";

    abrirModal();
}

btnNovo.addEventListener("click", novoProduto);

if (btnPrimeiro) {
    btnPrimeiro.addEventListener("click", novoProduto);
}

// EDITAR PRODUTO
function editarProduto(produto) {
    campoId.value = produto.id;
    campoNome.value = produto.nome;
    campoCategoria.value = produto.categoria_id;
    campoDescricao.value = produto.descricao || "";
    campoPreco.value = produto.preco;
    campoImagem.value = produto.imagem || "";

    campoDisponivel.checked =
        produto.disponivel === true ||
        produto.disponivel === 1 ||
        produto.disponivel === "1";

    modalTitulo.textContent = "Editar Produto";
    btnSalvar.textContent = "Salvar Alterações";

    abrirModal();
}

// SALVAR PRODUTO
form.addEventListener("submit", async event => {
    event.preventDefault();

    const nome = campoNome.value.trim();
    const categoria_id = Number(campoCategoria.value);
    const preco = Number(campoPreco.value);

    if (!nome) {
        alert("Informe o nome do produto.");
        campoNome.focus();
        return;
    }

    if (!categoria_id) {
        alert("Selecione uma categoria.");
        campoCategoria.focus();
        return;
    }

    if (!Number.isFinite(preco) || preco < 0) {
        alert("Informe um preço válido.");
        campoPreco.focus();
        return;
    }

    const dados = {
        nome,
        categoria_id,
        descricao: campoDescricao.value.trim(),
        preco,
        imagem: campoImagem.value.trim(),
        disponivel: campoDisponivel.checked
    };

    const id = campoId.value;

    btnSalvar.disabled = true;

    try {
        if (id) {
            await requisicao(`${API_PRODUTOS}/${encodeURIComponent(id)}`, {
                method: "PUT",
                body: JSON.stringify(dados)
            });
        } else {
            await requisicao(API_PRODUTOS, {
                method: "POST",
                body: JSON.stringify(dados)
            });
        }

        fecharModal();
        await carregarProdutos();

        alert(id
            ? "Produto atualizado com sucesso!"
            : "Produto cadastrado com sucesso!");

    } catch (erro) {
        console.error("Erro ao salvar produto:", erro);
        alert(erro.message);

    } finally {
        btnSalvar.disabled = false;
    }
});

// EXCLUIR PRODUTO
function prepararExclusao(produto) {
    produtoParaExcluir = produto;
    deleteNome.textContent = produto.nome;
    modalDelete.classList.remove("hidden");
}

btnConfirmarDelete.addEventListener("click", async () => {
    if (!produtoParaExcluir) return;

    btnConfirmarDelete.disabled = true;

    try {
        await requisicao(
            `${API_PRODUTOS}/${encodeURIComponent(produtoParaExcluir.id)}`,
            { method: "DELETE" }
        );

        fecharModalDelete();
        await carregarProdutos();

        alert("Produto excluído com sucesso!");

    } catch (erro) {
        console.error("Erro ao excluir produto:", erro);
        alert(erro.message);

    } finally {
        btnConfirmarDelete.disabled = false;
    }
});

// EVENTOS DOS MODAIS
btnFechar.addEventListener("click", fecharModal);
btnCancelar.addEventListener("click", fecharModal);
btnCancelarDelete.addEventListener("click", fecharModalDelete);

modal.addEventListener("click", event => {
    if (event.target === modal) fecharModal();
});

modalDelete.addEventListener("click", event => {
    if (event.target === modalDelete) fecharModalDelete();
});

// PESQUISA E FILTROS
busca.addEventListener("input", renderizarProdutos);
filtroCategoria.addEventListener("change", renderizarProdutos);
filtroDisponibilidade.addEventListener("change", renderizarProdutos);

// INICIALIZAÇÃO
async function iniciarPagina() {
    try {
        await carregarCategorias();
        await carregarProdutos();
    } catch (erro) {
        console.error("Erro ao iniciar página:", erro);
        alert(erro.message);
    }
}

iniciarPagina();
