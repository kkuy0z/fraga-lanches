"use strict";

const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../database");
const QRCode = require("qrcode");
const crypto = require("crypto");
const router = express.Router();

const STATUS_PEDIDO = "novo";
const STATUS_PAGAMENTO = "pendente";
const STATUS_CANCELAVEIS = ["novo", "em_preparo"];

// ======================================================
// FUNÇÕES GERAIS
// ======================================================

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function criarErroValidacao(mensagem) {
  const erro = new Error(mensagem);
  erro.statusCode = 400;
  return erro;
}

function converterCentavos(valor) {
  return Math.round(Number(valor) * 100);
}

function formatarDecimal(centavos) {
  return (centavos / 100).toFixed(2);
}

function lerCookie(req, nome) {
  const cookies = req.headers.cookie || "";

  const cookie = cookies
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${nome}=`));

  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.substring(nome.length + 1));
  } catch {
    return null;
  }
}

// ======================================================
// NOTIFICAÇÕES
// ======================================================

async function criarNotificacao(
  conexao,
  usuarioId,
  pedidoId,
  tipo,
  titulo,
  mensagem,
) {
  await conexao.query(
    `INSERT INTO notificacoes (
      usuario_id,
      pedido_id,
      tipo,
      titulo,
      mensagem,
      lida
    ) VALUES (?, ?, ?, ?, ?, 0)
    ON DUPLICATE KEY UPDATE
      titulo = VALUES(titulo),
      mensagem = VALUES(mensagem),
      lida = 0`,
    [usuarioId, pedidoId, tipo, titulo, mensagem],
  );
}

async function criarNotificacoesEquipe(
  conexao,
  pedidoId,
  tipo,
  titulo,
  mensagem,
) {
  const [usuarios] = await conexao.query(
    "SELECT id FROM usuarios WHERE tipo IN ('admin', 'atendente', 'cozinha') AND ativo = 1",
  );

  for (const usuario of usuarios) {
    await criarNotificacao(
      conexao,
      usuario.id,
      pedidoId,
      tipo,
      titulo,
      mensagem,
    );
  }

  return usuarios.map((usuario) => Number(usuario.id));
}

function enviarEventoGateway(destino, dados) {
  const segredo = process.env.INTERNAL_SERVICE_SECRET;

  if (!segredo) {
    console.error("[Pedidos] INTERNAL_SERVICE_SECRET não configurada.");
    return;
  }

  fetch("http://127.0.0.1:3000/internal/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-service-secret": segredo,
    },
    body: JSON.stringify({
      destino,
      ...dados,
    }),
    signal: AbortSignal.timeout(5000),
  })
    .then(async (resposta) => {
      if (!resposta.ok) {
        console.error("[Pedidos] Gateway recusou evento:", resposta.status);
      }
    })
    .catch((erro) => {
      console.error("[Pedidos] Falha ao encaminhar evento:", erro.message);
    });
}

function emitirNotificacaoUsuario(req, usuarioId, dados) {
  enviarEventoGateway("usuario", {
    usuarioId,
    evento: {
      evento: "notificacao_criada",
      ...dados,
    },
  });
}

function emitirParaEquipe(req, tipos, dados) {
  enviarEventoGateway("equipe", {
    tipos,
    evento: dados,
  });
}

// ======================================================
// CONFIGURAÇÃO DINÂMICA DE ENTREGA
// ======================================================

async function obterConfiguracaoEntrega(conexao, bairro) {
  const [configuracoes] = await conexao.query(
    `
      SELECT
        taxa_padrao,
        valor_minimo,
        tempo_medio_minutos
      FROM configuracoes_entrega
      WHERE id = 1
      LIMIT 1
    `,
  );

  if (!configuracoes.length) {
    throw new Error("As configurações de entrega não foram inicializadas.");
  }

  const configuracao = configuracoes[0];

  const taxaPadraoCentavos = converterCentavos(configuracao.taxa_padrao);
  const valorMinimoCentavos = converterCentavos(configuracao.valor_minimo);

  if (
    !Number.isSafeInteger(taxaPadraoCentavos) ||
    taxaPadraoCentavos < 0 ||
    !Number.isSafeInteger(valorMinimoCentavos) ||
    valorMinimoCentavos < 0
  ) {
    throw new Error("As configurações de valores de entrega são inválidas.");
  }

  const [bairros] = await conexao.query(
    `
      SELECT id, nome, taxa_final, ativo
      FROM bairros_entrega
    `,
  );

  const bairroNormalizado = normalizarTexto(bairro);

  const bairroEncontrado = bairros.find(
    (item) => normalizarTexto(item.nome) === bairroNormalizado,
  );

  if (!bairroEncontrado) {
    return {
      taxaCentavos: taxaPadraoCentavos,
      valorMinimoCentavos,
      tempoMedioMinutos: Number(configuracao.tempo_medio_minutos),
    };
  }

  const bairroAtivo =
    bairroEncontrado.ativo === true || Number(bairroEncontrado.ativo) === 1;

  if (!bairroAtivo) {
    throw criarErroValidacao(
      "Este bairro está temporariamente indisponível para entrega.",
    );
  }

  const taxaBairroCentavos = converterCentavos(bairroEncontrado.taxa_final);

  if (!Number.isSafeInteger(taxaBairroCentavos) || taxaBairroCentavos < 0) {
    throw new Error("A taxa cadastrada para este bairro é inválida.");
  }

  return {
    taxaCentavos: taxaBairroCentavos,
    valorMinimoCentavos,
    tempoMedioMinutos: Number(configuracao.tempo_medio_minutos),
  };
}

// ======================================================
// AUTENTICAÇÃO
// ======================================================

async function autenticarCliente(req, res, next) {
  const token = lerCookie(req, "fraga_session");

  if (!token) {
    return res.status(401).json({
      mensagem: "Você precisa fazer login.",
    });
  }

  try {
    const usuario = jwt.verify(token, process.env.JWT_SECRET);

    if (usuario.tipo !== "cliente") {
      return res.status(403).json({
        mensagem: "Esta operação é exclusiva para clientes.",
      });
    }

    const [usuarios] = await db.query(
      `SELECT id, nome, email, ativo
       FROM usuarios
       WHERE id = ?
       LIMIT 1`,
      [usuario.id],
    );

    if (
      !usuarios.length ||
      usuarios[0].ativo === false ||
      Number(usuarios[0].ativo) !== 1
    ) {
      return res.status(401).json({
        mensagem: "Usuário não encontrado ou inativo.",
      });
    }

    req.usuario = usuarios[0];

    return next();
  } catch (erro) {
    if (
      erro.name === "JsonWebTokenError" ||
      erro.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        mensagem: "Sessão inválida ou expirada.",
      });
    }

    console.error("Erro na autenticação:", erro);

    return res.status(500).json({
      mensagem: "Erro ao verificar autenticação.",
    });
  }
}

// ======================================================
// PIX - BR CODE COM VALOR DO PEDIDO
// ======================================================

const PIX_BASE =
  "00020101021126580014br.gov.bcb.pix013619acfdc1-3340-4dfe-9e2b-6aebdb372b945204000053039865802BR5925SAMUEL WELINGTON DE OLIVE6009SAO PAULO622905251M7X3KK0N171P4KK4YQ4MVA5X6304C1D3";
function extrairChavePix() {
  const payload = PIX_BASE.trim().slice(0, -8);

  function lerCampos(texto) {
    const campos = [];
    let posicao = 0;

    while (posicao < texto.length) {
      if (posicao + 4 > texto.length) {
        throw new Error("Estrutura TLV PIX inválida.");
      }

      const tag = texto.substring(posicao, posicao + 2);
      const tamanhoTexto = texto.substring(posicao + 2, posicao + 4);

      if (!/^\d{2}$/.test(tamanhoTexto)) {
        throw new Error("Tamanho TLV PIX inválido.");
      }

      const tamanho = Number(tamanhoTexto);
      const inicio = posicao + 4;
      const fim = inicio + tamanho;

      if (fim > texto.length) {
        throw new Error("Campo TLV PIX incompleto.");
      }

      campos.push({
        tag,
        valor: texto.substring(inicio, fim),
      });

      posicao = fim;
    }

    return campos;
  }

  const conta = lerCampos(payload).find((campo) => campo.tag === "26");

  if (!conta) {
    throw new Error("Conta PIX não encontrada.");
  }

  const chave = lerCampos(conta.valor).find((campo) => campo.tag === "01");

  if (!chave || !chave.valor.trim()) {
    throw new Error("Chave PIX não encontrada.");
  }

  return chave.valor.trim();
}

function calcularCRC16(texto) {
  let crc = 0xffff;

  for (const byte of Buffer.from(texto, "utf8")) {
    crc ^= byte << 8;

    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function gerarPixComValor(valorCentavos, codigoReferencia) {
  if (!Number.isSafeInteger(valorCentavos) || valorCentavos <= 0) {
    throw new Error("Valor inválido para geração do PIX.");
  }

  if (!codigoReferencia) {
    throw new Error("Referência da intenção PIX não informada.");
  }

  const base = PIX_BASE.trim();
  const crcOriginal = base.slice(-4);
  const conteudoOriginal = base.slice(0, -4);

  if (calcularCRC16(conteudoOriginal) !== crcOriginal) {
    throw new Error("CRC do código PIX original inválido.");
  }

  const payloadOriginal = base.slice(0, -8);
  const campos = [];

  let posicao = 0;

  while (posicao < payloadOriginal.length) {
    if (posicao + 4 > payloadOriginal.length) {
      throw new Error("Estrutura TLV do PIX inválida.");
    }

    const tag = payloadOriginal.substring(posicao, posicao + 2);
    const tamanhoTexto = payloadOriginal.substring(posicao + 2, posicao + 4);

    if (!/^\d{2}$/.test(tamanhoTexto)) {
      throw new Error("Tamanho de campo PIX inválido.");
    }

    const tamanho = Number(tamanhoTexto);
    const inicioValor = posicao + 4;
    const fimValor = inicioValor + tamanho;

    if (fimValor > payloadOriginal.length) {
      throw new Error("Campo PIX incompleto.");
    }

    campos.push({
      tag,
      valor: payloadOriginal.substring(inicioValor, fimValor),
    });

    posicao = fimValor;
  }

  if (campos.some((campo) => campo.tag === "54")) {
    throw new Error("O código PIX original já possui valor definido.");
  }

  if (!campos.some((campo) => campo.tag === "58")) {
    throw new Error("Campo de país não encontrado no PIX.");
  }

  const referencia = String(codigoReferencia)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 25);

  if (!referencia) {
    throw new Error("Referência PIX inválida.");
  }

  function criarCampo(tag, valor) {
    const tamanho = Buffer.byteLength(valor, "utf8");

    if (tamanho > 99) {
      throw new Error(`Campo PIX ${tag} excede o limite permitido.`);
    }

    return `${tag}${String(tamanho).padStart(2, "0")}${valor}`;
  }

  const valor = (valorCentavos / 100).toFixed(2);

  if (valor.length > 13) {
    throw new Error("Valor excede o limite permitido para o PIX.");
  }

  const novosCampos = campos.filter(
    (campo) => campo.tag !== "54" && campo.tag !== "62",
  );

  const indicePais = novosCampos.findIndex((campo) => campo.tag === "58");

  novosCampos.splice(indicePais, 0, {
    tag: "54",
    valor,
  });

  const payloadSemCRC = novosCampos
    .map((campo) => criarCampo(campo.tag, campo.valor))
    .join("");

  // Identificador próprio para esta intenção PIX.
  const campoIdentificacao = criarCampo("62", criarCampo("05", referencia));

  const payloadFinal = `${payloadSemCRC}${campoIdentificacao}6304`;

  return `${payloadFinal}${calcularCRC16(payloadFinal)}`;
}

// ======================================================
// CRIAR PEDIDO
// ======================================================

router.post("/", autenticarCliente, async (req, res) => {
  let conexao;
  let transacaoIniciada = false;
  let transacaoFinalizada = false;

  try {
    const {
      tipo_entrega,
      endereco,
      forma_pagamento_id,
      troco_para,
      observacoes,
      itens,
    } = req.body;

    const usuarioId = req.usuario.id;

    if (!["entrega", "retirada"].includes(tipo_entrega)) {
      throw criarErroValidacao("Tipo de entrega inválido.");
    }

    const formaPagamentoId = Number(forma_pagamento_id);

    if (!Number.isSafeInteger(formaPagamentoId) || formaPagamentoId <= 0) {
      throw criarErroValidacao("Selecione uma forma de pagamento válida.");
    }

    if (!Array.isArray(itens) || itens.length === 0) {
      throw criarErroValidacao("O pedido precisa ter pelo menos um produto.");
    }

    if (itens.length > 50) {
      throw criarErroValidacao("Quantidade máxima de itens excedida.");
    }

    let enderecoValidado = null;
    let enderecoId = null;
    let taxaCentavos = 0;
    let valorMinimoCentavos = 0;

    if (tipo_entrega === "entrega") {
      if (!endereco || typeof endereco !== "object") {
        throw criarErroValidacao("Endereço de entrega inválido.");
      }

      const camposObrigatorios = [
        endereco.rua,
        endereco.numero,
        endereco.bairro,
        endereco.cidade,
      ];

      if (
        camposObrigatorios.some(
          (campo) => typeof campo !== "string" || !campo.trim(),
        )
      ) {
        throw criarErroValidacao(
          "Preencha todos os campos obrigatórios do endereço.",
        );
      }

      if (!/^\d{1,4}$/.test(String(endereco.numero).trim())) {
        throw criarErroValidacao(
          "O número da casa deve conter de 1 a 4 dígitos.",
        );
      }

      enderecoValidado = {
        rua: endereco.rua.trim(),
        numero: endereco.numero.trim(),
        bairro: endereco.bairro.trim(),
        cidade: endereco.cidade.trim(),
        complemento:
          typeof endereco.complemento === "string"
            ? endereco.complemento.trim()
            : null,
      };
    }

    conexao = await db.getConnection();

    await conexao.beginTransaction();
    transacaoIniciada = true;

    const [formasPagamento] = await conexao.query(
      `
        SELECT
          id,
          nome,
          tipo,
          taxa_percentual,
          prazo_recebimento,
          ativo,
          online
        FROM formas_pagamento
        WHERE id = ?
          AND ativo = 1
        LIMIT 1
        FOR UPDATE
      `,
      [formaPagamentoId],
    );

    if (!formasPagamento.length) {
      throw criarErroValidacao(
        "Esta forma de pagamento não está disponível. Atualize a página e selecione outra.",
      );
    }

    const formaPagamento = formasPagamento[0];
    const tipoPagamento = String(formaPagamento.tipo).toLowerCase();

    if (
      (formaPagamento.online === true || Number(formaPagamento.online) === 1) &&
      tipoPagamento !== "pix"
    ) {
      throw criarErroValidacao(
        "Esta forma de pagamento exige uma integração online ainda indisponível.",
      );
    }
    // ==================================================
    // PIX: IMPEDIR INTENÇÕES DUPLICADAS
    // ==================================================
    let pixCopiaECola = null;
    let pixQrCode = null;
    let pixChave = null;

    if (tipoPagamento === "pix" && usuarioId) {
      await conexao.query(
        `SELECT id
     FROM usuarios
     WHERE id = ?
     FOR UPDATE`,
        [usuarioId],
      );

      const [intencoesExistentes] = await conexao.query(
        `SELECT
       id,
       codigo_referencia,
       total,
       pix_copia_e_cola,
       status,
       criado_em,
       expira_em,
       TIMESTAMPDIFF(SECOND, NOW(), expira_em) AS segundos_restantes
     FROM intencoes_pix
     WHERE usuario_id = ?
       AND status = 'pendente'
       AND expira_em > NOW()
     ORDER BY criado_em DESC
     LIMIT 1
     FOR UPDATE`,
        [usuarioId],
      );

      if (intencoesExistentes.length > 0) {
        const intencao = intencoesExistentes[0];

        const pixQrCodeExistente = await QRCode.toDataURL(
          intencao.pix_copia_e_cola,
          {
            errorCorrectionLevel: "M",
            margin: 2,
            width: 280,
          },
        );

        await conexao.rollback();
        transacaoFinalizada = true;

        return res.status(200).json({
          mensagem: "Você já possui uma intenção PIX aguardando pagamento.",
          intencaoPixId: intencao.id,
          codigoReferencia: intencao.codigo_referencia,
          status: intencao.status,
          formaPagamento: "pix",
          formaPagamentoId: Number(formaPagamento.id),
          formaPagamentoNome: formaPagamento.nome,
          total: Number(intencao.total).toFixed(2),
          pixCopiaECola: intencao.pix_copia_e_cola,
          pixQrCode: pixQrCodeExistente,
          pixChave: extrairChavePix(),
          pixExpiraEmSegundos: Math.max(
            0,
            Number(intencao.segundos_restantes) || 0,
          ),
          pixValor: Number(intencao.total).toFixed(2),
          expiraEm: intencao.expira_em,
        });
      }
    }
    if (tipo_entrega === "entrega") {
      const configuracao = await obterConfiguracaoEntrega(
        conexao,
        enderecoValidado.bairro,
      );

      taxaCentavos = configuracao.taxaCentavos;
      valorMinimoCentavos = configuracao.valorMinimoCentavos;
    }

    let enderecoRua = null;
    let enderecoNumero = null;
    let enderecoBairro = null;
    let enderecoCidade = null;
    if (tipo_entrega === "entrega") {
      enderecoRua = enderecoValidado.rua;
      enderecoNumero = enderecoValidado.numero;
      enderecoBairro = enderecoValidado.bairro;
      enderecoCidade = enderecoValidado.cidade;

      if (usuarioId) {
        const [resultadoEndereco] = await conexao.query(
          `INSERT INTO enderecos (
        usuario_id, rua, numero, bairro, cidade, complemento
      ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            usuarioId,
            enderecoRua,
            enderecoNumero,
            enderecoBairro,
            enderecoCidade,
            enderecoValidado.complemento,
          ],
        );

        enderecoId = resultadoEndereco.insertId;
      }
    }

    let subtotalCentavos = 0;
    const itensValidados = [];

    for (const item of itens) {
      const produtoId = Number(item.produto_id);
      const quantidade = Number(item.quantidade);

      if (
        !Number.isInteger(produtoId) ||
        produtoId <= 0 ||
        !Number.isInteger(quantidade) ||
        quantidade <= 0 ||
        quantidade > 50
      ) {
        throw criarErroValidacao("Um dos produtos possui dados inválidos.");
      }

      const [produtos] = await conexao.query(
        `SELECT id, nome, preco
         FROM produtos
         WHERE id = ?
           AND disponivel = TRUE
         FOR UPDATE`,
        [produtoId],
      );

      if (!produtos.length) {
        throw criarErroValidacao(
          `O produto de ID ${produtoId} não está disponível.`,
        );
      }

      const produto = produtos[0];
      const adicionaisRecebidos = item.adicionais || [];

      if (!Array.isArray(adicionaisRecebidos)) {
        throw criarErroValidacao("Lista de adicionais inválida.");
      }

      if (adicionaisRecebidos.length > 30) {
        throw criarErroValidacao("Quantidade de adicionais excedida.");
      }

      const idsAdicionais = adicionaisRecebidos.map(Number);

      if (
        idsAdicionais.some((id) => !Number.isInteger(id) || id <= 0) ||
        new Set(idsAdicionais).size !== idsAdicionais.length
      ) {
        throw criarErroValidacao(
          "Um dos adicionais possui ID inválido ou repetido.",
        );
      }

      let adicionaisValidados = [];
      let totalAdicionaisCentavos = 0;

      if (idsAdicionais.length > 0) {
        const placeholders = idsAdicionais.map(() => "?").join(",");

        const [adicionais] = await conexao.query(
          `SELECT
             a.id,
             a.nome,
             a.preco
           FROM adicionais a
           INNER JOIN produto_adicionais pa
             ON pa.adicional_id = a.id
           WHERE pa.produto_id = ?
             AND a.id IN (${placeholders})
             AND a.disponivel = TRUE
           FOR UPDATE`,
          [produtoId, ...idsAdicionais],
        );

        if (adicionais.length !== idsAdicionais.length) {
          throw criarErroValidacao(
            `Existem adicionais indisponíveis para ${produto.nome}.`,
          );
        }

        adicionaisValidados = adicionais.map((adicional) => ({
          id: adicional.id,
          nome: adicional.nome,
          preco: Number(adicional.preco),
        }));

        totalAdicionaisCentavos = adicionais.reduce(
          (total, adicional) => total + converterCentavos(adicional.preco),
          0,
        );
      }

      const precoProdutoCentavos = converterCentavos(produto.preco);

      if (
        !Number.isSafeInteger(precoProdutoCentavos) ||
        precoProdutoCentavos < 0 ||
        !Number.isSafeInteger(totalAdicionaisCentavos)
      ) {
        throw criarErroValidacao(
          "O preço de um produto ou adicional é inválido.",
        );
      }

      const precoUnitarioCentavos =
        precoProdutoCentavos + totalAdicionaisCentavos;

      const totalItemCentavos = precoUnitarioCentavos * quantidade;

      if (!Number.isSafeInteger(totalItemCentavos) || totalItemCentavos <= 0) {
        throw criarErroValidacao("O valor de um dos itens é inválido.");
      }

      subtotalCentavos += totalItemCentavos;

      itensValidados.push({
        produtoId: produto.id,
        nome: produto.nome,
        quantidade,
        precoUnitario: precoUnitarioCentavos,
        total: totalItemCentavos,
        adicionais: adicionaisValidados,
      });
    }

    if (!Number.isSafeInteger(subtotalCentavos) || subtotalCentavos <= 0) {
      throw criarErroValidacao("Valor total do pedido inválido.");
    }

    if (tipo_entrega === "entrega" && subtotalCentavos < valorMinimoCentavos) {
      throw criarErroValidacao(
        `O valor mínimo para entrega é R$ ${formatarDecimal(valorMinimoCentavos)}. Seu subtotal é R$ ${formatarDecimal(subtotalCentavos)}.`,
      );
    }

    const descontoCentavos = 0;

    const totalCentavos = subtotalCentavos + taxaCentavos - descontoCentavos;

    if (!Number.isSafeInteger(totalCentavos) || totalCentavos <= 0) {
      throw criarErroValidacao("Valor final do pedido inválido.");
    }

    let trocoTexto = "";

    if (
      tipoPagamento === "dinheiro" &&
      troco_para !== null &&
      troco_para !== undefined &&
      troco_para !== ""
    ) {
      const valorTroco = Number(troco_para);
      const trocoCentavos = converterCentavos(valorTroco);

      if (
        !Number.isFinite(valorTroco) ||
        !Number.isSafeInteger(trocoCentavos) ||
        trocoCentavos < totalCentavos
      ) {
        throw criarErroValidacao(
          "O valor informado para troco precisa ser igual ou superior ao total.",
        );
      }

      trocoTexto = `Troco para: R$ ${formatarDecimal(trocoCentavos)}.`;
    }

    let observacoesFinais =
      typeof observacoes === "string" ? observacoes.trim() : "";

    if (observacoesFinais.length > 1000) {
      throw criarErroValidacao(
        "As observações ultrapassam o limite permitido.",
      );
    }

    if (trocoTexto) {
      observacoesFinais = observacoesFinais
        ? `${observacoesFinais}\n${trocoTexto}`
        : trocoTexto;
    }

    // ==================================================
    // PIX: CRIAR INTENÇÃO TEMPORÁRIA, SEM PEDIDO OFICIAL
    // ==================================================

    if (tipoPagamento === "pix") {
      const codigoReferencia = crypto.randomUUID();

      pixCopiaECola = gerarPixComValor(totalCentavos, codigoReferencia);

      pixQrCode = await QRCode.toDataURL(pixCopiaECola, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 280,
      });

      pixChave = extrairChavePix();
      const [resultadoIntencao] = await conexao.query(
        `INSERT INTO intencoes_pix (
          codigo_referencia,
          usuario_id,
          endereco_id,
          endereco_rua,
          endereco_numero,
          endereco_bairro,
          endereco_cidade,
          tipo_entrega,
          subtotal,
          taxa_entrega,
          desconto,
          total,
          observacoes,
          pix_copia_e_cola,
          status,
          expira_em
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          'pendente',
          DATE_ADD(NOW(), INTERVAL 5 MINUTE)
        )`,
        [
          codigoReferencia,
          usuarioId,
          enderecoId,
          enderecoRua,
          enderecoNumero,
          enderecoBairro,
          enderecoCidade,
          tipo_entrega,
          formatarDecimal(subtotalCentavos),
          formatarDecimal(taxaCentavos),
          formatarDecimal(descontoCentavos),
          formatarDecimal(totalCentavos),
          observacoesFinais || null,
          pixCopiaECola,
        ],
      );

      const intencaoPixId = resultadoIntencao.insertId;

      for (const item of itensValidados) {
        const personalizacao =
          item.adicionais.length > 0 ? JSON.stringify(item.adicionais) : null;

        await conexao.query(
          `INSERT INTO itens_intencao_pix (
            intencao_pix_id,
            produto_id,
            nome_produto,
            quantidade,
            preco_unitario,
            subtotal,
            personalizacao
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            intencaoPixId,
            item.produtoId,
            item.nome,
            item.quantidade,
            formatarDecimal(item.precoUnitario),
            formatarDecimal(item.total),
            personalizacao,
          ],
        );
      }

      if (usuarioId) {
        await criarNotificacao(
          conexao,
          usuarioId,
          null,
          "pix_intencao_pendente",
          "PIX aguardando aprovação",
          "Sua intenção de pagamento PIX foi registrada e está aguardando aprovação.",
        );
      }

      const usuariosEquipeNotificados = await criarNotificacoesEquipe(
        conexao,
        null,
        "pix_intencao_pendente",
        "PIX aguardando conferência",
        `Uma intenção PIX de R$ ${formatarDecimal(totalCentavos)} aguarda pagamento e conferência.`,
      );

      await conexao.commit();
      transacaoFinalizada = true;
      if (usuarioId) {
        emitirNotificacaoUsuario(req, req.usuario.id, {
          tipo: "pix_intencao_pendente",
          titulo: "PIX gerado",
          mensagem: "Seu PIX foi gerado. Aguarde a confirmação do pagamento.",
        });
      }

      for (const usuarioId of usuariosEquipeNotificados) {
        emitirNotificacaoUsuario(req, usuarioId, {
          tipo: "pix_intencao_pendente",
          titulo: "PIX aguardando conferência",
          mensagem: "Uma nova intenção PIX aguarda conferência.",
        });
      }

      emitirParaEquipe(req, ["admin", "atendente"], {
        evento: "nova_intencao_pix",
        intencaoPixId,
        status: "pendente",
        mensagem: "Uma nova intenção PIX aguarda conferência.",
      });

      return res.status(201).json({
        mensagem: "PIX gerado. Aguarde a confirmação do pagamento.",
        intencaoPixId,
        codigoReferencia,
        status: "pendente",
        formaPagamento: "pix",
        formaPagamentoId: Number(formaPagamento.id),
        formaPagamentoNome: formaPagamento.nome,
        subtotal: formatarDecimal(subtotalCentavos),
        taxaEntrega: formatarDecimal(taxaCentavos),
        desconto: formatarDecimal(descontoCentavos),
        total: formatarDecimal(totalCentavos),
        pixCopiaECola,
        pixQrCode,
        pixChave,
        pixExpiraEmSegundos: 300,
        pixValor: formatarDecimal(totalCentavos),
      });
    }

    const [resultadoPedido] = await conexao.query(
      `INSERT INTO pedidos (
        usuario_id,
        endereco_id,
        endereco_rua,
        endereco_numero,
        endereco_bairro,
        endereco_cidade,
        status,
        tipo_entrega,
        subtotal,
        taxa_entrega,
        desconto,
        total,
        observacoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usuarioId,
        enderecoId,
        enderecoRua,
        enderecoNumero,
        enderecoBairro,
        enderecoCidade,
        STATUS_PEDIDO,
        tipo_entrega,
        formatarDecimal(subtotalCentavos),
        formatarDecimal(taxaCentavos),
        formatarDecimal(descontoCentavos),
        formatarDecimal(totalCentavos),
        observacoesFinais || null,
      ],
    );

    const pedidoId = resultadoPedido.insertId;

    for (const item of itensValidados) {
      const personalizacao =
        item.adicionais.length > 0 ? JSON.stringify(item.adicionais) : null;

      await conexao.query(
        `INSERT INTO itens_pedido (
          pedido_id,
          produto_id,
          nome_produto,
          quantidade,
          preco_unitario,
          subtotal,
          personalizacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          pedidoId,
          item.produtoId,
          item.nome,
          item.quantidade,
          formatarDecimal(item.precoUnitario),
          formatarDecimal(item.total),
          personalizacao,
        ],
      );
    }

    await conexao.query(
      `INSERT INTO pagamentos (
    pedido_id,
    forma_pagamento,
    valor,
    status,
    codigo_transacao,
    data_pagamento,
    expira_em
  ) VALUES (?, ?, ?, ?, NULL, NULL, NULL)`,
      [
        pedidoId,
        tipoPagamento,
        formatarDecimal(totalCentavos),
        STATUS_PAGAMENTO,
      ],
    );

    await conexao.query(
      `INSERT INTO historico_pedidos (
        pedido_id,
        usuario_id,
        status_anterior,
        status_novo,
        data_alteracao
      ) VALUES (?, ?, NULL, ?, NOW())`,
      [pedidoId, usuarioId, STATUS_PEDIDO],
    );

    // Notificação persistente para o cliente.

    if (usuarioId) {
      emitirNotificacaoUsuario(req, usuarioId, {
        pedidoId,
        tipo: "pedido_confirmado",
        mensagem: `Seu pedido #${pedidoId} foi registrado com sucesso.`,
      });
    }

    const usuariosEquipeNotificados = await criarNotificacoesEquipe(
      conexao,
      pedidoId,
      "novo_pedido_equipe",
      "Novo pedido recebido",
      `O pedido #${pedidoId} foi recebido e aguarda atendimento.`,
    );

    await conexao.commit();
    transacaoFinalizada = true;

    // Atualiza o sino do cliente em tempo real.
    emitirNotificacaoUsuario(req, req.usuario.id, {
      pedidoId,
      tipo: "pedido_confirmado",
      mensagem: `Seu pedido #${pedidoId} foi registrado com sucesso.`,
    });

    // Atualiza os painéis internos em tempo real.
    for (const usuarioId of usuariosEquipeNotificados) {
      emitirNotificacaoUsuario(req, usuarioId, {
        pedidoId,
        tipo: "novo_pedido_equipe",
        titulo: "Novo pedido recebido",
        mensagem: `O pedido #${pedidoId} foi recebido e aguarda atendimento.`,
      });
    }

    emitirParaEquipe(req, ["admin", "atendente", "cozinha"], {
      evento: "novo_pedido",
      pedidoId,
      status: STATUS_PEDIDO,
      mensagem: `Novo pedido #${pedidoId} recebido.`,
    });

    return res.status(201).json({
      mensagem: "Pedido registrado com sucesso.",
      pedidoId,
      status: STATUS_PEDIDO,
      pagamento: STATUS_PAGAMENTO,
      formaPagamento: tipoPagamento,
      formaPagamentoId: Number(formaPagamento.id),
      formaPagamentoNome: formaPagamento.nome,
      subtotal: formatarDecimal(subtotalCentavos),
      taxaEntrega: formatarDecimal(taxaCentavos),
      desconto: formatarDecimal(descontoCentavos),
      total: formatarDecimal(totalCentavos),
      pixCopiaECola,
      pixQrCode,
      pixChave,
      pixExpiraEmSegundos: tipoPagamento === "pix" ? 300 : null,
      pixValor: tipoPagamento === "pix" ? formatarDecimal(totalCentavos) : null,
    });
  } catch (erro) {
    if (conexao && transacaoIniciada && !transacaoFinalizada) {
      try {
        await conexao.rollback();
      } catch (erroRollback) {
        console.error("Erro ao desfazer transação:", erroRollback);
      }
    }

    console.error("Erro ao criar pedido:", erro);

    const statusCode = [400, 409].includes(erro.statusCode)
      ? erro.statusCode
      : 500;
    return res.status(statusCode).json({
      mensagem:
        statusCode === 400
          ? erro.message
          : "Não foi possível registrar o pedido.",
    });
  } finally {
    if (conexao) {
      conexao.release();
    }
  }
});

// ======================================================
// CANCELAR INTENÇÃO PIX DO CLIENTE
// ======================================================

router.patch(
  "/pix/intencoes/:id/cancelar",
  autenticarCliente,
  async (req, res) => {
    let conexao;
    let transacaoAberta = false;

    try {
      const intencaoId = Number(req.params.id);

      if (!Number.isSafeInteger(intencaoId) || intencaoId <= 0) {
        return res.status(400).json({
          mensagem: "ID da intenção PIX inválido.",
        });
      }

      conexao = await db.getConnection();

      await conexao.beginTransaction();
      transacaoAberta = true;

      // Bloqueia a intenção para evitar conflito com a aprovação administrativa.
      const [intencoes] = await conexao.query(
        `
          SELECT
            id,
            usuario_id,
            status,
            expira_em > NOW() AS dentro_do_prazo
          FROM intencoes_pix
          WHERE id = ?
            AND usuario_id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [intencaoId, req.usuario.id],
      );

      if (!intencoes.length) {
        await conexao.rollback();
        transacaoAberta = false;

        return res.status(404).json({
          mensagem: "Intenção PIX não encontrada.",
        });
      }

      const intencao = intencoes[0];

      if (intencao.status !== "pendente") {
        await conexao.rollback();
        transacaoAberta = false;

        return res.status(409).json({
          mensagem: "Esta intenção PIX não está mais pendente.",
          status: intencao.status,
        });
      }

      if (Number(intencao.dentro_do_prazo) !== 1) {
        await conexao.query(
          `
            UPDATE intencoes_pix
            SET status = 'expirado'
            WHERE id = ?
              AND status = 'pendente'
          `,
          [intencaoId],
        );

        await conexao.commit();
        transacaoAberta = false;

        return res.status(409).json({
          mensagem: "Esta intenção PIX já expirou.",
          status: "expirado",
        });
      }

      const [resultado] = await conexao.query(
        `
          UPDATE intencoes_pix
          SET status = 'cancelado'
          WHERE id = ?
            AND usuario_id = ?
            AND status = 'pendente'
        `,
        [intencaoId, req.usuario.id],
      );

      if (resultado.affectedRows !== 1) {
        await conexao.rollback();
        transacaoAberta = false;

        return res.status(409).json({
          mensagem: "Não foi possível cancelar esta intenção PIX.",
        });
      }

      await conexao.commit();
      transacaoAberta = false;

      return res.json({
        mensagem: "Intenção PIX cancelada com sucesso.",
        intencaoPixId: intencaoId,
        status: "cancelado",
      });
    } catch (erro) {
      if (conexao && transacaoAberta) {
        try {
          await conexao.rollback();
        } catch (erroRollback) {
          console.error("Erro ao desfazer cancelamento PIX:", erroRollback);
        }
      }

      console.error("Erro ao cancelar intenção PIX:", erro);

      return res.status(500).json({
        mensagem: "Não foi possível cancelar a intenção PIX.",
      });
    } finally {
      if (conexao) {
        conexao.release();
      }
    }
  },
);

// ======================================================
// CONSULTAR INTENÇÃO PIX
// ======================================================

router.get("/pix/intencoes/:id", autenticarCliente, async (req, res) => {
  try {
    const intencaoId = Number(req.params.id);

    if (!Number.isSafeInteger(intencaoId) || intencaoId <= 0) {
      return res.status(400).json({
        mensagem: "ID da intenção PIX inválido.",
      });
    }

    const filtroAutorizacao = "usuario_id = ?";
    const parametrosAutorizacao = [req.usuario.id];

    await db.query(
      `UPDATE intencoes_pix
         SET status = 'expirado'
         WHERE id = ?
           AND ${filtroAutorizacao}
           AND status = 'pendente'
           AND expira_em <= NOW()`,
      [intencaoId, ...parametrosAutorizacao],
    );

    const [intencoes] = await db.query(
      `SELECT
          id,
          codigo_referencia,
          status,
          total,
          pix_copia_e_cola,
          criado_em,
          expira_em,
          aprovado_em,
          pedido_id
        FROM intencoes_pix
        WHERE id = ?
          AND ${filtroAutorizacao}
        LIMIT 1`,
      [intencaoId, ...parametrosAutorizacao],
    );

    if (!intencoes.length) {
      return res.status(404).json({
        mensagem: "Intenção PIX não encontrada.",
      });
    }

    const intencao = intencoes[0];

    let pixQrCode = null;

    if (intencao.status === "pendente" && intencao.pix_copia_e_cola) {
      pixQrCode = await QRCode.toDataURL(intencao.pix_copia_e_cola, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 280,
      });
    }

    return res.json({
      intencaoPixId: intencao.id,
      codigoReferencia: intencao.codigo_referencia,
      status: intencao.status,
      total: Number(intencao.total),
      pixCopiaECola: intencao.pix_copia_e_cola,
      pixQrCode,
      pixChave: extrairChavePix(),
      criadoEm: intencao.criado_em,
      expiraEm: intencao.expira_em,
      aprovadoEm: intencao.aprovado_em,
      pedidoId: intencao.pedido_id,
    });
  } catch (erro) {
    console.error("Erro ao consultar intenção PIX:", erro);

    return res.status(500).json({
      mensagem: "Erro ao consultar a intenção PIX.",
    });
  }
});

// ======================================================
// LISTAR PEDIDOS DO CLIENTE
// ======================================================

router.get("/meus", autenticarCliente, async (req, res) => {
  try {
    const [pedidos] = await db.query(
      `SELECT
        p.id,
        p.data_pedido,
        p.status,
        p.tipo_entrega,
        p.subtotal,
        p.taxa_entrega,
        p.desconto,
        p.total,

        pg.forma_pagamento,
        pg.status AS status_pagamento,

        (
          SELECT COALESCE(SUM(ip.quantidade), 0)
          FROM itens_pedido ip
          WHERE ip.pedido_id = p.id
        ) AS quantidade_itens

      FROM pedidos p

      LEFT JOIN pagamentos pg
        ON pg.pedido_id = p.id

      WHERE p.usuario_id = ?

      ORDER BY p.data_pedido DESC`,
      [req.usuario.id],
    );

    return res.json(pedidos);
  } catch (erro) {
    console.error("Erro ao listar pedidos:", erro);

    return res.status(500).json({
      mensagem: "Erro ao carregar seus pedidos.",
    });
  }
});

// ======================================================
// CANCELAR PEDIDO DO CLIENTE
// ======================================================

async function cancelarPedidoCliente(req, res) {
  let conexao;
  let transacaoIniciada = false;
  let transacaoFinalizada = false;

  try {
    const pedidoId = Number(req.params.id);

    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({
        mensagem: "ID de pedido inválido.",
      });
    }

    const motivoBruto =
      req.body?.motivo || req.body?.observacao || "Cancelado pelo cliente";

    const motivo =
      String(motivoBruto).trim().slice(0, 255) || "Cancelado pelo cliente";

    conexao = await db.getConnection();

    await conexao.beginTransaction();
    transacaoIniciada = true;

    // ==================================================
    // BUSCAR E BLOQUEAR PEDIDO
    // ==================================================

    const [pedidos] = await conexao.query(
      `SELECT id, usuario_id, status, observacoes
       FROM pedidos
       WHERE id = ?
         AND usuario_id = ?
       FOR UPDATE`,
      [pedidoId, req.usuario.id],
    );

    if (!pedidos.length) {
      await conexao.rollback();
      transacaoFinalizada = true;

      return res.status(404).json({
        mensagem: "Pedido não encontrado.",
      });
    }

    const pedido = pedidos[0];
    const statusAtual = String(pedido.status || "").toLowerCase();

    if (statusAtual === "cancelado") {
      await conexao.rollback();
      transacaoFinalizada = true;

      return res.status(400).json({
        mensagem: "Este pedido já está cancelado.",
      });
    }

    if (!STATUS_CANCELAVEIS.includes(statusAtual)) {
      await conexao.rollback();
      transacaoFinalizada = true;

      return res.status(400).json({
        mensagem:
          "Não é possível cancelar este pedido pois ele já avançou no preparo ou saiu para entrega.",
      });
    }

    // ==================================================
    // ATUALIZAR PEDIDO
    // ==================================================

    const linhaMotivo = `Cancelamento: ${motivo}`;

    const novasObservacoes = pedido.observacoes
      ? `${pedido.observacoes}\n${linhaMotivo}`.slice(0, 1000)
      : linhaMotivo.slice(0, 1000);

    await conexao.query(
      `UPDATE pedidos
       SET status = 'cancelado',
           observacoes = ?
       WHERE id = ?
         AND usuario_id = ?`,
      [novasObservacoes, pedidoId, req.usuario.id],
    );

    // ==================================================
    // CANCELAR PAGAMENTO PENDENTE
    // ==================================================

    await conexao.query(
      `UPDATE pagamentos
       SET status = 'cancelado'
       WHERE pedido_id = ?
         AND status = 'pendente'`,
      [pedidoId],
    );

    // ==================================================
    // REGISTRAR HISTÓRICO
    // ==================================================

    await conexao.query(
      `INSERT INTO historico_pedidos (
        pedido_id,
        usuario_id,
        status_anterior,
        status_novo,
        data_alteracao
      ) VALUES (?, ?, ?, 'cancelado', NOW())`,
      [pedidoId, req.usuario.id, statusAtual],
    );

    // ==================================================
    // NOTIFICAÇÃO PERSISTENTE PARA O CLIENTE
    // ==================================================

    await criarNotificacao(
      conexao,
      req.usuario.id,
      pedidoId,
      "pedido_cancelado",
      "Pedido cancelado",
      `Seu pedido #${pedidoId} foi cancelado com sucesso.`,
    );

    // ==================================================
    // NOTIFICAÇÕES PERSISTENTES PARA A EQUIPE
    // ==================================================

    const usuariosEquipeNotificados = await criarNotificacoesEquipe(
      conexao,
      pedidoId,
      "pedido_cancelado_equipe",
      "Pedido cancelado",
      `O pedido #${pedidoId} foi cancelado pelo cliente. Motivo: ${motivo}`,
    );

    // ==================================================
    // CONFIRMAR TRANSAÇÃO
    // ==================================================

    await conexao.commit();
    transacaoFinalizada = true;

    // ==================================================
    // WEBSOCKET DO CLIENTE
    // ==================================================

    emitirNotificacaoUsuario(req, req.usuario.id, {
      pedidoId,
      tipo: "pedido_cancelado",
      titulo: "Pedido cancelado",
      mensagem: `Seu pedido #${pedidoId} foi cancelado.`,
    });

    // ==================================================
    // WEBSOCKET DO ADMINISTRADOR E ATENDENTE
    // ==================================================

    for (const usuarioId of usuariosEquipeNotificados) {
      emitirNotificacaoUsuario(req, usuarioId, {
        pedidoId,
        tipo: "pedido_cancelado_equipe",
        titulo: "Pedido cancelado",
        mensagem: `O pedido #${pedidoId} foi cancelado pelo cliente.`,
      });
    }

    // ==================================================
    // ATUALIZAR PAINÉIS INTERNOS
    // ==================================================

    emitirParaEquipe(req, ["admin", "atendente", "cozinha"], {
      evento: "pedido_atualizado",
      pedidoId,
      statusAnterior: statusAtual,
      status: "cancelado",
      mensagem: `O pedido #${pedidoId} foi cancelado pelo cliente.`,
    });

    // ==================================================
    // RESPOSTA
    // ==================================================

    return res.json({
      mensagem: `Pedido #${pedidoId} cancelado com sucesso.`,
      pedido: {
        id: pedidoId,
        status: "cancelado",
      },
    });
  } catch (erro) {
    if (conexao && transacaoIniciada && !transacaoFinalizada) {
      try {
        await conexao.rollback();
      } catch (erroRollback) {
        console.error("Erro ao desfazer cancelamento:", erroRollback);
      }
    }

    console.error("Erro ao cancelar pedido:", erro);

    return res.status(500).json({
      mensagem: "Erro ao cancelar o pedido.",
    });
  } finally {
    if (conexao) {
      conexao.release();
    }
  }
}

router.patch("/:id/cancelar", autenticarCliente, cancelarPedidoCliente);
router.put("/:id/cancelar", autenticarCliente, cancelarPedidoCliente);

// ======================================================
// CONSULTAR PEDIDO ESPECÍFICO
// ======================================================

router.get("/:id", autenticarCliente, async (req, res) => {
  try {
    const pedidoId = Number(req.params.id);

    if (!Number.isSafeInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({
        mensagem: "ID de pedido inválido.",
      });
    }

    const filtroAutorizacao = "p.usuario_id = ?";
    const parametrosAutorizacao = [req.usuario.id];

    const [pedidos] = await db.query(
      `SELECT
        p.id,
        p.data_pedido,
        p.status,
        p.tipo_entrega,
        p.subtotal,
        p.taxa_entrega,
        p.desconto,
        p.total,
        p.observacoes,
        COALESCE(e.rua, p.endereco_rua) AS rua,
        COALESCE(e.numero, p.endereco_numero) AS numero,
        COALESCE(e.bairro, p.endereco_bairro) AS bairro,
        COALESCE(e.cidade, p.endereco_cidade) AS cidade,
        e.complemento,
        pg.forma_pagamento,
        pg.status AS status_pagamento
      FROM pedidos p
      LEFT JOIN enderecos e
        ON e.id = p.endereco_id
      LEFT JOIN pagamentos pg
        ON pg.pedido_id = p.id
      WHERE p.id = ?
        AND ${filtroAutorizacao}
      LIMIT 1`,
      [pedidoId, ...parametrosAutorizacao],
    );

    if (!pedidos.length) {
      return res.status(404).json({
        mensagem: "Pedido não encontrado.",
      });
    }

    const [itens] = await db.query(
      `SELECT
        id,
        produto_id,
        nome_produto,
        quantidade,
        preco_unitario,
        subtotal,
        personalizacao
      FROM itens_pedido
      WHERE pedido_id = ?`,
      [pedidoId],
    );

    const [historico] = await db.query(
      `SELECT
        status_anterior,
        status_novo,
        data_alteracao
      FROM historico_pedidos
      WHERE pedido_id = ?
      ORDER BY data_alteracao ASC`,
      [pedidoId],
    );

    return res.json({
      pedido: pedidos[0],
      itens,
      historico,
    });
  } catch (erro) {
    console.error("Erro ao consultar pedido:", erro);

    return res.status(500).json({
      mensagem: "Erro ao consultar pedido.",
    });
  }
});

module.exports = router;
