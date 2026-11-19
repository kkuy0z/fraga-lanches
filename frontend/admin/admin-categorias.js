
const API = "/api/admin/categorias";

// ELEMENTOS
const form = document.getElementById("categoriaForm");
const modal = document.getElementById("categoriaModal");
const modalTitulo = document.getElementById("categoriaModalTitulo");

const campoId = document.getElementById("categoriaId");
const campoNome = document.getElementById("categoriaNome");
const campoDescricao = document.getElementById("categoriaDescricao");
const campoAtivo = document.getElementById("categoriaAtivo");

const tabela = document.getElementById("tbodyCategorias");
const busca = document.getElementById("buscaCategoria");
const filtro = document.getElementById("filtroAtivo");

const btnNova = document.getElementById("btnNovaCategoria");
const btnSalvar = document.getElementById("btnSalvarCategoria");
const btnFechar = document.getElementById("categoriaModalClose");
const btnCancelar = document.getElementById("btnCancelarCategoria");

const modalDelete = document.getElementById("deleteCategoriaModal");
const deleteNome = document.getElementById("deleteCategoriaNome");
const btnCancelarDelete = document.getElementById("btnCancelarDeleteCategoria");
const btnConfirmarDelete = document.getElementById("btnConfirmarDeleteCategoria");

let categorias = [];
let categoriaParaExcluir = null;

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
        alert("Sua sessão expirou ou você não tem permissão de administrador.");
        window.location.href = "/admin/admin-login.html";
        throw new Error("Acesso não autorizado.");
    }

    if (!resposta.ok) {
        throw new Error(dados.mensagem || "Não foi possível concluir a operação.");
    }

    return dados;
}

// UTILITÁRIOS
function categoriaEstaAtiva(valor) {
    return valor === true || valor === 1 || valor === "1";
}

function abrirModal() {
    modal.classList.remove("hidden");
}

function fecharModal() {
    modal.classList.add("hidden");
    form.reset();
    campoId.value = "";
    campoAtivo.checked = true;
}

function fecharModalDelete() {
    modalDelete.classList.add("hidden");
    categoriaParaExcluir = null;
}

// CARREGAR CATEGORIAS
async function carregarCategorias() {
    try {
        tabela.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-4">
                    Carregando categorias...
                </td>
            </tr>
        `;

        categorias = await requisicao(API);

        renderizarCategorias();

    } catch (erro) {
        console.error("Erro ao carregar categorias:", erro);

        tabela.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-4">
                    ${erro.message}
                </td>
            </tr>
        `;
    }
}

// RENDERIZAR TABELA
function renderizarCategorias() {
    const termo = busca.value.trim().toLowerCase();
    const status = filtro.value;

    const filtradas = categorias.filter(categoria => {
        const nome = categoria.nome.toLowerCase();
        const ativa = categoriaEstaAtiva(categoria.ativo);

        const correspondeNome = nome.includes(termo);

        const correspondeStatus =
            status === "" ||
            (status === "ativo" && ativa) ||
            (status === "inativo" && !ativa);

        return correspondeNome && correspondeStatus;
    });

    if (filtradas.length === 0) {
        tabela.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-4">
                    Nenhuma categoria encontrada.
                </td>
            </tr>
        `;
        return;
    }

    tabela.innerHTML = "";

    filtradas.forEach(categoria => {
        const linha = document.createElement("tr");

        const celulaNome = document.createElement("td");
        celulaNome.textContent = categoria.nome;

        const celulaDescricao = document.createElement("td");
        celulaDescricao.textContent = categoria.descricao || "Sem descrição";

        const celulaStatus = document.createElement("td");
        celulaStatus.textContent = categoriaEstaAtiva(categoria.ativo)
            ? "Ativa"
            : "Inativa";

        const celulaAcoes = document.createElement("td");

        const btnEditar = document.createElement("button");
        btnEditar.type = "button";
        btnEditar.className = "btn btn-secondary";
        btnEditar.textContent = "Editar";
        btnEditar.addEventListener("click", () => editarCategoria(categoria));

        const btnExcluir = document.createElement("button");
        btnExcluir.type = "button";
        btnExcluir.className = "btn btn-danger";
        btnExcluir.textContent = "Excluir";
        btnExcluir.addEventListener("click", () => prepararExclusao(categoria));

        celulaAcoes.append(btnEditar, btnExcluir);

        linha.append(
            celulaNome,
            celulaDescricao,
            celulaStatus,
            celulaAcoes
        );

        tabela.appendChild(linha);
    });
}

// NOVA CATEGORIA
btnNova.addEventListener("click", () => {
    form.reset();

    campoId.value = "";
    campoAtivo.checked = true;

    modalTitulo.textContent = "Nova Categoria";
    btnSalvar.textContent = "Salvar Categoria";

    abrirModal();
});

// EDITAR CATEGORIA
function editarCategoria(categoria) {
    campoId.value = categoria.id;
    campoNome.value = categoria.nome;
    campoDescricao.value = categoria.descricao || "";
    campoAtivo.checked = categoriaEstaAtiva(categoria.ativo);

    modalTitulo.textContent = "Editar Categoria";
    btnSalvar.textContent = "Salvar Alterações";

    abrirModal();
}

// SALVAR CATEGORIA
form.addEventListener("submit", async event => {
    event.preventDefault();

    const nome = campoNome.value.trim();
    const descricao = campoDescricao.value.trim();

    if (!nome) {
        alert("Informe o nome da categoria.");
        campoNome.focus();
        return;
    }

    const dados = {
        nome,
        descricao,
        ativo: campoAtivo.checked
    };

    const id = campoId.value;

    btnSalvar.disabled = true;

    try {
        if (id) {
            await requisicao(`${API}/${encodeURIComponent(id)}`, {
                method: "PUT",
                body: JSON.stringify(dados)
            });
        } else {
            await requisicao(API, {
                method: "POST",
                body: JSON.stringify(dados)
            });
        }

        fecharModal();
        await carregarCategorias();

        alert(id
            ? "Categoria atualizada com sucesso!"
            : "Categoria cadastrada com sucesso!");

    } catch (erro) {
        console.error("Erro ao salvar categoria:", erro);
        alert(erro.message);

    } finally {
        btnSalvar.disabled = false;
    }
});

// EXCLUIR CATEGORIA
function prepararExclusao(categoria) {
    categoriaParaExcluir = categoria;

    deleteNome.textContent = categoria.nome;
    modalDelete.classList.remove("hidden");
}

btnConfirmarDelete.addEventListener("click", async () => {
    if (!categoriaParaExcluir) return;

    btnConfirmarDelete.disabled = true;

    try {
        await requisicao(
            `${API}/${encodeURIComponent(categoriaParaExcluir.id)}`,
            { method: "DELETE" }
        );

        fecharModalDelete();
        await carregarCategorias();

        alert("Categoria excluída com sucesso!");

    } catch (erro) {
        console.error("Erro ao excluir categoria:", erro);
        alert(erro.message);

    } finally {
        btnConfirmarDelete.disabled = false;
    }
});

// FECHAR MODAIS
btnFechar.addEventListener("click", fecharModal);
btnCancelar.addEventListener("click", fecharModal);
btnCancelarDelete.addEventListener("click", fecharModalDelete);

modal.addEventListener("click", event => {
    if (event.target === modal) fecharModal();
});

modalDelete.addEventListener("click", event => {
    if (event.target === modalDelete) fecharModalDelete();
});

// PESQUISA E FILTRO
busca.addEventListener("input", renderizarCategorias);
filtro.addEventListener("change", renderizarCategorias);

// INICIALIZAÇÃO
carregarCategorias();
