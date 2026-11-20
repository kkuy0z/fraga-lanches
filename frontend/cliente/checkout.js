"use strict";

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const API_CARRINHO = "/api/cliente/carrinho";
const API_PEDIDOS = "/api/pedidos";
const API_PERFIL = "/api/cliente/perfil";

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

// Elementos de endereços salvos.
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

// Endereços cadastrados no perfil.
let enderecosSalvos = [];
let enderecoSelecionadoId = null;

// ======================================================
// UTILITÁRIOS
// ======================================================

function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
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

  // O banco de dados não armazena CEP.
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
      // A API ordena os endereços do mais recente para o mais antigo.
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

    // Atualiza a lista consultando novamente o banco.
    const carregou = await carregarEnderecosSalvos({
      selecionarPrimeiro: false,
    });

    if (!carregou) {
      throw new Error(
        "O endereço pode ter sido salvo, mas não foi possível atualizar a lista. Atualize a página para conferir.",
      );
    }

    // A API ordena por ID decrescente; o novo endereço aparece primeiro.
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

    carrinhoAtual = itens.map((item) => {
      const produtoId = Number(
        item.produto_id ?? item.produtoId ?? item.id_produto,
      );

      const quantidade = Number(item.quantidade || 1);
      const preco = Number(item.preco || 0);

      return {
        id: item.id,
        produto_id: produtoId,
        produtoId,
        nome: item.nome || "Produto",
        descricao: item.descricao || "",
        imagem: item.imagem || "",
        preco,
        quantidade,
        subtotal: Number(item.subtotal ?? preco * quantidade),
        adicionais: Array.isArray(item.adicionais) ? item.adicionais : [],
      };
    });

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
    const adicionais = (item.adicionais || []).reduce(
      (soma, adicional) => soma + Number(adicional.preco || 0),
      0,
    );

    return (
      total +
      (Number(item.preco || 0) + adicionais) * Number(item.quantidade || 1)
    );
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
      const linha = document.createElement("p");

      linha.textContent = `${item.quantidade}x ${item.nome}`;

      itens.appendChild(linha);
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
    const linha = document.createElement("p");
    linha.textContent = `${item.quantidade || 1}x ${item.nome || "Produto"}`;
    confItens.appendChild(linha);
  });

  const retirada = tipoEntrega.value === "retirada";

  document.getElementById("confEnderecoTexto").textContent = retirada
    ? "Retirada no estabelecimento."
    : `${campoRua.value}, ${campoNumero.value} - ${campoBairro.value}, ${campoCidade.value}`;

  const metodo = formaPagamento.options[formaPagamento.selectedIndex].text;
  const troco = document.getElementById("troco").value;

  document.getElementById("confPagamentoTexto").textContent =
    metodo +
    (formaPagamento.value === "dinheiro" && troco
      ? ` — Troco para ${moeda(troco)}`
      : "");

  const totalConfirmado =
    dadosPedido && dadosPedido.total !== undefined
      ? Number(dadosPedido.total)
      : totalPedido();

  document.getElementById("confTotal").textContent = moeda(totalConfirmado);
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

    // Ao alterar os campos, deixa de ser um endereço salvo selecionado.
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

campoBairro.addEventListener("input", () => {
  enderecoSelecionadoId = null;

  if (seletorEndereco) {
    seletorEndereco.value = "";
  }

  agendarCalculoTaxa();
});

campoBairro.addEventListener("change", calcularTaxaEntrega);

campoCep.addEventListener("change", calcularTaxaEntrega);

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

formaPagamento.addEventListener("change", () => {
  trocoGroup.classList.toggle("hidden", formaPagamento.value !== "dinheiro");
});

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
  if (!formaPagamento.value) {
    alert("Selecione uma forma de pagamento.");

    return;
  }

  if (formaPagamento.value === "dinheiro") {
    const trocoCampo = document.getElementById("troco");
    const troco = Number(trocoCampo.value);

    if (trocoCampo.value && troco < totalPedido()) {
      alert(
        "O valor informado para troco precisa ser igual ou superior ao total com entrega.",
      );

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

// ======================================================
// FINALIZAÇÃO DO PEDIDO
// ======================================================

let pedidoEmEnvio = false;

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

    if (!formaPagamento.value) {
      throw new Error("Selecione uma forma de pagamento.");
    }

    const taxaFinal = entrega === "entrega" ? await calcularTaxaEntrega() : 0;

    const payload = {
      tipo_entrega: entrega,
      taxa_entrega: taxaFinal,

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

      forma_pagamento: formaPagamento.value,

      troco_para:
        formaPagamento.value === "dinheiro"
          ? Number(document.getElementById("troco").value || 0)
          : null,

      observacoes: document.getElementById("observacao").value.trim(),

      itens: carrinho.map((item) => ({
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        adicionais: (item.adicionais || []).map((adicional) => adicional.id),
      })),
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

    // Pedido registrado pelo servidor.
    const numeroPedido =
      dados.pedidoId || dados.pedido_id || dados.id || "Registrado";

    elementoPedidoNumero.textContent = `Pedido #${numeroPedido}`;

    // Recupera os valores oficiais retornados pelo backend.
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

    // Atualiza os valores exibidos.
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

    // Exibe a confirmação.
    sucessoModal.classList.remove("hidden");
    sucessoModal.style.display = "flex";
    sucessoModal.setAttribute("aria-hidden", "false");

    botao.textContent = "Pedido registrado";

    // Limpa o carrinho somente depois do registro.
    const carrinhoLimpo = await limparCarrinhoServidor();

    if (!carrinhoLimpo) {
      console.warn(
        "O pedido foi registrado, mas o carrinho não foi limpo no servidor.",
      );
    }

    // A limpeza atualiza o resumo. Reaplica os valores do pedido concluído.
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

    // Primeiro carrega o carrinho do MySQL.
    const carregado = await carregarCarrinho();

    if (!carregado) return;

    // Carrega os endereços cadastrados no perfil.
    await carregarEnderecosSalvos();

    // Atualiza os valores e a taxa de entrega.
    await calcularTaxaEntrega();

    // Abre a primeira etapa.
    mostrarEtapa(1);
  } catch (erro) {
    console.error("Erro ao iniciar checkout:", erro);

    alert("Não foi possível carregar o checkout. Tente novamente.");
  }
}

iniciarCheckout();
