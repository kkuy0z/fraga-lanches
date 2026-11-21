
CREATE DATABASE fraga_db;
USE fraga_db;

-- ======================================================
-- USUÁRIOS
-- ======================================================

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    telefone VARCHAR(20),
    senha VARCHAR(255) NOT NULL,
    tipo ENUM('admin', 'atendente', 'cozinha', 'entregador', 'cliente')
        DEFAULT 'cliente',
    ativo BOOLEAN DEFAULT TRUE,
    data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ======================================================
-- ENDEREÇOS
-- ======================================================

CREATE TABLE enderecos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    rua VARCHAR(150) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    complemento VARCHAR(100),
    origem ENUM('perfil', 'pedido') NOT NULL DEFAULT 'perfil',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,

    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- ======================================================
-- CATEGORIAS
-- ======================================================

CREATE TABLE categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    ativo BOOLEAN DEFAULT TRUE
);

-- ======================================================
-- PRODUTOS
-- ======================================================

CREATE TABLE produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    categoria_id INT NOT NULL,
    nome VARCHAR(120) NOT NULL,
    descricao TEXT,
    imagem VARCHAR(255),
    preco DECIMAL(10,2) NOT NULL,
    disponivel BOOLEAN DEFAULT TRUE,

    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

-- ======================================================
-- ADICIONAIS
-- ======================================================

CREATE TABLE adicionais (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    preco DECIMAL(10,2) NOT NULL,
    disponivel BOOLEAN DEFAULT TRUE
);

-- ======================================================
-- ADICIONAIS DISPONÍVEIS POR PRODUTO
-- ======================================================

CREATE TABLE produto_adicionais (
    produto_id INT NOT NULL,
    adicional_id INT NOT NULL,

    PRIMARY KEY (produto_id, adicional_id),

    FOREIGN KEY (produto_id) REFERENCES produtos(id),
    FOREIGN KEY (adicional_id) REFERENCES adicionais(id)
);

-- ======================================================
-- PEDIDOS
-- ======================================================

CREATE TABLE pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    endereco_id INT,
    data_pedido DATETIME DEFAULT CURRENT_TIMESTAMP,

    status ENUM(
        'novo',
        'em_preparo',
        'pronto',
        'saiu_para_entrega',
        'concluido',
        'cancelado'
    ) DEFAULT 'novo',

    tipo_entrega ENUM('entrega', 'retirada') DEFAULT 'entrega',
    subtotal DECIMAL(10,2) NOT NULL,
    taxa_entrega DECIMAL(10,2) DEFAULT 0,
    desconto DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    observacoes TEXT,

    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (endereco_id) REFERENCES enderecos(id)
);

-- ======================================================
-- ITENS DO PEDIDO
-- ======================================================

CREATE TABLE itens_pedido (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    produto_id INT,
    nome_produto VARCHAR(120) NOT NULL,
    quantidade INT NOT NULL,
    preco_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    personalizacao TEXT,

    FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

-- ======================================================
-- PAGAMENTOS
-- ======================================================

CREATE TABLE pagamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,

    forma_pagamento ENUM(
        'pix',
        'cartao',
        'dinheiro',
        'credito',
        'debito',
        'boleto',
        'outro'
    ) NOT NULL,

    tipo_cartao ENUM(
        'debito',
        'credito',
        'vale_refeicao'
    ) NULL,

    valor DECIMAL(10,2) NOT NULL,

    status ENUM(
        'pendente',
        'aprovado',
        'recusado',
        'cancelado'
    ) DEFAULT 'pendente',

    codigo_transacao VARCHAR(150),
    data_pagamento DATETIME,

    FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
);

-- ======================================================
-- ENTREGAS
-- ======================================================

CREATE TABLE entregas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL UNIQUE,
    entregador_id INT,

    status ENUM(
        'pendente',
        'atribuida',
        'em_andamento',
        'entregue'
    ) DEFAULT 'pendente',

    data_saida DATETIME,
    data_entrega DATETIME,

    FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY (entregador_id) REFERENCES usuarios(id)
);

-- ======================================================
-- HISTÓRICO DOS PEDIDOS
-- ======================================================

CREATE TABLE historico_pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    usuario_id INT,
    status_anterior VARCHAR(30),
    status_novo VARCHAR(30) NOT NULL,
    data_alteracao DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- ======================================================
-- AVALIAÇÕES
-- ======================================================

CREATE TABLE avaliacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL UNIQUE,
    usuario_id INT NOT NULL,
    nota INT NOT NULL,
    comentario TEXT,
    data_avaliacao DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- ======================================================
-- CARRINHOS
-- ======================================================

CREATE TABLE carrinhos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL UNIQUE,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE
);

-- ======================================================
-- ITENS DO CARRINHO
-- ======================================================

CREATE TABLE itens_carrinho (
    id INT AUTO_INCREMENT PRIMARY KEY,
    carrinho_id INT NOT NULL,
    produto_id INT NOT NULL,
    quantidade INT NOT NULL DEFAULT 1,

    FOREIGN KEY (carrinho_id)
        REFERENCES carrinhos(id)
        ON DELETE CASCADE,

    FOREIGN KEY (produto_id)
        REFERENCES produtos(id),

    UNIQUE (carrinho_id, produto_id)
);

-- ======================================================
-- ADICIONAIS DOS ITENS DO CARRINHO
-- ======================================================

CREATE TABLE item_carrinho_adicionais (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_carrinho_id INT NOT NULL,
    adicional_id INT,
    nome_adicional VARCHAR(100) NOT NULL,
    preco DECIMAL(10,2) NOT NULL,

    FOREIGN KEY (item_carrinho_id)
        REFERENCES itens_carrinho(id)
        ON DELETE CASCADE,

    FOREIGN KEY (adicional_id)
        REFERENCES adicionais(id)
        ON DELETE SET NULL
);

-- ======================================================
-- HORÁRIOS DE FUNCIONAMENTO
-- ======================================================

CREATE TABLE horarios_funcionamento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dia_semana TINYINT NOT NULL,
    horario_abertura TIME NOT NULL,
    horario_fechamento TIME NOT NULL,
    ativo BOOLEAN DEFAULT TRUE
);

-- ======================================================
-- FORMAS DE PAGAMENTO
-- ======================================================

CREATE TABLE formas_pagamento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,

    tipo ENUM(
        'dinheiro',
        'credito',
        'debito',
        'pix',
        'boleto',
        'outro'
    ) NOT NULL,

    taxa_percentual DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    prazo_recebimento INT UNSIGNED NOT NULL DEFAULT 0,
    ordem_exibicao INT NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    online BOOLEAN NOT NULL DEFAULT FALSE,

    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

-- ======================================================
-- CONFIGURAÇÕES DE ENTREGA
-- ======================================================

CREATE TABLE configuracoes_entrega (
    id INT PRIMARY KEY,
    taxa_padrao DECIMAL(10,2) NOT NULL DEFAULT 6.00,
    valor_minimo DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tempo_medio_minutos SMALLINT UNSIGNED NOT NULL DEFAULT 40,

    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO configuracoes_entrega (
    id,
    taxa_padrao,
    valor_minimo,
    tempo_medio_minutos
)
VALUES (1, 6.00, 0.00, 40.00);

-- ======================================================
-- TAXAS POR BAIRRO
-- ======================================================

CREATE TABLE bairros_entrega (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    taxa_final DECIMAL(10,2) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,

    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_bairros_entrega_nome (nome)
);

-- ======================================================
-- ÍNDICES
-- ======================================================

CREATE INDEX idx_formas_pagamento_ativo
    ON formas_pagamento(ativo);

CREATE INDEX idx_formas_pagamento_ordem
    ON formas_pagamento(ordem_exibicao);

CREATE INDEX idx_pedidos_usuario
    ON pedidos(usuario_id);

CREATE INDEX idx_pedidos_status
    ON pedidos(status);

CREATE INDEX idx_produtos_categoria
    ON produtos(categoria_id);

CREATE INDEX idx_entregas_entregador
    ON entregas(entregador_id);

-- ======================================================
-- FIM DO BANCO DE DADOS
-- ======================================================
