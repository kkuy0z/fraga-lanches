const express = require("express");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const db = require("../database");

const router = express.Router();

const COOKIE_NAME = "fraga_session";
const JWT_SECRET = process.env.JWT_SECRET;

function lerCookie(req, nome) {
    const cookies = req.headers.cookie || "";

    for (const item of cookies.split(";")) {
        const partes = item.trim().split("=");

        if (partes.shift() === nome) {
            return decodeURIComponent(partes.join("="));
        }
    }

    return null;
}

function configurarCookie(res, token, lembrar = false) {
    const opcoes = [
        `${COOKIE_NAME}=${encodeURIComponent(token)}`,
        "HttpOnly",
        "SameSite=Lax",
        "Path=/"
    ];

    if (process.env.NODE_ENV === "production") {
        opcoes.push("Secure");
    }

    if (lembrar) {
        opcoes.push(`Max-Age=${30 * 24 * 60 * 60}`);
    }

    res.setHeader("Set-Cookie", opcoes.join("; "));
}

function autenticar(req, res, next) {
    const token = lerCookie(req, COOKIE_NAME);

    if (!token) {
        return res.status(401).json({
            mensagem: "Você precisa entrar na sua conta."
        });
    }

    try {
        req.usuario = jwt.verify(token, JWT_SECRET);
        next();
    } catch (erro) {
        return res.status(401).json({
            mensagem: "Sessão inválida ou expirada."
        });
    }
}

// CADASTRO
router.post("/cadastro", async (req, res) => {
    try {
        const { nome, email, telefone, senha } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({
                mensagem: "Preencha todos os campos obrigatórios."
            });
        }

        const nomeLimpo = String(nome).trim();
        const emailLimpo = String(email).trim().toLowerCase();
        const telefoneLimpo = telefone
            ? String(telefone).trim()
            : null;

        if (nomeLimpo.length < 2 || nomeLimpo.length > 100) {
            return res.status(400).json({
                mensagem: "Informe um nome válido."
            });
        }

        const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo);

        if (!emailValido || emailLimpo.length > 120) {
            return res.status(400).json({
                mensagem: "Informe um e-mail válido."
            });
        }

        if (String(senha).length < 8 || String(senha).length > 64) {
            return res.status(400).json({
                mensagem: "A senha deve ter entre 8 e 64 caracteres."
            });
        }

        const [usuarios] = await db.execute(
            "SELECT id FROM usuarios WHERE email = ? LIMIT 1",
            [emailLimpo]
        );

        if (usuarios.length > 0) {
            return res.status(409).json({
                mensagem: "Este e-mail já está cadastrado."
            });
        }

        const senhaHash = await argon2.hash(String(senha), {
            type: argon2.argon2id
        });

        await db.execute(
            `INSERT INTO usuarios
            (nome, email, telefone, senha, tipo, ativo)
            VALUES (?, ?, ?, ?, 'cliente', TRUE)`,
            [nomeLimpo, emailLimpo, telefoneLimpo, senhaHash]
        );

        return res.status(201).json({
            mensagem: "Cadastro realizado com sucesso."
        });

    } catch (erro) {
        console.error("Erro no cadastro:", erro);

        if (erro.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                mensagem: "Este e-mail já está cadastrado."
            });
        }

        return res.status(500).json({
            mensagem: "Não foi possível realizar o cadastro."
        });
    }
});

// LOGIN
router.post("/login", async (req, res) => {
    try {
        const { email, senha, lembrar } = req.body;

        if (!email || !senha) {
            return res.status(400).json({
                mensagem: "Informe seu e-mail e sua senha."
            });
        }

        const emailLimpo = String(email).trim().toLowerCase();

        const [usuarios] = await db.execute(
            `SELECT id, nome, email, senha, tipo, ativo
             FROM usuarios
             WHERE email = ?
             LIMIT 1`,
            [emailLimpo]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({
                mensagem: "E-mail ou senha incorretos."
            });
        }

        const usuario = usuarios[0];

        if (!usuario.ativo) {
            return res.status(403).json({
                mensagem: "Esta conta está desativada."
            });
        }

        const senhaCorreta = await argon2.verify(
            usuario.senha,
            String(senha)
        );

        if (!senhaCorreta) {
            return res.status(401).json({
                mensagem: "E-mail ou senha incorretos."
            });
        }

        const payload = {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            tipo: usuario.tipo
        };

        const token = jwt.sign(
            payload,
            JWT_SECRET,
            {
                expiresIn: lembrar ? "30d" : "1d"
            }
        );

        configurarCookie(res, token, Boolean(lembrar));

        return res.status(200).json({
            mensagem: "Login realizado com sucesso.",
            usuario: payload
        });

    } catch (erro) {
        console.error("Erro no login:", erro);

        return res.status(500).json({
            mensagem: "Não foi possível realizar o login."
        });
    }
});

// USUÁRIO DA SESSÃO
router.get("/me", autenticar, (req, res) => {
    return res.json({
        usuario: req.usuario
    });
});

// ENCERRAR SESSÃO
router.post("/logout", (req, res) => {
    const opcoes = [
        `${COOKIE_NAME}=`,
        "HttpOnly",
        "SameSite=Lax",
        "Path=/",
        "Max-Age=0"
    ];

    if (process.env.NODE_ENV === "production") {
        opcoes.push("Secure");
    }

    res.setHeader("Set-Cookie", opcoes.join("; "));

    return res.json({
        mensagem: "Sessão encerrada."
    });
});

router.autenticar = autenticar;
router.configurarCookie = configurarCookie;

module.exports = router;