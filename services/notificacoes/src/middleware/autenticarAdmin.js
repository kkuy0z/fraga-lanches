
const jwt = require("jsonwebtoken");

function lerCookie(req, nome) {
    const cookies = req.headers.cookie || "";

    const cookie = cookies
        .split(";")
        .map(item => item.trim())
        .find(item => item.startsWith(`${nome}=`));

    if (!cookie) return null;

    return decodeURIComponent(
        cookie.substring(nome.length + 1)
    );
}

function autenticarAdmin(req, res, next) {
    const token = lerCookie(req, "fraga_session");

    if (!token) {
        return res.status(401).json({
            mensagem: "Você precisa fazer login."
        });
    }

    try {
        const usuario = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (usuario.tipo !== "admin") {
            return res.status(403).json({
                mensagem: "Acesso permitido somente para administradores."
            });
        }

        req.usuario = usuario;

        next();

    } catch (erro) {
        return res.status(401).json({
            mensagem: "Sessão inválida ou expirada."
        });
    }
}

module.exports = autenticarAdmin;
