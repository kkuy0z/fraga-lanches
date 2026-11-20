"use strict";

const express = require("express");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");

const db = require("../database");
const authRoutes = require("./auth");

const router = express.Router();
const autenticar = authRoutes.autenticar;
const configurarCookie = authRoutes.configurarCookie;

const COOKIE_NAME = "fraga_session";

function exigirCliente(req, res, next) {
  if (!req.usuario || req.usuario.tipo !== "cliente") {
    return res.status(403).json({
      sucesso: false,
      mensagem: "Acesso permitido somente para clientes.",
    });
  }

  next();
}

function gerarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipo: usuario.tipo,
    },
    process.env.JWT_SECRET,
    { expiresIn: "30d" },
  );
}

function atualizarCookie(res, usuario) {
  const token = gerarToken(usuario);

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

// Todas as rotas exigem autenticação de cliente.
router.use(autenticar, exigirCliente);

/* =====================================================
   GET /api/cliente/perfil
   Buscar dados pessoais e endereços
===================================================== */

router.get("/", async (req, res) => {
  try {
    const [usuarios] = await db.execute(
      `SELECT id, nome, email, telefone
             FROM usuarios
             WHERE id = ? AND tipo = 'cliente' AND ativo = TRUE`,
      [req.usuario.id],
    );

    if (!usuarios.length) {
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
      [req.usuario.id],
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

/* =====================================================
   PUT /api/cliente/perfil/dados
   Atualizar nome, email e telefone
===================================================== */

router.put("/dados", async (req, res) => {
  try {
    const nome = String(req.body.nome || "").trim();
    const telefone = String(req.body.telefone || "").trim();

    if (!nome || nome.length < 2) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Informe um nome válido.",
      });
    }

    if (nome.length > 100 || telefone.length > 20) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Um ou mais campos ultrapassaram o limite permitido.",
      });
    }

    const [resultado] = await db.execute(
      `UPDATE usuarios
             SET nome = ?, telefone = ?
             WHERE id = ? AND tipo = 'cliente' AND ativo = TRUE`,
      [nome, telefone || null, req.usuario.id],
    );

    if (!resultado.affectedRows) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Usuário não encontrado.",
      });
    }

    const [usuarios] = await db.execute(
      `SELECT id, nome, email, telefone
             FROM usuarios
             WHERE id = ? AND tipo = 'cliente'`,
      [req.usuario.id],
    );

    if (!usuarios.length) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Usuário não encontrado.",
      });
    }

    const usuarioAtualizado = usuarios[0];

    configurarCookie(
      res,
      gerarToken({
        ...usuarioAtualizado,
        tipo: "cliente",
      }),
      true,
    );

    return res.json({
      sucesso: true,
      mensagem: "Dados pessoais atualizados com sucesso.",
      usuario: usuarioAtualizado,
    });
  } catch (erro) {
    console.error("Erro ao atualizar dados pessoais:", erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Não foi possível atualizar seus dados.",
    });
  }
});

/* =====================================================
   PUT /api/cliente/perfil/senha
   Alterar senha
===================================================== */

router.put("/senha", async (req, res) => {
  try {
    const senhaAtual = String(req.body.senhaAtual || "");
    const senhaNova = String(req.body.senhaNova || "");
    const senhaConfirmar = String(req.body.senhaConfirmar || "");

    if (!senhaAtual || !senhaNova || !senhaConfirmar) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Preencha todos os campos de senha.",
      });
    }

    if (senhaNova.length < 8 || senhaNova.length > 64) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "A nova senha deve ter entre 8 e 64 caracteres.",
      });
    }

    if (senhaNova !== senhaConfirmar) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "A confirmação da nova senha não corresponde.",
      });
    }

    if (senhaAtual === senhaNova) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "A nova senha deve ser diferente da atual.",
      });
    }

    const [usuarios] = await db.execute(
      `SELECT senha FROM usuarios
             WHERE id = ? AND tipo = 'cliente' AND ativo = TRUE`,
      [req.usuario.id],
    );

    if (!usuarios.length) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Usuário não encontrado.",
      });
    }

    const senhaCorreta = await argon2.verify(usuarios[0].senha, senhaAtual);

    if (!senhaCorreta) {
      return res.status(401).json({
        sucesso: false,
        mensagem: "A senha atual está incorreta.",
      });
    }

    const senhaHash = await argon2.hash(senhaNova, {
      type: argon2.argon2id,
    });

    await db.execute(
      `UPDATE usuarios SET senha = ?
             WHERE id = ? AND tipo = 'cliente'`,
      [senhaHash, req.usuario.id],
    );

    return res.json({
      sucesso: true,
      mensagem: "Senha alterada com sucesso.",
    });
  } catch (erro) {
    console.error("Erro ao alterar senha:", erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Não foi possível alterar sua senha.",
    });
  }
});

/* =====================================================
   POST /api/cliente/perfil/enderecos
   Cadastrar endereço
===================================================== */

router.post("/enderecos", async (req, res) => {
  try {
    const rua = String(req.body.rua || "").trim();
    const numero = String(req.body.numero || "").trim();
    const bairro = String(req.body.bairro || "").trim();
    const cidade = String(req.body.cidade || "").trim();
    const complemento = String(req.body.complemento || "").trim();

    if (!rua || !numero || !bairro || !cidade) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Preencha rua, número, bairro e cidade.",
      });
    }

    if (
      rua.length > 150 ||
      numero.length > 20 ||
      bairro.length > 100 ||
      cidade.length > 100 ||
      complemento.length > 100
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
      [req.usuario.id, rua, numero, bairro, cidade, complemento || null],
    );

    return res.status(201).json({
      sucesso: true,
      mensagem: "Endereço cadastrado com sucesso.",
      endereco: {
        id: resultado.insertId,
        rua,
        numero,
        bairro,
        cidade,
        complemento,
      },
    });
  } catch (erro) {
    console.error("Erro ao cadastrar endereço:", erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Não foi possível cadastrar o endereço.",
    });
  }
});

/* =====================================================
   PUT /api/cliente/perfil/enderecos/:id
   Atualizar endereço
===================================================== */

router.put("/enderecos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Endereço inválido.",
      });
    }

    const rua = String(req.body.rua || "").trim();
    const numero = String(req.body.numero || "").trim();
    const bairro = String(req.body.bairro || "").trim();
    const cidade = String(req.body.cidade || "").trim();
    const complemento = String(req.body.complemento || "").trim();

    if (!rua || !numero || !bairro || !cidade) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Preencha rua, número, bairro e cidade.",
      });
    }

    if (
      rua.length > 150 ||
      numero.length > 20 ||
      bairro.length > 100 ||
      cidade.length > 100 ||
      complemento.length > 100
    ) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Um ou mais campos ultrapassaram o limite permitido.",
      });
    }

    const [resultado] = await db.execute(
      `UPDATE enderecos
             SET rua = ?, numero = ?, bairro = ?,
                 cidade = ?, complemento = ?
             WHERE id = ? AND usuario_id = ?`,
      [rua, numero, bairro, cidade, complemento || null, id, req.usuario.id],
    );

    if (!resultado.affectedRows) {
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

/* =====================================================
   DELETE /api/cliente/perfil/enderecos/:id
   Excluir endereço
===================================================== */

router.delete("/enderecos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Endereço inválido.",
      });
    }

    const [resultado] = await db.execute(
      `DELETE FROM enderecos
             WHERE id = ? AND usuario_id = ?`,
      [id, req.usuario.id],
    );

    if (!resultado.affectedRows) {
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
