-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: fraga_db
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `adicionais`
--

DROP TABLE IF EXISTS `adicionais`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `adicionais` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) NOT NULL,
  `preco` decimal(10,2) NOT NULL,
  `disponivel` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `adicionais`
--

LOCK TABLES `adicionais` WRITE;
/*!40000 ALTER TABLE `adicionais` DISABLE KEYS */;
INSERT INTO `adicionais` VALUES (1,'Bacon Extra',4.00,1),(2,'Queijo Cheddar',3.00,1),(3,'Hambúrguer Extra',8.00,1),(4,'Cebola Caramelizada',2.50,1);
/*!40000 ALTER TABLE `adicionais` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `avaliacoes`
--

DROP TABLE IF EXISTS `avaliacoes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `avaliacoes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pedido_id` int NOT NULL,
  `usuario_id` int NOT NULL,
  `nota` int NOT NULL,
  `comentario` text,
  `data_avaliacao` datetime DEFAULT CURRENT_TIMESTAMP,
  `status` enum('pendente','aprovada','rejeitada') NOT NULL DEFAULT 'pendente',
  `moderado_por` int DEFAULT NULL,
  `data_moderacao` datetime DEFAULT NULL,
  `motivo_rejeicao` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pedido_id` (`pedido_id`),
  KEY `usuario_id` (`usuario_id`),
  KEY `fk_avaliacoes_moderador` (`moderado_por`),
  KEY `idx_avaliacoes_status_data` (`status`,`data_avaliacao`),
  CONSTRAINT `avaliacoes_ibfk_1` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`),
  CONSTRAINT `avaliacoes_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_avaliacoes_moderador` FOREIGN KEY (`moderado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `avaliacoes`
--

LOCK TABLES `avaliacoes` WRITE;
/*!40000 ALTER TABLE `avaliacoes` DISABLE KEYS */;
INSERT INTO `avaliacoes` VALUES (1,13,1,5,'muito bom, excelente prato','2026-11-21 14:46:09','aprovada',2,'2026-11-21 14:46:44',NULL);
/*!40000 ALTER TABLE `avaliacoes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bairros_entrega`
--

DROP TABLE IF EXISTS `bairros_entrega`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bairros_entrega` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) NOT NULL,
  `taxa_final` decimal(10,2) NOT NULL,
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  `criado_em` datetime DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bairros_entrega_nome` (`nome`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bairros_entrega`
--

LOCK TABLES `bairros_entrega` WRITE;
/*!40000 ALTER TABLE `bairros_entrega` DISABLE KEYS */;
INSERT INTO `bairros_entrega` VALUES (1,'Marimba',0.00,1,'2026-11-21 00:58:26','2026-11-21 00:58:26'),(2,'Centro',5.00,1,'2026-11-21 00:58:26','2026-11-21 00:58:26'),(3,'Industrial',6.00,1,'2026-11-21 00:58:26','2026-11-21 00:58:26'),(4,'Eldorado',7.00,1,'2026-11-21 00:58:26','2026-11-21 00:58:26'),(5,'Alterosa',7.00,1,'2026-11-21 00:58:26','2026-11-21 00:58:26'),(6,'Petropolis',8.00,1,'2026-11-21 00:58:26','2026-11-21 00:58:26'),(7,'Imbirucu',8.00,1,'2026-11-21 00:58:26','2026-11-21 00:58:26'),(8,'Jardim Alterosa',8.50,1,'2026-11-21 00:58:26','2026-11-21 00:58:26'),(9,'Nossa Senhora das Gracas',7.50,1,'2026-11-21 00:58:26','2026-11-21 00:58:26'),(10,'Filadélfia',12.00,1,'2026-11-21 01:38:10','2026-11-21 01:38:10');
/*!40000 ALTER TABLE `bairros_entrega` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `carrinhos`
--

DROP TABLE IF EXISTS `carrinhos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `carrinhos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `data_criacao` datetime DEFAULT CURRENT_TIMESTAMP,
  `data_atualizacao` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `carrinhos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=630 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `carrinhos`
--

LOCK TABLES `carrinhos` WRITE;
/*!40000 ALTER TABLE `carrinhos` DISABLE KEYS */;
INSERT INTO `carrinhos` VALUES (1,1,'2026-11-20 02:49:16','2026-11-20 02:49:16'),(604,7,'2026-11-23 10:54:43','2026-11-23 10:54:43');
/*!40000 ALTER TABLE `carrinhos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categorias`
--

DROP TABLE IF EXISTS `categorias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categorias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) NOT NULL,
  `descricao` text,
  `ativo` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categorias`
--

LOCK TABLES `categorias` WRITE;
/*!40000 ALTER TABLE `categorias` DISABLE KEYS */;
INSERT INTO `categorias` VALUES (1,'teste','abc123',1);
/*!40000 ALTER TABLE `categorias` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `configuracoes_entrega`
--

DROP TABLE IF EXISTS `configuracoes_entrega`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `configuracoes_entrega` (
  `id` int NOT NULL,
  `taxa_padrao` decimal(10,2) NOT NULL DEFAULT '6.00',
  `valor_minimo` decimal(10,2) NOT NULL DEFAULT '0.00',
  `tempo_medio_minutos` smallint unsigned NOT NULL DEFAULT '40',
  `atualizado_em` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `configuracoes_entrega`
--

LOCK TABLES `configuracoes_entrega` WRITE;
/*!40000 ALTER TABLE `configuracoes_entrega` DISABLE KEYS */;
INSERT INTO `configuracoes_entrega` VALUES (1,2.00,0.00,40,'2026-11-21 01:09:07');
/*!40000 ALTER TABLE `configuracoes_entrega` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `enderecos`
--

DROP TABLE IF EXISTS `enderecos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `enderecos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `rua` varchar(150) NOT NULL,
  `numero` varchar(20) NOT NULL,
  `bairro` varchar(100) NOT NULL,
  `cidade` varchar(100) NOT NULL,
  `complemento` varchar(100) DEFAULT NULL,
  `origem` enum('perfil','pedido') NOT NULL DEFAULT 'perfil',
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `enderecos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `enderecos`
--

LOCK TABLES `enderecos` WRITE;
/*!40000 ALTER TABLE `enderecos` DISABLE KEYS */;
INSERT INTO `enderecos` VALUES (1,1,'Rua Jardim do Seridó','41','Jardim Teresópolis','Betim',NULL,'perfil',0),(2,1,'Beco do Funil','25','Jardim Teresópolis','Betim',NULL,'perfil',0),(3,1,'Rua Jardim do Seridó','52','Jardim Teresópolis','Betim',NULL,'perfil',0),(4,1,'Vargem Grande','41','Jardim Teresópolis','Betim','','perfil',1),(5,1,'Rua Jardim do Seridó','41','Jardim Teresópolis','Betim','','perfil',0),(6,1,'Rua Jardim do Seridó','41','Jardim Teresópolis','Betim','','perfil',0),(7,1,'Rua Jardim do Seridó','41','Jardim Teresópolis','Betim','','perfil',0),(8,1,'Rua Jardim do Seridó','41','Jardim Teresópolis','Betim','','perfil',1),(9,1,'Rua Jardim do Seridó','41','Jardim Teresópolis','Betim','','perfil',1),(11,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(12,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(13,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(14,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(15,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(16,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(17,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(18,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(21,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(22,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(23,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(24,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(25,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(26,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(27,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(28,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(29,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(30,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(31,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(32,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(33,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(34,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(35,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(36,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(37,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(40,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',0),(41,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',0),(42,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(43,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(44,1,'Rua Pouso Alegre','14','Marimbá','Betim','','perfil',1),(45,7,'Rua Amin fares Debian','53825629856298562895','Silver chat','Zogrates Almeida','Moro de baixo da ponte','perfil',1);
/*!40000 ALTER TABLE `enderecos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `entregas`
--

DROP TABLE IF EXISTS `entregas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entregas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pedido_id` int NOT NULL,
  `entregador_id` int DEFAULT NULL,
  `status` enum('pendente','atribuida','em_andamento','entregue') DEFAULT 'pendente',
  `data_saida` datetime DEFAULT NULL,
  `data_entrega` datetime DEFAULT NULL,
  `data_confirmacao_recebimento` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pedido_id` (`pedido_id`),
  KEY `idx_entregas_entregador` (`entregador_id`),
  CONSTRAINT `entregas_ibfk_1` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`),
  CONSTRAINT `entregas_ibfk_2` FOREIGN KEY (`entregador_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `entregas`
--

LOCK TABLES `entregas` WRITE;
/*!40000 ALTER TABLE `entregas` DISABLE KEYS */;
INSERT INTO `entregas` VALUES (1,1,NULL,'pendente',NULL,NULL,NULL),(2,9,4,'entregue','2026-11-21 06:13:04','2026-11-21 06:45:09',NULL),(3,10,4,'entregue','2026-11-21 07:23:26','2026-11-21 07:23:31','2026-11-21 07:24:00'),(4,11,4,'entregue','2026-11-21 07:39:51','2026-11-21 07:40:05','2026-11-21 07:43:56'),(5,12,4,'entregue','2026-11-21 07:42:48','2026-11-21 07:44:04','2026-11-21 07:44:20'),(6,13,4,'entregue','2026-11-21 14:43:54','2026-11-21 14:43:58','2026-11-21 14:44:46'),(7,14,4,'entregue','2026-11-21 17:09:28','2026-11-21 17:12:22','2026-11-21 17:12:58'),(8,15,4,'entregue','2026-11-21 18:10:17','2026-11-21 18:10:34','2026-11-21 19:37:24'),(9,16,4,'entregue','2026-11-21 19:26:22','2026-11-21 19:28:44','2026-11-21 19:37:21'),(10,17,4,'entregue','2026-11-21 20:10:57','2026-11-21 20:11:00','2026-11-21 21:45:25'),(11,19,4,'entregue','2026-11-21 20:02:57','2026-11-21 20:03:36','2026-11-21 20:04:02'),(12,18,4,'entregue','2026-11-21 20:02:54','2026-11-21 20:03:33','2026-11-21 20:04:03'),(13,21,4,'entregue','2026-11-21 20:10:14','2026-11-21 20:10:18','2026-11-21 20:13:46'),(14,27,4,'em_andamento','2026-11-21 21:57:09',NULL,NULL),(15,32,4,'atribuida',NULL,NULL,NULL);
/*!40000 ALTER TABLE `entregas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `formas_pagamento`
--

DROP TABLE IF EXISTS `formas_pagamento`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `formas_pagamento` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(50) NOT NULL,
  `tipo` enum('dinheiro','credito','debito','pix','boleto','outro') NOT NULL,
  `taxa_percentual` decimal(5,2) NOT NULL DEFAULT '0.00',
  `prazo_recebimento` int unsigned NOT NULL DEFAULT '0',
  `ordem_exibicao` int NOT NULL DEFAULT '0',
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  `online` tinyint(1) NOT NULL DEFAULT '0',
  `data_criacao` datetime DEFAULT CURRENT_TIMESTAMP,
  `data_atualizacao` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_formas_pagamento_ativo` (`ativo`),
  KEY `idx_formas_pagamento_ordem` (`ordem_exibicao`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `formas_pagamento`
--

LOCK TABLES `formas_pagamento` WRITE;
/*!40000 ALTER TABLE `formas_pagamento` DISABLE KEYS */;
INSERT INTO `formas_pagamento` VALUES (2,'PIX','pix',0.00,0,1,1,0,'2026-11-21 04:05:08','2026-11-21 04:05:08'),(3,'DINHEIRO','dinheiro',0.00,0,2,1,0,'2026-11-21 04:05:39','2026-11-21 04:06:12'),(4,'CARTÃO DE CRÉDITO','credito',10.00,0,3,1,0,'2026-11-21 04:06:00','2026-11-21 04:06:21'),(5,'TESTE CMD 1795313039177 EDITADO','outro',1.25,1,9999,0,0,'2026-11-21 23:03:59','2026-11-21 23:04:00');
/*!40000 ALTER TABLE `formas_pagamento` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `historico_pagamentos`
--

DROP TABLE IF EXISTS `historico_pagamentos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `historico_pagamentos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pagamento_id` int NOT NULL,
  `pedido_id` int NOT NULL,
  `usuario_id` int DEFAULT NULL,
  `status_anterior` varchar(20) NOT NULL,
  `status_novo` varchar(20) NOT NULL,
  `data_alteracao` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_hist_pagamento` (`pagamento_id`),
  KEY `idx_hist_pedido` (`pedido_id`),
  KEY `idx_hist_usuario` (`usuario_id`),
  CONSTRAINT `fk_hist_pag_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`),
  CONSTRAINT `fk_hist_pag_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_hist_pagamento` FOREIGN KEY (`pagamento_id`) REFERENCES `pagamentos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `historico_pagamentos`
--

LOCK TABLES `historico_pagamentos` WRITE;
/*!40000 ALTER TABLE `historico_pagamentos` DISABLE KEYS */;
INSERT INTO `historico_pagamentos` VALUES (1,30,31,2,'pendente','aprovado','2026-11-22 00:18:47'),(2,32,33,2,'pendente','aprovado','2026-11-22 01:17:13'),(3,38,39,2,'pendente','aprovado','2026-11-22 18:52:49');
/*!40000 ALTER TABLE `historico_pagamentos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `historico_pedidos`
--

DROP TABLE IF EXISTS `historico_pedidos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `historico_pedidos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pedido_id` int NOT NULL,
  `usuario_id` int DEFAULT NULL,
  `status_anterior` varchar(30) DEFAULT NULL,
  `status_novo` varchar(30) NOT NULL,
  `data_alteracao` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `pedido_id` (`pedido_id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `historico_pedidos_ibfk_1` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`),
  CONSTRAINT `historico_pedidos_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=125 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `historico_pedidos`
--

LOCK TABLES `historico_pedidos` WRITE;
/*!40000 ALTER TABLE `historico_pedidos` DISABLE KEYS */;
INSERT INTO `historico_pedidos` VALUES (1,1,1,NULL,'novo','2026-11-20 06:21:47'),(2,2,1,NULL,'novo','2026-11-20 18:00:07'),(3,3,1,NULL,'novo','2026-11-20 18:18:50'),(4,4,1,NULL,'novo','2026-11-20 18:27:34'),(5,5,1,NULL,'novo','2026-11-20 18:40:16'),(6,6,1,NULL,'novo','2026-11-20 19:01:32'),(7,6,1,'novo','cancelado','2026-11-20 22:02:08'),(8,5,1,'novo','cancelado','2026-11-20 22:02:24'),(9,4,1,'novo','cancelado','2026-11-20 22:02:30'),(10,3,1,'novo','cancelado','2026-11-20 22:02:33'),(11,2,1,'novo','cancelado','2026-11-20 22:02:36'),(12,1,1,'novo','cancelado','2026-11-20 22:02:38'),(13,7,1,NULL,'novo','2026-11-20 22:48:08'),(14,7,2,'novo','em_preparo','2026-11-20 23:24:55'),(15,7,2,'em_preparo','saiu_para_entrega','2026-11-20 23:25:04'),(16,7,2,'saiu_para_entrega','novo','2026-11-20 23:25:12'),(17,7,2,'novo','concluido','2026-11-21 01:48:53'),(18,9,1,NULL,'novo','2026-11-21 04:37:28'),(19,9,2,'novo','pronto','2026-11-21 06:00:29'),(20,9,4,'pronto','saiu_para_entrega','2026-11-21 06:13:04'),(21,9,4,'saiu_para_entrega','concluido','2026-11-21 06:45:10'),(22,10,1,NULL,'novo','2026-11-21 07:21:44'),(23,10,2,'novo','pronto','2026-11-21 07:22:42'),(24,10,4,'pronto','saiu_para_entrega','2026-11-21 07:23:26'),(25,10,1,'saiu_para_entrega','concluido','2026-11-21 07:24:00'),(26,11,1,NULL,'novo','2026-11-21 07:37:45'),(27,11,2,'novo','pronto','2026-11-21 07:39:33'),(28,11,4,'pronto','saiu_para_entrega','2026-11-21 07:39:51'),(29,12,1,NULL,'novo','2026-11-21 07:41:57'),(30,12,2,'novo','pronto','2026-11-21 07:42:22'),(31,12,4,'pronto','saiu_para_entrega','2026-11-21 07:42:48'),(32,11,1,'saiu_para_entrega','concluido','2026-11-21 07:43:56'),(33,12,1,'saiu_para_entrega','concluido','2026-11-21 07:44:20'),(34,13,1,NULL,'novo','2026-11-21 14:43:01'),(35,13,2,'novo','pronto','2026-11-21 14:43:21'),(36,13,4,'pronto','saiu_para_entrega','2026-11-21 14:43:54'),(37,13,1,'saiu_para_entrega','concluido','2026-11-21 14:44:46'),(38,14,1,NULL,'novo','2026-11-21 16:17:50'),(39,14,5,'novo','em_preparo','2026-11-21 16:19:23'),(40,14,5,'em_preparo','pronto','2026-11-21 16:19:37'),(41,14,4,'pronto','saiu_para_entrega','2026-11-21 17:09:28'),(42,14,1,'saiu_para_entrega','concluido','2026-11-21 17:12:58'),(43,15,1,NULL,'novo','2026-11-21 18:07:35'),(44,15,5,'novo','em_preparo','2026-11-21 18:09:45'),(45,15,5,'em_preparo','pronto','2026-11-21 18:09:47'),(46,15,4,'pronto','saiu_para_entrega','2026-11-21 18:10:17'),(47,16,1,NULL,'novo','2026-11-21 19:24:20'),(48,16,5,'novo','em_preparo','2026-11-21 19:25:21'),(49,16,5,'em_preparo','pronto','2026-11-21 19:25:26'),(50,16,4,'pronto','saiu_para_entrega','2026-11-21 19:26:22'),(51,16,1,'saiu_para_entrega','concluido','2026-11-21 19:37:21'),(52,15,1,'saiu_para_entrega','concluido','2026-11-21 19:37:24'),(53,17,1,NULL,'novo','2026-11-21 19:38:21'),(54,17,5,'novo','em_preparo','2026-11-21 19:40:48'),(55,17,5,'em_preparo','pronto','2026-11-21 19:40:50'),(56,18,1,NULL,'novo','2026-11-21 19:49:50'),(57,19,1,NULL,'novo','2026-11-21 19:50:09'),(58,19,5,'novo','em_preparo','2026-11-21 19:52:02'),(59,18,5,'novo','em_preparo','2026-11-21 19:52:04'),(60,18,5,'em_preparo','pronto','2026-11-21 19:52:05'),(61,19,5,'em_preparo','pronto','2026-11-21 19:52:08'),(62,20,1,NULL,'novo','2026-11-21 20:00:08'),(63,20,5,'novo','em_preparo','2026-11-21 20:01:08'),(64,20,5,'em_preparo','pronto','2026-11-21 20:01:57'),(65,18,4,'pronto','saiu_para_entrega','2026-11-21 20:02:54'),(66,19,4,'pronto','saiu_para_entrega','2026-11-21 20:02:57'),(67,19,1,'saiu_para_entrega','concluido','2026-11-21 20:04:02'),(68,18,1,'saiu_para_entrega','concluido','2026-11-21 20:04:03'),(69,21,1,NULL,'novo','2026-11-21 20:09:01'),(70,21,5,'novo','em_preparo','2026-11-21 20:09:39'),(71,21,5,'em_preparo','pronto','2026-11-21 20:09:41'),(72,21,4,'pronto','saiu_para_entrega','2026-11-21 20:10:14'),(73,17,4,'pronto','saiu_para_entrega','2026-11-21 20:10:57'),(74,21,1,'saiu_para_entrega','concluido','2026-11-21 20:13:46'),(75,22,1,NULL,'novo','2026-11-21 20:37:40'),(76,23,1,NULL,'novo','2026-11-21 20:51:14'),(77,23,1,'novo','cancelado','2026-11-21 20:55:39'),(78,22,1,'novo','cancelado','2026-11-21 21:00:44'),(79,24,1,NULL,'novo','2026-11-21 21:05:31'),(80,24,1,'novo','cancelado','2026-11-21 21:05:49'),(81,25,1,NULL,'novo','2026-11-21 21:27:02'),(82,26,1,NULL,'novo','2026-11-21 21:31:46'),(83,17,1,'saiu_para_entrega','concluido','2026-11-21 21:45:26'),(84,27,1,NULL,'novo','2026-11-21 21:45:49'),(85,27,2,'novo','em_preparo','2026-11-21 21:52:18'),(86,25,5,'novo','em_preparo','2026-11-21 21:54:16'),(87,26,5,'novo','em_preparo','2026-11-21 21:54:18'),(88,25,5,'em_preparo','pronto','2026-11-21 21:54:20'),(89,26,5,'em_preparo','pronto','2026-11-21 21:54:22'),(90,27,5,'em_preparo','pronto','2026-11-21 21:54:26'),(91,27,4,'pronto','saiu_para_entrega','2026-11-21 21:57:09'),(92,28,1,NULL,'novo','2026-11-21 21:58:37'),(93,28,5,'novo','em_preparo','2026-11-21 21:58:58'),(94,28,1,'em_preparo','cancelado','2026-11-21 22:00:06'),(95,29,1,NULL,'novo','2026-11-21 22:04:11'),(96,29,5,'novo','em_preparo','2026-11-21 22:04:45'),(97,29,5,'em_preparo','pronto','2026-11-21 22:04:47'),(98,30,1,NULL,'novo','2026-11-21 22:16:06'),(99,30,5,'novo','em_preparo','2026-11-21 22:17:48'),(100,30,5,'em_preparo','pronto','2026-11-21 22:17:52'),(101,31,NULL,NULL,'pronto','2026-11-22 00:15:32'),(102,32,1,NULL,'novo','2026-11-22 00:38:10'),(103,33,1,NULL,'novo','2026-11-22 00:40:34'),(104,32,2,'novo','pronto','2026-11-22 00:54:36'),(105,33,2,'novo','pronto','2026-11-22 01:17:06'),(106,34,1,NULL,'novo','2026-11-22 15:08:58'),(107,34,NULL,'novo','cancelado','2026-11-22 15:35:28'),(108,35,1,NULL,'novo','2026-11-22 15:36:43'),(109,35,NULL,'novo','cancelado','2026-11-22 15:41:43'),(110,36,1,NULL,'novo','2026-11-22 15:54:10'),(111,36,NULL,'novo','cancelado','2026-11-22 15:59:10'),(112,37,1,NULL,'novo','2026-11-22 16:03:50'),(113,37,1,'novo','cancelado','2026-11-22 16:05:29'),(114,38,1,NULL,'novo','2026-11-22 16:07:21'),(115,38,NULL,'novo','cancelado','2026-11-22 16:12:23'),(116,39,2,NULL,'novo','2026-11-22 18:52:49'),(117,40,1,NULL,'novo','2026-11-22 20:54:50'),(118,41,1,NULL,'novo','2026-11-22 20:58:54'),(119,41,5,'novo','em_preparo','2026-11-22 21:35:45'),(120,40,5,'novo','em_preparo','2026-11-22 21:35:49'),(121,39,5,'novo','em_preparo','2026-11-22 21:35:52'),(122,41,5,'em_preparo','pronto','2026-11-22 21:35:54'),(123,40,5,'em_preparo','pronto','2026-11-22 21:35:57'),(124,39,5,'em_preparo','pronto','2026-11-22 21:35:59');
/*!40000 ALTER TABLE `historico_pedidos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `horarios_funcionamento`
--

DROP TABLE IF EXISTS `horarios_funcionamento`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `horarios_funcionamento` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dia_semana` tinyint NOT NULL,
  `horario_abertura` time NOT NULL,
  `horario_fechamento` time NOT NULL,
  `ativo` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `horarios_funcionamento`
--

LOCK TABLES `horarios_funcionamento` WRITE;
/*!40000 ALTER TABLE `horarios_funcionamento` DISABLE KEYS */;
INSERT INTO `horarios_funcionamento` VALUES (1,0,'20:10:00','22:10:00',1);
/*!40000 ALTER TABLE `horarios_funcionamento` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `intencoes_pix`
--

DROP TABLE IF EXISTS `intencoes_pix`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `intencoes_pix` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `codigo_referencia` char(36) NOT NULL,
  `usuario_id` int DEFAULT NULL,
  `visitante_nome` varchar(100) DEFAULT NULL,
  `visitante_telefone` varchar(20) DEFAULT NULL,
  `token_acompanhamento_hash` char(64) DEFAULT NULL,
  `endereco_id` int DEFAULT NULL,
  `tipo_entrega` enum('entrega','retirada') NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `taxa_entrega` decimal(10,2) NOT NULL DEFAULT '0.00',
  `desconto` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total` decimal(10,2) NOT NULL,
  `observacoes` text,
  `pix_copia_e_cola` text NOT NULL,
  `status` enum('pendente','aprovado','expirado','cancelado') NOT NULL DEFAULT 'pendente',
  `criado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expira_em` datetime NOT NULL,
  `aprovado_em` datetime DEFAULT NULL,
  `aprovado_por` int DEFAULT NULL,
  `pedido_id` int DEFAULT NULL,
  `atualizado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `endereco_cep` varchar(12) DEFAULT NULL,
  `endereco_rua` varchar(150) DEFAULT NULL,
  `endereco_numero` varchar(30) DEFAULT NULL,
  `endereco_bairro` varchar(100) DEFAULT NULL,
  `endereco_cidade` varchar(100) DEFAULT NULL,
  `endereco_complemento` varchar(150) DEFAULT NULL,
  `endereco_referencia` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_intencoes_pix_referencia` (`codigo_referencia`),
  UNIQUE KEY `uk_intencoes_pix_pedido` (`pedido_id`),
  UNIQUE KEY `uk_intencoes_pix_token_acompanhamento` (`token_acompanhamento_hash`),
  KEY `idx_intencoes_pix_usuario` (`usuario_id`),
  KEY `idx_intencoes_pix_status_expiracao` (`status`,`expira_em`),
  KEY `fk_intencoes_pix_endereco` (`endereco_id`),
  KEY `fk_intencoes_pix_aprovador` (`aprovado_por`),
  CONSTRAINT `fk_intencoes_pix_aprovador` FOREIGN KEY (`aprovado_por`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_intencoes_pix_endereco` FOREIGN KEY (`endereco_id`) REFERENCES `enderecos` (`id`),
  CONSTRAINT `fk_intencoes_pix_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`),
  CONSTRAINT `fk_intencoes_pix_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `intencoes_pix`
--

LOCK TABLES `intencoes_pix` WRITE;
/*!40000 ALTER TABLE `intencoes_pix` DISABLE KEYS */;
INSERT INTO `intencoes_pix` VALUES (1,'6aa8fc23-b6df-41ae-804c-620b048692a1',1,NULL,NULL,NULL,34,'entrega',10.00,0.00,0.00,10.00,NULL,'00020101021126580014br.gov.bcb.pix013619acfdc1-3340-4dfe-9e2b-6aebdb372b94520400005303986540510.005802BR5925SAMUEL WELINGTON DE OLIVE6009SAO PAULO622905256AA8FC23B6DF41AE804C620B06304EFA6','aprovado','2026-11-22 18:51:09','2026-11-22 18:56:09','2026-11-22 18:52:49',2,39,'2026-11-22 18:52:49',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(2,'919fe872-d69f-440c-8aac-f1cc7f1facd1',1,NULL,NULL,NULL,35,'entrega',10.00,0.00,0.00,10.00,NULL,'00020101021126580014br.gov.bcb.pix013619acfdc1-3340-4dfe-9e2b-6aebdb372b94520400005303986540510.005802BR5925SAMUEL WELINGTON DE OLIVE6009SAO PAULO62290525919FE872D69F440C8AACF1CC76304B6B0','expirado','2026-11-22 18:55:08','2026-11-22 19:00:08',NULL,NULL,NULL,'2026-11-22 19:00:10',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(3,'601f5234-8c82-4e14-9224-0ab2cd423940',1,NULL,NULL,NULL,36,'entrega',10.00,0.00,0.00,10.00,NULL,'00020101021126580014br.gov.bcb.pix013619acfdc1-3340-4dfe-9e2b-6aebdb372b94520400005303986540510.005802BR5925SAMUEL WELINGTON DE OLIVE6009SAO PAULO62290525601F52348C824E1492240AB2C63040633','expirado','2026-11-22 19:08:39','2026-11-22 19:13:39',NULL,NULL,NULL,'2026-11-22 19:13:39',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(4,'9fece09f-1633-451e-92ed-80f118ff9ab3',1,NULL,NULL,NULL,37,'entrega',10.00,0.00,0.00,10.00,NULL,'00020101021126580014br.gov.bcb.pix013619acfdc1-3340-4dfe-9e2b-6aebdb372b94520400005303986540510.005802BR5925SAMUEL WELINGTON DE OLIVE6009SAO PAULO622905259FECE09F1633451E92ED80F11630496F9','expirado','2026-11-22 19:21:39','2026-11-22 19:26:39',NULL,NULL,NULL,'2026-11-22 19:26:43',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(5,'5d1a9a5e-ffb7-4e01-b7ac-9afad90a4bff',1,NULL,NULL,NULL,42,'entrega',10.00,0.00,0.00,10.00,NULL,'00020101021126580014br.gov.bcb.pix013619acfdc1-3340-4dfe-9e2b-6aebdb372b94520400005303986540510.005802BR5925SAMUEL WELINGTON DE OLIVE6009SAO PAULO622905255D1A9A5EFFB74E01B7AC9AFAD6304E46F','expirado','2026-11-23 01:59:46','2026-11-23 02:04:46',NULL,NULL,NULL,'2026-11-23 02:04:46',NULL,'Rua Pouso Alegre','14','Marimbá','Betim',NULL,NULL),(6,'eb7002db-1603-4831-9f95-cb2405abbed7',1,NULL,NULL,NULL,43,'entrega',10.00,0.00,0.00,10.00,NULL,'00020101021126580014br.gov.bcb.pix013619acfdc1-3340-4dfe-9e2b-6aebdb372b94520400005303986540510.005802BR5925SAMUEL WELINGTON DE OLIVE6009SAO PAULO62290525EB7002DB160348319F95CB2406304900A','expirado','2026-11-23 02:22:09','2026-11-23 02:27:09',NULL,NULL,NULL,'2026-11-23 02:27:09',NULL,'Rua Pouso Alegre','14','Marimbá','Betim',NULL,NULL),(7,'dc80eda3-942e-4c08-b43e-d397277e2a80',1,NULL,NULL,NULL,44,'entrega',10.00,0.00,0.00,10.00,NULL,'00020101021126580014br.gov.bcb.pix013619acfdc1-3340-4dfe-9e2b-6aebdb372b94520400005303986540510.005802BR5925SAMUEL WELINGTON DE OLIVE6009SAO PAULO62290525DC80EDA3942E4C08B43ED397263048236','cancelado','2026-11-23 02:28:59','2026-11-23 02:33:59',NULL,NULL,NULL,'2026-11-23 02:29:03',NULL,'Rua Pouso Alegre','14','Marimbá','Betim',NULL,NULL);
/*!40000 ALTER TABLE `intencoes_pix` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `item_carrinho_adicionais`
--

DROP TABLE IF EXISTS `item_carrinho_adicionais`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_carrinho_adicionais` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_carrinho_id` int NOT NULL,
  `adicional_id` int DEFAULT NULL,
  `nome_adicional` varchar(100) NOT NULL,
  `preco` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `item_carrinho_id` (`item_carrinho_id`),
  KEY `adicional_id` (`adicional_id`),
  CONSTRAINT `item_carrinho_adicionais_ibfk_1` FOREIGN KEY (`item_carrinho_id`) REFERENCES `itens_carrinho` (`id`) ON DELETE CASCADE,
  CONSTRAINT `item_carrinho_adicionais_ibfk_2` FOREIGN KEY (`adicional_id`) REFERENCES `adicionais` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item_carrinho_adicionais`
--

LOCK TABLES `item_carrinho_adicionais` WRITE;
/*!40000 ALTER TABLE `item_carrinho_adicionais` DISABLE KEYS */;
INSERT INTO `item_carrinho_adicionais` VALUES (18,54,1,'Bacon Extra',4.00),(19,54,4,'Cebola Caramelizada',2.50),(20,54,3,'Hambúrguer Extra',8.00),(21,54,2,'Queijo Cheddar',3.00),(22,55,1,'Bacon Extra',4.00),(23,56,4,'Cebola Caramelizada',2.50),(24,57,3,'Hambúrguer Extra',8.00),(25,58,2,'Queijo Cheddar',3.00);
/*!40000 ALTER TABLE `item_carrinho_adicionais` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `itens_carrinho`
--

DROP TABLE IF EXISTS `itens_carrinho`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `itens_carrinho` (
  `id` int NOT NULL AUTO_INCREMENT,
  `carrinho_id` int NOT NULL,
  `produto_id` int NOT NULL,
  `quantidade` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `produto_id` (`produto_id`),
  KEY `idx_itens_carrinho_carrinho` (`carrinho_id`),
  CONSTRAINT `itens_carrinho_ibfk_1` FOREIGN KEY (`carrinho_id`) REFERENCES `carrinhos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `itens_carrinho_ibfk_2` FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=63 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `itens_carrinho`
--

LOCK TABLES `itens_carrinho` WRITE;
/*!40000 ALTER TABLE `itens_carrinho` DISABLE KEYS */;
INSERT INTO `itens_carrinho` VALUES (53,1,1,1),(54,604,2,1),(55,604,2,1),(56,604,2,1),(57,604,2,1),(58,604,2,1),(59,604,1,1),(60,604,1,1),(61,604,1,1),(62,604,1,1);
/*!40000 ALTER TABLE `itens_carrinho` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `itens_intencao_pix`
--

DROP TABLE IF EXISTS `itens_intencao_pix`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `itens_intencao_pix` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `intencao_pix_id` bigint NOT NULL,
  `produto_id` int DEFAULT NULL,
  `nome_produto` varchar(120) NOT NULL,
  `quantidade` int NOT NULL,
  `preco_unitario` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `personalizacao` text,
  PRIMARY KEY (`id`),
  KEY `idx_itens_intencao_pix_intencao` (`intencao_pix_id`),
  KEY `idx_itens_intencao_pix_produto` (`produto_id`),
  CONSTRAINT `fk_itens_intencao_pix_intencao` FOREIGN KEY (`intencao_pix_id`) REFERENCES `intencoes_pix` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_itens_intencao_pix_produto` FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `itens_intencao_pix`
--

LOCK TABLES `itens_intencao_pix` WRITE;
/*!40000 ALTER TABLE `itens_intencao_pix` DISABLE KEYS */;
INSERT INTO `itens_intencao_pix` VALUES (1,1,1,'coca-cola',1,10.00,10.00,NULL),(2,2,1,'coca-cola',1,10.00,10.00,NULL),(3,3,1,'coca-cola',1,10.00,10.00,NULL),(4,4,1,'coca-cola',1,10.00,10.00,NULL),(5,5,1,'coca-cola',1,10.00,10.00,NULL),(6,6,1,'coca-cola',1,10.00,10.00,NULL),(7,7,1,'coca-cola',1,10.00,10.00,NULL);
/*!40000 ALTER TABLE `itens_intencao_pix` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `itens_pedido`
--

DROP TABLE IF EXISTS `itens_pedido`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `itens_pedido` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pedido_id` int NOT NULL,
  `produto_id` int DEFAULT NULL,
  `nome_produto` varchar(120) NOT NULL,
  `quantidade` int NOT NULL,
  `preco_unitario` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `personalizacao` text,
  PRIMARY KEY (`id`),
  KEY `pedido_id` (`pedido_id`),
  KEY `produto_id` (`produto_id`),
  CONSTRAINT `itens_pedido_ibfk_1` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`),
  CONSTRAINT `itens_pedido_ibfk_2` FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `itens_pedido`
--

LOCK TABLES `itens_pedido` WRITE;
/*!40000 ALTER TABLE `itens_pedido` DISABLE KEYS */;
INSERT INTO `itens_pedido` VALUES (1,1,1,'coca-cola',1,10.00,10.00,NULL),(2,2,1,'coca-cola',1,10.00,10.00,NULL),(3,3,1,'coca-cola',1,10.00,10.00,NULL),(4,4,1,'coca-cola',1,10.00,10.00,NULL),(5,5,1,'coca-cola',1,10.00,10.00,NULL),(6,6,1,'coca-cola',1,10.00,10.00,NULL),(7,7,1,'coca-cola',1,10.00,10.00,NULL),(8,7,2,'Fraga Burger Teste',1,42.50,42.50,'[{\"id\":1,\"nome\":\"Bacon Extra\",\"preco\":4},{\"id\":2,\"nome\":\"Queijo Cheddar\",\"preco\":3},{\"id\":3,\"nome\":\"Hambúrguer Extra\",\"preco\":8},{\"id\":4,\"nome\":\"Cebola Caramelizada\",\"preco\":2.5}]'),(10,9,2,'Fraga Burger Teste',1,33.00,33.00,'[{\"id\":3,\"nome\":\"Hambúrguer Extra\",\"preco\":8}]'),(11,10,1,'coca-cola',1,10.00,10.00,NULL),(12,10,2,'Fraga Burger Teste',1,36.00,36.00,'[{\"id\":2,\"nome\":\"Queijo Cheddar\",\"preco\":3},{\"id\":3,\"nome\":\"Hambúrguer Extra\",\"preco\":8}]'),(13,11,2,'Fraga Burger Teste',1,25.00,25.00,NULL),(14,12,1,'coca-cola',1,10.00,10.00,NULL),(15,12,2,'Fraga Burger Teste',1,28.00,28.00,'[{\"id\":2,\"nome\":\"Queijo Cheddar\",\"preco\":3}]'),(16,13,2,'Fraga Burger Teste',1,33.00,33.00,'[{\"id\":3,\"nome\":\"Hambúrguer Extra\",\"preco\":8}]'),(17,14,2,'Fraga Burger Teste',1,33.00,33.00,'[{\"id\":3,\"nome\":\"Hambúrguer Extra\",\"preco\":8}]'),(18,15,2,'Fraga Burger Teste',1,33.00,33.00,'[{\"id\":3,\"nome\":\"Hambúrguer Extra\",\"preco\":8}]'),(19,16,2,'Fraga Burger Teste',1,25.00,25.00,NULL),(20,17,2,'Fraga Burger Teste',1,28.00,28.00,'[{\"id\":2,\"nome\":\"Queijo Cheddar\",\"preco\":3}]'),(21,18,2,'Fraga Burger Teste',1,25.00,25.00,NULL),(22,19,2,'Fraga Burger Teste',1,28.00,28.00,'[{\"id\":2,\"nome\":\"Queijo Cheddar\",\"preco\":3}]'),(23,20,2,'Fraga Burger Teste',1,25.00,25.00,NULL),(24,21,1,'coca-cola',1,10.00,10.00,NULL),(25,22,1,'coca-cola',1,10.00,10.00,NULL),(26,22,2,'Fraga Burger Teste',1,25.00,25.00,NULL),(27,23,1,'coca-cola',1,10.00,10.00,NULL),(28,23,2,'Fraga Burger Teste',1,25.00,25.00,NULL),(29,24,1,'coca-cola',1,10.00,10.00,NULL),(30,24,2,'Fraga Burger Teste',1,25.00,25.00,NULL),(31,25,1,'coca-cola',1,10.00,10.00,NULL),(32,25,2,'Fraga Burger Teste',1,25.00,25.00,NULL),(33,26,1,'coca-cola',1,10.00,10.00,NULL),(34,26,2,'Fraga Burger Teste',1,25.00,25.00,NULL),(35,27,1,'coca-cola',1,10.00,10.00,NULL),(36,28,1,'coca-cola',1,10.00,10.00,NULL),(37,29,1,'coca-cola',1,10.00,10.00,NULL),(38,30,1,'coca-cola',1,10.00,10.00,NULL),(39,31,2,'Fraga Burger Teste',1,25.00,25.00,'Item criado exclusivamente para teste administrativo.'),(40,32,1,'coca-cola',1,10.00,10.00,NULL),(41,33,2,'Fraga Burger Teste',1,27.50,27.50,'[{\"id\":4,\"nome\":\"Cebola Caramelizada\",\"preco\":2.5}]'),(42,34,2,'Fraga Burger Teste',1,28.00,28.00,'[{\"id\":2,\"nome\":\"Queijo Cheddar\",\"preco\":3}]'),(43,35,1,'coca-cola',1,10.00,10.00,NULL),(44,36,1,'coca-cola',1,10.00,10.00,NULL),(45,37,1,'coca-cola',1,10.00,10.00,NULL),(46,38,2,'Fraga Burger Teste',1,25.00,25.00,NULL),(47,39,1,'coca-cola',1,10.00,10.00,NULL),(48,40,1,'coca-cola',1,10.00,10.00,NULL),(49,41,1,'coca-cola',1,10.00,10.00,NULL);
/*!40000 ALTER TABLE `itens_pedido` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notificacoes`
--

DROP TABLE IF EXISTS `notificacoes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notificacoes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `pedido_id` int DEFAULT NULL,
  `tipo` varchar(50) NOT NULL,
  `titulo` varchar(120) NOT NULL,
  `mensagem` varchar(255) NOT NULL,
  `lida` tinyint(1) NOT NULL DEFAULT '0',
  `data_criacao` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notificacao_usuario_pedido_tipo` (`usuario_id`,`pedido_id`,`tipo`),
  KEY `idx_notificacoes_usuario_data` (`usuario_id`,`data_criacao`),
  KEY `idx_notificacoes_pedido` (`pedido_id`),
  KEY `idx_notificacoes_usuario_lida_data` (`usuario_id`,`lida`,`data_criacao`),
  CONSTRAINT `fk_notificacoes_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`),
  CONSTRAINT `fk_notificacoes_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=192 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notificacoes`
--

LOCK TABLES `notificacoes` WRITE;
/*!40000 ALTER TABLE `notificacoes` DISABLE KEYS */;
INSERT INTO `notificacoes` VALUES (1,1,10,'entrega_informada','Entrega realizada','O entregador informou que o pedido #10 foi entregue. Confirme o recebimento no seu painel.',1,'2026-11-21 07:23:31'),(2,1,11,'entrega_informada','Entrega realizada','O entregador informou que o pedido #11 foi entregue. Confirme o recebimento no seu painel.',1,'2026-11-21 07:40:05'),(3,1,12,'entrega_informada','Entrega realizada','O entregador informou que o pedido #12 foi entregue. Confirme o recebimento no seu painel.',1,'2026-11-21 07:44:04'),(4,1,13,'entrega_informada','Entrega realizada','O entregador informou que o pedido #13 foi entregue. Confirme o recebimento no seu painel.',1,'2026-11-21 14:43:58'),(5,1,14,'entrega_informada','Entrega realizada','O entregador informou que o pedido #14 foi entregue. Confirme o recebimento no seu painel.',1,'2026-11-21 17:12:22'),(6,1,15,'entrega_informada','Entrega realizada','O entregador informou que o pedido #15 foi entregue. Confirme o recebimento no seu painel.',1,'2026-11-21 18:10:34'),(7,1,16,'pedido_confirmado','Pedido recebido','Seu pedido #16 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-21 19:24:20'),(8,1,16,'entrega_informada','Entrega realizada','O entregador informou que o pedido #16 foi entregue. Confirme o recebimento no seu painel.',1,'2026-11-21 19:28:44'),(9,1,17,'pedido_confirmado','Pedido recebido','Seu pedido #17 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-21 19:38:21'),(10,1,18,'pedido_confirmado','Pedido recebido','Seu pedido #18 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-21 19:49:50'),(11,1,19,'pedido_confirmado','Pedido recebido','Seu pedido #19 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-21 19:50:09'),(12,4,19,'nova_entrega_atribuida','Nova entrega atribuída','Você recebeu uma nova entrega referente ao pedido #19.',1,'2026-11-21 19:52:28'),(13,1,19,'pedido_atribuido_entregador','Pedido encaminhado para entrega','Seu pedido #19 foi atribuído a um entregador e está aguardando a saída para entrega.',1,'2026-11-21 19:52:28'),(14,4,18,'nova_entrega_atribuida','Nova entrega atribuída','Você recebeu uma nova entrega referente ao pedido #18.',1,'2026-11-21 19:55:05'),(15,1,18,'pedido_atribuido_entregador','Pedido encaminhado para entrega','Seu pedido #18 foi atribuído a um entregador e está aguardando a saída para entrega.',1,'2026-11-21 19:55:05'),(16,1,20,'pedido_confirmado','Pedido recebido','Seu pedido #20 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-21 20:00:08'),(17,1,20,'pedido_em_preparo','Pedido em preparo','Seu pedido #20 começou a ser preparado.',1,'2026-11-21 20:01:08'),(18,1,20,'pedido_pronto','Pedido pronto','Seu pedido #20 está pronto e aguardando a próxima etapa.',1,'2026-11-21 20:01:57'),(19,1,18,'entrega_informada','Entrega realizada','O entregador informou que o pedido #18 foi entregue. Confirme o recebimento no seu painel.',1,'2026-11-21 20:03:33'),(20,1,19,'entrega_informada','Entrega realizada','O entregador informou que o pedido #19 foi entregue. Confirme o recebimento no seu painel.',1,'2026-11-21 20:03:36'),(21,1,21,'pedido_confirmado','Pedido recebido','Seu pedido #21 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-21 20:09:01'),(22,1,21,'pedido_em_preparo','Pedido em preparo','Seu pedido #21 começou a ser preparado.',1,'2026-11-21 20:09:39'),(23,1,21,'pedido_pronto','Pedido pronto','Seu pedido #21 está pronto e aguardando a próxima etapa.',1,'2026-11-21 20:09:41'),(24,4,21,'nova_entrega_atribuida','Nova entrega atribuída','Você recebeu uma nova entrega referente ao pedido #21.',1,'2026-11-21 20:09:59'),(25,1,21,'pedido_atribuido_entregador','Pedido encaminhado para entrega','Seu pedido #21 foi atribuído a um entregador e está aguardando a saída para entrega.',1,'2026-11-21 20:09:59'),(26,1,21,'entrega_informada','Entrega realizada','O entregador informou que o pedido #21 foi entregue. Confirme o recebimento no seu painel.',1,'2026-11-21 20:10:18'),(27,1,17,'entrega_informada','Entrega realizada','O entregador informou que o pedido #17 foi entregue. Confirme o recebimento no seu painel.',1,'2026-11-21 20:11:00'),(28,4,10,'cliente_confirmou_recebimento','Recebimento confirmado','O cliente confirmou o recebimento do pedido #10.',1,'2026-11-21 20:17:24'),(29,4,11,'cliente_confirmou_recebimento','Recebimento confirmado','O cliente confirmou o recebimento do pedido #11.',1,'2026-11-21 20:17:24'),(30,4,12,'cliente_confirmou_recebimento','Recebimento confirmado','O cliente confirmou o recebimento do pedido #12.',1,'2026-11-21 20:17:24'),(31,4,13,'cliente_confirmou_recebimento','Recebimento confirmado','O cliente confirmou o recebimento do pedido #13.',1,'2026-11-21 20:17:24'),(32,4,14,'cliente_confirmou_recebimento','Recebimento confirmado','O cliente confirmou o recebimento do pedido #14.',1,'2026-11-21 20:17:24'),(33,4,15,'cliente_confirmou_recebimento','Recebimento confirmado','O cliente confirmou o recebimento do pedido #15.',1,'2026-11-21 20:17:24'),(34,4,16,'cliente_confirmou_recebimento','Recebimento confirmado','O cliente confirmou o recebimento do pedido #16.',1,'2026-11-21 20:17:24'),(35,4,19,'cliente_confirmou_recebimento','Recebimento confirmado','O cliente confirmou o recebimento do pedido #19.',1,'2026-11-21 20:17:24'),(36,4,18,'cliente_confirmou_recebimento','Recebimento confirmado','O cliente confirmou o recebimento do pedido #18.',1,'2026-11-21 20:17:24'),(37,4,21,'cliente_confirmou_recebimento','Recebimento confirmado','O cliente confirmou o recebimento do pedido #21.',1,'2026-11-21 20:17:24'),(43,1,22,'pedido_confirmado','Pedido recebido','Seu pedido #22 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-21 20:37:40'),(44,2,22,'novo_pedido_equipe','Novo pedido recebido','O pedido #22 foi recebido e aguarda atendimento.',1,'2026-11-21 20:37:40'),(45,3,22,'novo_pedido_equipe','Novo pedido recebido','O pedido #22 foi recebido e aguarda atendimento.',1,'2026-11-21 20:37:40'),(46,1,23,'pedido_confirmado','Pedido recebido','Seu pedido #23 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-21 20:51:14'),(47,2,23,'novo_pedido_equipe','Novo pedido recebido','O pedido #23 foi recebido e aguarda atendimento.',1,'2026-11-21 20:51:14'),(48,3,23,'novo_pedido_equipe','Novo pedido recebido','O pedido #23 foi recebido e aguarda atendimento.',1,'2026-11-21 20:51:14'),(49,1,23,'pedido_cancelado','Pedido cancelado','Seu pedido #23 foi cancelado.',1,'2026-11-21 20:55:39'),(50,2,23,'pedido_cancelado_equipe','Pedido cancelado','O pedido #23 foi cancelado pelo teste via CMD.',1,'2026-11-21 20:55:39'),(51,3,23,'pedido_cancelado_equipe','Pedido cancelado','O pedido #23 foi cancelado pelo teste via CMD.',1,'2026-11-21 20:55:39'),(52,1,22,'pedido_cancelado','Pedido cancelado','Seu pedido #22 foi cancelado com sucesso.',1,'2026-11-21 21:00:44'),(53,1,24,'pedido_confirmado','Pedido recebido','Seu pedido #24 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-21 21:05:31'),(54,2,24,'novo_pedido_equipe','Novo pedido recebido','O pedido #24 foi recebido e aguarda atendimento.',1,'2026-11-21 21:05:32'),(55,3,24,'novo_pedido_equipe','Novo pedido recebido','O pedido #24 foi recebido e aguarda atendimento.',1,'2026-11-21 21:05:32'),(56,1,24,'pedido_cancelado','Pedido cancelado','Seu pedido #24 foi cancelado com sucesso.',1,'2026-11-21 21:05:49'),(57,2,24,'pedido_cancelado_equipe','Pedido cancelado','O pedido #24 foi cancelado pelo cliente. Motivo: t',1,'2026-11-21 21:05:49'),(58,3,24,'pedido_cancelado_equipe','Pedido cancelado','O pedido #24 foi cancelado pelo cliente. Motivo: t',1,'2026-11-21 21:05:49'),(59,1,25,'pedido_confirmado','Pedido recebido','Seu pedido #25 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-21 21:27:02'),(60,2,25,'novo_pedido_equipe','Novo pedido recebido','O pedido #25 foi recebido e aguarda atendimento.',1,'2026-11-21 21:27:03'),(61,3,25,'novo_pedido_equipe','Novo pedido recebido','O pedido #25 foi recebido e aguarda atendimento.',1,'2026-11-21 21:27:03'),(62,1,26,'pedido_confirmado','Pedido recebido','Seu pedido #26 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-21 21:31:46'),(63,2,26,'novo_pedido_equipe','Novo pedido recebido','O pedido #26 foi recebido e aguarda atendimento.',1,'2026-11-21 21:31:46'),(64,3,26,'novo_pedido_equipe','Novo pedido recebido','O pedido #26 foi recebido e aguarda atendimento.',1,'2026-11-21 21:31:46'),(65,5,26,'novo_pedido_equipe','Novo pedido recebido','O pedido #26 foi recebido e aguarda atendimento.',1,'2026-11-21 21:31:46'),(66,4,17,'cliente_confirmou_recebimento','Recebimento confirmado','O cliente confirmou o recebimento do pedido #17.',1,'2026-11-21 21:45:26'),(67,1,27,'pedido_confirmado','Pedido recebido','Seu pedido #27 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-21 21:45:49'),(68,2,27,'novo_pedido_equipe','Novo pedido recebido','O pedido #27 foi recebido e aguarda atendimento.',1,'2026-11-21 21:45:49'),(69,3,27,'novo_pedido_equipe','Novo pedido recebido','O pedido #27 foi recebido e aguarda atendimento.',1,'2026-11-21 21:45:49'),(70,5,27,'novo_pedido_equipe','Novo pedido recebido','O pedido #27 foi recebido e aguarda atendimento.',1,'2026-11-21 21:45:49'),(71,1,25,'pedido_em_preparo','Pedido em preparo','Seu pedido #25 começou a ser preparado.',1,'2026-11-21 21:54:16'),(72,1,26,'pedido_em_preparo','Pedido em preparo','Seu pedido #26 começou a ser preparado.',1,'2026-11-21 21:54:18'),(73,1,25,'pedido_pronto','Pedido pronto','Seu pedido #25 está pronto e aguardando a próxima etapa.',1,'2026-11-21 21:54:20'),(74,1,26,'pedido_pronto','Pedido pronto','Seu pedido #26 está pronto e aguardando a próxima etapa.',1,'2026-11-21 21:54:22'),(75,1,27,'pedido_pronto','Pedido pronto','Seu pedido #27 está pronto e aguardando a próxima etapa.',1,'2026-11-21 21:54:26'),(76,4,27,'nova_entrega_atribuida','Nova entrega atribuída','Você recebeu uma nova entrega referente ao pedido #27.',1,'2026-11-21 21:55:17'),(77,1,27,'pedido_atribuido_entregador','Pedido encaminhado para entrega','Seu pedido #27 foi atribuído a um entregador e está aguardando a saída para entrega.',1,'2026-11-21 21:55:17'),(78,1,28,'pedido_confirmado','Pedido recebido','Seu pedido #28 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-21 21:58:37'),(79,2,28,'novo_pedido_equipe','Novo pedido recebido','O pedido #28 foi recebido e aguarda atendimento.',1,'2026-11-21 21:58:37'),(80,3,28,'novo_pedido_equipe','Novo pedido recebido','O pedido #28 foi recebido e aguarda atendimento.',1,'2026-11-21 21:58:37'),(81,5,28,'novo_pedido_equipe','Novo pedido recebido','O pedido #28 foi recebido e aguarda atendimento.',1,'2026-11-21 21:58:37'),(82,1,28,'pedido_em_preparo','Pedido em preparo','Seu pedido #28 começou a ser preparado.',1,'2026-11-21 21:58:58'),(83,1,28,'pedido_cancelado','Pedido cancelado','Seu pedido #28 foi cancelado com sucesso.',1,'2026-11-21 22:00:06'),(84,2,28,'pedido_cancelado_equipe','Pedido cancelado','O pedido #28 foi cancelado pelo cliente. Motivo: horrivel',1,'2026-11-21 22:00:06'),(85,3,28,'pedido_cancelado_equipe','Pedido cancelado','O pedido #28 foi cancelado pelo cliente. Motivo: horrivel',1,'2026-11-21 22:00:06'),(86,5,28,'pedido_cancelado_equipe','Pedido cancelado','O pedido #28 foi cancelado pelo cliente. Motivo: horrivel',1,'2026-11-21 22:00:06'),(87,1,29,'pedido_confirmado','Pedido recebido','Seu pedido #29 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-21 22:04:11'),(88,2,29,'novo_pedido_equipe','Novo pedido recebido','O pedido #29 foi recebido e aguarda atendimento.',1,'2026-11-21 22:04:11'),(89,3,29,'novo_pedido_equipe','Novo pedido recebido','O pedido #29 foi recebido e aguarda atendimento.',1,'2026-11-21 22:04:11'),(90,5,29,'novo_pedido_equipe','Novo pedido recebido','O pedido #29 foi recebido e aguarda atendimento.',1,'2026-11-21 22:04:11'),(91,1,29,'pedido_em_preparo','Pedido em preparo','Seu pedido #29 começou a ser preparado.',1,'2026-11-21 22:04:45'),(92,1,29,'pedido_pronto','Pedido pronto','Seu pedido #29 está pronto e aguardando a próxima etapa.',1,'2026-11-21 22:04:47'),(93,1,30,'pedido_confirmado','Pedido recebido','Seu pedido #30 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-21 22:16:06'),(94,2,30,'novo_pedido_equipe','Novo pedido recebido','O pedido #30 foi recebido e aguarda atendimento.',1,'2026-11-21 22:16:06'),(95,3,30,'novo_pedido_equipe','Novo pedido recebido','O pedido #30 foi recebido e aguarda atendimento.',1,'2026-11-21 22:16:06'),(96,5,30,'novo_pedido_equipe','Novo pedido recebido','O pedido #30 foi recebido e aguarda atendimento.',1,'2026-11-21 22:16:06'),(97,1,30,'pedido_em_preparo','Pedido em preparo','Seu pedido #30 começou a ser preparado.',1,'2026-11-21 22:17:49'),(98,1,30,'pedido_pronto','Pedido pronto para retirada','Seu pedido #30 está pronto! Você já pode retirá-lo em nosso estabelecimento.',1,'2026-11-21 22:17:52'),(99,1,32,'pedido_confirmado','Pedido recebido','Seu pedido #32 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-22 00:38:10'),(100,2,32,'novo_pedido_equipe','Novo pedido recebido','O pedido #32 foi recebido e aguarda atendimento.',1,'2026-11-22 00:38:10'),(101,3,32,'novo_pedido_equipe','Novo pedido recebido','O pedido #32 foi recebido e aguarda atendimento.',1,'2026-11-22 00:38:10'),(102,5,32,'novo_pedido_equipe','Novo pedido recebido','O pedido #32 foi recebido e aguarda atendimento.',1,'2026-11-22 00:38:10'),(103,1,33,'pedido_confirmado','Pedido recebido','Seu pedido #33 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-22 00:40:34'),(104,2,33,'novo_pedido_equipe','Novo pedido recebido','O pedido #33 foi recebido e aguarda atendimento.',1,'2026-11-22 00:40:34'),(105,3,33,'novo_pedido_equipe','Novo pedido recebido','O pedido #33 foi recebido e aguarda atendimento.',1,'2026-11-22 00:40:34'),(106,5,33,'novo_pedido_equipe','Novo pedido recebido','O pedido #33 foi recebido e aguarda atendimento.',1,'2026-11-22 00:40:34'),(107,1,34,'pedido_confirmado','Pedido recebido','Seu pedido #34 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-22 15:08:58'),(108,2,34,'novo_pedido_equipe','Novo pedido recebido','O pedido #34 foi recebido e aguarda atendimento.',1,'2026-11-22 15:08:58'),(109,3,34,'novo_pedido_equipe','Novo pedido recebido','O pedido #34 foi recebido e aguarda atendimento.',1,'2026-11-22 15:08:58'),(110,5,34,'novo_pedido_equipe','Novo pedido recebido','O pedido #34 foi recebido e aguarda atendimento.',1,'2026-11-22 15:08:58'),(111,1,34,'pix_expirado','Pedido cancelado por expiração do PIX','O pedido #34 foi cancelado porque o prazo de 5 minutos para pagamento via PIX terminou.',1,'2026-11-22 15:35:28'),(112,2,34,'pix_expirado','Pedido cancelado por expiração do PIX','O pedido #34 foi cancelado porque o prazo de 5 minutos para pagamento via PIX terminou.',1,'2026-11-22 15:35:28'),(113,3,34,'pix_expirado','Pedido cancelado por expiração do PIX','O pedido #34 foi cancelado porque o prazo de 5 minutos para pagamento via PIX terminou.',1,'2026-11-22 15:35:28'),(114,5,34,'pix_expirado','Pedido cancelado por expiração do PIX','O pedido #34 foi cancelado porque o prazo de 5 minutos para pagamento via PIX terminou.',1,'2026-11-22 15:35:28'),(115,1,35,'pedido_confirmado','Pedido recebido','Seu pedido #35 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-22 15:36:43'),(116,2,35,'novo_pedido_equipe','Novo pedido recebido','O pedido #35 foi recebido e aguarda atendimento.',1,'2026-11-22 15:36:44'),(117,3,35,'novo_pedido_equipe','Novo pedido recebido','O pedido #35 foi recebido e aguarda atendimento.',1,'2026-11-22 15:36:44'),(118,5,35,'novo_pedido_equipe','Novo pedido recebido','O pedido #35 foi recebido e aguarda atendimento.',1,'2026-11-22 15:36:44'),(119,1,35,'pix_expirado','Pedido cancelado por expiração do PIX','O pedido #35 foi cancelado porque o prazo de 5 minutos para pagamento via PIX terminou.',1,'2026-11-22 15:41:43'),(120,2,35,'pix_expirado','Pedido cancelado por expiração do PIX','O pedido #35 foi cancelado porque o prazo de 5 minutos para pagamento via PIX terminou.',1,'2026-11-22 15:41:43'),(121,3,35,'pix_expirado','Pedido cancelado por expiração do PIX','O pedido #35 foi cancelado porque o prazo de 5 minutos para pagamento via PIX terminou.',1,'2026-11-22 15:41:43'),(122,5,35,'pix_expirado','Pedido cancelado por expiração do PIX','O pedido #35 foi cancelado porque o prazo de 5 minutos para pagamento via PIX terminou.',1,'2026-11-22 15:41:43'),(123,1,36,'pedido_confirmado','Pedido recebido','Seu pedido #36 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-22 15:54:10'),(124,2,36,'novo_pedido_equipe','Novo pedido recebido','O pedido #36 foi recebido e aguarda atendimento.',1,'2026-11-22 15:54:10'),(125,3,36,'novo_pedido_equipe','Novo pedido recebido','O pedido #36 foi recebido e aguarda atendimento.',1,'2026-11-22 15:54:10'),(126,5,36,'novo_pedido_equipe','Novo pedido recebido','O pedido #36 foi recebido e aguarda atendimento.',1,'2026-11-22 15:54:10'),(127,1,36,'pix_expirado','Pedido cancelado por expiração do PIX','O pedido #36 foi cancelado porque o prazo de 5 minutos para pagamento via PIX terminou.',1,'2026-11-22 15:59:10'),(128,2,36,'pix_expirado','Pedido cancelado por expiração do PIX','O pedido #36 foi cancelado porque o prazo de 5 minutos para pagamento via PIX terminou.',1,'2026-11-22 15:59:10'),(129,3,36,'pix_expirado','Pedido cancelado por expiração do PIX','O pedido #36 foi cancelado porque o prazo de 5 minutos para pagamento via PIX terminou.',1,'2026-11-22 15:59:10'),(130,5,36,'pix_expirado','Pedido cancelado por expiração do PIX','O pedido #36 foi cancelado porque o prazo de 5 minutos para pagamento via PIX terminou.',1,'2026-11-22 15:59:10'),(131,1,37,'pedido_confirmado','Pedido recebido','Seu pedido #37 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-22 16:03:50'),(132,2,37,'novo_pedido_equipe','Novo pedido recebido','O pedido #37 foi recebido e aguarda atendimento.',1,'2026-11-22 16:03:50'),(133,3,37,'novo_pedido_equipe','Novo pedido recebido','O pedido #37 foi recebido e aguarda atendimento.',1,'2026-11-22 16:03:50'),(134,5,37,'novo_pedido_equipe','Novo pedido recebido','O pedido #37 foi recebido e aguarda atendimento.',1,'2026-11-22 16:03:50'),(135,1,37,'pedido_cancelado','Pedido cancelado','Seu pedido #37 foi cancelado com sucesso.',1,'2026-11-22 16:05:29'),(136,2,37,'pedido_cancelado_equipe','Pedido cancelado','O pedido #37 foi cancelado pelo cliente. Motivo: Cancelado pelo cliente',1,'2026-11-22 16:05:29'),(137,3,37,'pedido_cancelado_equipe','Pedido cancelado','O pedido #37 foi cancelado pelo cliente. Motivo: Cancelado pelo cliente',1,'2026-11-22 16:05:29'),(138,5,37,'pedido_cancelado_equipe','Pedido cancelado','O pedido #37 foi cancelado pelo cliente. Motivo: Cancelado pelo cliente',1,'2026-11-22 16:05:29'),(139,1,38,'pedido_confirmado','Pedido recebido','Seu pedido #38 foi registrado com sucesso e aguarda confirmação.',1,'2026-11-22 16:07:21'),(140,2,38,'novo_pedido_equipe','Novo pedido recebido','O pedido #38 foi recebido e aguarda atendimento.',1,'2026-11-22 16:07:21'),(141,3,38,'novo_pedido_equipe','Novo pedido recebido','O pedido #38 foi recebido e aguarda atendimento.',1,'2026-11-22 16:07:21'),(142,5,38,'novo_pedido_equipe','Novo pedido recebido','O pedido #38 foi recebido e aguarda atendimento.',1,'2026-11-22 16:07:21'),(143,1,38,'pix_expirado','Pedido cancelado por expiração do PIX','O pedido #38 foi cancelado porque o prazo de 5 minutos para pagamento via PIX terminou.',1,'2026-11-22 16:12:23'),(144,2,38,'pix_expirado','Pedido cancelado por expiração do PIX','O pedido #38 foi cancelado porque o prazo de 5 minutos para pagamento via PIX terminou.',1,'2026-11-22 16:12:23'),(145,3,38,'pix_expirado','Pedido cancelado por expiração do PIX','O pedido #38 foi cancelado porque o prazo de 5 minutos para pagamento via PIX terminou.',1,'2026-11-22 16:12:23'),(146,5,38,'pix_expirado','Pedido cancelado por expiração do PIX','O pedido #38 foi cancelado porque o prazo de 5 minutos para pagamento via PIX terminou.',1,'2026-11-22 16:12:23'),(147,1,NULL,'pix_intencao_pendente','PIX gerado','Seu PIX foi gerado. Aguarde a confirmação do pagamento.',1,'2026-11-22 18:51:09'),(148,2,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',1,'2026-11-22 18:51:09'),(149,3,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',1,'2026-11-22 18:51:09'),(150,5,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',1,'2026-11-22 18:51:09'),(151,1,39,'pix_aprovado','Pagamento PIX confirmado','Seu pagamento foi confirmado. O pedido #39 foi criado.',1,'2026-11-22 18:52:49'),(152,1,NULL,'pix_intencao_pendente','PIX gerado','Seu PIX foi gerado. Aguarde a confirmação do pagamento.',1,'2026-11-22 18:55:08'),(153,2,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',0,'2026-11-22 18:55:08'),(154,3,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',1,'2026-11-22 18:55:08'),(155,5,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',1,'2026-11-22 18:55:08'),(156,1,NULL,'pix_intencao_pendente','PIX gerado','Seu PIX foi gerado. Aguarde a confirmação do pagamento.',1,'2026-11-22 19:08:39'),(157,2,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',0,'2026-11-22 19:08:39'),(158,3,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',1,'2026-11-22 19:08:39'),(159,5,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',1,'2026-11-22 19:08:39'),(160,1,NULL,'pix_intencao_pendente','PIX gerado','Seu PIX foi gerado. Aguarde a confirmação do pagamento.',1,'2026-11-22 19:21:39'),(161,2,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',0,'2026-11-22 19:21:39'),(162,3,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',1,'2026-11-22 19:21:39'),(163,5,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',1,'2026-11-22 19:21:39'),(164,4,32,'nova_entrega_atribuida','Nova entrega atribuída','Você recebeu uma nova entrega referente ao pedido #32.',0,'2026-11-22 20:40:49'),(165,1,32,'pedido_atribuido_entregador','Pedido encaminhado para entrega','Seu pedido #32 foi atribuído a um entregador e está aguardando a saída para entrega.',1,'2026-11-22 20:40:49'),(166,1,40,'pedido_confirmado','Pedido recebido','Seu pedido #40 foi registrado com sucesso e aguarda atendimento.',1,'2026-11-22 20:54:50'),(167,2,40,'novo_pedido_equipe','Novo pedido recebido','O pedido #40 foi recebido e aguarda atendimento.',0,'2026-11-22 20:54:50'),(168,3,40,'novo_pedido_equipe','Novo pedido recebido','O pedido #40 foi recebido e aguarda atendimento.',0,'2026-11-22 20:54:50'),(169,5,40,'novo_pedido_equipe','Novo pedido recebido','O pedido #40 foi recebido e aguarda atendimento.',1,'2026-11-22 20:54:50'),(170,1,41,'pedido_confirmado','Pedido recebido','Seu pedido #41 foi registrado com sucesso e aguarda atendimento.',1,'2026-11-22 20:58:54'),(171,2,41,'novo_pedido_equipe','Novo pedido recebido','O pedido #41 foi recebido e aguarda atendimento.',0,'2026-11-22 20:58:54'),(172,3,41,'novo_pedido_equipe','Novo pedido recebido','O pedido #41 foi recebido e aguarda atendimento.',0,'2026-11-22 20:58:54'),(173,5,41,'novo_pedido_equipe','Novo pedido recebido','O pedido #41 foi recebido e aguarda atendimento.',1,'2026-11-22 20:58:54'),(174,1,41,'pedido_em_preparo','Pedido em preparo','Seu pedido #41 começou a ser preparado.',1,'2026-11-22 21:35:46'),(175,1,40,'pedido_em_preparo','Pedido em preparo','Seu pedido #40 começou a ser preparado.',1,'2026-11-22 21:35:49'),(176,1,39,'pedido_em_preparo','Pedido em preparo','Seu pedido #39 começou a ser preparado.',1,'2026-11-22 21:35:52'),(177,1,41,'pedido_pronto','Pedido pronto','Seu pedido #41 está pronto e aguardando a próxima etapa.',1,'2026-11-22 21:35:54'),(178,1,40,'pedido_pronto','Pedido pronto','Seu pedido #40 está pronto e aguardando a próxima etapa.',1,'2026-11-22 21:35:57'),(179,1,39,'pedido_pronto','Pedido pronto','Seu pedido #39 está pronto e aguardando a próxima etapa.',1,'2026-11-22 21:35:59'),(180,1,NULL,'pix_intencao_pendente','PIX aguardando aprovação','Sua intenção de pagamento PIX foi registrada e está aguardando aprovação.',1,'2026-11-23 01:59:47'),(181,2,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',0,'2026-11-23 01:59:47'),(182,3,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',0,'2026-11-23 01:59:47'),(183,5,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',0,'2026-11-23 01:59:47'),(184,1,NULL,'pix_intencao_pendente','PIX aguardando aprovação','Sua intenção de pagamento PIX foi registrada e está aguardando aprovação.',0,'2026-11-23 02:22:09'),(185,2,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',0,'2026-11-23 02:22:09'),(186,3,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',0,'2026-11-23 02:22:09'),(187,5,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',0,'2026-11-23 02:22:09'),(188,1,NULL,'pix_intencao_pendente','PIX aguardando aprovação','Sua intenção de pagamento PIX foi registrada e está aguardando aprovação.',0,'2026-11-23 02:28:59'),(189,2,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',0,'2026-11-23 02:28:59'),(190,3,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',0,'2026-11-23 02:28:59'),(191,5,NULL,'pix_intencao_pendente','PIX aguardando conferência','Uma intenção PIX de R$ 10.00 aguarda pagamento e conferência.',0,'2026-11-23 02:28:59');
/*!40000 ALTER TABLE `notificacoes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pagamentos`
--

DROP TABLE IF EXISTS `pagamentos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pagamentos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pedido_id` int NOT NULL,
  `forma_pagamento` enum('pix','cartao','dinheiro','credito','debito','boleto','outro') NOT NULL,
  `tipo_cartao` enum('debito','credito','vale_refeicao') DEFAULT NULL,
  `valor` decimal(10,2) NOT NULL,
  `status` enum('pendente','aprovado','recusado','cancelado') DEFAULT 'pendente',
  `codigo_transacao` varchar(150) DEFAULT NULL,
  `data_pagamento` datetime DEFAULT NULL,
  `expira_em` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `pedido_id` (`pedido_id`),
  KEY `idx_pagamentos_pix_expiracao` (`forma_pagamento`,`status`,`expira_em`),
  CONSTRAINT `pagamentos_ibfk_1` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pagamentos`
--

LOCK TABLES `pagamentos` WRITE;
/*!40000 ALTER TABLE `pagamentos` DISABLE KEYS */;
INSERT INTO `pagamentos` VALUES (1,1,'pix',NULL,10.00,'cancelado',NULL,NULL,NULL),(2,2,'pix',NULL,10.00,'cancelado',NULL,NULL,NULL),(3,3,'pix',NULL,10.00,'cancelado',NULL,NULL,NULL),(4,4,'pix',NULL,10.00,'cancelado',NULL,NULL,NULL),(5,5,'pix',NULL,16.00,'cancelado',NULL,NULL,NULL),(6,6,'pix',NULL,16.00,'cancelado',NULL,NULL,NULL),(7,7,'pix',NULL,58.50,'pendente',NULL,NULL,NULL),(8,9,'credito',NULL,33.00,'pendente',NULL,NULL,NULL),(9,10,'credito',NULL,46.00,'pendente',NULL,NULL,NULL),(10,11,'dinheiro',NULL,25.00,'pendente',NULL,NULL,NULL),(11,12,'dinheiro',NULL,38.00,'pendente',NULL,NULL,NULL),(12,13,'dinheiro',NULL,33.00,'pendente',NULL,NULL,NULL),(13,14,'dinheiro',NULL,33.00,'pendente',NULL,NULL,NULL),(14,15,'dinheiro',NULL,33.00,'pendente',NULL,NULL,NULL),(15,16,'credito',NULL,25.00,'pendente',NULL,NULL,NULL),(16,17,'dinheiro',NULL,28.00,'pendente',NULL,NULL,NULL),(17,18,'credito',NULL,25.00,'pendente',NULL,NULL,NULL),(18,19,'dinheiro',NULL,28.00,'pendente',NULL,NULL,NULL),(19,20,'credito',NULL,25.00,'pendente',NULL,NULL,NULL),(20,21,'pix',NULL,10.00,'pendente',NULL,NULL,NULL),(21,22,'pix',NULL,35.00,'cancelado',NULL,NULL,NULL),(22,23,'pix',NULL,35.00,'cancelado',NULL,NULL,NULL),(23,24,'pix',NULL,35.00,'cancelado',NULL,NULL,NULL),(24,25,'pix',NULL,35.00,'pendente',NULL,NULL,NULL),(25,26,'pix',NULL,35.00,'pendente',NULL,NULL,NULL),(26,27,'dinheiro',NULL,10.00,'pendente',NULL,NULL,NULL),(27,28,'credito',NULL,10.00,'cancelado',NULL,NULL,NULL),(28,29,'pix',NULL,10.00,'pendente',NULL,NULL,NULL),(29,30,'credito',NULL,10.00,'pendente',NULL,NULL,NULL),(30,31,'dinheiro',NULL,25.00,'aprovado',NULL,'2026-11-22 00:18:46',NULL),(31,32,'pix',NULL,10.00,'pendente',NULL,NULL,NULL),(32,33,'dinheiro',NULL,27.50,'aprovado',NULL,'2026-11-22 01:17:13',NULL),(33,34,'pix',NULL,28.00,'cancelado',NULL,NULL,'2026-11-22 15:13:58'),(34,35,'pix',NULL,10.00,'cancelado',NULL,NULL,'2026-11-22 15:41:43'),(35,36,'pix',NULL,10.00,'cancelado',NULL,NULL,'2026-11-22 15:59:10'),(36,37,'pix',NULL,10.00,'cancelado',NULL,NULL,'2026-11-22 16:08:50'),(37,38,'pix',NULL,25.00,'cancelado',NULL,NULL,'2026-11-22 16:12:21'),(38,39,'pix',NULL,10.00,'aprovado',NULL,'2026-11-22 18:52:49',NULL),(39,40,'dinheiro',NULL,10.00,'pendente',NULL,NULL,NULL),(40,41,'dinheiro',NULL,10.00,'pendente',NULL,NULL,NULL);
/*!40000 ALTER TABLE `pagamentos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pedidos`
--

DROP TABLE IF EXISTS `pedidos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pedidos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int DEFAULT NULL,
  `visitante_nome` varchar(100) DEFAULT NULL,
  `visitante_telefone` varchar(20) DEFAULT NULL,
  `token_acompanhamento_hash` char(64) DEFAULT NULL,
  `endereco_id` int DEFAULT NULL,
  `data_pedido` datetime DEFAULT CURRENT_TIMESTAMP,
  `status` enum('novo','em_preparo','pronto','saiu_para_entrega','concluido','cancelado') DEFAULT 'novo',
  `tipo_entrega` enum('entrega','retirada') DEFAULT 'entrega',
  `subtotal` decimal(10,2) NOT NULL,
  `taxa_entrega` decimal(10,2) DEFAULT '0.00',
  `desconto` decimal(10,2) DEFAULT '0.00',
  `total` decimal(10,2) NOT NULL,
  `observacoes` text,
  `endereco_cep` varchar(12) DEFAULT NULL,
  `endereco_rua` varchar(150) DEFAULT NULL,
  `endereco_numero` varchar(30) DEFAULT NULL,
  `endereco_bairro` varchar(100) DEFAULT NULL,
  `endereco_cidade` varchar(100) DEFAULT NULL,
  `endereco_complemento` varchar(150) DEFAULT NULL,
  `endereco_referencia` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pedidos_token_acompanhamento` (`token_acompanhamento_hash`),
  KEY `endereco_id` (`endereco_id`),
  KEY `idx_pedidos_usuario` (`usuario_id`),
  KEY `idx_pedidos_status` (`status`),
  CONSTRAINT `pedidos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `pedidos_ibfk_2` FOREIGN KEY (`endereco_id`) REFERENCES `enderecos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pedidos`
--

LOCK TABLES `pedidos` WRITE;
/*!40000 ALTER TABLE `pedidos` DISABLE KEYS */;
INSERT INTO `pedidos` VALUES (1,1,NULL,NULL,NULL,3,'2026-11-20 06:21:44','cancelado','entrega',10.00,0.00,0.00,10.00,'Cancelamento: Cancelado pelo cliente',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(2,1,NULL,NULL,NULL,4,'2026-11-20 18:00:06','cancelado','entrega',10.00,0.00,0.00,10.00,'Cancelamento: Cancelado pelo cliente',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(3,1,NULL,NULL,NULL,5,'2026-11-20 18:18:50','cancelado','entrega',10.00,0.00,0.00,10.00,'Cancelamento: Cancelado pelo cliente',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(4,1,NULL,NULL,NULL,6,'2026-11-20 18:27:34','cancelado','entrega',10.00,0.00,0.00,10.00,'Cancelamento: Cancelado pelo cliente',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(5,1,NULL,NULL,NULL,7,'2026-11-20 18:40:16','cancelado','entrega',10.00,6.00,0.00,16.00,'Cancelamento: Cancelado pelo cliente',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(6,1,NULL,NULL,NULL,8,'2026-11-20 19:01:31','cancelado','entrega',10.00,6.00,0.00,16.00,'Cancelamento: oi',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(7,1,NULL,NULL,NULL,9,'2026-11-20 22:48:07','concluido','entrega',52.50,6.00,0.00,58.50,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(9,1,NULL,NULL,NULL,11,'2026-11-21 04:37:28','concluido','entrega',33.00,0.00,0.00,33.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(10,1,NULL,NULL,NULL,12,'2026-11-21 07:21:44','concluido','entrega',46.00,0.00,0.00,46.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(11,1,NULL,NULL,NULL,13,'2026-11-21 07:37:45','concluido','entrega',25.00,0.00,0.00,25.00,'Troco para: R$ 30.00.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(12,1,NULL,NULL,NULL,14,'2026-11-21 07:41:57','concluido','entrega',38.00,0.00,0.00,38.00,'Troco para: R$ 50.00.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(13,1,NULL,NULL,NULL,15,'2026-11-21 14:43:01','concluido','entrega',33.00,0.00,0.00,33.00,'Troco para: R$ 50.00.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(14,1,NULL,NULL,NULL,16,'2026-11-21 16:17:50','concluido','entrega',33.00,0.00,0.00,33.00,'Troco para: R$ 50.00.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(15,1,NULL,NULL,NULL,17,'2026-11-21 18:07:35','concluido','entrega',33.00,0.00,0.00,33.00,'Troco para: R$ 50.00.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(16,1,NULL,NULL,NULL,18,'2026-11-21 19:24:20','concluido','entrega',25.00,0.00,0.00,25.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(17,1,NULL,NULL,NULL,21,'2026-11-21 19:38:21','concluido','entrega',28.00,0.00,0.00,28.00,'Troco para: R$ 50.00.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(18,1,NULL,NULL,NULL,22,'2026-11-21 19:49:50','concluido','entrega',25.00,0.00,0.00,25.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(19,1,NULL,NULL,NULL,23,'2026-11-21 19:50:09','concluido','entrega',28.00,0.00,0.00,28.00,'Troco para: R$ 28.00.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(20,1,NULL,NULL,NULL,24,'2026-11-21 20:00:07','pronto','entrega',25.00,0.00,0.00,25.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(21,1,NULL,NULL,NULL,25,'2026-11-21 20:09:01','concluido','entrega',10.00,0.00,0.00,10.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(22,1,NULL,NULL,NULL,NULL,'2026-11-21 20:37:40','cancelado','retirada',35.00,0.00,0.00,35.00,'Pedido de teste via CMD - notificacoes\nCancelamento: sa',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(23,1,NULL,NULL,NULL,NULL,'2026-11-21 20:51:13','cancelado','retirada',35.00,0.00,0.00,35.00,'Pedido de teste via CMD - notificacoes - 2026-11-21T23:51:13.751Z',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(24,1,NULL,NULL,NULL,NULL,'2026-11-21 21:05:31','cancelado','retirada',35.00,0.00,0.00,35.00,'Pedido de teste via CMD - notificacoes - 2026-11-22T00:05:31.924Z\nCancelamento: t',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(25,1,NULL,NULL,NULL,NULL,'2026-11-21 21:27:02','pronto','retirada',35.00,0.00,0.00,35.00,'Pedido de teste via CMD - notificacoes - 2026-11-22T00:27:02.510Z',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(26,1,NULL,NULL,NULL,NULL,'2026-11-21 21:31:46','pronto','retirada',35.00,0.00,0.00,35.00,'Pedido de teste via CMD - notificacoes - 2026-11-22T00:31:46.225Z',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(27,1,NULL,NULL,NULL,26,'2026-11-21 21:45:49','saiu_para_entrega','entrega',10.00,0.00,0.00,10.00,'Troco para: R$ 50.00.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(28,1,NULL,NULL,NULL,27,'2026-11-21 21:58:37','cancelado','entrega',10.00,0.00,0.00,10.00,'Cancelamento: horrivel',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(29,1,NULL,NULL,NULL,NULL,'2026-11-21 22:04:11','pronto','retirada',10.00,0.00,0.00,10.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(30,1,NULL,NULL,NULL,NULL,'2026-11-21 22:16:06','pronto','retirada',10.00,0.00,0.00,10.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(31,1,NULL,NULL,NULL,NULL,'2026-11-22 00:15:29','pronto','retirada',25.00,0.00,0.00,25.00,'Pedido de teste via CMD - pagamento -1795317329847 - NAO E PEDIDO REAL',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(32,1,NULL,NULL,NULL,28,'2026-11-22 00:38:10','pronto','entrega',10.00,0.00,0.00,10.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(33,1,NULL,NULL,NULL,NULL,'2026-11-22 00:40:34','pronto','retirada',27.50,0.00,0.00,27.50,'Troco para: R$ 50.00.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(34,1,NULL,NULL,NULL,29,'2026-11-22 15:08:57','cancelado','entrega',28.00,0.00,0.00,28.00,'Pedido cancelado automaticamente: PIX não pago em 5 minutos.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(35,1,NULL,NULL,NULL,30,'2026-11-22 15:36:43','cancelado','entrega',10.00,0.00,0.00,10.00,'Pedido cancelado automaticamente: PIX não pago em 5 minutos.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(36,1,NULL,NULL,NULL,31,'2026-11-22 15:54:10','cancelado','entrega',10.00,0.00,0.00,10.00,'Pedido cancelado automaticamente: PIX não pago em 5 minutos.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(37,1,NULL,NULL,NULL,32,'2026-11-22 16:03:50','cancelado','entrega',10.00,0.00,0.00,10.00,'Cancelamento: Cancelado pelo cliente',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(38,1,NULL,NULL,NULL,33,'2026-11-22 16:07:21','cancelado','entrega',25.00,0.00,0.00,25.00,'Pedido cancelado automaticamente: PIX não pago em 5 minutos.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(39,1,NULL,NULL,NULL,34,'2026-11-22 18:52:49','pronto','entrega',10.00,0.00,0.00,10.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(40,1,NULL,NULL,NULL,40,'2026-11-22 20:54:50','pronto','entrega',10.00,0.00,0.00,10.00,'Troco para: R$ 60.00.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(41,1,NULL,NULL,NULL,41,'2026-11-22 20:58:54','pronto','entrega',10.00,0.00,0.00,10.00,'Troco para: R$ 60.00.',NULL,NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `pedidos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `produto_adicionais`
--

DROP TABLE IF EXISTS `produto_adicionais`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `produto_adicionais` (
  `produto_id` int NOT NULL,
  `adicional_id` int NOT NULL,
  PRIMARY KEY (`produto_id`,`adicional_id`),
  KEY `adicional_id` (`adicional_id`),
  CONSTRAINT `produto_adicionais_ibfk_1` FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`),
  CONSTRAINT `produto_adicionais_ibfk_2` FOREIGN KEY (`adicional_id`) REFERENCES `adicionais` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `produto_adicionais`
--

LOCK TABLES `produto_adicionais` WRITE;
/*!40000 ALTER TABLE `produto_adicionais` DISABLE KEYS */;
INSERT INTO `produto_adicionais` VALUES (2,1),(2,2),(2,3),(2,4);
/*!40000 ALTER TABLE `produto_adicionais` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `produtos`
--

DROP TABLE IF EXISTS `produtos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `produtos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `categoria_id` int NOT NULL,
  `nome` varchar(120) NOT NULL,
  `descricao` text,
  `imagem` varchar(255) DEFAULT NULL,
  `preco` decimal(10,2) NOT NULL,
  `disponivel` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `idx_produtos_categoria` (`categoria_id`),
  CONSTRAINT `produtos_ibfk_1` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `produtos`
--

LOCK TABLES `produtos` WRITE;
/*!40000 ALTER TABLE `produtos` DISABLE KEYS */;
INSERT INTO `produtos` VALUES (1,1,'coca-cola','agua','https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQNvBLxJv7s508qEwsd5qeyZBh4xJn8QReCVDbR5RbLmg&s=10',10.00,1),(2,1,'Fraga Burger Teste','Hambúrguer fictício para testar adicionais e personalização do carrinho.',NULL,25.00,1);
/*!40000 ALTER TABLE `produtos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) NOT NULL,
  `email` varchar(120) NOT NULL,
  `telefone` varchar(20) DEFAULT NULL,
  `senha` varchar(255) NOT NULL,
  `tipo` enum('admin','atendente','cozinha','entregador','cliente') DEFAULT 'cliente',
  `ativo` tinyint(1) DEFAULT '1',
  `data_cadastro` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
INSERT INTO `usuarios` VALUES (1,'Eloise Arruda','eloise123@gmail.com','11966202140','$argon2id$v=19$m=65536,t=3,p=4$z5YDE2gh6spkMleyQS7ENg$7yWUrm2e4BBMcUFYdND5Z39PnjqI16EqmRVBakl0hiA','cliente',1,'2026-11-19 03:00:43'),(2,'Fraga','fragalanches@gmail.com',NULL,'$argon2id$v=19$m=65536,t=3,p=4$z7dmtI8mrZ7eF3ZfJP1uTQ$TQJ4P2l9VB7HkRaGUzfpHB4VbeUItiE+yN7SYlSfmAQ','admin',1,'2026-11-20 00:39:35'),(3,'Atendente','atendente@gmail.com','11966202140','$argon2id$v=19$m=65536,t=3,p=4$8D0mTqvDfCQLY5VzTV+4sA$+t3F+J30NZ++DnpD9liNU9yjUzQp+FkheEo1gx0Maqo','atendente',1,'2026-11-20 01:24:03'),(4,'Fred','entregador@gmail.com','31999999999','$argon2id$v=19$m=65536,t=3,p=4$bxwHUFVTZ/KDoOlg9bFd7g$n6uMyv/EYyZsvOO74G3kk9fuEi3McMTaBgcwAp32naM','entregador',1,'2026-11-21 05:03:15'),(5,'Cozinha','cozinha@gmail.com',NULL,'$argon2id$v=19$m=65536,t=3,p=4$v/QfDzMXTUmh7Yg6fINn9g$RiTSBHjJUxRhnlrMY3dFCUmOTuhBpsQEQd64UOVbtAs','cozinha',1,'2026-11-21 16:03:52'),(6,'Arnaldo Pinto','tjgiwgbuiwegow@gmail.com','31 986967876869','$argon2id$v=19$m=65536,t=3,p=4$TAt6qvpT06dym3RMVsCJlg$JZZLyB5vdFSLJEsylt/Jmgp4pXiAJ1QiRcOMok2nRnM','cliente',1,'2026-11-23 10:48:45'),(7,'Tomasturbano Almeida da Silva','uoghauoighoaugoa@gmail.com','316789456789467','$argon2id$v=19$m=65536,t=3,p=4$4PzKN6vo9KL6M4iOpWWnnw$oU1coqRySncnokuOtRETwSW5mRTI2ZNAaqeu4jIxcA8','cliente',1,'2026-11-23 10:54:29');
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-23 11:19:38
