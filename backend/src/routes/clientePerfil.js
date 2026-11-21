"use strict";

const express = require("express");
const db = require("../database");
const authRoutes = require("./auth");

const router = express.Router();

const autenticar = authRoutes.autenticar;

// ======================================================
// AUTENTICAÇÃO
// ======================================================

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
// VALIDAR ENDEREÇO
// ======================================================

function validarEndereco(dados) {
  const endereco = {
    rua: String(dados.rua || "").trim(),
    numero: String(dados.numero || "").trim(),
    bairro: String(dados.bairro || "").trim(),
    cidade: String(dados.cidade || "").trim(),
    complemento: String(dados.complemento || "").trim(),
  };

  if (
    !endereco.rua ||
    !endereco.numero ||
    !endereco.bairro ||
    !endereco.cidade
  ) {
    return {
      valido: false,
      mensagem: "Preencha rua, número, bairro e cidade.",
    };
  }

  if (
    endereco.rua.length > 150 ||
    endereco.numero.length > 20 ||
    endereco.bairro.length > 100 ||
    endereco.cidade.length > 100 ||
    endereco.complemento.length > 100
  ) {
    return {
      valido: false,
      mensagem: "Um ou mais campos ultrapassaram o limite permitido.",
    };
  }

  return {
    valido: true,
    endereco,
  };
}

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
       AND ativo = TRUE
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

    const validacao = validarEndereco(req.body || {});

    if (!validacao.valido) {
      return res.status(400).json({
        sucesso: false,
        mensagem: validacao.mensagem,
      });
    }

    const endereco = validacao.endereco;

    const [resultado] = await db.execute(
      `INSERT INTO enderecos
       (
         usuario_id,
         rua,
         numero,
         bairro,
         cidade,
         complemento,
         ativo
       )
       VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
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

    const validacao = validarEndereco(req.body || {});

    if (!validacao.valido) {
      return res.status(400).json({
        sucesso: false,
        mensagem: validacao.mensagem,
      });
    }

    const endereco = validacao.endereco;

    const [resultado] = await db.execute(
      `UPDATE enderecos
       SET rua = ?,
           numero = ?,
           bairro = ?,
           cidade = ?,
           complemento = ?
       WHERE id = ?
       AND usuario_id = ?
       AND ativo = TRUE`,
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
        mensagem: "Endereço não encontrado ou já excluído.",
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
// EXCLUIR ENDEREÇO (EXCLUSÃO LÓGICA)
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
      `UPDATE enderecos
       SET ativo = FALSE
       WHERE id = ?
       AND usuario_id = ?
       AND ativo = TRUE`,
      [enderecoId, usuarioId],
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Endereço não encontrado ou já excluído.",
      });
    }

    return res.json({
      sucesso: true,
      mensagem: "Endereço removido da sua lista com sucesso.",
    });
  } catch (erro) {
    console.error("Erro ao excluir endereço:", erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Não foi possível excluir o endereço.",
    });
  }
});

module.exports = router;
