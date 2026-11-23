"use strict";

const jwt = require("jsonwebtoken");

const COOKIE_NAME = "fraga_session";
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("[Clientes] JWT_SECRET ausente ou inválido.");
}

function lerCookie(req, nome) {
  const cookies = req.headers.cookie || "";

  for (const item of cookies.split(";")) {
    const partes = item.trim().split("=");

    if (partes.shift() === nome) {
      try {
        return decodeURIComponent(partes.join("="));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function autenticar(req, res, next) {
  const token = lerCookie(req, COOKIE_NAME);

  if (!token) {
    return res.status(401).json({
      mensagem: "Você precisa entrar na sua conta.",
    });
  }

  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (erro) {
    return res.status(401).json({
      mensagem: "Sessão inválida ou expirada.",
    });
  }
}

module.exports = autenticar;
