
-- =========================================================
-- FRAGA LANCHES
-- BANCO DE DADOS COMPLETO
-- =========================================================

CREATE DATABASE IF NOT EXISTS fraga_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE fraga_db;

-- =========================================================
-- 1. USUÁRIOS
-- =========================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    telefone VARCHAR(20),
    senha VARCHAR(255) NOT NULL,
    tipo ENUM(
        'admin',
        'atendente',
        'cozinha',
        'entregador',
        'cliente'
    ) DEFAULT 'cliente',
    ativo BOOLEAN DEFAULT TRUE,
    data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =========================================================
-- 2. ENDEREÇOS
-- =========================================================

CREATE TABLE IF NOT EXISTS enderecos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    rua VARCHAR(150) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    complemento VARCHAR(100),

    CONSTRAINT fk_enderecos_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- =========================================================
-- 3. CATEGORIAS
-- =========================================================

CREATE TABLE IF NOT EXISTS categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    ativo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

-- =========================================================
-- 4. PRODUTOS
-- =========================================================

CREATE TABLE IF NOT EXISTS produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    categoria_id INT NOT NULL,
    nome VARCHAR(120) NOT NULL,
    descricao TEXT,
    imagem VARCHAR(255),
    preco DECIMAL(10,2) NOT NULL,
    disponivel BOOLEAN DEFAULT TRUE,

    CONSTRAINT fk_produtos_categoria
        FOREIGN KEY (categoria_id)
        REFERENCES categorias(id)
) ENGINE=InnoDB;

-- =========================================================
-- 5. ADICIONAIS
-- =========================================================

CREATE TABLE IF NOT EXISTS adicionais (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    preco DECIMAL(10,2) NOT NULL,
    disponivel BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

-- =========================================================
-- 6. ADICIONAIS DISPONÍVEIS POR PRODUTO
-- =========================================================

CREATE TABLE IF NOT EXISTS produto_adicionais (
    produto_id INT NOT NULL,
    adicional_id INT NOT NULL,

    PRIMARY KEY (produto_id, adicional_id),

    CONSTRAINT fk_produto_adicionais_produto
        FOREIGN KEY (produto_id)
        REFERENCES produtos(id),

    CONSTRAINT fk_produto_adicionais_adicional
        FOREIGN KEY (adicional_id)
        REFERENCES adicionais(id)
) ENGINE=InnoDB;

-- =========================================================
-- 7. PEDIDOS
-- =========================================================

CREATE TABLE IF NOT EXISTS pedidos (
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

    tipo_entrega ENUM(
        'entrega',
        'retirada'
    ) DEFAULT 'entrega',

    subtotal DECIMAL(10,2) NOT NULL,
    taxa_entrega DECIMAL(10,2) DEFAULT 0.00,
    desconto DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL,
    observacoes TEXT,

    CONSTRAINT fk_pedidos_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id),

    CONSTRAINT fk_pedidos_endereco
        FOREIGN KEY (endereco_id)
        REFERENCES enderecos(id)
) ENGINE=InnoDB;

-- =========================================================
-- 8. ITENS DO PEDIDO
-- =========================================================

CREATE TABLE IF NOT EXISTS itens_pedido (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    produto_id INT,
    nome_produto VARCHAR(120) NOT NULL,
    quantidade INT NOT NULL,
    preco_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    personalizacao TEXT,

    CONSTRAINT fk_itens_pedido_pedido
        FOREIGN KEY (pedido_id)
        REFERENCES pedidos(id),

    CONSTRAINT fk_itens_pedido_produto
        FOREIGN KEY (produto_id)
        REFERENCES produtos(id)
) ENGINE=InnoDB;

-- =========================================================
-- 9. PAGAMENTOS
-- =========================================================

CREATE TABLE IF NOT EXISTS pagamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,

    forma_pagamento ENUM(
        'pix',
        'cartao',
        'dinheiro'
    ) NOT NULL,

    valor DECIMAL(10,2) NOT NULL,

    status ENUM(
        'pendente',
        'aprovado',
        'recusado',
        'cancelado'
    ) DEFAULT 'pendente',

    codigo_transacao VARCHAR(150),
    data_pagamento DATETIME,

    CONSTRAINT fk_pagamentos_pedido
        FOREIGN KEY (pedido_id)
        REFERENCES pedidos(id)
) ENGINE=InnoDB;

-- =========================================================
-- 10. ENTREGAS
-- =========================================================

CREATE TABLE IF NOT EXISTS entregas (
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

    CONSTRAINT fk_entregas_pedido
        FOREIGN KEY (pedido_id)
        REFERENCES pedidos(id),

    CONSTRAINT fk_entregas_entregador
        FOREIGN KEY (entregador_id)
        REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- =========================================================
-- 11. HISTÓRICO DOS PEDIDOS
-- =========================================================

CREATE TABLE IF NOT EXISTS historico_pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    usuario_id INT,
    status_anterior VARCHAR(30),
    status_novo VARCHAR(30) NOT NULL,
    data_alteracao DATETIME DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_historico_pedido
        FOREIGN KEY (pedido_id)
        REFERENCES pedidos(id),

    CONSTRAINT fk_historico_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- =========================================================
-- 12. AVALIAÇÕES
-- =========================================================

CREATE TABLE IF NOT EXISTS avaliacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL UNIQUE,
    usuario_id INT NOT NULL,
    nota INT NOT NULL,
    comentario TEXT,
    data_avaliacao DATETIME DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_avaliacoes_pedido
        FOREIGN KEY (pedido_id)
        REFERENCES pedidos(id),

    CONSTRAINT fk_avaliacoes_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id),

    CONSTRAINT chk_avaliacoes_nota
        CHECK (nota BETWEEN 1 AND 5)
) ENGINE=InnoDB;

-- =========================================================
-- 13. CARRINHOS
-- =========================================================

CREATE TABLE IF NOT EXISTS carrinhos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL UNIQUE,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_carrinhos_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================================================
-- 14. ITENS DO CARRINHO
-- =========================================================

CREATE TABLE IF NOT EXISTS itens_carrinho (
    id INT AUTO_INCREMENT PRIMARY KEY,
    carrinho_id INT NOT NULL,
    produto_id INT NOT NULL,
    quantidade INT NOT NULL DEFAULT 1,

    CONSTRAINT fk_itens_carrinho_carrinho
        FOREIGN KEY (carrinho_id)
        REFERENCES carrinhos(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_itens_carrinho_produto
        FOREIGN KEY (produto_id)
        REFERENCES produtos(id),

    UNIQUE KEY uk_carrinho_produto (
        carrinho_id,
        produto_id
    )
) ENGINE=InnoDB;

-- =========================================================
-- 15. HORÁRIOS DE FUNCIONAMENTO
-- =========================================================

CREATE TABLE IF NOT EXISTS horarios_funcionamento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dia_semana TINYINT NOT NULL,
    horario_abertura TIME NOT NULL,
    horario_fechamento TIME NOT NULL,
    ativo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

-- =========================================================
-- 16. CONFIGURAÇÕES GERAIS DE ENTREGA
-- =========================================================

CREATE TABLE IF NOT EXISTS configuracoes_entrega (
    id INT PRIMARY KEY,
    taxa_padrao DECIMAL(10,2) NOT NULL DEFAULT 6.00,
    valor_minimo DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tempo_medio_minutos SMALLINT UNSIGNED NOT NULL DEFAULT 40,

    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_taxa_padrao
        CHECK (taxa_padrao >= 0),

    CONSTRAINT chk_valor_minimo
        CHECK (valor_minimo >= 0)
) ENGINE=InnoDB;

INSERT IGNORE INTO configuracoes_entrega (
    id,
    taxa_padrao,
    valor_minimo,
    tempo_medio_minutos
) VALUES (
    1,
    6.00,
    0.00,
    40
);

-- =========================================================
-- 17. BAIRROS E TAXAS FINAIS DE ENTREGA
-- =========================================================

CREATE TABLE IF NOT EXISTS bairros_entrega (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    taxa_final DECIMAL(10,2) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,

    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_bairros_taxa_final
        CHECK (taxa_final >= 0),

    UNIQUE KEY uk_bairros_entrega_nome (nome)
) ENGINE=InnoDB;

-- =========================================================
-- 18. CADASTRO INICIAL DOS BAIRROS
-- =========================================================

INSERT IGNORE INTO bairros_entrega (
    nome,
    taxa_final,
    ativo
) VALUES
('Marimba', 0.00, TRUE),
('Centro', 5.00, TRUE),
('Industrial', 6.00, TRUE),
('Eldorado', 7.00, TRUE),
('Alterosa', 7.00, TRUE),
('Petropolis', 8.00, TRUE),
('Imbirucu', 8.00, TRUE),
('Jardim Alterosa', 8.50, TRUE),
('Nossa Senhora das Gracas', 7.50, TRUE);

-- =========================================================
-- 19. ÍNDICES
-- =========================================================

CREATE INDEX idx_pedidos_usuario
    ON pedidos(usuario_id);

CREATE INDEX idx_pedidos_status
    ON pedidos(status);

CREATE INDEX idx_produtos_categoria
    ON produtos(categoria_id);

CREATE INDEX idx_entregas_entregador
    ON entregas(entregador_id);

CREATE INDEX idx_enderecos_usuario
    ON enderecos(usuario_id);

CREATE INDEX idx_historico_pedido
    ON historico_pedidos(pedido_id);

CREATE INDEX idx_itens_pedido_pedido
    ON itens_pedido(pedido_id);

CREATE INDEX idx_pagamentos_pedido
    ON pagamentos(pedido_id);

CREATE INDEX idx_bairros_entrega_ativo
    ON bairros_entrega(ativo);
