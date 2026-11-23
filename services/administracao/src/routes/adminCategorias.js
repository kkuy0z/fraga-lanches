const express = require("express");
const router = express.Router();

const db = require("../database");
const autenticarAdmin = require("../middleware/autenticarAdmin");

router.use(autenticarAdmin);

// LISTAR CATEGORIAS
router.get("/", async (req, res) => {
  try {
    const [categorias] = await db.query(`
            SELECT
                c.id,
                c.nome,
                c.descricao,
                c.ativo
            FROM categorias c
            ORDER BY c.nome ASC
        `);

    res.json(categorias);
  } catch (erro) {
    console.error("Erro ao listar categorias:", erro);

    res.status(500).json({
      mensagem: "Erro ao carregar categorias.",
    });
  }
});

// CADASTRAR CATEGORIA
router.post("/", async (req, res) => {
  try {
    const { nome, descricao, ativo } = req.body;

    if (!nome || typeof nome !== "string" || !nome.trim()) {
      return res.status(400).json({
        mensagem: "Informe o nome da categoria.",
      });
    }

    const nomeLimpo = nome.trim();

    if (nomeLimpo.length > 100) {
      return res.status(400).json({
        mensagem: "O nome deve ter no máximo 100 caracteres.",
      });
    }

    const [existente] = await db.query(
      "SELECT id FROM categorias WHERE nome = ? LIMIT 1",
      [nomeLimpo],
    );

    if (existente.length) {
      return res.status(409).json({
        mensagem: "Já existe uma categoria com esse nome.",
      });
    }

    await db.query(
      `
            INSERT INTO categorias (nome, descricao, ativo)
            VALUES (?, ?, ?)
        `,
      [
        nomeLimpo,
        descricao?.trim() || null,
        ativo === false || ativo === 0 ? 0 : 1,
      ],
    );

    res.status(201).json({
      mensagem: "Categoria cadastrada com sucesso.",
    });
  } catch (erro) {
    console.error("Erro ao cadastrar categoria:", erro);

    res.status(500).json({
      mensagem: "Erro ao cadastrar categoria.",
    });
  }
});

// EDITAR CATEGORIA
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nome, descricao, ativo } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        mensagem: "ID inválido.",
      });
    }

    if (!nome || typeof nome !== "string" || !nome.trim()) {
      return res.status(400).json({
        mensagem: "Informe o nome da categoria.",
      });
    }

    const nomeLimpo = nome.trim();

    if (nomeLimpo.length > 100) {
      return res.status(400).json({
        mensagem: "O nome deve ter no máximo 100 caracteres.",
      });
    }

    const [categoria] = await db.query(
      "SELECT id FROM categorias WHERE id = ?",
      [id],
    );

    if (!categoria.length) {
      return res.status(404).json({
        mensagem: "Categoria não encontrada.",
      });
    }

    const [duplicada] = await db.query(
      "SELECT id FROM categorias WHERE nome = ? AND id <> ?",
      [nomeLimpo, id],
    );

    if (duplicada.length) {
      return res.status(409).json({
        mensagem: "Já existe outra categoria com esse nome.",
      });
    }

    await db.query(
      `
            UPDATE categorias
            SET nome = ?, descricao = ?, ativo = ?
            WHERE id = ?
        `,
      [
        nomeLimpo,
        descricao?.trim() || null,
        ativo === false || ativo === 0 ? 0 : 1,
        id,
      ],
    );

    res.json({
      mensagem: "Categoria atualizada com sucesso.",
    });
  } catch (erro) {
    console.error("Erro ao editar categoria:", erro);

    res.status(500).json({
      mensagem: "Erro ao atualizar categoria.",
    });
  }
});

// EXCLUIR CATEGORIA
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        mensagem: "ID inválido.",
      });
    }

    const [categoria] = await db.query(
      "SELECT id FROM categorias WHERE id = ?",
      [id],
    );

    if (!categoria.length) {
      return res.status(404).json({
        mensagem: "Categoria não encontrada.",
      });
    }

    const [produtos] = await db.query(
      "SELECT id FROM produtos WHERE categoria_id = ? LIMIT 1",
      [id],
    );

    if (produtos.length) {
      return res.status(409).json({
        mensagem:
          "Esta categoria possui produtos vinculados. Desative-a em vez de excluí-la.",
      });
    }

    await db.query("DELETE FROM categorias WHERE id = ?", [id]);

    res.json({
      mensagem: "Categoria excluída com sucesso.",
    });
  } catch (erro) {
    console.error("Erro ao excluir categoria:", erro);

    res.status(500).json({
      mensagem: "Erro ao excluir categoria.",
    });
  }
});

module.exports = router;
