const TIPO_PERMITIDO = "cliente";

async function verificarAcesso() {
    try {
        const resposta = await fetch("/api/auth/me", {
            credentials: "same-origin"
        });

        if (!resposta.ok) {
            window.location.href = "/cadastro/login.html";
            return;
        }

        const dados = await resposta.json();
        const usuario = dados.usuario;

        if (usuario.tipo !== TIPO_PERMITIDO) {
            document.body.innerHTML = "<h2>Acesso nÃ£o autorizado.</h2>";
            return;
        }

        const nome = document.getElementById("nome-usuario");
        if (nome) nome.textContent = usuario.nome;

    } catch (erro) {
        console.error("Erro ao verificar acesso:", erro);
        document.body.innerHTML = "<h2>NÃ£o foi possÃ­vel conectar ao servidor.</h2>";
    }
}

document.getElementById("btn-sair").addEventListener("click", async () => {
    try {
        await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin"
        });
    } finally {
        window.location.href = "/cadastro/login.html";
    }
});

verificarAcesso();
