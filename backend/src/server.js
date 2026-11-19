const express = require("express");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
    path: path.resolve(__dirname, "../.env")
});

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error("ERRO: JWT_SECRET precisa ter pelo menos 32 caracteres.");
    process.exit(1);
}

const db = require("./database");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 3000;

const frontendPath = path.resolve(__dirname, "../../frontend");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/api/auth", authRoutes);

app.get("/api/status", async (req, res) => {
    try {
        await db.query("SELECT 1");

        res.json({
            servidor: "online",
            banco: "conectado"
        });
    } catch (erro) {
        console.error("Erro de conexão com MySQL:", erro);

        res.status(500).json({
            servidor: "online",
            banco: "desconectado"
        });
    }
});

app.use(express.static(frontendPath));

app.get("/", (req, res) => {
    res.sendFile(path.join(frontendPath, "inicio.html"));
});

app.listen(PORT, () => {
    console.log(`Fraga Lanches rodando em http://localhost:${PORT}`);
});