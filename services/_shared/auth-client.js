"use strict";

const AUTH_BASE_URL = `http://127.0.0.1:${Number(process.env.AUTH_PORT || 4001)}`;

async function requisitarAuth(caminho) {
  const segredo = process.env.INTERNAL_SERVICE_SECRET;
  if (!segredo) throw new Error("INTERNAL_SERVICE_SECRET não configurada.");
  const resposta = await fetch(`${AUTH_BASE_URL}${caminho}`, {
    headers: { "x-internal-service-secret": segredo, accept: "application/json" },
    signal: AbortSignal.timeout(4000),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const erro = new Error(dados.mensagem || "Falha ao consultar o serviço Auth.");
    erro.statusCode = resposta.status;
    throw erro;
  }
  return dados;
}

async function consultarUsuarios(ids) {
  const unicos = [...new Set((ids || []).map(Number))].filter((id) => Number.isSafeInteger(id) && id > 0);
  if (!unicos.length) return [];
  if (unicos.length > 100) throw new Error("A consulta de usuários aceita no máximo 100 IDs.");
  const dados = await requisitarAuth(`/internal/users?ids=${encodeURIComponent(unicos.join(","))}`);
  return Array.isArray(dados.usuarios) ? dados.usuarios : [];
}

async function contarUsuarios(tipo, ativo = null) {
  const query = new URLSearchParams({ tipo });
  if (ativo !== null) query.set("ativo", String(ativo));
  const dados = await requisitarAuth(`/internal/users/count?${query.toString()}`);
  return Number(dados.total || 0);
}

async function atualizarPerfilUsuario(id, perfil) {
  const usuarioId = Number(id);
  if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) throw new Error("ID de usuário inválido.");
  const segredo = process.env.INTERNAL_SERVICE_SECRET;
  if (!segredo) throw new Error("INTERNAL_SERVICE_SECRET não configurada.");
  const resposta = await fetch(`${AUTH_BASE_URL}/internal/users/${usuarioId}/profile`, {
    method: "PATCH",
    headers: { "x-internal-service-secret": segredo, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(perfil),
    signal: AbortSignal.timeout(4000),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const erro = new Error(dados.mensagem || "Falha ao atualizar perfil no serviço Auth.");
    erro.statusCode = resposta.status;
    throw erro;
  }
  return dados.usuario;
}

module.exports = { consultarUsuarios, contarUsuarios, atualizarPerfilUsuario };
