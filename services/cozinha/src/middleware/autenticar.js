"use strict";

const jwt = require("jsonwebtoken");

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

function autenticar(req, res, next) {
  const token = lerCookie(req, "fraga_session");

  if (!token) {
    return res.status(401).json({
      mensagem: "Você precisa fazer login.",
    });
  }

  try {
    const usuario = jwt.verify(token, process.env.JWT_SECRET);

    if (!usuario || !usuario.id || !usuario.tipo) {
      return res.status(401).json({
        mensagem: "Sessão inválida.",
      });
    }

    req.usuario = usuario;

    next();
  } catch (erro) {
    return res.status(401).json({
      mensagem: "Sessão inválida ou expirada.",
    });
  }
}

module.exports = autenticar;
