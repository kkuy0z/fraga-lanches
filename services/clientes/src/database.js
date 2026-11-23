"use strict";

const path = require("path");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const obrigatorias = ["DB_HOST", "DB_USER", "DB_PASSWORD"];
for (const variavel of obrigatorias) {
  if (!process.env[variavel]) throw new Error(`[clientes] Variável ${variavel} não configurada no .env da raiz.`);
}

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME_CLIENTES || process.env.DB_NAME || "fraga_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = db;
