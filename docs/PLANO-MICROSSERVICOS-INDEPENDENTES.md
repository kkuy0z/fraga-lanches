# Plano de migração para microsserviços independentes

## Estado confirmado na main

- O Gateway encaminha as APIs para dez serviços e não abre conexão MySQL.
- Os dez serviços possuem processos/portas próprios.
- Os dez módulos `src/database.js` ainda usam `DB_NAME` (por padrão `fraga_db`): há pools separados, mas não há isolamento de persistência.
- O schema legado está em `backend/database/schema.sql`.
- O Gateway distribui eventos internos por HTTP em `/internal/events`; isso não é um broker durável.
- Há consultas SQL entre domínios. Portanto, trocar os nomes dos bancos antes de remover essas consultas causaria falhas.
- O callback de upgrade WebSocket do Gateway foi corrigido na main para ser assíncrono.

Este documento registra o desenho-alvo e a ordem segura de migração. Não declara a migração concluída.

## Propriedade de dados proposta

| Serviço | Dados que deve possuir | Observações |
|---|---|---|
| Auth | credenciais, identidade, tipo/estado da conta e sessões | Outros serviços recebem somente um identificador de usuário e claims mínimas; não consultam a tabela `usuarios`. |
| Clientes | endereços, carrinhos, itens do carrinho e preferências do cliente | Consulta catálogo pela API para validar preço/disponibilidade; carrinho guarda snapshots necessários. |
| Catálogo | categorias, produtos, adicionais, relações produto-adicional e formas de pagamento publicadas | Administração altera estes dados por APIs do Catálogo. |
| Pedidos | pedidos, itens do pedido, pagamentos, intenções PIX e histórico de status | Mantém snapshots de nome/preço/produto/endereço necessários ao histórico. Não usa FK para tabelas de outros serviços. |
| Entregas | entregas, atribuições, configurações de entrega, bairros e dados operacionais da entrega | Recebe eventos de pedido; consulta Pedidos por API quando precisar de dados atuais. |
| Cozinha | projeção/read model dos pedidos relevantes para produção | Não altera tabelas de Pedidos diretamente; recebe eventos e envia comandos/API para Pedidos. |
| Notificações | notificações, preferências e estado de leitura | Recebe eventos de domínio; não faz JOIN em Pedidos ou Entregas. |
| Avaliações | avaliações e moderação | Valida elegibilidade consultando Pedidos por API/evento; nome público vem de snapshot ou perfil autorizado. |
| Atendimento | chamados/conversas e atribuições de atendimento, caso persistidos | Para consultar/alterar pedido usa API de Pedidos; não lê tabelas de Pedidos ou Usuários. |
| Administração | sem cópia autoritativa de dados de outros domínios | Atua como BFF/painel administrativo, chamando APIs dos serviços proprietários. KPIs agregados usam projeções/eventos. |

## Regras de integridade entre serviços

1. IDs de outro domínio são referências externas, não chaves estrangeiras MySQL.
2. Cada serviço escreve somente no próprio banco.
3. Dados históricos de pedidos (itens, preços, endereço de entrega e identificação necessária) são snapshots imutáveis no contexto do pedido.
4. Operações que atravessam serviços usam APIs ou eventos; não usam JOIN entre bancos.
5. Fluxos distribuídos (pedido, pagamento PIX, cozinha e entrega) precisam de estados explícitos, idempotência, timeout, compensação e trilha de auditoria.
6. Eventos devem ter `event_id`, `event_type`, `aggregate_id`, `occurred_at`, `version` e payload versionado.
7. Publicação confiável deve usar Outbox transacional no banco do serviço produtor e consumidores idempotentes. RabbitMQ deve ter retry e dead-letter queue.
8. O Gateway não deve ser broker nem dono de regras de negócio.

## Dependências cruzadas já observadas na auditoria

- Auth, Clientes, Cozinha, Entregas, Atendimento, Pedidos e Avaliações consultam `usuarios`.
- Catálogo, Administração, Clientes e Pedidos consultam `produtos` e/ou `categorias`.
- Atendimento, Cozinha, Entregas, Notificações, Administração, Clientes e Avaliações consultam `pedidos`.
- Cozinha, Entregas, Atendimento e Clientes consultam `itens_pedido`.
- Pedidos e Administração consultam `pagamentos`; Pedidos também consulta `intencoes_pix`.
- Entregas e Notificações cruzam dados de `entregas` e `pedidos`.
- Avaliações faz JOIN com `usuarios` para dados de cliente/moderador.
- Pedidos grava notificações diretamente; isso deve virar evento consumido por Notificações.

A lista é um inventário inicial baseado nas consultas encontradas no código, não uma garantia de que não existam outras referências.

## Sequência de migração sem perda de dados

### Fase 0 — Congelar e inventariar
- Fazer backup verificável do banco e ensaiar restauração.
- Inventariar todas as tabelas, índices, FKs, triggers, procedures e volumes.
- Mapear toda query SQL e cada escrita por tabela, incluindo jobs e scripts.
- Registrar contratos HTTP existentes e consumidores frontend.
- Criar testes de caracterização dos fluxos críticos: cadastro/login, carrinho, checkout, PIX, cozinha, entrega, cancelamento, avaliações e administração.

### Fase 1 — Definir contratos e remover acoplamento
- Criar APIs internas versionadas para identidade/perfil, catálogo, pedidos, pagamentos e entregas.
- Trocar cada JOIN cruzado por chamada de API ou projeção local alimentada por evento.
- Remover escritas diretas de Pedidos para Notificações; publicar evento.
- Criar read models locais para telas que precisam de dados combinados.
- Manter o banco legado como fonte durante esta fase.

### Fase 2 — Eventos confiáveis
- Implementar Outbox e Inbox/idempotência em cada produtor/consumidor.
- Introduzir RabbitMQ com exchanges, filas por consumidor, retry limitado e DLQ.
- Garantir correlação de requisições/eventos e observabilidade.
- Testar indisponibilidade temporária, duplicidade e reprocessamento.

### Fase 3 — Separar persistência por domínio
- Criar bancos e credenciais MySQL exclusivos por serviço.
- Criar migrations versionadas por serviço.
- Copiar dados por domínio preservando IDs ou criando mapeamentos explícitos.
- Fazer sincronização incremental/dual-read controlado durante a transição; evitar dual-write sem Outbox.
- Validar contagens, somas financeiras, FKs internas e amostras antes do cutover.
- Fazer cutover gradual por serviço, com rollback documentado.
- Remover permissões de leitura/escrita no banco dos outros serviços.

### Fase 4 — Independência operacional
- Cada serviço com Dockerfile, health/readiness, shutdown gracioso, configuração própria e pipeline CI.
- Gateway e frontend implantáveis separadamente.
- Segredos e credenciais distintos por serviço, privilégios mínimos.
- Logs estruturados, métricas, tracing e alertas.
- Testes de contrato, integração, resiliência e recuperação de backup.

### Fase 5 — Desativar legado
- Confirmar ausência de tráfego e consultas ao schema legado.
- Arquivar o schema antigo e plano de rollback.
- Remover código, credenciais e dependências do monólito somente após janela de estabilidade.

## Critérios objetivos de conclusão

- Nenhum serviço acessa tabelas de outro serviço.
- Nenhum serviço compartilha credenciais ou schema de banco com outro.
- Nenhuma FK atravessa a fronteira de um serviço.
- Eventos críticos são duráveis, idempotentes e reprocessáveis.
- Serviços podem iniciar, parar, implantar e recuperar-se independentemente.
- Testes de contrato e fluxos ponta a ponta passam.
- Backups e restaurações por serviço foram testados.
- Nenhuma funcionalidade do frontend depende de endpoints removidos.

## Cuidados

Não executar migração destrutiva, apagar tabelas, renomear banco ou alterar FKs em produção antes de backup, inventário completo e plano de rollback testado. O banco atual contém relações que atravessam os domínios; a separação precisa ser incremental.
