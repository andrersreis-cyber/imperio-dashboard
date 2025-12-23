-- ============================================
-- EPIC 11: Sistema de Notificações Automáticas de Pedidos
-- Trigger no Banco de Dados para WhatsApp
-- ============================================

-- 1. Criar tabela de fila de notificações (fallback)
CREATE TABLE IF NOT EXISTS notificacoes_pendentes (
    id SERIAL PRIMARY KEY,
    pedido_id BIGINT NOT NULL,
    status_anterior TEXT,
    status_novo TEXT,
    status_mapeado TEXT,
    telefone TEXT,
    tentativas INT DEFAULT 0,
    processado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    processado_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_pendentes_processado ON notificacoes_pendentes(processado, created_at);

-- 2. Função para notificar cliente quando status muda
CREATE OR REPLACE FUNCTION notificar_cliente_pedido()
RETURNS TRIGGER AS $$
DECLARE
    status_mapeado TEXT;
    supabase_url TEXT := 'https://cxhypcvdijqauaibcgyp.supabase.co';
    supabase_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4aHlwY3ZkaWpxYXVhaWJjZ3lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2Mjg0NzUsImV4cCI6MjA4MTIwNDQ3NX0.3GLQ1hPlee7dMAZiRFeclDEz-Q7G_Uje5eIltp_8VPo';
BEGIN
    -- Só notificar se o status realmente mudou
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Mapear status do banco para status esperado pela Edge Function
    CASE NEW.status
        WHEN 'preparando' THEN status_mapeado := 'confirmado';
        WHEN 'saiu' THEN status_mapeado := 'saiu_entrega';
        WHEN 'entregue' THEN status_mapeado := 'entregue';
        ELSE 
            -- Status que não requer notificação (pendente, cancelado)
            RETURN NEW;
    END CASE;

    -- Só notificar se tiver telefone
    IF NEW.phone IS NULL OR NEW.phone = '' THEN
        RETURN NEW;
    END IF;

    -- Tentar chamar Edge Function usando pg_net (assíncrono - não bloqueia)
    BEGIN
        PERFORM net.http_post(
            url := supabase_url || '/functions/v1/whatsapp-notify',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || supabase_anon_key
            ),
            body := jsonb_build_object(
                'pedidoId', NEW.id,
                'novoStatus', status_mapeado
            )
        );
    EXCEPTION WHEN OTHERS THEN
        -- Se pg_net não estiver disponível ou houver erro, registrar na fila
        INSERT INTO notificacoes_pendentes (pedido_id, status_anterior, status_novo, status_mapeado, telefone)
        VALUES (NEW.id, OLD.status, NEW.status, status_mapeado, NEW.phone)
        ON CONFLICT DO NOTHING;
        
        -- Log do erro (não bloqueia a atualização)
        RAISE WARNING 'Erro ao notificar cliente (pedido %): %. Registrado na fila.', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar trigger que executa após UPDATE na tabela pedidos
DROP TRIGGER IF EXISTS trg_notificar_cliente_pedido ON pedidos;

CREATE TRIGGER trg_notificar_cliente_pedido
    AFTER UPDATE OF status ON pedidos
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION notificar_cliente_pedido();

-- ============================================
-- MAPEAMENTO DE STATUS
-- ============================================
-- pendente → (sem notificação)
-- preparando → confirmado → Template: pedido_confirmado
-- saiu → saiu_entrega → Template: pedido_saiu  
-- entregue → entregue → Template: pedido_entregue
-- cancelado → (sem notificação)
-- ============================================

-- ============================================
-- FIM DA MIGRAÇÃO
-- ============================================

