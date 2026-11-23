"use strict";

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const API_CARRINHO = "/api/cliente/carrinho";
const API_PEDIDOS = "/api/pedidos";
const API_PERFIL = "/api/cliente/perfil";
const API_FORMAS_PAGAMENTO = "/api/formas-pagamento";
const CHAVE_SESSAO_INTENCAO_PIX = "fraga_pix_intencao_pendente";
const API_STATUS_INTENCAO_PIX = (id) =>
  `${API_PEDIDOS}/pix/intencoes/${encodeURIComponent(id)}`;

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
const pixContainer = document.getElementById("pixContainer");
const pixQrCode = document.getElementById("pixQrCode");
const pixValor = document.getElementById("pixValor");
const pixTemporizador = document.getElementById("pixTemporizador");
const pixChave = document.getElementById("pixChave");
const pixCopiaECola = document.getElementById("pixCopiaECola");
const btnCopiarPixChave = document.getElementById("btnCopiarPixChave");
const btnCopiarPix = document.getElementById("btnCopiarPix");
const mensagemSucesso = document.getElementById("mensagemSucesso");
const campoCep = document.getElementById("cep");
const campoRua = document.getElementById("rua");
const campoNumero = document.getElementById("numero");

if (campoNumero) {
  campoNumero.maxLength = 4;
  campoNumero.inputMode = "numeric";
  campoNumero.addEventListener("input", () => {
    campoNumero.value = campoNumero.value.replace(/\D/g, "").slice(0, 4);
    campoNumero.setCustomValidity("");
  });
}

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
const btnCancelarPix = document.getElementById("btnCancelarPix");
// ======================================================
// MODAL
// ======================================================

if (sucessoModal) {
  sucessoModal.classList.add("hidden");
  sucessoModal.classList.remove("show");
  sucessoModal.style.display = "none";
  sucessoModal.setAttribute("aria-hidden", "true");
}

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
let pedidoRegistrado = false;

let formasPagamentoDisponiveis = [];

let pixIntervalo = null;
let pixConsultaIntervalo = null;
let pixSegundosRestantes = 0;
let pixIntencaoAtual = null;
let pixIntencaoTerminal = false;
let pixCarrinhoLimpo = false;
let pixConsultaEmAndamento = false;
let pixRespostaInconsistente = false;

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

function salvarIntencaoPixNaSessao(id) {
  if (!id) return false;

  try {
    sessionStorage.setItem(
      CHAVE_SESSAO_INTENCAO_PIX,
      JSON.stringify({
        id: String(id),
      }),
    );

    return true;
  } catch (erro) {
    console.error("[PIX] Não foi possível salvar a intenção:", erro);
    return false;
  }
}
function removerIntencaoPixDaSessao() {
  try {
    sessionStorage.removeItem(CHAVE_SESSAO_INTENCAO_PIX);
  } catch (erro) {
    console.warn("[PIX] Erro ao limpar sessão:", erro);
  }
}

function obterIntencaoPixDaSessao() {
  try {
    const valor = sessionStorage.getItem(CHAVE_SESSAO_INTENCAO_PIX);

    if (!valor) return null;

    return JSON.parse(valor);
  } catch (erro) {
    console.error("[PIX] Erro ao recuperar intenção:", erro);
    return null;
  }
}

function obterIdIntencaoPix(dados) {
  const resposta = dados?.data || dados?.dados || dados || {};

  const intencao =
    resposta.intencao ||
    resposta.intencaoPix ||
    resposta.intencao_pix ||
    resposta;

  return (
    intencao?.intencaoPixId ||
    intencao?.intencao_pix_id ||
    intencao?.intencaoId ||
    intencao?.intencao_id ||
    intencao?.id ||
    resposta?.intencaoPixId ||
    resposta?.intencao_pix_id ||
    resposta?.intencaoId ||
    resposta?.intencao_id ||
    null
  );
}

function obterObjetoIntencao(dados) {
  const resposta = dados?.data || dados?.dados || dados || {};

  return (
    resposta.intencao ||
    resposta.intencaoPix ||
    resposta.intencao_pix ||
    resposta
  );
}

function obterStatusIntencao(dados) {
  const resposta = dados?.data || dados?.dados || dados || {};
  const intencao = obterObjetoIntencao(dados);

  return String(intencao?.status || resposta?.status || "")
    .trim()
    .toLowerCase();
}
function obterNumeroPedido(dados) {
  const resposta = dados?.data || dados?.dados || dados || {};
  const intencao = obterObjetoIntencao(dados);

  return (
    resposta?.pedidoId ||
    resposta?.pedido_id ||
    resposta?.pedido?.id ||
    intencao?.pedidoId ||
    intencao?.pedido_id ||
    intencao?.pedido?.id ||
    null
  );
}

async function lerResposta(resposta) {
  return resposta.json().catch(() => ({}));
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

// ======================================================
// PAGAMENTO PIX
// ======================================================

function formatarTempoPix(segundos) {
  const minutos = Math.floor(segundos / 60);
  const restantes = segundos % 60;

  return `${String(minutos).padStart(2, "0")}:${String(restantes).padStart(2, "0")}`;
}

function pararTemporizadorPix() {
  if (pixIntervalo) {
    clearInterval(pixIntervalo);
    pixIntervalo = null;
  }
}

function pararConsultaPix() {
  if (pixConsultaIntervalo) {
    clearInterval(pixConsultaIntervalo);
    pixConsultaIntervalo = null;
  }
}

function calcularSegundosRestantesPix(dados) {
  const intencao = obterObjetoIntencao(dados);

  const segundosInformados =
    dados?.pixExpiraEmSegundos ??
    dados?.expiraEmSegundos ??
    intencao?.pixExpiraEmSegundos ??
    intencao?.expiraEmSegundos;

  if (segundosInformados !== undefined && segundosInformados !== null) {
    return Math.max(0, Number(segundosInformados) || 0);
  }

  const dataExpiracao =
    dados?.expiraEm ||
    dados?.expira_em ||
    intencao?.expiraEm ||
    intencao?.expira_em;

  if (dataExpiracao) {
    const data = new Date(dataExpiracao).getTime();

    if (Number.isFinite(data)) {
      return Math.max(0, Math.ceil((data - Date.now()) / 1000));
    }
  }

  return 300;
}

function iniciarTemporizadorPix(segundos = 300) {
  pararTemporizadorPix();

  pixSegundosRestantes = Math.max(0, Number(segundos) || 0);

  if (!pixTemporizador) return;

  pixTemporizador.classList.remove("pix-expirado");
  pixTemporizador.textContent = formatarTempoPix(pixSegundosRestantes);

  if (pixSegundosRestantes <= 0) {
    pixTemporizador.textContent = "Tempo esgotado";
    pixTemporizador.classList.add("pix-expirado");
    return;
  }

  pixIntervalo = setInterval(() => {
    pixSegundosRestantes--;

    if (pixSegundosRestantes <= 0) {
      pararTemporizadorPix();

      pixSegundosRestantes = 0;

      pixTemporizador.textContent = "Tempo esgotado";
      pixTemporizador.classList.add("pix-expirado");

      if (mensagemSucesso && !pixIntencaoTerminal) {
        mensagemSucesso.textContent =
          "O prazo do PIX terminou. Estamos verificando a situação do pagamento.";
      }

      if (btnCopiarPix) btnCopiarPix.disabled = true;
      if (btnCopiarPixChave) btnCopiarPixChave.disabled = true;

      // A consulta continua para detectar uma aprovação já realizada.
      consultarStatusIntencaoPix();
      return;
    }

    pixTemporizador.textContent = formatarTempoPix(pixSegundosRestantes);
  }, 1000);
}

async function copiarTextoPix(texto, botao, textoOriginal) {
  if (!texto) {
    alert("Não há informação PIX disponível para copiar.");
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
    } else {
      const campoTemporario = document.createElement("textarea");

      campoTemporario.value = texto;
      campoTemporario.style.position = "fixed";
      campoTemporario.style.opacity = "0";

      document.body.appendChild(campoTemporario);
      campoTemporario.select();

      const copiado = document.execCommand("copy");

      campoTemporario.remove();

      if (!copiado) {
        throw new Error("Não foi possível copiar automaticamente.");
      }
    }

    if (botao) {
      botao.textContent = "Copiado!";
      botao.disabled = true;

      setTimeout(() => {
        if (pixIntencaoTerminal) return;

        botao.textContent = textoOriginal;
        botao.disabled = false;
      }, 1800);
    }
  } catch (erro) {
    console.error("Erro ao copiar informação PIX:", erro);
    alert("Não foi possível copiar. Selecione e copie o conteúdo manualmente.");
  }
}

async function gerarQrCodePix(codigo) {
  if (!pixQrCode || !codigo) return false;

  // Usa a biblioteca QRCode caso ela já esteja carregada no checkout.
  if (window.QRCode && typeof window.QRCode.toDataURL === "function") {
    try {
      const imagem = await window.QRCode.toDataURL(codigo, {
        width: 260,
        margin: 2,
        errorCorrectionLevel: "M",
      });

      pixQrCode.src = imagem;
      pixQrCode.alt = "QR Code para pagamento PIX";

      return true;
    } catch (erro) {
      console.error("Erro ao gerar QR Code PIX:", erro);
    }
  }

  // Algumas versões da biblioteca disponibilizam um construtor.
  if (typeof window.QRCode === "function") {
    try {
      const area = document.createElement("div");
      area.style.cssText = "display:none";

      document.body.appendChild(area);

      new window.QRCode(area, {
        text: codigo,
        width: 260,
        height: 260,
        correctLevel: window.QRCode.CorrectLevel?.M || undefined,
      });

      const imagemGerada = area.querySelector("canvas, img");

      if (imagemGerada) {
        if (imagemGerada.tagName === "CANVAS") {
          pixQrCode.src = imagemGerada.toDataURL("image/png");
        } else {
          pixQrCode.src = imagemGerada.src;
        }

        pixQrCode.alt = "QR Code para pagamento PIX";
        area.remove();

        return true;
      }

      area.remove();
    } catch (erro) {
      console.error("Erro ao gerar QR Code PIX:", erro);
    }
  }

  pixQrCode.removeAttribute("src");
  pixQrCode.alt = "QR Code indisponível. Utilize o código PIX copia e cola.";

  return false;
}

async function exibirPagamentoPix(dados) {
  if (!pixContainer) {
    console.error("Elemento #pixContainer não encontrado.");
    return false;
  }

  pararTemporizadorPix();

  const intencao = obterObjetoIntencao(dados);

  const codigo =
    dados?.pixCopiaECola ||
    dados?.pix_copia_e_cola ||
    intencao?.pixCopiaECola ||
    intencao?.pix_copia_e_cola ||
    "";

  const chave =
    dados?.pixChave ||
    dados?.pix_chave ||
    intencao?.pixChave ||
    intencao?.pix_chave ||
    "";

  const qrCode =
    dados?.pixQrCode ||
    dados?.pix_qr_code ||
    intencao?.pixQrCode ||
    intencao?.pix_qr_code ||
    "";

  const valor =
    dados?.pixValor ??
    dados?.pix_valor ??
    intencao?.total ??
    dados?.total ??
    totalPedido();

  if (!codigo) {
    console.error("[CHECKOUT] Código PIX não retornado pelo servidor.", dados);

    if (mensagemSucesso) {
      mensagemSucesso.textContent =
        "A intenção PIX foi criada, mas o código de pagamento não foi retornado. Não faça outro pedido. Atualize a página ou entre em contato com o estabelecimento.";
    }

    return false;
  }

  pixContainer.classList.add("ativo");

  if (pixQrCode) {
    if (qrCode) {
      pixQrCode.src = qrCode;
      pixQrCode.alt = "QR Code para pagamento PIX";
    } else {
      await gerarQrCodePix(codigo);
    }
  }

  if (pixValor) {
    pixValor.textContent = moeda(valor);
  }

  if (pixChave) {
    pixChave.textContent = chave || "Utilize o código PIX copia e cola.";
  }

  if (pixCopiaECola) {
    pixCopiaECola.value = codigo;
  }

  if (mensagemSucesso) {
    mensagemSucesso.textContent =
      "PIX aguardando confirmação. Após pagar, aguarde a conferência do estabelecimento. Seu pedido só será criado depois da aprovação.";
  }

  if (btnCopiarPix) {
    btnCopiarPix.disabled = false;
    btnCopiarPix.textContent = "Copiar código PIX";
  }

  if (btnCopiarPixChave) {
    btnCopiarPixChave.disabled = !chave;
    btnCopiarPixChave.textContent = "Copiar chave PIX";
  }

  iniciarTemporizadorPix(calcularSegundosRestantesPix(dados));

  return true;
}

function ocultarPagamentoPix() {
  pararTemporizadorPix();
  pararConsultaPix();

  if (pixContainer) {
    pixContainer.classList.remove("ativo");
  }

  if (pixQrCode) {
    pixQrCode.removeAttribute("src");
    pixQrCode.alt = "";
  }

  if (pixValor) {
    pixValor.textContent = "";
  }

  if (pixChave) {
    pixChave.textContent = "";
  }

  if (pixCopiaECola) {
    pixCopiaECola.value = "";
  }
}

function configurarModalSucesso({
  titulo = "Pedido registrado!",
  mostrarLinkPedidos = false,
} = {}) {
  const elementoTitulo = document.getElementById("tituloSucesso");
  const linkMeusPedidos = document.getElementById("linkMeusPedidos");

  if (elementoTitulo) {
    elementoTitulo.textContent = titulo;
  }

  if (linkMeusPedidos) {
    linkMeusPedidos.style.display = mostrarLinkPedidos ? "" : "none";
    linkMeusPedidos.setAttribute(
      "aria-hidden",
      mostrarLinkPedidos ? "false" : "true",
    );
  }
}

function abrirModalSucesso() {
  if (!sucessoModal) return;

  sucessoModal.classList.remove("hidden");
  sucessoModal.classList.add("show");
  sucessoModal.style.display = "flex";
  sucessoModal.setAttribute("aria-hidden", "false");
}

function atualizarBotaoFinalizar(texto, desabilitado) {
  const botao = document.getElementById("btnFinalizarPedido");

  if (!botao) return;

  botao.textContent = texto;
  botao.disabled = Boolean(desabilitado);
}

// ======================================================
// CONSULTAR STATUS DA INTENÇÃO PIX
// ======================================================

async function consultarStatusIntencaoPix() {
  if (!pixIntencaoAtual || pixIntencaoTerminal || pixConsultaEmAndamento) {
    return;
  }

  pixConsultaEmAndamento = true;

  try {
    const resposta = await fetch(API_STATUS_INTENCAO_PIX(pixIntencaoAtual), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const dados = await lerResposta(resposta);

    if (!resposta.ok) {
      if (resposta.status === 404) {
        console.error(
          "[PIX] A intenção não foi encontrada na consulta de status.",
          dados,
        );
        return;
      }

      if (resposta.status === 401 || resposta.status === 403) {
        console.error("[PIX] Sessão não autorizada para consultar intenção.");
        return;
      }

      throw new Error(
        dados.mensagem ||
          dados.erro ||
          "Não foi possível consultar o status do PIX.",
      );
    }

    const status = obterStatusIntencao(dados);

    if (status === "aprovado") {
      await finalizarIntencaoPixAprovada(dados);
      return;
    }

    if (
      status === "expirado" ||
      status === "cancelado" ||
      status === "recusado"
    ) {
      finalizarIntencaoPixSemAprovacao(status, dados);
      return;
    }

    if (status === "pendente") {
      const segundos = calcularSegundosRestantesPix(dados);

      if (segundos <= 0 && pixSegundosRestantes > 0) {
        pararTemporizadorPix();
        pixSegundosRestantes = 0;

        if (pixTemporizador) {
          pixTemporizador.textContent = "Tempo esgotado";
          pixTemporizador.classList.add("pix-expirado");
        }

        if (btnCopiarPix) btnCopiarPix.disabled = true;
        if (btnCopiarPixChave) btnCopiarPixChave.disabled = true;
      }
    }
  } catch (erro) {
    console.error("[PIX] Erro ao consultar status:", erro);
  } finally {
    pixConsultaEmAndamento = false;
  }
}

function iniciarConsultaPix() {
  pararConsultaPix();

  // Consulta imediatamente e depois a cada 3 segundos.
  consultarStatusIntencaoPix();

  pixConsultaIntervalo = setInterval(() => {
    consultarStatusIntencaoPix();
  }, 3000);
}

async function finalizarIntencaoPixAprovada(dados) {
  if (pixIntencaoTerminal) return;

  const numeroPedido = obterNumeroPedido(dados);

  if (!numeroPedido) {
    console.error(
      "[PIX] A intenção foi aprovada, mas a API não retornou o pedido vinculado.",
      dados,
    );

    if (mensagemSucesso) {
      mensagemSucesso.textContent =
        "Pagamento aprovado! Estamos atualizando os dados do pedido. Aguarde alguns instantes.";
    }

    return;
  }

  pixIntencaoTerminal = true;
  removerIntencaoPixDaSessao();
  pararTemporizadorPix();
  pararConsultaPix();

  if (pixTemporizador) {
    pixTemporizador.textContent = "Pagamento aprovado";
    pixTemporizador.classList.remove("pix-expirado");
  }

  if (pixQrCode) {
    pixQrCode.removeAttribute("src");
  }

  if (pixCopiaECola) {
    pixCopiaECola.value = "";
  }

  if (btnCopiarPix) btnCopiarPix.disabled = true;
  if (btnCopiarPixChave) btnCopiarPixChave.disabled = true;

  configurarModalSucesso({
    titulo: "Pedido registrado!",
    mostrarLinkPedidos: Boolean(usuarioAtual),
  });

  const elementoPedidoNumero = document.getElementById("pedidoNumero");

  if (elementoPedidoNumero) {
    elementoPedidoNumero.textContent = `Pedido #${numeroPedido}`;
  }

  if (mensagemSucesso) {
    mensagemSucesso.textContent =
      "Pagamento PIX aprovado! Seu pedido foi confirmado pelo estabelecimento.";
  }

  if (!pixCarrinhoLimpo) {
    pixCarrinhoLimpo = true;

    const carrinhoLimpo = await limparCarrinhoServidor();

    if (!carrinhoLimpo) {
      console.warn(
        "[PIX] Pagamento aprovado, mas não foi possível limpar o carrinho.",
      );
    }
  }

  atualizarBotaoFinalizar("Pedido confirmado", true);

  if (pixContainer) {
    pixContainer.classList.remove("ativo");
  }

  abrirModalSucesso();
}

function finalizarIntencaoPixSemAprovacao(status, dados) {
  if (pixIntencaoTerminal) return;

  const idIntencaoFinalizada = pixIntencaoAtual;

  pixIntencaoTerminal = true;

  pararTemporizadorPix();
  pararConsultaPix();

  removerIntencaoPixDaSessao();
  pixIntencaoAtual = null;

  configurarModalSucesso({
    titulo: status === "expirado" ? "PIX expirado" : "PIX cancelado",
    mostrarLinkPedidos: false,
  });

  const elementoPedidoNumero = document.getElementById("pedidoNumero");

  if (elementoPedidoNumero) {
    elementoPedidoNumero.textContent =
      status === "expirado"
        ? "Pagamento não concluído"
        : "Intenção PIX cancelada";
  }

  // Remove QR Code, chave e código PIX expirados.
  ocultarPagamentoPix();

  if (pixTemporizador) {
    pixTemporizador.textContent =
      status === "expirado" ? "PIX expirado" : "PIX cancelado";

    pixTemporizador.classList.add("pix-expirado");
  }

  if (btnCopiarPix) {
    btnCopiarPix.disabled = true;
  }

  if (btnCopiarPixChave) {
    btnCopiarPixChave.disabled = true;
  }

  if (mensagemSucesso) {
    if (status === "expirado") {
      mensagemSucesso.textContent =
        "O prazo para pagamento terminou. Nenhum pedido foi criado. Seu carrinho foi mantido para você tentar novamente.";
    } else {
      mensagemSucesso.textContent =
        "Esta intenção PIX foi cancelada. Nenhum pedido foi criado. Seu carrinho foi mantido.";
    }
  }

  atualizarBotaoFinalizar("Tentar novamente", false);

  console.info("[PIX] Intenção finalizada sem aprovação:", {
    status,
    intencaoPixId: idIntencaoFinalizada,
    dados,
  });
}

// ======================================================
// EVENTOS DOS BOTÕES PIX
// ======================================================
// ======================================================
// CANCELAR PIX E LIBERAR NOVO PEDIDO
// ======================================================

if (btnCancelarPix) {
  btnCancelarPix.addEventListener("click", async () => {
    if (!pixIntencaoAtual || pixIntencaoTerminal) {
      alert("Não existe uma intenção PIX pendente para cancelar.");
      return;
    }

    const confirmar = window.confirm(
      "Deseja realmente cancelar esta intenção PIX?\n\n" +
        "O código anterior deixará de ser válido para esta intenção. " +
        "Você poderá criar outro pedido depois da confirmação do cancelamento.",
    );

    if (!confirmar) return;

    const idIntencao = pixIntencaoAtual;

    btnCancelarPix.disabled = true;
    btnCancelarPix.textContent = "Cancelando PIX...";

    try {
      const resposta = await fetch(
        `${API_PEDIDOS}/pix/intencoes/${encodeURIComponent(idIntencao)}/cancelar`,
        {
          method: "PATCH",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const dados = await lerResposta(resposta);

      if (!resposta.ok) {
        // A intenção pode ter sido aprovada enquanto o cliente
        // tentava cancelar. Nesse caso, consulta o estado real.
        if (dados.status === "aprovado") {
          alert(
            "Esta intenção PIX já foi aprovada. Não é possível cancelá-la. " +
              "Vamos atualizar a situação do pedido.",
          );

          await consultarStatusIntencaoPix();
          return;
        }

        // Se já expirou, libera o checkout normalmente.
        if (dados.status === "expirado") {
          finalizarIntencaoPixSemAprovacao("expirado", dados);

          sucessoModal?.classList.add("hidden");
          sucessoModal?.classList.remove("show");

          if (sucessoModal) {
            sucessoModal.style.display = "none";
            sucessoModal.setAttribute("aria-hidden", "true");
          }

          atualizarBotaoFinalizar("Finalizar pedido", false);
          return;
        }

        throw new Error(
          dados.mensagem || "Não foi possível cancelar a intenção PIX.",
        );
      }

      if (dados.status !== "cancelado") {
        throw new Error(
          "O servidor não confirmou o cancelamento da intenção PIX.",
        );
      }

      // Finaliza o estado anterior sem apagar o carrinho.
      finalizarIntencaoPixSemAprovacao("cancelado", dados);

      pedidoRegistrado = false;
      pedidoEmEnvio = false;
      pixRespostaInconsistente = false;
      pixCarrinhoLimpo = false;

      // Fecha o modal para permitir um novo pedido.
      if (sucessoModal) {
        sucessoModal.classList.add("hidden");
        sucessoModal.classList.remove("show");
        sucessoModal.style.display = "none";
        sucessoModal.setAttribute("aria-hidden", "true");
      }

      atualizarBotaoFinalizar("Finalizar pedido", false);

      alert(
        "PIX cancelado com sucesso! Seu carrinho foi mantido. " +
          "Você já pode fazer outro pedido.",
      );
    } catch (erro) {
      console.error("[PIX] Erro ao cancelar intenção:", erro);

      alert(
        erro.message || "Não foi possível cancelar o PIX. Tente novamente.",
      );
    } finally {
      btnCancelarPix.disabled = false;
      btnCancelarPix.textContent = "Cancelar PIX e fazer outro pedido";
    }
  });
}
if (btnCopiarPix) {
  btnCopiarPix.addEventListener("click", () => {
    copiarTextoPix(pixCopiaECola?.value, btnCopiarPix, "Copiar código PIX");
  });
}

if (btnCopiarPixChave) {
  btnCopiarPixChave.addEventListener("click", () => {
    copiarTextoPix(
      pixChave?.textContent,
      btnCopiarPixChave,
      "Copiar chave PIX",
    );
  });
}

// ======================================================
// CARRINHO
// ======================================================

function obterCarrinho() {
  return carrinhoAtual;
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

async function carregarCarrinho() {
  try {
    if (!usuarioAtual) {
      window.location.replace("/cadastro/login.html");
      return false;
    }

    const resposta = await fetch(API_CARRINHO, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const dados = await lerResposta(resposta);

    if (resposta.status === 401 || resposta.status === 403) {
      usuarioAtual = null;
      window.location.replace("/cadastro/login.html");
      return false;
    }

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
    console.error("[CHECKOUT] Erro ao carregar carrinho:", erro);

    alert(erro.message || "Não foi possível carregar seu carrinho.");

    return false;
  }
}

async function limparCarrinhoServidor() {
  try {
    if (!usuarioAtual) {
      window.location.replace("/cadastro/login.html");
      return false;
    }

    const resposta = await fetch(API_CARRINHO, {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (resposta.status === 401 || resposta.status === 403) {
      usuarioAtual = null;
      window.location.replace("/cadastro/login.html");
      return false;
    }

    if (!resposta.ok) {
      const dados = await lerResposta(resposta);

      throw new Error(dados.mensagem || "Não foi possível limpar o carrinho.");
    }

    carrinhoAtual = [];

    atualizarResumo();

    return true;
  } catch (erro) {
    console.warn("[CHECKOUT] Não foi possível limpar o carrinho:", erro);

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
      const tipo = String(forma.tipo || "").toLowerCase();

      const pagamentoOnline =
        forma.online === true || Number(forma.online) === 1;

      if (pagamentoOnline && tipo !== "pix") {
        return false;
      }

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

function definirStatusEndereco(mensagem, tipo = "") {
  if (!enderecoStatus) return;

  enderecoStatus.textContent = mensagem;
  enderecoStatus.classList.remove("erro", "sucesso");

  if (tipo) {
    enderecoStatus.classList.add(tipo);
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

  if (!usuarioAtual) {
    alert("Entre na sua conta para salvar endereços no perfil.");
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
  try {
    const resposta = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (resposta.status === 401 || resposta.status === 403) {
      usuarioAtual = null;
      window.location.replace("/cadastro/login.html");
      return false;
    }

    if (!resposta.ok) {
      throw new Error("Não foi possível verificar sua sessão.");
    }

    const dados = await lerResposta(resposta);

    usuarioAtual = dados.usuario || null;

    if (!usuarioAtual) {
      window.location.replace("/cadastro/login.html");
      return false;
    }

    return true;
  } catch (erro) {
    console.error("[CHECKOUT] Erro ao verificar usuário:", erro);
    throw erro;
  }
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
    const numero = campoNumero?.value.trim() || "";
  if (!/^\d{1,4}$/.test(numero)) {
    alert("O número da casa deve conter de 1 a 4 dígitos.");
    campoNumero?.focus();
    return false;
  }

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

if (tipoEntrega) {
  tipoEntrega.addEventListener("change", async () => {
    const retirada = tipoEntrega.value === "retirada";

    if (enderecoCampos) {
      enderecoCampos.classList.toggle("hidden", retirada);

      enderecoCampos.querySelectorAll("input").forEach((campo) => {
        campo.required =
          !retirada && ["rua", "numero", "bairro", "cidade"].includes(campo.id);
      });
    }

    if (usuarioAtual && !retirada && enderecosSalvos.length === 0) {
      await carregarEnderecosSalvos();
    }

    await calcularTaxaEntrega();
  });
}

// ======================================================
// EVENTOS DE PAGAMENTO
// ======================================================

if (formaPagamento) {
  formaPagamento.addEventListener("change", atualizarCampoTroco);
}

// ======================================================
// NAVEGAÇÃO ENTRE ETAPAS
// ======================================================

const btnProximo1 = document.getElementById("btnProximo1");
const btnVoltar2 = document.getElementById("btnVoltar2");
const btnProximo2 = document.getElementById("btnProximo2");
const btnVoltar3 = document.getElementById("btnVoltar3");

if (btnProximo1) {
  btnProximo1.addEventListener("click", async () => {
    if (obterCarrinho().length === 0) {
      alert("Adicione produtos ao carrinho antes de continuar.");
      return;
    }
    if (!usuarioAtual) {
      window.location.replace("/cadastro/login.html");
      return;
    }
    if (!validarEndereco()) return;

    await calcularTaxaEntrega();

    mostrarEtapa(2);
  });
}

if (btnVoltar2) {
  btnVoltar2.addEventListener("click", () => {
    mostrarEtapa(1);
  });
}

if (btnProximo2) {
  btnProximo2.addEventListener("click", () => {
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
}

if (btnVoltar3) {
  btnVoltar3.addEventListener("click", () => {
    mostrarEtapa(2);
  });
}

// ======================================================
// ATUALIZAR VALORES DA RESPOSTA DO SERVIDOR
// ======================================================

function atualizarValoresPedido(dados) {
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
}

// ======================================================
// MONTAR PAYLOAD DO PEDIDO
// ======================================================

function montarPayloadCheckout(carrinho, entrega, formaSelecionada) {
  const tipoPagamento = String(formaSelecionada.tipo).toLowerCase();

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
      produto_id: Number(item.produto_id ?? item.produtoId),
      quantidade: Number(item.quantidade || 1),
      adicionais,
    };
  });

  return {
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
        ? Number(document.getElementById("troco")?.value || 0)
        : null,

    observacoes: document.getElementById("observacao")?.value.trim() || "",

    itens: itensPedido,
  };
}

// ======================================================
// TRATAMENTO DA RESPOSTA PIX
// ======================================================

async function iniciarIntencaoPix(dados) {
  const id = obterIdIntencaoPix(dados);

  if (!id) {
    pixRespostaInconsistente = true;

    console.error("[PIX] Resposta sem identificador de intenção:", dados);

    if (mensagemSucesso) {
      mensagemSucesso.textContent =
        "O servidor recebeu a solicitação, mas não retornou o identificador do PIX. Não tente pagar novamente. Entre em contato com o estabelecimento para verificar a situação.";
    }

    abrirModalSucesso();
    atualizarBotaoFinalizar("Verificar com estabelecimento", true);

    throw new Error(
      "Não foi possível identificar a intenção PIX criada. Uma nova solicitação foi bloqueada para evitar duplicidade.",
    );
  }

  const resposta = dados?.data || dados?.dados || dados || {};
  const intencao = obterObjetoIntencao(dados);

  pixRespostaInconsistente = false;
  pixIntencaoAtual = String(id);
  pixIntencaoTerminal = false;
  pixCarrinhoLimpo = false;

  configurarModalSucesso({
    titulo: "Pagamento PIX",
    mostrarLinkPedidos: true,
  });

  salvarIntencaoPixNaSessao(id);

  const elementoPedidoNumero = document.getElementById("pedidoNumero");

  if (elementoPedidoNumero) {
    elementoPedidoNumero.textContent = "Aguardando aprovação do PIX";
  }

  atualizarValoresPedido(dados);

  let pagamentoExibido = await exibirPagamentoPix(dados);

  if (!pagamentoExibido) {
    try {
      const respostaConsulta = await fetch(API_STATUS_INTENCAO_PIX(id), {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const dadosRecuperados = await lerResposta(respostaConsulta);

      if (respostaConsulta.ok) {
        pagamentoExibido = await exibirPagamentoPix(dadosRecuperados);
      }
    } catch (erro) {
      console.error(
        "[PIX] Não foi possível recuperar os dados do pagamento:",
        erro,
      );
    }
  }

  if (!pagamentoExibido && mensagemSucesso) {
    mensagemSucesso.textContent =
      "Sua intenção PIX foi registrada, mas não conseguimos exibir o código. Não envie outro pedido. Aguarde a consulta ou entre em contato com o estabelecimento.";
  }

  abrirModalSucesso();

  atualizarBotaoFinalizar(
    pagamentoExibido ? "PIX aguardando aprovação" : "Verificando pagamento",
    true,
  );

  iniciarConsultaPix();
}

// ======================================================
// FINALIZAÇÃO DO PEDIDO
// ======================================================

if (form) {
  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    // Não permite duplicar envio nem criar outra intenção enquanto existe PIX ativo.
    if (pedidoEmEnvio || pedidoRegistrado) return;

    if (pixIntencaoAtual && !pixIntencaoTerminal) {
      alert(
        "Você já possui uma intenção PIX aguardando confirmação. Utilize o código exibido e aguarde a aprovação.",
      );
      return;
    }

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
    botao.textContent = "Processando...";

    let respostaRecebidaComSucesso = false;

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

      const tipoPagamento = String(formaSelecionada.tipo).toLowerCase();

      const payload = montarPayloadCheckout(
        carrinho,
        entrega,
        formaSelecionada,
      );

      console.log("[CHECKOUT] Enviando checkout:", {
        formaPagamento: tipoPagamento,
        quantidadeItens: payload.itens.length,
        tipoEntrega: entrega,
        taxaEntrega: taxaFinal,
      });

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

      console.log("[CHECKOUT] Resposta do servidor:", {
        statusHTTP: resposta.status,
        tipoPagamento,
        intencaoPixId: obterIdIntencaoPix(dados),
        status: obterStatusIntencao(dados),
        pedidoId: obterNumeroPedido(dados),
      });

      if (!resposta.ok) {
        throw new Error(
          dados.mensagem ||
            dados.erro ||
            "Não foi possível registrar o pedido.",
        );
      }

      respostaRecebidaComSucesso = true;

      if (tipoPagamento === "pix") {
        // PIX cria somente uma intenção. Não existe pedido oficial ainda.
        await iniciarIntencaoPix(dados);

        botao.textContent = "PIX aguardando aprovação";
        botao.disabled = true;

        return;
      }

      // Pagamentos não PIX mantêm o fluxo anterior.
      pedidoRegistrado = true;

      const numeroPedido =
        dados.pedidoId || dados.pedido_id || dados.id || "Registrado";

      configurarModalSucesso({
        titulo: "Pedido registrado!",
        mostrarLinkPedidos: Boolean(usuarioAtual),
      });
      elementoPedidoNumero.textContent = `Pedido #${numeroPedido}`;

      ocultarPagamentoPix();

      if (mensagemSucesso) {
        mensagemSucesso.textContent = "Seu pedido foi recebido.";
      }

      atualizarValoresPedido(dados);

      abrirModalSucesso();

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

      if (pedidoRegistrado) {
        botao.disabled = true;
        botao.textContent = "Pedido registrado";
      } else if (pixRespostaInconsistente) {
        botao.disabled = true;
        botao.textContent = "Verificar com estabelecimento";
      } else if (pixIntencaoAtual && !pixIntencaoTerminal) {
        botao.disabled = true;
        botao.textContent = "PIX aguardando aprovação";
      } else if (respostaRecebidaComSucesso && pixIntencaoTerminal) {
        botao.disabled = true;
        botao.textContent = "PIX finalizado";
      } else {
        botao.disabled = false;
        botao.textContent = "Confirmar Pedido";
      }
    }
  });
}

async function recuperarIntencaoPixPendente() {
  const intencaoSalva = obterIntencaoPixDaSessao();

  if (!intencaoSalva?.id) {
    return false;
  }

  const id = String(intencaoSalva.id);

  pixIntencaoAtual = id;
  pixIntencaoTerminal = false;
  pixCarrinhoLimpo = false;

  const elementoPedidoNumero = document.getElementById("pedidoNumero");

  if (elementoPedidoNumero) {
    elementoPedidoNumero.textContent = "Recuperando pagamento PIX...";
  }

  try {
    const resposta = await fetch(API_STATUS_INTENCAO_PIX(id), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const dados = await lerResposta(resposta);

    if (resposta.status === 404) {
      removerIntencaoPixDaSessao();
      pixIntencaoAtual = null;
      return false;
    }

    if (!resposta.ok) {
      throw new Error(
        dados.mensagem ||
          dados.erro ||
          "Não foi possível recuperar o pagamento PIX.",
      );
    }

    const status = obterStatusIntencao(dados);

    if (status === "aprovado") {
      await finalizarIntencaoPixAprovada(dados);
      return true;
    }

    if (
      status === "expirado" ||
      status === "cancelado" ||
      status === "recusado"
    ) {
      finalizarIntencaoPixSemAprovacao(status, dados);
      return true;
    }

    if (status === "pendente") {
      configurarModalSucesso({
        titulo: "Pagamento PIX",
        mostrarLinkPedidos: Boolean(usuarioAtual),
      });

      await exibirPagamentoPix(dados);

      if (elementoPedidoNumero) {
        elementoPedidoNumero.textContent = "Aguardando aprovação do PIX";
      }

      if (mensagemSucesso) {
        mensagemSucesso.textContent =
          "Encontramos seu pagamento PIX pendente. Utilize o código apresentado e aguarde a confirmação do estabelecimento.";
      }

      abrirModalSucesso();
      atualizarBotaoFinalizar("PIX aguardando aprovação", true);
      iniciarConsultaPix();

      return true;
    }

    throw new Error(
      "A API retornou um status desconhecido para a intenção PIX.",
    );
  } catch (erro) {
    console.error("[PIX] Erro ao recuperar intenção:", erro);

    if (mensagemSucesso) {
      mensagemSucesso.textContent =
        "Não conseguimos consultar seu pagamento anterior. Não faça outro pagamento nem crie outro pedido. Atualize a página para consultar novamente ou entre em contato com o estabelecimento.";
    }

    abrirModalSucesso();
    atualizarBotaoFinalizar("Verificando pagamento", true);

    return true;
  }
}

async function iniciarCheckout() {
  try {
    if (sucessoModal) {
      sucessoModal.classList.add("hidden");
      sucessoModal.classList.remove("show");
      sucessoModal.style.display = "none";
      sucessoModal.setAttribute("aria-hidden", "true");
    }

    ocultarPagamentoPix();

    // Exige uma sessão autenticada antes de carregar o checkout.
    const autenticado = await verificarUsuario();

    if (!autenticado) return;

    const enderecoSalvoArea = document.getElementById("enderecoSalvoArea");
    const linkPainelCliente = document.getElementById("linkPainelCliente");

    const btnSalvarEnderecoPerfil = document.getElementById(
      "btnSalvarEnderecoPerfil",
    );

    if (enderecoSalvoArea) {
      enderecoSalvoArea.classList.remove("hidden");
    }

    if (linkPainelCliente) {
      linkPainelCliente.classList.remove("hidden");
    }

    if (btnSalvarEnderecoPerfil) {
      btnSalvarEnderecoPerfil.classList.remove("hidden");
    }

    // Carrega exclusivamente o carrinho do cliente autenticado.
    const carregado = await carregarCarrinho();

    if (!carregado) return;

    // Recupera eventual pagamento PIX pendente.
    const possuiIntencaoPix = await recuperarIntencaoPixPendente();

    if (possuiIntencaoPix) return;

    await carregarFormasPagamento();

    enderecosSalvos = [];

    if (seletorEndereco) {
      seletorEndereco.classList.remove("hidden");
    }

    if (btnNovoEndereco) {
      btnNovoEndereco.classList.remove("hidden");
    }

    if (btnSalvarEnderecoPerfil) {
      btnSalvarEnderecoPerfil.classList.remove("hidden");
    }

    await carregarEnderecosSalvos();
    await calcularTaxaEntrega();

    mostrarEtapa(1);
  } catch (erro) {
    console.error("[CHECKOUT] Erro ao iniciar checkout:", erro);

    alert(
      erro.message || "Não foi possível carregar o checkout. Tente novamente.",
    );
  }
}
// ======================================================
// INICIALIZAÇÃO
// ======================================================

iniciarCheckout();

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
                  credentials: "same-origin",
                },
              );

              if (resposta.ok) {
                await carregarNotificacoes();
              }
            } catch (erro) {
              console.error("[Notificações] Erro ao marcar como lida:", erro);
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
            Accept: "application/json",
          },
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
          credentials: "same-origin",
        });

        if (resposta.ok) {
          await carregarNotificacoes();
        }
      } catch (erro) {
        console.error("[Notificações] Erro ao marcar todas:", erro);
      }
    });

    function conectarWebSocket() {
      const protocolo = location.protocol === "https:" ? "wss:" : "ws:";

      const ws = new WebSocket(protocolo + "//" + location.host + "/ws");

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
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", aguardarCabecalho, {
      once: true,
    });
  } else {
    aguardarCabecalho();
  }
})();
