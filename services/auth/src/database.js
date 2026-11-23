"use strict";

const path = require("path");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");

// Todos os serviços leem a configuração central da raiz.
// O fallback DB_NAME mantém compatibilidade até a migração dos dados e queries.
dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
});

const obrigatorias = ["DB_HOST", "DB_USER", "DB_PASSWORD"];
for (const variavel of obrigatorias) {
  if (!process.env[variavel]) {
    throw new Error(`[auth] Variável ${variavel} não configurada no .env da raiz.`);
  }
}

const nomeBanco = process.env.DB_NAME_AUTH || process.env.DB_NAME || "fraga_db";

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: nomeBanco,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

module.exports = db;
