
const TIPO_PERMITIDO = "cliente";

async function verificarAcesso() {
    try {
        const resposta = await fetch("/api/auth/me", {
            method: "GET",
            credentials: "same-origin"
        });

        if (resposta.status === 401) {
            window.location.href = "/cadastro/login.html";
            return;
        }

        if (!resposta.ok) {
            throw new Error("Erro ao verificar autenticação.");
        }

        const dados = await resposta.json();
        const usuario = dados.usuario;

        if (!usuario || usuario.tipo !== TIPO_PERMITIDO) {
            document.body.innerHTML = `
                <h2>Acesso não autorizado.</h2>
                <a href="/cadastro/login.html">Voltar ao login</a>
            `;
            return;
        }

        const nomeUsuario = document.getElementById("nome-usuario");

        if (nomeUsuario) {
            nomeUsuario.textContent = usuario.nome;
        }

    } catch (erro) {
        console.error("Erro ao verificar acesso:", erro);

        document.body.innerHTML = `
            <h2>Não foi possível conectar ao servidor.</h2>
            <button onclick="location.reload()">Tentar novamente</button>
        `;
    }
}

const botaoSair = document.getElementById("btn-sair");

if (botaoSair) {
    botaoSair.addEventListener("click", async () => {
        botaoSair.disabled = true;

        try {
            const resposta = await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "same-origin"
            });

            if (!resposta.ok) {
                throw new Error("Não foi possível encerrar a sessão.");
            }

            window.location.href = "/cadastro/login.html";

        } catch (erro) {
            console.error("Erro ao sair:", erro);
            botaoSair.disabled = false;
            alert("Não foi possível sair. Tente novamente.");
        }
    });
}

verificarAcesso();
