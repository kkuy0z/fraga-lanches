"use strict";

/**
 * Autenticação centralizada: somente o serviço Auth valida JWT e consulta
 * o estado ativo da conta. Os demais serviços recebem apenas o perfil mínimo.
 */
function criarAutenticacao(tiposPermitidos = []) {
  const permitidos = Array.isArray(tiposPermitidos) ? tiposPermitidos : [];

  return async function autenticarViaAuth(req, res, next) {
    const cookie = req.headers.cookie;
    if (!cookie || !cookie.split(";").some((item) => item.trim().startsWith("fraga_session="))) {
      return res.status(401).json({ mensagem: "Você precisa fazer login." });
    }

    const segredo = process.env.INTERNAL_SERVICE_SECRET;
    if (!segredo) {
      console.error("[Auth compartilhado] INTERNAL_SERVICE_SECRET não configurada.");
      return res.status(503).json({ mensagem: "Autenticação temporariamente indisponível." });
    }

    try {
      const porta = Number(process.env.AUTH_PORT || 4001);
      const resposta = await fetch(`http://127.0.0.1:${porta}/internal/session`, {
        method: "GET",
        headers: {
          cookie,
          "x-internal-service-secret": segredo,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(4000),
      });

      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        const status = resposta.status === 401 || resposta.status === 403 ? resposta.status : 503;
        return res.status(status).json({
          mensagem: dados.mensagem || (status === 503 ? "Autenticação temporariamente indisponível." : "Sessão inválida ou expirada."),
        });
      }

      const usuario = dados.usuario;
      if (!usuario || !Number.isInteger(Number(usuario.id)) || !usuario.tipo) {
        return res.status(503).json({ mensagem: "Resposta inválida do serviço de autenticação." });
      }

      if (permitidos.length && !permitidos.includes(usuario.tipo)) {
        return res.status(403).json({ mensagem: "Você não tem permissão para realizar esta operação." });
      }

      req.usuario = usuario;
      return next();
    } catch (erro) {
      console.error("[Auth compartilhado] Falha ao consultar Auth:", erro.message);
      return res.status(503).json({ mensagem: "Serviço de autenticação indisponível." });
    }
  };
}

module.exports = criarAutenticacao;
