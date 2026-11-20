const express = require("express");
const router = express.Router();

const db = require("../database");
const autenticarAdmin = require("../middleware/autenticarAdmin");

router.use(autenticarAdmin);

// LISTAR PRODUTOS
router.get("/", async (req, res) => {
  try {
    const { categoria, disponibilidade, busca } = req.query;

    let sql = `
            SELECT
                p.id,
                p.categoria_id,
                p.nome,
                p.descricao,
                p.imagem,
                p.preco,
                p.disponivel,
                c.nome AS categoria_nome
            FROM produtos p
            INNER JOIN categorias c ON c.id = p.categoria_id
            WHERE 1 = 1
        `;

    const parametros = [];

    if (categoria) {
      sql += " AND p.categoria_id = ?";
      parametros.push(categoria);
    }

    if (disponibilidade === "disponivel") {
      sql += " AND p.disponivel = 1";
    } else if (disponibilidade === "indisponivel") {
      sql += " AND p.disponivel = 0";
    }

    if (busca) {
      sql += " AND p.nome LIKE ?";
      parametros.push(`%${busca}%`);
    }

    sql += " ORDER BY p.nome ASC";

    const [produtos] = await db.query(sql, parametros);

    res.json(produtos);
  } catch (erro) {
    console.error("Erro ao listar produtos:", erro);

    res.status(500).json({
      mensagem: "Erro ao carregar produtos.",
    });
  }
});

// CADASTRAR PRODUTO
router.post("/", async (req, res) => {
  try {
    const { categoria_id, nome, descricao, imagem, preco, disponivel } =
      req.body;

    const categoriaId = Number(categoria_id);
    const precoNumerico = Number(preco);

    if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
      return res.status(400).json({
        mensagem: "Selecione uma categoria válida.",
      });
    }

    if (typeof nome !== "string" || !nome.trim()) {
      return res.status(400).json({
        mensagem: "Informe o nome do produto.",
      });
    }

    if (!Number.isFinite(precoNumerico) || precoNumerico < 0) {
      return res.status(400).json({
        mensagem: "Informe um preço válido.",
      });
    }

    const [categorias] = await db.query(
      "SELECT id FROM categorias WHERE id = ?",
      [categoriaId],
    );

    if (!categorias.length) {
      return res.status(404).json({
        mensagem: "Categoria não encontrada.",
      });
    }

    await db.query(
      `
            INSERT INTO produtos (
                categoria_id,
                nome,
                descricao,
                imagem,
                preco,
                disponivel
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `,
      [
        categoriaId,
        nome.trim(),
        descricao?.trim() || null,
        imagem?.trim() || null,
        precoNumerico,
        disponivel === false || disponivel === 0 ? 0 : 1,
      ],
    );

    res.status(201).json({
      mensagem: "Produto cadastrado com sucesso.",
    });
  } catch (erro) {
    console.error("Erro ao cadastrar produto:", erro);

    res.status(500).json({
      mensagem: "Erro ao cadastrar produto.",
    });
  }
});

// EDITAR PRODUTO
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const { categoria_id, nome, descricao, imagem, preco, disponivel } =
      req.body;

    const categoriaId = Number(categoria_id);
    const precoNumerico = Number(preco);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        mensagem: "ID do produto inválido.",
      });
    }

    if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
      return res.status(400).json({
        mensagem: "Selecione uma categoria válida.",
      });
    }

    if (typeof nome !== "string" || !nome.trim()) {
      return res.status(400).json({
        mensagem: "Informe o nome do produto.",
      });
    }

    if (!Number.isFinite(precoNumerico) || precoNumerico < 0) {
      return res.status(400).json({
        mensagem: "Informe um preço válido.",
      });
    }

    const [produto] = await db.query("SELECT id FROM produtos WHERE id = ?", [
      id,
    ]);

    if (!produto.length) {
      return res.status(404).json({
        mensagem: "Produto não encontrado.",
      });
    }

    const [categoria] = await db.query(
      "SELECT id FROM categorias WHERE id = ?",
      [categoriaId],
    );

    if (!categoria.length) {
      return res.status(404).json({
        mensagem: "Categoria não encontrada.",
      });
    }

    await db.query(
      `
            UPDATE produtos
            SET
                categoria_id = ?,
                nome = ?,
                descricao = ?,
                imagem = ?,
                preco = ?,
                disponivel = ?
            WHERE id = ?
        `,
      [
        categoriaId,
        nome.trim(),
        descricao?.trim() || null,
        imagem?.trim() || null,
        precoNumerico,
        disponivel === false || disponivel === 0 ? 0 : 1,
        id,
      ],
    );

    res.json({
      mensagem: "Produto atualizado com sucesso.",
    });
  } catch (erro) {
    console.error("Erro ao editar produto:", erro);

    res.status(500).json({
      mensagem: "Erro ao atualizar produto.",
    });
  }
});

// EXCLUIR PRODUTO
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        mensagem: "ID do produto inválido.",
      });
    }

    const [produto] = await db.query("SELECT id FROM produtos WHERE id = ?", [
      id,
    ]);

    if (!produto.length) {
      return res.status(404).json({
        mensagem: "Produto não encontrado.",
      });
    }

    const [itens] = await db.query(
      "SELECT id FROM itens_pedido WHERE produto_id = ? LIMIT 1",
      [id],
    );

    if (itens.length) {
      return res.status(409).json({
        mensagem:
          "Este produto possui pedidos vinculados. Altere sua disponibilidade para indisponível em vez de excluí-lo.",
      });
    }

    await db.query("DELETE FROM produtos WHERE id = ?", [id]);

    res.json({
      mensagem: "Produto excluído com sucesso.",
    });
  } catch (erro) {
    console.error("Erro ao excluir produto:", erro);

    res.status(500).json({
      mensagem: "Erro ao excluir produto.",
    });
  }
});

module.exports = router;
