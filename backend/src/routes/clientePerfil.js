"use strict";

const express = require("express");
const db = require("../database");
const authRoutes = require("./auth");

const router = express.Router();

const autenticar = authRoutes.autenticar;

// Todas as rotas exigem autenticação de cliente.
function exigirCliente(req, res, next) {
  if (!req.usuario || req.usuario.tipo !== "cliente") {
    return res.status(403).json({
      sucesso: false,
      mensagem: "Acesso permitido somente para clientes.",
    });
  }

  next();
}

router.use(autenticar, exigirCliente);

// ======================================================
// BUSCAR PERFIL E ENDEREÇOS
// GET /api/cliente/perfil
// ======================================================

router.get("/", async (req, res) => {
  try {
    const usuarioId = req.usuario.id;

    const [usuarios] = await db.execute(
      `SELECT id, nome, email, telefone
             FROM usuarios
             WHERE id = ?
             LIMIT 1`,
      [usuarioId],
    );

    if (usuarios.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Usuário não encontrado.",
      });
    }

    const [enderecos] = await db.execute(
      `SELECT id, rua, numero, bairro, cidade, complemento
             FROM enderecos
             WHERE usuario_id = ?
             ORDER BY id DESC`,
      [usuarioId],
    );

    return res.json({
      sucesso: true,
      usuario: usuarios[0],
      enderecos,
    });
  } catch (erro) {
    console.error("Erro ao buscar perfil:", erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Não foi possível carregar seu perfil.",
    });
  }
});

// ======================================================
// CADASTRAR ENDEREÇO
// POST /api/cliente/perfil/enderecos
// ======================================================

router.post("/enderecos", async (req, res) => {
  try {
    const usuarioId = req.usuario.id;

    const { rua, numero, bairro, cidade, complemento } = req.body;

    const endereco = {
      rua: String(rua || "").trim(),
      numero: String(numero || "").trim(),
      bairro: String(bairro || "").trim(),
      cidade: String(cidade || "").trim(),
      complemento: String(complemento || "").trim(),
    };

    if (
      !endereco.rua ||
      !endereco.numero ||
      !endereco.bairro ||
      !endereco.cidade
    ) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Preencha rua, número, bairro e cidade.",
      });
    }

    if (
      endereco.rua.length > 150 ||
      endereco.numero.length > 20 ||
      endereco.bairro.length > 100 ||
      endereco.cidade.length > 100 ||
      endereco.complemento.length > 100
    ) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Um ou mais campos ultrapassaram o limite permitido.",
      });
    }

    const [resultado] = await db.execute(
      `INSERT INTO enderecos
            (usuario_id, rua, numero, bairro, cidade, complemento)
            VALUES (?, ?, ?, ?, ?, ?)`,
      [
        usuarioId,
        endereco.rua,
        endereco.numero,
        endereco.bairro,
        endereco.cidade,
        endereco.complemento || null,
      ],
    );

    return res.status(201).json({
      sucesso: true,
      mensagem: "Endereço cadastrado com sucesso.",
      enderecoId: resultado.insertId,
    });
  } catch (erro) {
    console.error("Erro ao cadastrar endereço:", erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Não foi possível cadastrar o endereço.",
    });
  }
});

// ======================================================
// ATUALIZAR ENDEREÇO
// PUT /api/cliente/perfil/enderecos/:id
// ======================================================

router.put("/enderecos/:id", async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const enderecoId = Number(req.params.id);

    if (!Number.isInteger(enderecoId) || enderecoId <= 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Endereço inválido.",
      });
    }

    const { rua, numero, bairro, cidade, complemento } = req.body;

    const endereco = {
      rua: String(rua || "").trim(),
      numero: String(numero || "").trim(),
      bairro: String(bairro || "").trim(),
      cidade: String(cidade || "").trim(),
      complemento: String(complemento || "").trim(),
    };

    if (
      !endereco.rua ||
      !endereco.numero ||
      !endereco.bairro ||
      !endereco.cidade
    ) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Preencha rua, número, bairro e cidade.",
      });
    }

    if (
      endereco.rua.length > 150 ||
      endereco.numero.length > 20 ||
      endereco.bairro.length > 100 ||
      endereco.cidade.length > 100 ||
      endereco.complemento.length > 100
    ) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Um ou mais campos ultrapassaram o limite permitido.",
      });
    }

    const [resultado] = await db.execute(
      `UPDATE enderecos
             SET rua = ?,
                 numero = ?,
                 bairro = ?,
                 cidade = ?,
                 complemento = ?
             WHERE id = ?
             AND usuario_id = ?`,
      [
        endereco.rua,
        endereco.numero,
        endereco.bairro,
        endereco.cidade,
        endereco.complemento || null,
        enderecoId,
        usuarioId,
      ],
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Endereço não encontrado.",
      });
    }

    return res.json({
      sucesso: true,
      mensagem: "Endereço atualizado com sucesso.",
    });
  } catch (erro) {
    console.error("Erro ao atualizar endereço:", erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Não foi possível atualizar o endereço.",
    });
  }
});

// ======================================================
// EXCLUIR ENDEREÇO
// DELETE /api/cliente/perfil/enderecos/:id
// ======================================================

router.delete("/enderecos/:id", async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const enderecoId = Number(req.params.id);

    if (!Number.isInteger(enderecoId) || enderecoId <= 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Endereço inválido.",
      });
    }

    const [resultado] = await db.execute(
      `DELETE FROM enderecos
             WHERE id = ?
             AND usuario_id = ?`,
      [enderecoId, usuarioId],
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Endereço não encontrado.",
      });
    }

    return res.json({
      sucesso: true,
      mensagem: "Endereço excluído com sucesso.",
    });
  } catch (erro) {
    console.error("Erro ao excluir endereço:", erro);

    if (erro.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        sucesso: false,
        mensagem:
          "Este endereço está vinculado a um pedido e não pode ser excluído.",
      });
    }

    return res.status(500).json({
      sucesso: false,
      mensagem: "Não foi possível excluir o endereço.",
    });
  }
});

module.exports = router;
