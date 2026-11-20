const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../database");

const router = express.Router();

const STATUS_PEDIDO = "novo";
const STATUS_PAGAMENTO = "pendente";

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

// Autenticação exclusiva para clientes
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

    next();
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

function converterCentavos(valor) {
  return Math.round(Number(valor) * 100);
}

function formatarDecimal(centavos) {
  return (centavos / 100).toFixed(2);
}

// Criar pedido
router.post("/", async (req, res) => {
  let conexao;

  try {
    const {
      tipo_entrega,
      endereco,
      forma_pagamento,
      troco_para,
      observacoes,
      itens,
    } = req.body;

    // Validar tipo de entrega
    if (!["entrega", "retirada"].includes(tipo_entrega)) {
      return res.status(400).json({
        mensagem: "Tipo de entrega inválido.",
      });
    }

    // Validar pagamento
    if (!["pix", "cartao", "dinheiro"].includes(forma_pagamento)) {
      return res.status(400).json({
        mensagem: "Forma de pagamento inválida.",
      });
    }

    // Validar itens
    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({
        mensagem: "O pedido precisa ter pelo menos um produto.",
      });
    }

    if (itens.length > 50) {
      return res.status(400).json({
        mensagem: "Quantidade máxima de itens excedida.",
      });
    }

    // Validar endereço
    if (tipo_entrega === "entrega") {
      if (
        !endereco ||
        !endereco.rua ||
        !endereco.numero ||
        !endereco.bairro ||
        !endereco.cidade
      ) {
        return res.status(400).json({
          mensagem: "Preencha todos os campos obrigatórios do endereço.",
        });
      }

      const camposEndereco = [
        endereco.rua,
        endereco.numero,
        endereco.bairro,
        endereco.cidade,
      ];

      if (
        camposEndereco.some(
          (campo) => typeof campo !== "string" || !campo.trim(),
        )
      ) {
        return res.status(400).json({
          mensagem: "Os dados do endereço são inválidos.",
        });
      }
    }

    // Validar taxa de entrega configurada no servidor
    const taxaConfigurada = Number(process.env.TAXA_ENTREGA ?? 0);

    if (!Number.isFinite(taxaConfigurada) || taxaConfigurada < 0) {
      throw new Error("TAXA_ENTREGA inválida no arquivo .env.");
    }

    const taxaCentavos =
      tipo_entrega === "entrega" ? converterCentavos(taxaConfigurada) : 0;

    conexao = await db.getConnection();

    await conexao.beginTransaction();

    let enderecoId = null;

    // Salvar endereço
    if (tipo_entrega === "entrega") {
      const [resultadoEndereco] = await conexao.query(
        `INSERT INTO enderecos
                    (usuario_id, rua, numero, bairro, cidade, complemento)
                 VALUES (?, ?, ?, ?, ?, ?)`,
        [
          req.usuario.id,
          endereco.rua.trim(),
          endereco.numero.trim(),
          endereco.bairro.trim(),
          endereco.cidade.trim(),
          typeof endereco.complemento === "string"
            ? endereco.complemento.trim()
            : null,
        ],
      );

      enderecoId = resultadoEndereco.insertId;
    }

    let subtotalCentavos = 0;
    const itensValidados = [];

    // Validar e recalcular cada produto
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
        throw new Error("Um dos produtos possui dados inválidos.");
      }

      const [produtos] = await conexao.query(
        `SELECT id, nome, preco
                 FROM produtos
                 WHERE id = ? AND disponivel = TRUE
                 FOR UPDATE`,
        [produtoId],
      );

      if (!produtos.length) {
        throw new Error(`O produto de ID ${produtoId} não está disponível.`);
      }

      const produto = produtos[0];

      const adicionaisRecebidos = item.adicionais || [];

      if (!Array.isArray(adicionaisRecebidos)) {
        throw new Error("Lista de adicionais inválida.");
      }

      if (adicionaisRecebidos.length > 30) {
        throw new Error("Quantidade de adicionais excedida.");
      }

      const idsAdicionais = adicionaisRecebidos.map(Number);

      if (
        idsAdicionais.some((id) => !Number.isInteger(id) || id <= 0) ||
        new Set(idsAdicionais).size !== idsAdicionais.length
      ) {
        throw new Error("Um dos adicionais possui ID inválido ou repetido.");
      }

      let adicionaisValidados = [];
      let totalAdicionaisCentavos = 0;

      if (idsAdicionais.length > 0) {
        const placeholders = idsAdicionais.map(() => "?").join(",");

        const [adicionais] = await conexao.query(
          `SELECT a.id, a.nome, a.preco
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
          throw new Error(
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

      const precoUnitarioCentavos =
        precoProdutoCentavos + totalAdicionaisCentavos;

      const totalItemCentavos = precoUnitarioCentavos * quantidade;

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

    // Limite de segurança para o valor do pedido
    if (!Number.isSafeInteger(subtotalCentavos) || subtotalCentavos <= 0) {
      throw new Error("Valor total do pedido inválido.");
    }

    const descontoCentavos = 0;
    const totalCentavos = subtotalCentavos + taxaCentavos - descontoCentavos;

    // Validar troco
    let trocoTexto = "";

    if (
      forma_pagamento === "dinheiro" &&
      troco_para !== null &&
      troco_para !== undefined &&
      troco_para !== ""
    ) {
      const trocoCentavos = converterCentavos(Number(troco_para));

      if (
        !Number.isFinite(Number(troco_para)) ||
        !Number.isSafeInteger(trocoCentavos) ||
        trocoCentavos < totalCentavos
      ) {
        throw new Error(
          "O valor informado para troco precisa ser igual ou superior ao total.",
        );
      }

      trocoTexto = `Troco para: R$ ${formatarDecimal(trocoCentavos)}.`;
    }

    let observacoesFinais =
      typeof observacoes === "string" ? observacoes.trim() : "";

    if (observacoesFinais.length > 1000) {
      throw new Error("As observações ultrapassam o limite permitido.");
    }

    if (trocoTexto) {
      observacoesFinais = observacoesFinais
        ? `${observacoesFinais}\n${trocoTexto}`
        : trocoTexto;
    }

    // Criar pedido
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

    // Inserir itens do pedido
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

    // Registrar pagamento pendente
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
        forma_pagamento,
        formatarDecimal(totalCentavos),
        STATUS_PAGAMENTO,
      ],
    );

    // Registrar histórico inicial
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

    await conexao.commit();

    return res.status(201).json({
      mensagem: "Pedido registrado com sucesso.",
      pedidoId,
      status: STATUS_PEDIDO,
      pagamento: STATUS_PAGAMENTO,
      formaPagamento: forma_pagamento,
      subtotal: formatarDecimal(subtotalCentavos),
      taxaEntrega: formatarDecimal(taxaCentavos),
      total: formatarDecimal(totalCentavos),
    });
  } catch (erro) {
    if (conexao) {
      await conexao.rollback();
    }

    console.error("Erro ao criar pedido:", erro);

    const mensagem = erro.message || "Erro ao registrar pedido.";

    const errosValidacao = [
      "inválido",
      "inválida",
      "indisponível",
      "disponíveis",
      "disponíveis.",
      "precisa",
      "Preencha",
      "Existem",
      "Quantidade",
      "O produto",
      "As observações",
      "Lista de",
      "Um dos",
    ];

    const erroCliente = errosValidacao.some((texto) =>
      mensagem.toLowerCase().includes(texto.toLowerCase()),
    );

    return res.status(erroCliente ? 400 : 500).json({
      mensagem: erroCliente ? mensagem : "Não foi possível registrar o pedido.",
    });
  } finally {
    if (conexao) {
      conexao.release();
    }
  }
});

// Listar pedidos do cliente autenticado
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
             LEFT JOIN pagamentos pg ON pg.pedido_id = p.id
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

// Consultar um pedido específico do cliente
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
             LEFT JOIN enderecos e ON e.id = p.endereco_id
             LEFT JOIN pagamentos pg ON pg.pedido_id = p.id
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
