"use strict";

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const API_CARRINHO = "/api/cliente/carrinho";
const API_PEDIDOS = "/api/pedidos";
const API_PERFIL = "/api/cliente/perfil";
const API_FORMAS_PAGAMENTO = "/api/formas-pagamento";

const TAXA_PADRAO_ENTREGA = 6.0;

const TAXAS_POR_BAIRRO = {
  marimba: 0.0,
  centro: 5.0,
  industrial: 6.0,
  eldorado: 7.0,
  alterosa: 7.0,
  petropolis: 8.0,
  imbirucu: 8.0,
  "jardim alterosa": 8.5,
  "nossa senhora das gracas": 7.5,
};

// ======================================================
// ELEMENTOS
// ======================================================

const form = document.getElementById("checkoutForm");
const tipoEntrega = document.getElementById("tipoEntrega");
const enderecoCampos = document.getElementById("enderecoCampos");
const formaPagamento = document.getElementById("formaPagamento");
const trocoGroup = document.getElementById("trocoGroup");
const sucessoModal = document.getElementById("sucessoModal");

const campoCep = document.getElementById("cep");
const campoRua = document.getElementById("rua");
const campoNumero = document.getElementById("numero");
const campoComplemento = document.getElementById("complemento");
const campoBairro = document.getElementById("bairro");
const campoCidade = document.getElementById("cidade");
const campoReferencia = document.getElementById("referencia");

const seletorEndereco = document.getElementById("enderecoSalvo");
const btnNovoEndereco = document.getElementById("btnNovoEndereco");
const btnSalvarEnderecoPerfil = document.getElementById(
  "btnSalvarEnderecoPerfil",
);
const enderecoStatus = document.getElementById("enderecoStatus");

// ======================================================
// ESTADO
// ======================================================

let etapaAtual = 1;
let usuarioAtual = null;
let taxaEntregaAtual = 0;
let timerCalculoTaxa = null;
let carrinhoAtual = [];

let enderecosSalvos = [];
let enderecoSelecionadoId = null;
let pedidoEmEnvio = false;

let formasPagamentoDisponiveis = [];

// ======================================================
// UTILITÁRIOS
// ======================================================

function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function obterCarrinho() {
  return carrinhoAtual;
}

async function lerResposta(resposta) {
  return resposta.json().catch(() => ({}));
}

function definirStatusEndereco(mensagem, tipo = "") {
  if (!enderecoStatus) return;

  enderecoStatus.textContent = mensagem;
  enderecoStatus.classList.remove("erro", "sucesso");

  if (tipo) {
    enderecoStatus.classList.add(tipo);
  }
}

function criarElemento(tag, texto, estilos = "") {
  const elemento = document.createElement(tag);

  if (texto !== undefined && texto !== null) {
    elemento.textContent = texto;
  }

  if (estilos) {
    elemento.style.cssText = estilos;
  }

  return elemento;
}

function normalizarAdicional(adicional) {
  return {
    id: Number(adicional.id ?? adicional.adicional_id),
    nome: adicional.nome || adicional.nome_adicional || "Adicional",
    preco: Number(adicional.preco || 0),
  };
}

function normalizarItemCarrinho(item) {
  const produtoId = Number(
    item.produto_id ?? item.produtoId ?? item.id_produto,
  );

  const quantidade = Number(item.quantidade || 1);
  const preco = Number(item.preco || 0);

  const adicionais = Array.isArray(item.adicionais)
    ? item.adicionais.map(normalizarAdicional)
    : [];

  const totalAdicionais = adicionais.reduce(
    (total, adicional) => total + adicional.preco,
    0,
  );

  const precoUnitario = preco + totalAdicionais;

  return {
    id: item.id,
    produto_id: produtoId,
    produtoId,
    nome: item.nome || item.nome_produto || "Produto",
    descricao: item.descricao || "",
    imagem: item.imagem || "",
    preco,
    quantidade,
    preco_unitario: precoUnitario,
    subtotal: precoUnitario * quantidade,
    adicionais,
  };
}

// ======================================================
// FORMAS DE PAGAMENTO
// ======================================================

function obterFormaPagamentoSelecionada() {
  if (!formaPagamento || !formaPagamento.value) {
    return null;
  }

  const id = Number(formaPagamento.value);

  return (
    formasPagamentoDisponiveis.find((forma) => Number(forma.id) === id) || null
  );
}

function obterTipoPagamentoSelecionado() {
  const forma = obterFormaPagamentoSelecionada();

  return forma ? String(forma.tipo).toLowerCase() : "";
}

async function carregarFormasPagamento() {
  if (!formaPagamento) {
    throw new Error("Campo de forma de pagamento não encontrado.");
  }

  formaPagamento.disabled = true;
  formaPagamento.replaceChildren();

  const opcaoInicial = document.createElement("option");
  opcaoInicial.value = "";
  opcaoInicial.textContent = "Carregando formas de pagamento...";

  formaPagamento.appendChild(opcaoInicial);

  try {
    const resposta = await fetch(API_FORMAS_PAGAMENTO, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const dados = await lerResposta(resposta);

    if (!resposta.ok) {
      throw new Error(
        dados.mensagem || "Não foi possível carregar as formas de pagamento.",
      );
    }

    if (!Array.isArray(dados.formasPagamento)) {
      throw new Error(
        "A API não retornou uma lista válida de formas de pagamento.",
      );
    }

    formasPagamentoDisponiveis = dados.formasPagamento.filter((forma) => {
      return (
        Number(forma.id) > 0 &&
        typeof forma.nome === "string" &&
        typeof forma.tipo === "string"
      );
    });

    formaPagamento.replaceChildren();

    const opcaoInicialReal = document.createElement("option");
    opcaoInicialReal.value = "";
    opcaoInicialReal.textContent = "Selecione uma forma de pagamento";

    formaPagamento.appendChild(opcaoInicialReal);

    formasPagamentoDisponiveis.forEach((forma) => {
      const opcao = document.createElement("option");

      opcao.value = String(forma.id);
      opcao.textContent = forma.nome;
      opcao.dataset.tipo = String(forma.tipo).toLowerCase();

      formaPagamento.appendChild(opcao);
    });

    if (formasPagamentoDisponiveis.length === 0) {
      opcaoInicialReal.textContent = "Nenhuma forma de pagamento disponível";

      formaPagamento.disabled = true;

      throw new Error(
        "Não existem formas de pagamento ativas no momento. Entre em contato com o estabelecimento.",
      );
    }

    formaPagamento.disabled = false;

    atualizarCampoTroco();

    return true;
  } catch (erro) {
    formasPagamentoDisponiveis = [];

    formaPagamento.replaceChildren();

    const opcaoErro = document.createElement("option");
    opcaoErro.value = "";
    opcaoErro.textContent = "Formas de pagamento indisponíveis";

    formaPagamento.appendChild(opcaoErro);
    formaPagamento.disabled = true;

    console.error("Erro ao carregar formas de pagamento:", erro);

    throw erro;
  }
}

function atualizarCampoTroco() {
  if (!trocoGroup || !formaPagamento) return;

  const tipo = obterTipoPagamentoSelecionado();
  const mostrarTroco = tipo === "dinheiro";

  trocoGroup.classList.toggle("hidden", !mostrarTroco);

  const campoTroco = document.getElementById("troco");

  if (campoTroco && !mostrarTroco) {
    campoTroco.value = "";
  }
}

// ======================================================
// ENDEREÇOS DO PERFIL
// ======================================================

function formatarEndereco(endereco) {
  const rua = endereco.rua || "";
  const numero = endereco.numero || "";
  const bairro = endereco.bairro || "";
  const cidade = endereco.cidade || "";

  return `${rua}, ${numero} - ${bairro}, ${cidade}`;
}

function preencherCamposEndereco(endereco) {
  if (!endereco) return;

  campoRua.value = endereco.rua || "";
  campoNumero.value = endereco.numero || "";
  campoComplemento.value = endereco.complemento || "";
  campoBairro.value = endereco.bairro || "";
  campoCidade.value = endereco.cidade || "";

  campoCep.value = "";

  enderecoSelecionadoId = Number(endereco.id);

  calcularTaxaEntrega();

  definirStatusEndereco(
    `Endereço selecionado: ${formatarEndereco(endereco)}`,
    "sucesso",
  );
}

function renderizarEnderecosSalvos() {
  if (!seletorEndereco) return;

  seletorEndereco.replaceChildren();

  const opcaoInicial = document.createElement("option");

  opcaoInicial.value = "";
  opcaoInicial.textContent = enderecosSalvos.length
    ? "Selecione um endereço cadastrado"
    : "Nenhum endereço cadastrado";

  seletorEndereco.appendChild(opcaoInicial);

  enderecosSalvos.forEach((endereco) => {
    const opcao = document.createElement("option");

    opcao.value = String(endereco.id);
    opcao.textContent = formatarEndereco(endereco);

    seletorEndereco.appendChild(opcao);
  });

  if (enderecoSelecionadoId !== null) {
    seletorEndereco.value = String(enderecoSelecionadoId);
  }
}

async function carregarEnderecosSalvos(opcoes = {}) {
  const selecionarPrimeiro = opcoes.selecionarPrimeiro !== false;

  if (!seletorEndereco) {
    console.warn("Elemento #enderecoSalvo não encontrado no checkout.html.");
    return false;
  }

  seletorEndereco.disabled = true;

  definirStatusEndereco("Carregando seus endereços...");

  try {
    const resposta = await fetch(API_PERFIL, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const dados = await lerResposta(resposta);

    if (!resposta.ok) {
      throw new Error(
        dados.mensagem ||
          dados.erro ||
          `Erro ao carregar endereços (${resposta.status}).`,
      );
    }

    if (!Array.isArray(dados.enderecos)) {
      throw new Error("A API não retornou uma lista válida de endereços.");
    }

    enderecosSalvos = dados.enderecos;

    renderizarEnderecosSalvos();

    if (enderecosSalvos.length === 0) {
      enderecoSelecionadoId = null;

      definirStatusEndereco(
        "Você ainda não possui endereços cadastrados. Preencha os campos e clique em Salvar no meu perfil.",
      );

      return true;
    }

    let enderecoParaSelecionar = null;

    if (enderecoSelecionadoId !== null) {
      enderecoParaSelecionar = enderecosSalvos.find(
        (endereco) => Number(endereco.id) === Number(enderecoSelecionadoId),
      );
    }

    if (!enderecoParaSelecionar && selecionarPrimeiro) {
      enderecoParaSelecionar = enderecosSalvos[0];
    }

    if (enderecoParaSelecionar) {
      seletorEndereco.value = String(enderecoParaSelecionar.id);
      preencherCamposEndereco(enderecoParaSelecionar);
    } else {
      enderecoSelecionadoId = null;

      definirStatusEndereco(
        "Selecione um dos seus endereços cadastrados ou informe um novo.",
      );
    }

    return true;
  } catch (erro) {
    console.error("Erro ao carregar endereços do perfil:", erro);

    enderecosSalvos = [];
    renderizarEnderecosSalvos();

    definirStatusEndereco(
      `${erro.message} Você ainda pode preencher o endereço manualmente.`,
      "erro",
    );

    return false;
  } finally {
    seletorEndereco.disabled = false;
  }
}

// ======================================================
// SELEÇÃO DE ENDEREÇO
// ======================================================

function selecionarEnderecoSalvo() {
  if (!seletorEndereco) return;

  const id = Number(seletorEndereco.value);

  if (!id) {
    enderecoSelecionadoId = null;

    definirStatusEndereco("Preencha os campos para utilizar um novo endereço.");

    return;
  }

  const endereco = enderecosSalvos.find((item) => Number(item.id) === id);

  if (!endereco) {
    definirStatusEndereco("Não foi possível localizar esse endereço.", "erro");
    return;
  }

  preencherCamposEndereco(endereco);
}

// ======================================================
// NOVO ENDEREÇO
// ======================================================

function novoEndereco() {
  enderecoSelecionadoId = null;

  if (seletorEndereco) {
    seletorEndereco.value = "";
  }

  campoCep.value = "";
  campoRua.value = "";
  campoNumero.value = "";
  campoComplemento.value = "";
  campoBairro.value = "";
  campoCidade.value = "";

  definirStatusEndereco(
    "Preencha os campos abaixo com seu novo endereço. Você poderá salvá-lo no perfil.",
  );

  calcularTaxaEntrega();

  campoRua.focus();
}

// ======================================================
// SALVAR ENDEREÇO NO PERFIL
// ======================================================

async function salvarEnderecoNoPerfil() {
  const rua = campoRua.value.trim();
  const numero = campoNumero.value.trim();
  const bairro = campoBairro.value.trim();
  const cidade = campoCidade.value.trim();
  const complemento = campoComplemento.value.trim();

  if (!rua || !numero || !bairro || !cidade) {
    alert("Preencha rua, número, bairro e cidade antes de salvar o endereço.");
    return;
  }

  if (btnSalvarEnderecoPerfil) {
    btnSalvarEnderecoPerfil.disabled = true;
    btnSalvarEnderecoPerfil.textContent = "Salvando...";
  }

  definirStatusEndereco("Salvando endereço no seu perfil...");

  try {
    const resposta = await fetch(`${API_PERFIL}/enderecos`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        rua,
        numero,
        bairro,
        cidade,
        complemento,
      }),
    });

    const dados = await lerResposta(resposta);

    if (!resposta.ok) {
      throw new Error(
        dados.mensagem || dados.erro || "Não foi possível salvar o endereço.",
      );
    }

    const carregou = await carregarEnderecosSalvos({
      selecionarPrimeiro: false,
    });

    if (!carregou) {
      throw new Error(
        "O endereço pode ter sido salvo, mas não foi possível atualizar a lista. Atualize a página para conferir.",
      );
    }

    let novoEnderecoSalvo = null;

    if (dados.endereco && dados.endereco.id) {
      novoEnderecoSalvo = enderecosSalvos.find(
        (endereco) => Number(endereco.id) === Number(dados.endereco.id),
      );
    }

    if (!novoEnderecoSalvo && dados.id) {
      novoEnderecoSalvo = enderecosSalvos.find(
        (endereco) => Number(endereco.id) === Number(dados.id),
      );
    }

    if (!novoEnderecoSalvo && enderecosSalvos.length > 0) {
      novoEnderecoSalvo = enderecosSalvos[0];
    }

    if (novoEnderecoSalvo) {
      enderecoSelecionadoId = Number(novoEnderecoSalvo.id);

      renderizarEnderecosSalvos();

      seletorEndereco.value = String(novoEnderecoSalvo.id);

      preencherCamposEndereco(novoEnderecoSalvo);
    }

    definirStatusEndereco(
      "Endereço salvo no seu perfil com sucesso!",
      "sucesso",
    );

    alert("Endereço cadastrado no seu perfil com sucesso!");
  } catch (erro) {
    console.error("Erro ao salvar endereço:", erro);

    definirStatusEndereco(erro.message, "erro");

    alert(erro.message || "Não foi possível salvar o endereço.");
  } finally {
    if (btnSalvarEnderecoPerfil) {
      btnSalvarEnderecoPerfil.disabled = false;
      btnSalvarEnderecoPerfil.textContent = "Salvar no meu perfil";
    }
  }
}

// ======================================================
// CARRINHO MYSQL
// ======================================================

async function carregarCarrinho() {
  try {
    const resposta = await fetch(API_CARRINHO, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (resposta.status === 401 || resposta.status === 403) {
      alert("Sua sessão expirou. Faça login novamente.");
      window.location.href = "/cadastro/login.html";
      return false;
    }

    const dados = await lerResposta(resposta);

    if (!resposta.ok) {
      throw new Error(
        dados.mensagem || "Não foi possível carregar seu carrinho.",
      );
    }

    const carrinho = dados.carrinho || dados;

    const itens = Array.isArray(carrinho)
      ? carrinho
      : Array.isArray(carrinho.itens)
        ? carrinho.itens
        : [];

    carrinhoAtual = itens.map(normalizarItemCarrinho);

    atualizarResumo();

    return true;
  } catch (erro) {
    console.error("Erro ao carregar carrinho do servidor:", erro);

    alert(erro.message || "Não foi possível carregar seu carrinho.");

    return false;
  }
}

async function limparCarrinhoServidor() {
  try {
    const resposta = await fetch(API_CARRINHO, {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!resposta.ok) {
      const dados = await lerResposta(resposta);

      throw new Error(dados.mensagem || "Não foi possível limpar o carrinho.");
    }

    carrinhoAtual = [];

    atualizarResumo();

    return true;
  } catch (erro) {
    console.warn("Não foi possível limpar o carrinho:", erro);
    return false;
  }
}

// ======================================================
// VALORES DO PEDIDO
// ======================================================

function subtotalCarrinho() {
  return obterCarrinho().reduce((total, item) => {
    const precoProduto = Number(item.preco || 0);
    const quantidade = Number(item.quantidade || 1);

    const totalAdicionais = (item.adicionais || []).reduce(
      (soma, adicional) => soma + Number(adicional.preco || 0),
      0,
    );

    return total + (precoProduto + totalAdicionais) * quantidade;
  }, 0);
}

function totalPedido() {
  return subtotalCarrinho() + Number(taxaEntregaAtual || 0);
}

// ======================================================
// TAXA DE ENTREGA
// ======================================================

function calcularTaxaLocalPorBairro(bairro) {
  const chave = normalizarTexto(bairro);

  if (!chave) {
    return TAXA_PADRAO_ENTREGA;
  }

  if (Object.prototype.hasOwnProperty.call(TAXAS_POR_BAIRRO, chave)) {
    return Number(TAXAS_POR_BAIRRO[chave]);
  }

  return TAXA_PADRAO_ENTREGA;
}

async function calcularTaxaEntrega() {
  if (tipoEntrega.value !== "entrega") {
    taxaEntregaAtual = 0;
    atualizarResumo();
    return 0;
  }

  const bairro = campoBairro.value.trim();

  taxaEntregaAtual = calcularTaxaLocalPorBairro(bairro);

  atualizarResumo();

  return taxaEntregaAtual;
}

function agendarCalculoTaxa() {
  clearTimeout(timerCalculoTaxa);

  timerCalculoTaxa = setTimeout(() => {
    calcularTaxaEntrega();
  }, 200);
}

// ======================================================
// RENDERIZAÇÃO DOS ADICIONAIS
// ======================================================

function renderizarAdicionais(item, container) {
  const adicionais = Array.isArray(item.adicionais) ? item.adicionais : [];

  adicionais.forEach((adicional) => {
    const nome = adicional.nome || adicional.nome_adicional || "Adicional";

    const detalhe = criarElemento(
      "p",
      `+ ${nome} — ${moeda(adicional.preco)}`,
      `
        margin: 5px 0 0 12px;
        color: #b5b5b5;
        font-size: 12px;
        line-height: 1.5;
      `,
    );

    container.appendChild(detalhe);
  });
}

// ======================================================
// RESUMO DO CHECKOUT
// ======================================================

function atualizarResumo() {
  const carrinho = obterCarrinho();
  const subtotal = subtotalCarrinho();
  const total = totalPedido();

  const itens = document.getElementById("checkoutItens");

  if (!itens) return;

  itens.innerHTML = "";

  if (carrinho.length === 0) {
    const mensagem = document.createElement("div");

    mensagem.style.cssText = `
      padding: 18px 12px;
      text-align: center;
      border: 1px dashed rgba(245, 197, 66, 0.35);
      border-radius: 10px;
      background: rgba(245, 197, 66, 0.04);
      margin: 12px 0;
    `;

    mensagem.innerHTML = `
      <div style="font-size: 30px; margin-bottom: 10px;">🛒</div>

      <strong style="
        display: block;
        color: #f5c542;
        font-size: 14px;
        margin-bottom: 7px;
      ">
        Seu carrinho está esperando!
      </strong>

      <p style="
        color: #a5a5a5;
        font-size: 12px;
        line-height: 1.6;
        margin: 0 0 14px;
      ">
        Você ainda não adicionou nenhum produto.
        Explore nosso cardápio e escolha seus favoritos!
      </p>

      <a href="/cliente/cardapio.html" style="
        display: inline-flex;
        justify-content: center;
        align-items: center;
        padding: 10px 16px;
        border-radius: 7px;
        background: #f5c542;
        color: #141414;
        font-size: 11px;
        font-weight: 700;
        text-decoration: none;
        text-transform: uppercase;
      ">
        Explorar cardápio
      </a>
    `;

    itens.appendChild(mensagem);
  } else {
    carrinho.forEach((item) => {
      const quantidade = Number(item.quantidade || 1);
      const precoProduto = Number(item.preco || 0);

      const totalAdicionais = (item.adicionais || []).reduce(
        (soma, adicional) => soma + Number(adicional.preco || 0),
        0,
      );

      const totalUnitario = precoProduto + totalAdicionais;

      const grupo = criarElemento(
        "div",
        null,
        `
          padding: 10px 0;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        `,
      );

      const linha = criarElemento(
        "p",
        `${quantidade}x ${item.nome}`,
        `
          margin: 0;
          color: #fff;
          font-weight: 600;
        `,
      );

      grupo.appendChild(linha);

      renderizarAdicionais(item, grupo);

      const valor = criarElemento(
        "p",
        moeda(totalUnitario * quantidade),
        `
          margin: 7px 0 0;
          color: #f5c542;
          font-size: 13px;
          font-weight: 700;
          text-align: right;
        `,
      );

      grupo.appendChild(valor);
      itens.appendChild(grupo);
    });
  }

  const elementoSubtotal = document.getElementById("checkoutSubtotal");
  const elementoTaxa = document.getElementById("checkoutTaxaEntrega");
  const elementoTotal = document.getElementById("checkoutTotal");
  const elementoConfTotal = document.getElementById("confTotal");

  if (elementoSubtotal) {
    elementoSubtotal.textContent = moeda(subtotal);
  }

  if (elementoTaxa) {
    elementoTaxa.textContent = moeda(taxaEntregaAtual);
  }

  if (elementoTotal) {
    elementoTotal.textContent = moeda(total);
  }

  if (elementoConfTotal) {
    elementoConfTotal.textContent = moeda(total);
  }
}

// ======================================================
// AUTENTICAÇÃO
// ======================================================

async function verificarUsuario() {
  const resposta = await fetch("/api/auth/me", {
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!resposta.ok) {
    alert("Faça login para finalizar seu pedido.");

    window.location.href = "/cadastro/login.html";

    return false;
  }

  const dados = await lerResposta(resposta);

  usuarioAtual = dados.usuario;

  return true;
}

// ======================================================
// ETAPAS
// ======================================================

function mostrarEtapa(numero) {
  etapaAtual = numero;

  document.querySelectorAll(".checkout-step").forEach((etapa) => {
    etapa.classList.toggle(
      "hidden",
      Number(etapa.id.replace("step", "")) !== numero,
    );
  });

  document.querySelectorAll(".progress-step").forEach((etapa) => {
    const passo = Number(etapa.dataset.step);

    etapa.classList.toggle("active", passo <= numero);
  });
}

// ======================================================
// VALIDAÇÃO DE ENDEREÇO
// ======================================================

function validarEndereco() {
  if (tipoEntrega.value === "retirada") {
    return true;
  }

  const campos = ["rua", "numero", "bairro", "cidade"];

  for (const id of campos) {
    const campo = document.getElementById(id);

    if (!campo || !campo.value.trim()) {
      alert(
        `Preencha o campo ${campo?.previousElementSibling?.textContent || id}.`,
      );

      campo?.focus();

      return false;
    }
  }

  return true;
}

// ======================================================
// CONFIRMAÇÃO
// ======================================================

function montarConfirmacao(dadosPedido = null) {
  const carrinho = obterCarrinho();
  const confItens = document.getElementById("confirmacaoItens");

  if (!confItens) return;

  confItens.innerHTML = "";

  carrinho.forEach((item) => {
    const quantidade = Number(item.quantidade || 1);

    const totalAdicionais = (item.adicionais || []).reduce(
      (soma, adicional) => soma + Number(adicional.preco || 0),
      0,
    );

    const totalUnitario = Number(item.preco || 0) + totalAdicionais;

    const grupo = criarElemento(
      "div",
      null,
      `
        padding: 10px 0;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      `,
    );

    const titulo = criarElemento(
      "p",
      `${quantidade}x ${item.nome || "Produto"}`,
      `
        margin: 0;
        color: #fff;
        font-weight: 600;
      `,
    );

    grupo.appendChild(titulo);

    renderizarAdicionais(item, grupo);

    const valor = criarElemento(
      "p",
      moeda(totalUnitario * quantidade),
      `
        margin: 7px 0 0;
        color: #f5c542;
        font-size: 13px;
        font-weight: 700;
        text-align: right;
      `,
    );

    grupo.appendChild(valor);
    confItens.appendChild(grupo);
  });

  const retirada = tipoEntrega.value === "retirada";

  const elementoEndereco = document.getElementById("confEnderecoTexto");

  if (elementoEndereco) {
    elementoEndereco.textContent = retirada
      ? "Retirada no estabelecimento."
      : `${campoRua.value}, ${campoNumero.value} - ${campoBairro.value}, ${campoCidade.value}`;
  }

  const formaSelecionada = obterFormaPagamentoSelecionada();
  const metodo = formaSelecionada
    ? formaSelecionada.nome
    : "Forma de pagamento não selecionada";

  const troco = document.getElementById("troco")?.value || "";

  const elementoPagamento = document.getElementById("confPagamentoTexto");

  if (elementoPagamento) {
    elementoPagamento.textContent =
      metodo +
      (obterTipoPagamentoSelecionado() === "dinheiro" && troco
        ? ` — Troco para ${moeda(troco)}`
        : "");
  }

  const totalConfirmado =
    dadosPedido && dadosPedido.total !== undefined
      ? Number(dadosPedido.total)
      : totalPedido();

  const elementoTotal = document.getElementById("confTotal");

  if (elementoTotal) {
    elementoTotal.textContent = moeda(totalConfirmado);
  }
}

// ======================================================
// CONSULTA DE CEP
// ======================================================

async function buscarCep() {
  const cep = campoCep.value.replace(/\D/g, "");

  if (cep.length !== 8) {
    alert("Informe um CEP válido.");
    return;
  }

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);

    const dados = await lerResposta(resposta);

    if (!resposta.ok || dados.erro) {
      throw new Error("CEP não encontrado.");
    }

    campoRua.value = dados.logradouro || "";
    campoBairro.value = dados.bairro || "";
    campoCidade.value = dados.localidade || "";

    enderecoSelecionadoId = null;

    if (seletorEndereco) {
      seletorEndereco.value = "";
    }

    await calcularTaxaEntrega();
  } catch (erro) {
    alert(erro.message || "Não foi possível consultar o CEP.");
  }
}

// ======================================================
// EVENTOS DE ENDEREÇO
// ======================================================

const btnBuscarCep = document.getElementById("btnBuscarCep");

if (btnBuscarCep) {
  btnBuscarCep.addEventListener("click", buscarCep);
}

if (seletorEndereco) {
  seletorEndereco.addEventListener("change", selecionarEnderecoSalvo);
}

if (btnNovoEndereco) {
  btnNovoEndereco.addEventListener("click", novoEndereco);
}

if (btnSalvarEnderecoPerfil) {
  btnSalvarEnderecoPerfil.addEventListener("click", salvarEnderecoNoPerfil);
}

if (campoBairro) {
  campoBairro.addEventListener("input", () => {
    enderecoSelecionadoId = null;

    if (seletorEndereco) {
      seletorEndereco.value = "";
    }

    agendarCalculoTaxa();
  });

  campoBairro.addEventListener("change", calcularTaxaEntrega);
}

if (campoCep) {
  campoCep.addEventListener("change", calcularTaxaEntrega);
}

tipoEntrega.addEventListener("change", async () => {
  const retirada = tipoEntrega.value === "retirada";

  enderecoCampos.classList.toggle("hidden", retirada);

  enderecoCampos.querySelectorAll("input").forEach((campo) => {
    campo.required =
      !retirada && ["rua", "numero", "bairro", "cidade"].includes(campo.id);
  });

  if (!retirada && enderecosSalvos.length === 0) {
    await carregarEnderecosSalvos();
  }

  await calcularTaxaEntrega();
});

// ======================================================
// EVENTOS DE PAGAMENTO
// ======================================================

formaPagamento.addEventListener("change", atualizarCampoTroco);

// ======================================================
// NAVEGAÇÃO ENTRE ETAPAS
// ======================================================

document.getElementById("btnProximo1").addEventListener("click", async () => {
  if (obterCarrinho().length === 0) {
    alert("Adicione produtos ao carrinho antes de continuar.");
    return;
  }

  if (!validarEndereco()) return;

  await calcularTaxaEntrega();

  mostrarEtapa(2);
});

document.getElementById("btnVoltar2").addEventListener("click", () => {
  mostrarEtapa(1);
});

document.getElementById("btnProximo2").addEventListener("click", () => {
  if (!obterFormaPagamentoSelecionada()) {
    alert("Selecione uma forma de pagamento.");
    return;
  }

  if (obterTipoPagamentoSelecionado() === "dinheiro") {
    const trocoCampo = document.getElementById("troco");
    const troco = Number(trocoCampo.value);

    if (trocoCampo.value && troco < totalPedido()) {
      alert(
        "O valor informado para troco precisa ser igual ou superior ao total com entrega.",
      );

      trocoCampo.focus();
      return;
    }
  }

  montarConfirmacao();

  mostrarEtapa(3);
});

document.getElementById("btnVoltar3").addEventListener("click", () => {
  mostrarEtapa(2);
});

// ======================================================
// FINALIZAÇÃO DO PEDIDO
// ======================================================

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  if (pedidoEmEnvio) return;

  const carrinho = obterCarrinho();

  if (carrinho.length === 0) {
    alert(
      "Seu carrinho ainda está vazio!\n\n" +
        "Que tal explorar nosso cardápio e escolher algo delicioso?",
    );

    return;
  }

  const botao = document.getElementById("btnFinalizarPedido");
  const elementoPedidoNumero = document.getElementById("pedidoNumero");

  if (!botao || !sucessoModal || !elementoPedidoNumero) {
    console.error(
      "Elementos necessários para finalizar o pedido não encontrados.",
    );

    alert("Não foi possível carregar a confirmação do pedido.");
    return;
  }

  pedidoEmEnvio = true;
  botao.disabled = true;
  botao.textContent = "Registrando pedido...";

  try {
    const entrega = tipoEntrega.value;

    if (entrega === "entrega" && !validarEndereco()) {
      return;
    }

    const formaSelecionada = obterFormaPagamentoSelecionada();

    if (!formaSelecionada) {
      throw new Error("Selecione uma forma de pagamento válida.");
    }

    const taxaFinal = entrega === "entrega" ? await calcularTaxaEntrega() : 0;

    const itensPedido = carrinho.map((item) => {
      const adicionais = (item.adicionais || []).map((adicional) =>
        Number(adicional.id ?? adicional.adicional_id),
      );

      if (adicionais.some((id) => !Number.isInteger(id) || id <= 0)) {
        throw new Error(
          `Os adicionais de "${item.nome}" possuem dados inválidos. Recarregue o carrinho.`,
        );
      }

      return {
        produto_id: Number(item.produto_id),
        quantidade: Number(item.quantidade || 1),
        adicionais,
      };
    });

    const tipoPagamento = String(formaSelecionada.tipo).toLowerCase();

    const payload = {
      tipo_entrega: entrega,

      endereco:
        entrega === "entrega"
          ? {
              cep: campoCep.value.trim(),
              rua: campoRua.value.trim(),
              numero: campoNumero.value.trim(),
              bairro: campoBairro.value.trim(),
              cidade: campoCidade.value.trim(),
              complemento: campoComplemento.value.trim(),
              referencia: campoReferencia.value.trim(),
            }
          : null,

      forma_pagamento_id: Number(formaSelecionada.id),

      troco_para:
        tipoPagamento === "dinheiro"
          ? Number(document.getElementById("troco").value || 0)
          : null,

      observacoes: document.getElementById("observacao").value.trim(),

      itens: itensPedido,
    };

    const resposta = await fetch(API_PEDIDOS, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const dados = await lerResposta(resposta);

    if (!resposta.ok) {
      throw new Error(
        dados.mensagem || dados.erro || "Não foi possível registrar o pedido.",
      );
    }

    const numeroPedido =
      dados.pedidoId || dados.pedido_id || dados.id || "Registrado";

    elementoPedidoNumero.textContent = `Pedido #${numeroPedido}`;

    const totalConfirmado =
      dados.total !== undefined ? Number(dados.total) : null;

    const subtotalConfirmado =
      dados.subtotal !== undefined ? Number(dados.subtotal) : null;

    const taxaConfirmada =
      dados.taxaEntrega !== undefined
        ? Number(dados.taxaEntrega)
        : dados.taxa_entrega !== undefined
          ? Number(dados.taxa_entrega)
          : null;

    if (Number.isFinite(totalConfirmado)) {
      const elementoTotal = document.getElementById("checkoutTotal");
      const elementoConfTotal = document.getElementById("confTotal");

      if (elementoTotal) {
        elementoTotal.textContent = moeda(totalConfirmado);
      }

      if (elementoConfTotal) {
        elementoConfTotal.textContent = moeda(totalConfirmado);
      }
    }

    if (Number.isFinite(subtotalConfirmado)) {
      const elementoSubtotal = document.getElementById("checkoutSubtotal");

      if (elementoSubtotal) {
        elementoSubtotal.textContent = moeda(subtotalConfirmado);
      }
    }

    if (Number.isFinite(taxaConfirmada)) {
      const elementoTaxa = document.getElementById("checkoutTaxaEntrega");

      if (elementoTaxa) {
        elementoTaxa.textContent = moeda(taxaConfirmada);
      }
    }

    sucessoModal.classList.remove("hidden");
    sucessoModal.style.display = "flex";
    sucessoModal.setAttribute("aria-hidden", "false");

    botao.textContent = "Pedido registrado";

    const carrinhoLimpo = await limparCarrinhoServidor();

    if (!carrinhoLimpo) {
      console.warn(
        "O pedido foi registrado, mas o carrinho não foi limpo no servidor.",
      );
    }
  } catch (erro) {
    console.error("Erro ao finalizar pedido:", erro);

    alert(erro.message || "Não foi possível finalizar seu pedido.");
  } finally {
    pedidoEmEnvio = false;

    if (sucessoModal.classList.contains("hidden")) {
      botao.disabled = false;
      botao.textContent = "Confirmar Pedido";
    }
  }
});

// ======================================================
// INICIALIZAÇÃO
// ======================================================

async function iniciarCheckout() {
  try {
    const autenticado = await verificarUsuario();

    if (!autenticado) return;

    const carregado = await carregarCarrinho();

    if (!carregado) return;

    await carregarFormasPagamento();

    await carregarEnderecosSalvos();

    await calcularTaxaEntrega();

    mostrarEtapa(1);
  } catch (erro) {
    console.error("Erro ao iniciar checkout:", erro);

    alert(
      erro.message || "Não foi possível carregar o checkout. Tente novamente.",
    );
  }
}

iniciarCheckout();
