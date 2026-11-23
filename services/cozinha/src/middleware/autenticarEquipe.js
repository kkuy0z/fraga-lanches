"use strict";

const jwt = require("jsonwebtoken");

function lerCookie(req, nome) {
  const cookies = req.headers.cookie || "";

  const cookie = cookies
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${nome}=`));

  if (!cookie) return null;

  return decodeURIComponent(cookie.substring(nome.length + 1));
}

function autenticarEquipe(req, res, next) {
  const token = lerCookie(req, "fraga_session");

  if (!token) {
    return res.status(401).json({
      mensagem: "Você precisa fazer login.",
    });
  }

  try {
    const usuario = jwt.verify(token, process.env.JWT_SECRET);

    if (!["admin", "atendente"].includes(usuario.tipo)) {
      return res.status(403).json({
        mensagem: "Acesso permitido somente para administradores e atendentes.",
      });
    }

    req.usuario = usuario;

    return next();
  } catch (erro) {
    return res.status(401).json({
      mensagem: "Sessão inválida ou expirada.",
    });
  }
}

module.exports = autenticarEquipe;
