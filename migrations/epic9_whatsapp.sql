-- ============================================
-- EPIC 9: WhatsApp + Agente IA
-- Execute no SQL Editor do Supabase
-- ============================================

-- 1. Instâncias WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_name VARCHAR(100) NOT NULL,
    instance_id VARCHAR(100),
    api_key VARCHAR(200),
    status VARCHAR(50) DEFAULT 'disconnected',
    qr_code_base64 TEXT,
    phone_number VARCHAR(20),
    profile_name VARCHAR(200),
    webhook_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Mensagens WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id SERIAL PRIMARY KEY,
    remote_jid VARCHAR(50) NOT NULL,
    message_id VARCHAR(100),
    from_me BOOLEAN DEFAULT false,
    message_type VARCHAR(20) DEFAULT 'text',
    content TEXT,
    media_url TEXT,
    status VARCHAR(20) DEFAULT 'sent',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_jid ON whatsapp_messages(remote_jid);
CREATE INDEX IF NOT EXISTS idx_messages_created ON whatsapp_messages(created_at);

-- 3. Sessões do Agente (memória de conversa)
CREATE TABLE IF NOT EXISTS agent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    remote_jid VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    context JSONB DEFAULT '{}',
    messages JSONB DEFAULT '[]',
    last_message_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_jid ON agent_sessions(remote_jid);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON agent_sessions(status);

-- 4. Dados do Cliente
CREATE TABLE IF NOT EXISTS dados_cliente (
    id SERIAL PRIMARY KEY,
    telefone VARCHAR(50) UNIQUE NOT NULL,
    nomewpp VARCHAR(200),
    nome_completo VARCHAR(200),
    endereco TEXT,
    bairro VARCHAR(100),
    ponto_referencia TEXT,
    atendimento_ia VARCHAR(20) DEFAULT 'ativa',
    ultimo_pedido TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cliente_telefone ON dados_cliente(telefone);

-- 5. Templates de Mensagens
CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    nome VARCHAR(100),
    mensagem TEXT NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Inserir templates padrão
INSERT INTO whatsapp_templates (tipo, nome, mensagem) VALUES
('pedido_confirmado', 'Confirmação', 'Pedido confirmado! Entrega em aproximadamente 70 minutos. Obrigada pela preferência! 🍗'),
('pedido_preparo', 'Em Preparo', 'Seu pedido está sendo preparado com muito carinho! 🍗'),
('pedido_saiu', 'Saiu para Entrega', 'Seu pedido saiu para entrega! Em breve estará aí. 🛵'),
('pedido_entregue', 'Entregue', 'Pedido entregue! Esperamos que aproveite. Obrigada pela preferência! 🍗👑')
ON CONFLICT DO NOTHING;

-- 6. Configurações do Agente
CREATE TABLE IF NOT EXISTS agent_config (
    id SERIAL PRIMARY KEY,
    nome_agente VARCHAR(100) DEFAULT 'Imperatriz',
    ativo BOOLEAN DEFAULT true,
    horario_inicio TIME DEFAULT '19:30',
    horario_fim TIME DEFAULT '23:00',
    mensagem_fora_horario TEXT DEFAULT 'Olá! Nosso horário de atendimento é de Quarta a Domingo, das 19h30 às 23h. Volte a nos contatar nesse período!',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Inserir config padrão
INSERT INTO agent_config (nome_agente) VALUES ('Imperatriz') ON CONFLICT DO NOTHING;

-- ============================================
-- FIM DA MIGRAÇÃO
-- ============================================
