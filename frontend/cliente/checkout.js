const CHAVE_CARRINHO = "fraga_carrinho";

const form = document.getElementById("checkoutForm");
const tipoEntrega = document.getElementById("tipoEntrega");
const enderecoCampos = document.getElementById("enderecoCampos");
const formaPagamento = document.getElementById("formaPagamento");
const trocoGroup = document.getElementById("trocoGroup");

let etapaAtual = 1;
let usuarioAtual = null;

function obterCarrinho() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_CARRINHO)) || [];
  } catch {
    return [];
  }
}

function moeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function subtotalCarrinho() {
  return obterCarrinho().reduce((total, item) => {
    const adicionais = (item.adicionais || []).reduce(
      (soma, adicional) => soma + Number(adicional.preco),
      0,
    );

    return total + (Number(item.preco) + adicionais) * Number(item.quantidade);
  }, 0);
}

function atualizarResumo() {
  const carrinho = obterCarrinho();
  const subtotal = subtotalCarrinho();

  const itens = document.getElementById("checkoutItens");
  itens.innerHTML = "";

  carrinho.forEach((item) => {
    const linha = document.createElement("p");
    linha.textContent = `${item.quantidade}x ${item.nome}`;
    itens.appendChild(linha);
  });

  document.getElementById("checkoutSubtotal").textContent = moeda(subtotal);
  document.getElementById("checkoutTaxaEntrega").textContent = moeda(0);
  document.getElementById("checkoutTotal").textContent = moeda(subtotal);
  document.getElementById("confTotal").textContent = moeda(subtotal);
}

async function verificarUsuario() {
  const resposta = await fetch("/api/auth/me");

  if (!resposta.ok) {
    alert("Faça login para finalizar seu pedido.");
    window.location.href = "/cadastro/login.html";
    return false;
  }

  const dados = await resposta.json();
  usuarioAtual = dados.usuario;

  return true;
}

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

function validarEndereco() {
  if (tipoEntrega.value === "retirada") return true;

  const campos = ["rua", "numero", "bairro", "cidade"];

  for (const id of campos) {
    const campo = document.getElementById(id);

    if (!campo.value.trim()) {
      alert(
        `Preencha o campo ${campo.previousElementSibling?.textContent || id}.`,
      );
      campo.focus();
      return false;
    }
  }

  return true;
}

function montarConfirmacao() {
  const retirada = tipoEntrega.value === "retirada";

  document.getElementById("confEnderecoTexto").textContent = retirada
    ? "Retirada no estabelecimento."
    : `${document.getElementById("rua").value}, ${document.getElementById("numero").value} - ${document.getElementById("bairro").value}, ${document.getElementById("cidade").value}`;

  const metodo = formaPagamento.options[formaPagamento.selectedIndex].text;
  const troco = document.getElementById("troco").value;

  document.getElementById("confPagamentoTexto").textContent =
    metodo +
    (formaPagamento.value === "dinheiro" && troco
      ? ` — Troco para ${moeda(troco)}`
      : "");
}

async function buscarCep() {
  const cep = document.getElementById("cep").value.replace(/\D/g, "");

  if (cep.length !== 8) {
    alert("Informe um CEP válido.");
    return;
  }

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const dados = await resposta.json();

    if (!resposta.ok || dados.erro) {
      throw new Error("CEP não encontrado.");
    }

    document.getElementById("rua").value = dados.logradouro || "";
    document.getElementById("bairro").value = dados.bairro || "";
    document.getElementById("cidade").value = dados.localidade || "";
  } catch (erro) {
    alert(erro.message || "Não foi possível consultar o CEP.");
  }
}

document.getElementById("btnBuscarCep").addEventListener("click", buscarCep);

tipoEntrega.addEventListener("change", () => {
  const retirada = tipoEntrega.value === "retirada";
  enderecoCampos.classList.toggle("hidden", retirada);

  enderecoCampos.querySelectorAll("input").forEach((campo) => {
    campo.required =
      !retirada && ["rua", "numero", "bairro", "cidade"].includes(campo.id);
  });

  atualizarResumo();
});

formaPagamento.addEventListener("change", () => {
  trocoGroup.classList.toggle("hidden", formaPagamento.value !== "dinheiro");
});

document.getElementById("btnProximo1").addEventListener("click", () => {
  if (!validarEndereco()) return;
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
    const troco = Number(document.getElementById("troco").value);

    if (document.getElementById("troco").value && troco < subtotalCarrinho()) {
      alert(
        "O valor informado para troco precisa ser igual ou superior ao total.",
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

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const carrinho = obterCarrinho();

  if (carrinho.length === 0) {
    alert("Seu carrinho está vazio.");
    return;
  }

  const botao = document.getElementById("btnFinalizarPedido");
  botao.disabled = true;
  botao.textContent = "Registrando pedido...";

  try {
    const entrega = tipoEntrega.value;
    const payload = {
      tipo_entrega: entrega,
      endereco:
        entrega === "entrega"
          ? {
              rua: document.getElementById("rua").value.trim(),
              numero: document.getElementById("numero").value.trim(),
              bairro: document.getElementById("bairro").value.trim(),
              cidade: document.getElementById("cidade").value.trim(),
              complemento: document.getElementById("complemento").value.trim(),
            }
          : null,
      forma_pagamento: formaPagamento.value,
      troco_para:
        formaPagamento.value === "dinheiro"
          ? Number(document.getElementById("troco").value || 0)
          : null,
      observacoes: document.getElementById("observacao").value.trim(),
      itens: carrinho.map((item) => ({
        produto_id: item.produtoId,
        quantidade: item.quantidade,
        adicionais: (item.adicionais || []).map((adicional) => adicional.id),
      })),
    };

    const resposta = await fetch("/api/pedidos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.mensagem || "Não foi possível registrar o pedido.");
    }

    localStorage.removeItem(CHAVE_CARRINHO);

    document.getElementById("pedidoNumero").textContent =
      `Pedido #${dados.pedidoId || dados.id}`;

    document.getElementById("sucessoModal").classList.remove("hidden");
  } catch (erro) {
    console.error(erro);
    alert(erro.message || "Erro ao finalizar o pedido.");
  } finally {
    botao.disabled = false;
    botao.textContent = "Confirmar Pedido";
  }
});

async function iniciarCheckout() {
  if (obterCarrinho().length === 0) {
    alert("Seu carrinho está vazio.");
    window.location.href = "/cliente/cardapio.html";
    return;
  }

  const autenticado = await verificarUsuario();

  if (!autenticado) return;

  atualizarResumo();
  mostrarEtapa(1);
}

iniciarCheckout();
