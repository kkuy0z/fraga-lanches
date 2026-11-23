# Fraga Lanches

Aplicacao organizada em microsservicos Node.js, com Gateway HTTP/WebSocket e frontend estatico.

## Arquitetura

| Componente | Porta | Responsabilidade |
|---|---:|---|
| Gateway | 3000 | Proxy reverso, frontend e WebSocket |
| Auth | 4001 | Cadastro, login e sessao |
| Catalogo | 4002 | Cardapio e formas de pagamento |
| Pedidos | 4003 | Pedidos, checkout, PIX e expiracao de intencoes |
| Entregas | 4004 | Entregas, atribuicoes e horarios |
| Cozinha | 4005 | Fluxo da cozinha |
| Notificacoes | 4006 | Notificacoes |
| Avaliacoes | 4007 | Avaliacoes de clientes e moderacao |
| Administracao | 4008 | Categorias, produtos, dashboard e formas de pagamento |
| Atendimento | 4009 | Painel e operacoes de atendimento |
| Clientes | 4010 | Carrinho, perfil e dashboard do cliente |

O frontend e servido pelo Gateway. As URLs publicas `/api/*` sao encaminhadas para o microsservico responsavel, preservando a compatibilidade com o frontend existente.

O Gateway nao acessa o MySQL nem executa regras de negocio. Cada microsservico possui seu proprio servidor Express e pool MySQL. Nesta versao, os servicos compartilham o mesmo banco MySQL; a separacao e feita por responsabilidade e processo, nao por bancos independentes.

Os eventos em tempo real sao publicados pelos microsservicos no endpoint interno autenticado do Gateway, que distribui os eventos via WebSocket.

## Requisitos

- Node.js 18 ou superior
- npm
- MySQL com o schema do projeto aplicado

## Configuracao local

1. Crie o arquivo de ambiente na raiz:

   ```cmd
   copy .env.example .env
   ```

2. Edite o arquivo `.env` e informe os dados do MySQL. Gere valores fortes e diferentes para `JWT_SECRET` e `INTERNAL_SERVICE_SECRET`. Nunca envie esse arquivo ao GitHub.

3. Instale as dependencias do Gateway e dos microsservicos:

   ```cmd
   npm install --prefix backend
   npm install --prefix services/auth
   npm install --prefix services/catalogo
   npm install --prefix services/pedidos
   npm install --prefix services/entregas
   npm install --prefix services/cozinha
   npm install --prefix services/notificacoes
   npm install --prefix services/avaliacoes
   npm install --prefix services/administracao
   npm install --prefix services/atendimento
   npm install --prefix services/clientes
   ```

4. Aplique o schema MySQL localizado em `backend/database/schema.sql`.

5. Na raiz do projeto, inicie todos os processos:

   ```cmd
   npm start
   ```

O inicializador sobe os dez microsservicos e o Gateway, aguardando cada porta ficar disponivel. Use `Ctrl+C` para encerrar os processos que ele iniciou.

## Verificacao

- Gateway: http://localhost:3000
- Diagnostico agregado: http://localhost:3000/api/status
- Health individual: `http://localhost:PORTA/health` para cada microsservico.

O endpoint agregado retorna HTTP 200 quando todos os servicos estao online e HTTP 503 quando algum esta indisponivel.

## Estrutura

- `frontend/`: telas, estilos e scripts do navegador.
- `backend/src/server.js`: Gateway HTTP/WebSocket.
- `services/<servico>/src/`: implementacao isolada de cada microsservico.
- `scripts/iniciar-servicos.js`: inicializador dos processos.
- `backend/database/schema.sql`: schema MySQL.

## Seguranca

- Arquivos `.env` e dependencias `node_modules` sao ignorados pelo Git.
- O endpoint `/internal/events` exige `INTERNAL_SERVICE_SECRET`.
- O WebSocket valida o JWT assinado pelo servico Auth.
- Credenciais que ja tenham sido publicadas devem ser rotacionadas; apagar um arquivo da branch atual nao remove valores de commits antigos.
