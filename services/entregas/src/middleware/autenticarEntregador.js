"use strict";

const jwt = require("jsonwebtoken");

function autenticarEntregador(req, res, next) {
  try {
    const cookies = req.headers.cookie || "";

    const cookie = cookies
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith("fraga_session="));

    if (!cookie) {
      return res.status(401).json({
        mensagem: "Sessão não encontrada.",
      });
    }

    const token = decodeURIComponent(cookie.substring("fraga_session=".length));

    const usuario = jwt.verify(token, process.env.JWT_SECRET);

    if (!usuario || usuario.tipo !== "entregador") {
      return res.status(403).json({
        mensagem: "Acesso permitido somente para entregadores.",
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

module.exports = autenticarEntregador;
