const formCadastro = document.getElementById("form-cadastro");

if (formCadastro) {
    formCadastro.addEventListener("submit", async (event) => {
        event.preventDefault();

        limparErros();

        const nome = formCadastro.elements.namedItem("nome").value.trim();
        const email = formCadastro.elements.namedItem("email").value.trim();
        const telefone = formCadastro.elements.namedItem("telefone").value.trim();
        const senha = formCadastro.elements.namedItem("senha").value;
        const confirmar = formCadastro.elements.namedItem("confirmarSenha").value;
        const termos = formCadastro.elements.namedItem("termos").checked;

        let valido = true;

        if (nome.length < 2) {
            mostrarErro("erro-nome", "Informe seu nome.");
            valido = false;
        }

        if (!email) {
            mostrarErro("erro-email", "Informe seu e-mail.");
            valido = false;
        }

        if (senha.length < 8 || senha.length > 64) {
            mostrarErro("erro-senha", "A senha deve ter entre 8 e 64 caracteres.");
            valido = false;
        }

        if (senha !== confirmar) {
            mostrarErro("erro-confirmar", "As senhas não são iguais.");
            valido = false;
        }

        if (!termos) {
            mostrarErro("erro-termos", "Você precisa aceitar os termos.");
            valido = false;
        }

        if (!valido) return;

        const botao = formCadastro.querySelector('[type="submit"]');
        botao.disabled = true;

        try {
            const resposta = await fetch("/api/auth/cadastro", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    nome,
                    email,
                    telefone,
                    senha
                })
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                mostrarErro("erro-email", dados.mensagem || "Erro ao realizar cadastro.");
                return;
            }

            const sucesso = document.getElementById("sucesso");

            if (sucesso) {
                sucesso.textContent = dados.mensagem;
                sucesso.classList.remove("hidden");
            }

            formCadastro.reset();

            setTimeout(() => {
                window.location.href = "/cadastro/login.html";
            }, 1500);

        } catch (erro) {
            mostrarErro("erro-email", "Não foi possível conectar ao servidor.");
        } finally {
            botao.disabled = false;
        }
    });
}

function mostrarErro(id, mensagem) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = mensagem;
        elemento.classList.remove("hidden");
    }
}

function limparErros() {
    const ids = [
        "erro-nome",
        "erro-email",
        "erro-telefone",
        "erro-senha",
        "erro-confirmar",
        "erro-termos"
    ];

    ids.forEach((id) => {
        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.textContent = "";
            elemento.classList.add("hidden");
        }
    });

    const sucesso = document.getElementById("sucesso");

    if (sucesso) {
        sucesso.classList.add("hidden");
    }
}
