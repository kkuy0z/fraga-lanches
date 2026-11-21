"use strict";

const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../database");

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

    if (!usuarios.length || !usuarios[0].ativo) {
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

router.use(autenticarCliente);

// ======================================================
// PIX - BR CODE COM VALOR DO PEDIDO
// ======================================================

const PIX_BASE =
  "00020101021126580014br.gov.bcb.pix013619acfdc1-3340-4dfe-9e2b-6aebdb372b945204000053039865802BR5925SAMUEL WELINGTON DE OLIVE6009SAO PAULO622905251M7X3KK0N171P4KK4YQ4MVA5X6304C1D3";

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

function gerarPixComValor(valorCentavos) {
  if (!Number.isSafeInteger(valorCentavos) || valorCentavos <= 0) {
    throw new Error("Valor inválido para geração do PIX.");
  }

  const base = PIX_BASE.trim();
  const crcOriginal = base.slice(-4);
  const conteudoParaCRC = base.slice(0, -4);

  if (calcularCRC16(conteudoParaCRC) !== crcOriginal) {
    throw new Error("CRC do código PIX original inválido.");
  }

  let payload = base.slice(0, -8);

  const campos = [];
  let posicao = 0;

  while (posicao < payload.length) {
    if (posicao + 4 > payload.length) {
      throw new Error("Estrutura TLV do PIX inválida.");
    }

    const tag = payload.substring(posicao, posicao + 2);
    const tamanhoTexto = payload.substring(posicao + 2, posicao + 4);

    if (!/^\d{2}$/.test(tamanhoTexto)) {
      throw new Error("Tamanho de campo PIX inválido.");
    }

    const tamanho = Number(tamanhoTexto);
    const inicioValor = posicao + 4;
    const fimValor = inicioValor + tamanho;

    if (fimValor > payload.length) {
      throw new Error("Campo PIX incompleto.");
    }

    campos.push({
      tag,
      inicio: posicao,
      fim: fimValor,
    });

    posicao = fimValor;
  }

  if (campos.some((campo) => campo.tag === "54")) {
    throw new Error("O código PIX já possui um valor definido.");
  }

  const campoPais = campos.find((campo) => campo.tag === "58");

  if (!campoPais) {
    throw new Error("Campo de país não encontrado no PIX.");
  }

  const valor = (valorCentavos / 100).toFixed(2);

  if (valor.length > 13) {
    throw new Error("Valor excede o limite permitido para o PIX.");
  }

  const campoValor = `54${String(valor.length).padStart(2, "0")}${valor}`;

  payload =
    payload.slice(0, campoPais.inicio) +
    campoValor +
    payload.slice(campoPais.inicio);

  const payloadParaCRC = `${payload}6304`;
  const novoCRC = calcularCRC16(payloadParaCRC);

  return `${payloadParaCRC}${novoCRC}`;
}

// ======================================================
// CRIAR PEDIDO
// ======================================================

router.post("/", async (req, res) => {
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

    // A forma de pagamento é validada diretamente no banco.
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

    // A taxa percentual cadastrada não é repassada ao cliente.
    // O total permanece subtotal + entrega - desconto.

    if (tipo_entrega === "entrega") {
      const configuracao = await obterConfiguracaoEntrega(
        conexao,
        enderecoValidado.bairro,
      );

      taxaCentavos = configuracao.taxaCentavos;
      valorMinimoCentavos = configuracao.valorMinimoCentavos;
    }

    if (tipo_entrega === "entrega") {
      const [resultadoEndereco] = await conexao.query(
        `INSERT INTO enderecos
          (
            usuario_id,
            rua,
            numero,
            bairro,
            cidade,
            complemento
          )
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          req.usuario.id,
          enderecoValidado.rua,
          enderecoValidado.numero,
          enderecoValidado.bairro,
          enderecoValidado.cidade,
          enderecoValidado.complemento,
        ],
      );

      enderecoId = resultadoEndereco.insertId;
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

    const [resultadoPedido] = await conexao.query(
      `INSERT INTO pedidos (
        usuario_id,
        endereco_id,
        status,
        tipo_entrega,
        subtotal,
        taxa_entrega,
        desconto,
        total,
        observacoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.usuario.id,
        enderecoId,
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
        data_pagamento
      ) VALUES (?, ?, ?, ?, NULL, NULL)`,
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
      [pedidoId, req.usuario.id, STATUS_PEDIDO],
    );

    let pixCopiaECola = null;

    if (tipoPagamento === "pix") {
      pixCopiaECola = gerarPixComValor(totalCentavos);
    }

    await conexao.commit();
    transacaoFinalizada = true;

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

    const statusCode = erro.statusCode === 400 ? 400 : 500;

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
// LISTAR PEDIDOS DO CLIENTE
// ======================================================

router.get("/meus", async (req, res) => {
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
        pg.status AS status_pagamento
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

    await conexao.query(
      `UPDATE pagamentos
       SET status = 'cancelado'
       WHERE pedido_id = ?
         AND status = 'pendente'`,
      [pedidoId],
    );

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

    await conexao.commit();
    transacaoFinalizada = true;

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

router.patch("/:id/cancelar", cancelarPedidoCliente);
router.put("/:id/cancelar", cancelarPedidoCliente);

// ======================================================
// CONSULTAR PEDIDO ESPECÍFICO
// ======================================================

router.get("/:id", async (req, res) => {
  try {
    const pedidoId = Number(req.params.id);

    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({
        mensagem: "ID de pedido inválido.",
      });
    }

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
        e.rua,
        e.numero,
        e.bairro,
        e.cidade,
        e.complemento,
        pg.forma_pagamento,
        pg.status AS status_pagamento
      FROM pedidos p
      LEFT JOIN enderecos e
        ON e.id = p.endereco_id
      LEFT JOIN pagamentos pg
        ON pg.pedido_id = p.id
      WHERE p.id = ?
        AND p.usuario_id = ?
      LIMIT 1`,
      [pedidoId, req.usuario.id],
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
