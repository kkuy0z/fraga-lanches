
const dotenv = require("dotenv");
const path = require("path");
const readline = require("readline/promises");
const argon2 = require("argon2");

dotenv.config({
    path: path.resolve(__dirname, "../.env")
});

const db = require("./database");

async function criarAdministrador() {
    const terminal = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        console.log("\n=== PRIMEIRO ADMINISTRADOR ===\n");

        const [administradores] = await db.execute(
            "SELECT id FROM usuarios WHERE tipo = 'admin' LIMIT 1"
        );

        if (administradores.length > 0) {
            console.log("Já existe um administrador cadastrado.");
            return;
        }

        const nome = (await terminal.question("Nome: ")).trim();
        const email = (await terminal.question("E-mail: "))
            .trim()
            .toLowerCase();

        const senha = await terminal.question("Senha: ");

        if (nome.length < 2 || nome.length > 100) {
            throw new Error("Nome inválido.");
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error("E-mail inválido.");
        }

        if (senha.length < 8 || senha.length > 64) {
            throw new Error("A senha deve ter entre 8 e 64 caracteres.");
        }

        const [usuarios] = await db.execute(
            "SELECT id FROM usuarios WHERE email = ? LIMIT 1",
            [email]
        );

        if (usuarios.length > 0) {
            throw new Error("Este e-mail já está cadastrado.");
        }

        const senhaHash = await argon2.hash(senha, {
            type: argon2.argon2id
        });

        await db.execute(
            `INSERT INTO usuarios
            (nome, email, senha, tipo, ativo)
            VALUES (?, ?, ?, 'admin', TRUE)`,
            [nome, email, senhaHash]
        );

        console.log("\nAdministrador criado com sucesso!");
        console.log("Acesse: http://localhost:3000/admin/admin-login.html");

    } catch (erro) {
        console.error("\nErro:", erro.message);
    } finally {
        terminal.close();
        await db.end();
    }
}

criarAdministrador();
