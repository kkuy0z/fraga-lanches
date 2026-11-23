"use strict";

const express = require("express");
const argon2 = require("argon2");
const db = require("../database");
const autenticarAdmin = require("../middleware/autenticarAdmin");

const router = express.Router();
const PERFIS = new Set(["admin", "atendente", "cozinha", "entregador"]);

router.use(autenticarAdmin);

// Confirma o estado atual da conta administrativa em cada requisição.
// Isso invalida imediatamente o acesso de administradores desativados.
router.use(async (req, res, next) => {
  try {
    const [usuarios] = await db.execute(
      "SELECT id FROM usuarios WHERE id = ? AND tipo = 'admin' AND ativo = 1 LIMIT 1",
      [req.usuario.id],
    );
    if (!usuarios.length) {
      return res.status(403).json({ mensagem: "Esta conta administrativa está inativa ou não possui mais acesso." });
    }
    return next();
  } catch (erro) {
    console.error("[Admin Usuários] Erro ao validar sessão:", erro);
    return res.status(500).json({ mensagem: "Não foi possível validar o acesso administrativo." });
  }
});

function validarId(valor) {
  const id = Number(valor);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validarDados(body, exigirSenha = false) {
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const tipo = String(body.perfil || body.tipo || "").trim();
  const senha = typeof body.senha === "string" ? body.senha : "";

  if (nome.length < 2 || nome.length > 100) {
    return { erro: "O nome deve ter entre 2 e 100 caracteres." };
  }
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { erro: "Informe um e-mail válido." };
  }
  if (!PERFIS.has(tipo)) {
    return { erro: "Selecione um perfil administrativo válido." };
  }
  if ((exigirSenha || senha) && (senha.length < 8 || senha.length > 64)) {
    return { erro: "A senha deve ter entre 8 e 64 caracteres." };
  }

  return {
    dados: {
      nome,
      email,
      tipo,
      senha,
      ativo: body.ativo === false || body.ativo === 0 || body.ativo === "0" ? 0 : 1,
    },
  };
}

// Lista apenas contas internas. Contas de clientes não fazem parte deste painel.
router.get("/", async (req, res) => {
  try {
    const busca = String(req.query.busca || "").trim().slice(0, 120);
    const perfil = String(req.query.perfil || "").trim();
    const ativo = String(req.query.ativo ?? "").trim();

    let sql = `
      SELECT id, nome, email, tipo, ativo, data_cadastro
      FROM usuarios
      WHERE tipo IN ('admin', 'atendente', 'cozinha', 'entregador')
    `;
    const parametros = [];

    if (busca) {
      sql += " AND (nome LIKE ? OR email LIKE ?)";
      parametros.push(`%${busca}%`, `%${busca}%`);
    }
    if (perfil && PERFIS.has(perfil)) {
      sql += " AND tipo = ?";
      parametros.push(perfil);
    }
    if (ativo === "true" || ativo === "false") {
      sql += " AND ativo = ?";
      parametros.push(ativo === "true" ? 1 : 0);
    }

    sql += " ORDER BY nome ASC, id ASC";
    const [usuarios] = await db.execute(sql, parametros);
    return res.json({ usuarios });
  } catch (erro) {
    console.error("[Admin Usuários] Erro ao listar:", erro);
    return res.status(500).json({ mensagem: "Não foi possível carregar os usuários." });
  }
});

// Cria uma conta administrativa com senha armazenada em Argon2id.
router.post("/", async (req, res) => {
  try {
    const validacao = validarDados(req.body || {}, true);
    if (validacao.erro) return res.status(400).json({ mensagem: validacao.erro });

    const { nome, email, tipo, senha, ativo } = validacao.dados;
    const [existente] = await db.execute("SELECT id FROM usuarios WHERE email = ? LIMIT 1", [email]);
    if (existente.length) {
      return res.status(409).json({ mensagem: "Este e-mail já está cadastrado." });
    }

    const hash = await argon2.hash(senha, { type: argon2.argon2id });
    const [resultado] = await db.execute(
      "INSERT INTO usuarios (nome, email, senha, tipo, ativo) VALUES (?, ?, ?, ?, ?)",
      [nome, email, hash, tipo, ativo],
    );

    return res.status(201).json({
      mensagem: "Usuário criado com sucesso.",
      usuario: { id: resultado.insertId, nome, email, tipo, ativo },
    });
  } catch (erro) {
    console.error("[Admin Usuários] Erro ao criar:", erro);
    if (erro.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ mensagem: "Este e-mail já está cadastrado." });
    }
    return res.status(500).json({ mensagem: "Não foi possível criar o usuário." });
  }
});

// Atualiza dados e, opcionalmente, redefine a senha.
router.put("/:id", async (req, res) => {
  const id = validarId(req.params.id);
  if (!id) return res.status(400).json({ mensagem: "ID de usuário inválido." });

  try {
    const validacao = validarDados(req.body || {}, false);
    if (validacao.erro) return res.status(400).json({ mensagem: validacao.erro });

    const { nome, email, tipo, senha, ativo } = validacao.dados;
    const [encontrados] = await db.execute(
      "SELECT id, tipo, ativo FROM usuarios WHERE id = ? AND tipo <> 'cliente' LIMIT 1",
      [id],
    );
    if (!encontrados.length) {
      return res.status(404).json({ mensagem: "Usuário administrativo não encontrado." });
    }

    const atual = encontrados[0];
    if (id === Number(req.usuario.id) && (tipo !== "admin" || !ativo)) {
      return res.status(400).json({ mensagem: "Você não pode remover ou desativar seu próprio acesso de administrador." });
    }

    if (atual.tipo === "admin" && (tipo !== "admin" || !ativo) && atual.ativo) {
      const [[contagem]] = await db.execute(
        "SELECT COUNT(*) AS total FROM usuarios WHERE tipo = 'admin' AND ativo = 1",
      );
      if (Number(contagem.total) <= 1) {
        return res.status(409).json({ mensagem: "Mantenha pelo menos um administrador ativo no sistema." });
      }
    }

    const [duplicado] = await db.execute(
      "SELECT id FROM usuarios WHERE email = ? AND id <> ? LIMIT 1",
      [email, id],
    );
    if (duplicado.length) {
      return res.status(409).json({ mensagem: "Este e-mail já pertence a outro usuário." });
    }

    if (senha) {
      const hash = await argon2.hash(senha, { type: argon2.argon2id });
      await db.execute(
        "UPDATE usuarios SET nome = ?, email = ?, tipo = ?, ativo = ?, senha = ? WHERE id = ?",
        [nome, email, tipo, ativo, hash, id],
      );
    } else {
      await db.execute(
        "UPDATE usuarios SET nome = ?, email = ?, tipo = ?, ativo = ? WHERE id = ?",
        [nome, email, tipo, ativo, id],
      );
    }

    return res.json({ mensagem: "Usuário atualizado com sucesso." });
  } catch (erro) {
    console.error("[Admin Usuários] Erro ao atualizar:", erro);
    if (erro.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ mensagem: "Este e-mail já pertence a outro usuário." });
    }
    return res.status(500).json({ mensagem: "Não foi possível atualizar o usuário." });
  }
});

module.exports = router;
