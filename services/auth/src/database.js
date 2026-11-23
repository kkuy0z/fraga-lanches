"use strict";

const path = require("path");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");

dotenv.config({
  path: path.resolve(__dirname, "../../../backend/.env"),
});

const obrigatorias = ["DB_HOST", "DB_USER", "DB_PASSWORD", "JWT_SECRET"];

for (const variavel of obrigatorias) {
  if (!process.env[variavel]) {
    throw new Error(`Variável ${variavel} não configurada.`);
  }
}

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "fraga_db",
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

module.exports = db;
