"use strict";

const express = require("express");
const db = require("../database");
const autenticar = require("../middleware/autenticar");
const { parsePhoneNumberFromString } = require("libphonenumber-js/max");

const router = express.Router();



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
// ATUALIZAR DADOS PESSOAIS
// PUT /api/cliente/perfil/dados
// ======================================================

router.put("/dados", async (req, res) => {
  try {
    const nome = String(req.body.nome || "").trim();
    const telefoneInformado = String(req.body.telefone || "").trim();

    if (nome.length < 2 || nome.length > 100) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "O nome deve ter entre 2 e 100 caracteres.",
      });
    }

    let telefone = null;
    if (telefoneInformado) {
      const parsed = parsePhoneNumberFromString(
        telefoneInformado,
        telefoneInformado.startsWith("+") ? undefined : "BR",
      );
      if (
        !parsed ||
        !parsed.isValid() ||
        parsed.number.replace(/\D/g, "").length > 15 ||
        (parsed.country === "BR" && parsed.nationalNumber.length !== 11)
      ) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Número inválido. Confira o DDD e o código do país.",
        });
      }
      telefone = parsed.number;
    }

    const [resultado] = await db.execute(
      `UPDATE usuarios SET nome = ?, telefone = ?
       WHERE id = ? AND tipo = 'cliente'`,
      [nome, telefone, req.usuario.id],
    );

    if (!resultado.affectedRows) {
      const [existente] = await db.execute(
        "SELECT id FROM usuarios WHERE id = ? AND tipo = 'cliente' LIMIT 1",
        [req.usuario.id],
      );
      if (!existente.length) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Usuário não encontrado.",
        });
      }
    }

    const [usuarios] = await db.execute(
      `SELECT id, nome, email, telefone FROM usuarios
       WHERE id = ? AND tipo = 'cliente' LIMIT 1`,
      [req.usuario.id],
    );

    return res.json({
      sucesso: true,
      mensagem: "Dados pessoais atualizados com sucesso.",
      usuario: usuarios[0],
    });
  } catch (erro) {
    console.error("Erro ao atualizar dados pessoais:", erro);
    return res.status(500).json({
      sucesso: false,
      mensagem: "Não foi possível atualizar seus dados pessoais.",
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
