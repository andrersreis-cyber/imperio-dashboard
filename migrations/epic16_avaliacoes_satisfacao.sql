-- ============================================
-- EPIC 16: Sistema de Avaliações de Satisfação
-- Quiz automático via WhatsApp após entrega
-- ============================================

-- ============================================
-- 1. TABELA: followups_agendados
-- Agenda envio do quiz para 30 min após entrega
-- ============================================
CREATE TABLE IF NOT EXISTS followups_agendados (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    telefone TEXT NOT NULL,
    enviar_em TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'cancelado', 'erro')),
    tentativas INTEGER DEFAULT 0,
    erro_mensagem TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_followup_pedido UNIQUE (pedido_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_followups_status_enviar_em 
    ON followups_agendados(status, enviar_em) 
    WHERE status = 'pendente';

CREATE INDEX IF NOT EXISTS idx_followups_telefone 
    ON followups_agendados(telefone);

-- ============================================
-- 2. TABELA: avaliacoes_pedido
-- Armazena respostas do quiz de satisfação
-- ============================================
CREATE TABLE IF NOT EXISTS avaliacoes_pedido (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    telefone TEXT NOT NULL,
    
    -- Notas de 1 a 4 (4 = excelente, 1 = ruim)
    nota_comida INTEGER CHECK (nota_comida IS NULL OR (nota_comida >= 1 AND nota_comida <= 4)),
    nota_entrega INTEGER CHECK (nota_entrega IS NULL OR (nota_entrega >= 1 AND nota_entrega <= 4)),
    nota_recomendacao INTEGER CHECK (nota_recomendacao IS NULL OR (nota_recomendacao >= 1 AND nota_recomendacao <= 4)),
    
    -- Controle do fluxo do quiz
    -- 0 = aguardando início, 1 = pergunta 1 enviada, 2 = pergunta 2 enviada, 3 = pergunta 3 enviada, 4 = finalizado
    etapa_atual INTEGER NOT NULL DEFAULT 0 CHECK (etapa_atual >= 0 AND etapa_atual <= 4),
    
    -- Timestamps
    iniciado_em TIMESTAMP WITH TIME ZONE,
    finalizado_em TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_avaliacao_pedido UNIQUE (pedido_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_avaliacoes_telefone 
    ON avaliacoes_pedido(telefone);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_etapa 
    ON avaliacoes_pedido(etapa_atual) 
    WHERE etapa_atual < 4;

CREATE INDEX IF NOT EXISTS idx_avaliacoes_created 
    ON avaliacoes_pedido(created_at);

-- ============================================
-- 3. FUNÇÃO: agendar_followup_satisfacao
-- Chamada pelo trigger quando pedido é entregue
-- ============================================
CREATE OR REPLACE FUNCTION agendar_followup_satisfacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_telefone TEXT;
BEGIN
    -- Só processa se status mudou para 'entregue'
    IF NEW.status = 'entregue' AND (OLD.status IS NULL OR OLD.status != 'entregue') THEN
        
        -- Extrair telefone do pedido
        v_telefone := NEW.telefone;
        
        -- Se não tem telefone direto, tenta do cliente associado
        IF v_telefone IS NULL AND NEW.cliente_id IS NOT NULL THEN
            SELECT telefone INTO v_telefone 
            FROM clientes 
            WHERE id = NEW.cliente_id;
        END IF;
        
        -- Só agenda se tem telefone
        IF v_telefone IS NOT NULL AND v_telefone != '' THEN
            -- Inserir agendamento (30 minutos após entrega)
            INSERT INTO followups_agendados (pedido_id, telefone, enviar_em)
            VALUES (NEW.id, v_telefone, NOW() + INTERVAL '30 minutes')
            ON CONFLICT (pedido_id) DO UPDATE 
            SET status = 'pendente',
                enviar_em = NOW() + INTERVAL '30 minutes',
                updated_at = NOW();
                
            RAISE NOTICE 'Follow-up agendado para pedido % em 30 minutos', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- ============================================
-- 4. TRIGGER: trigger_agendar_followup
-- Dispara quando pedido é marcado como entregue
-- ============================================
DROP TRIGGER IF EXISTS trigger_agendar_followup ON pedidos;

CREATE TRIGGER trigger_agendar_followup
    AFTER UPDATE OF status ON pedidos
    FOR EACH ROW
    EXECUTE FUNCTION agendar_followup_satisfacao();

-- ============================================
-- 5. FUNÇÃO: atualizar_updated_at_avaliacoes
-- Mantém updated_at atualizado
-- ============================================
CREATE OR REPLACE FUNCTION atualizar_updated_at_avaliacoes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Triggers de updated_at
DROP TRIGGER IF EXISTS trigger_updated_at_avaliacoes ON avaliacoes_pedido;
CREATE TRIGGER trigger_updated_at_avaliacoes
    BEFORE UPDATE ON avaliacoes_pedido
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_updated_at_avaliacoes();

DROP TRIGGER IF EXISTS trigger_updated_at_followups ON followups_agendados;
CREATE TRIGGER trigger_updated_at_followups
    BEFORE UPDATE ON followups_agendados
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_updated_at_avaliacoes();

-- ============================================
-- 6. FUNÇÃO RPC: buscar_followups_pendentes
-- Retorna follow-ups prontos para envio
-- ============================================
CREATE OR REPLACE FUNCTION buscar_followups_pendentes(p_limite INTEGER DEFAULT 10)
RETURNS TABLE (
    id INTEGER,
    pedido_id INTEGER,
    telefone TEXT,
    nome_cliente TEXT,
    itens_pedido JSONB,
    enviar_em TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id,
        f.pedido_id,
        f.telefone,
        COALESCE(p.nome_cliente, 'Cliente') as nome_cliente,
        p.itens as itens_pedido,
        f.enviar_em
    FROM followups_agendados f
    JOIN pedidos p ON p.id = f.pedido_id
    WHERE f.status = 'pendente'
      AND f.enviar_em <= NOW()
    ORDER BY f.enviar_em ASC
    LIMIT p_limite
    FOR UPDATE OF f SKIP LOCKED;
END;
$$;

-- ============================================
-- 7. FUNÇÃO RPC: iniciar_avaliacao
-- Cria registro de avaliação e marca follow-up como enviado
-- ============================================
CREATE OR REPLACE FUNCTION iniciar_avaliacao(
    p_followup_id INTEGER,
    p_pedido_id INTEGER,
    p_telefone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_avaliacao_id INTEGER;
BEGIN
    -- Criar registro de avaliação
    INSERT INTO avaliacoes_pedido (pedido_id, telefone, etapa_atual, iniciado_em)
    VALUES (p_pedido_id, p_telefone, 1, NOW())
    ON CONFLICT (pedido_id) DO UPDATE 
    SET etapa_atual = 1,
        iniciado_em = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_avaliacao_id;
    
    -- Marcar follow-up como enviado
    UPDATE followups_agendados 
    SET status = 'enviado', 
        updated_at = NOW()
    WHERE id = p_followup_id;
    
    RETURN jsonb_build_object(
        'sucesso', true,
        'avaliacao_id', v_avaliacao_id,
        'etapa', 1
    );
END;
$$;

-- ============================================
-- 8. FUNÇÃO RPC: processar_resposta_avaliacao
-- Processa resposta do cliente e avança etapa
-- ============================================
CREATE OR REPLACE FUNCTION processar_resposta_avaliacao(
    p_telefone TEXT,
    p_resposta TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_avaliacao RECORD;
    v_nota INTEGER;
    v_proxima_pergunta TEXT;
    v_finalizado BOOLEAN := false;
BEGIN
    -- Buscar avaliação pendente do telefone
    SELECT * INTO v_avaliacao
    FROM avaliacoes_pedido
    WHERE telefone = p_telefone
      AND etapa_atual > 0
      AND etapa_atual < 4
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Se não encontrou avaliação pendente
    IF v_avaliacao IS NULL THEN
        RETURN jsonb_build_object(
            'tem_avaliacao_pendente', false
        );
    END IF;
    
    -- Converter resposta para nota (1-4)
    -- Aceita: 1, 2, 3, 4 ou emojis correspondentes
    v_nota := CASE 
        WHEN p_resposta ~ '^[1-4]$' THEN p_resposta::INTEGER
        WHEN p_resposta ILIKE '%😋%' OR p_resposta ILIKE '%excelente%' OR p_resposta ILIKE '%otimo%' OR p_resposta ILIKE '%ótimo%' THEN 4
        WHEN p_resposta ILIKE '%😊%' OR p_resposta ILIKE '%bom%' OR p_resposta ILIKE '%legal%' THEN 3
        WHEN p_resposta ILIKE '%😐%' OR p_resposta ILIKE '%regular%' OR p_resposta ILIKE '%ok%' THEN 2
        WHEN p_resposta ILIKE '%😞%' OR p_resposta ILIKE '%ruim%' OR p_resposta ILIKE '%pessimo%' OR p_resposta ILIKE '%péssimo%' THEN 1
        ELSE NULL
    END;
    
    -- Se não conseguiu interpretar a resposta
    IF v_nota IS NULL THEN
        RETURN jsonb_build_object(
            'tem_avaliacao_pendente', true,
            'etapa_atual', v_avaliacao.etapa_atual,
            'resposta_invalida', true,
            'mensagem', 'Desculpe, não entendi. Por favor, responda com um número de 1 a 4 ou use os emojis: 😋 (excelente), 😊 (bom), 😐 (regular), 😞 (ruim)'
        );
    END IF;
    
    -- Atualizar a nota correspondente à etapa
    CASE v_avaliacao.etapa_atual
        WHEN 1 THEN
            UPDATE avaliacoes_pedido 
            SET nota_comida = v_nota, etapa_atual = 2, updated_at = NOW()
            WHERE id = v_avaliacao.id;
            v_proxima_pergunta := 'pergunta_entrega';
            
        WHEN 2 THEN
            UPDATE avaliacoes_pedido 
            SET nota_entrega = v_nota, etapa_atual = 3, updated_at = NOW()
            WHERE id = v_avaliacao.id;
            v_proxima_pergunta := 'pergunta_recomendacao';
            
        WHEN 3 THEN
            UPDATE avaliacoes_pedido 
            SET nota_recomendacao = v_nota, etapa_atual = 4, finalizado_em = NOW(), updated_at = NOW()
            WHERE id = v_avaliacao.id;
            v_proxima_pergunta := 'finalizado';
            v_finalizado := true;
    END CASE;
    
    RETURN jsonb_build_object(
        'tem_avaliacao_pendente', NOT v_finalizado,
        'etapa_atual', v_avaliacao.etapa_atual,
        'nota_registrada', v_nota,
        'proxima_acao', v_proxima_pergunta,
        'finalizado', v_finalizado
    );
END;
$$;

-- ============================================
-- 9. FUNÇÃO RPC: verificar_avaliacao_pendente
-- Verifica se telefone tem avaliação em andamento
-- ============================================
CREATE OR REPLACE FUNCTION verificar_avaliacao_pendente(p_telefone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_avaliacao RECORD;
BEGIN
    SELECT * INTO v_avaliacao
    FROM avaliacoes_pedido
    WHERE telefone = p_telefone
      AND etapa_atual > 0
      AND etapa_atual < 4
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_avaliacao IS NULL THEN
        RETURN jsonb_build_object(
            'tem_avaliacao_pendente', false
        );
    END IF;
    
    RETURN jsonb_build_object(
        'tem_avaliacao_pendente', true,
        'avaliacao_id', v_avaliacao.id,
        'pedido_id', v_avaliacao.pedido_id,
        'etapa_atual', v_avaliacao.etapa_atual
    );
END;
$$;

-- ============================================
-- 10. FUNÇÃO RPC: metricas_satisfacao
-- Retorna métricas agregadas para o dashboard
-- ============================================
CREATE OR REPLACE FUNCTION metricas_satisfacao(
    p_data_inicio DATE DEFAULT NULL,
    p_data_fim DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_data_inicio TIMESTAMP WITH TIME ZONE;
    v_data_fim TIMESTAMP WITH TIME ZONE;
    v_total_avaliacoes INTEGER;
    v_media_comida NUMERIC;
    v_media_entrega NUMERIC;
    v_media_recomendacao NUMERIC;
    v_media_geral NUMERIC;
    v_distribuicao JSONB;
BEGIN
    -- Defaults para últimos 30 dias
    v_data_inicio := COALESCE(p_data_inicio::TIMESTAMP WITH TIME ZONE, NOW() - INTERVAL '30 days');
    v_data_fim := COALESCE(p_data_fim::TIMESTAMP WITH TIME ZONE, NOW()) + INTERVAL '1 day';
    
    -- Métricas básicas
    SELECT 
        COUNT(*),
        ROUND(AVG(nota_comida)::NUMERIC, 2),
        ROUND(AVG(nota_entrega)::NUMERIC, 2),
        ROUND(AVG(nota_recomendacao)::NUMERIC, 2),
        ROUND(AVG((COALESCE(nota_comida, 0) + COALESCE(nota_entrega, 0) + COALESCE(nota_recomendacao, 0))::NUMERIC / 
            NULLIF((CASE WHEN nota_comida IS NOT NULL THEN 1 ELSE 0 END + 
                    CASE WHEN nota_entrega IS NOT NULL THEN 1 ELSE 0 END + 
                    CASE WHEN nota_recomendacao IS NOT NULL THEN 1 ELSE 0 END), 0)), 2)
    INTO v_total_avaliacoes, v_media_comida, v_media_entrega, v_media_recomendacao, v_media_geral
    FROM avaliacoes_pedido
    WHERE etapa_atual = 4  -- Só avaliações finalizadas
      AND created_at >= v_data_inicio
      AND created_at < v_data_fim;
    
    -- Distribuição por nota
    SELECT jsonb_build_object(
        'comida', jsonb_build_object(
            '4', COALESCE(SUM(CASE WHEN nota_comida = 4 THEN 1 ELSE 0 END), 0),
            '3', COALESCE(SUM(CASE WHEN nota_comida = 3 THEN 1 ELSE 0 END), 0),
            '2', COALESCE(SUM(CASE WHEN nota_comida = 2 THEN 1 ELSE 0 END), 0),
            '1', COALESCE(SUM(CASE WHEN nota_comida = 1 THEN 1 ELSE 0 END), 0)
        ),
        'entrega', jsonb_build_object(
            '4', COALESCE(SUM(CASE WHEN nota_entrega = 4 THEN 1 ELSE 0 END), 0),
            '3', COALESCE(SUM(CASE WHEN nota_entrega = 3 THEN 1 ELSE 0 END), 0),
            '2', COALESCE(SUM(CASE WHEN nota_entrega = 2 THEN 1 ELSE 0 END), 0),
            '1', COALESCE(SUM(CASE WHEN nota_entrega = 1 THEN 1 ELSE 0 END), 0)
        ),
        'recomendacao', jsonb_build_object(
            '4', COALESCE(SUM(CASE WHEN nota_recomendacao = 4 THEN 1 ELSE 0 END), 0),
            '3', COALESCE(SUM(CASE WHEN nota_recomendacao = 3 THEN 1 ELSE 0 END), 0),
            '2', COALESCE(SUM(CASE WHEN nota_recomendacao = 2 THEN 1 ELSE 0 END), 0),
            '1', COALESCE(SUM(CASE WHEN nota_recomendacao = 1 THEN 1 ELSE 0 END), 0)
        )
    )
    INTO v_distribuicao
    FROM avaliacoes_pedido
    WHERE etapa_atual = 4
      AND created_at >= v_data_inicio
      AND created_at < v_data_fim;
    
    RETURN jsonb_build_object(
        'total_avaliacoes', COALESCE(v_total_avaliacoes, 0),
        'media_comida', COALESCE(v_media_comida, 0),
        'media_entrega', COALESCE(v_media_entrega, 0),
        'media_recomendacao', COALESCE(v_media_recomendacao, 0),
        'media_geral', COALESCE(v_media_geral, 0),
        'distribuicao', COALESCE(v_distribuicao, '{}'::jsonb),
        'periodo', jsonb_build_object(
            'inicio', v_data_inicio,
            'fim', v_data_fim
        )
    );
END;
$$;

-- ============================================
-- 11. PERMISSÕES
-- ============================================
GRANT SELECT, INSERT, UPDATE ON followups_agendados TO authenticated;
GRANT SELECT, INSERT, UPDATE ON avaliacoes_pedido TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE followups_agendados_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE avaliacoes_pedido_id_seq TO authenticated;

GRANT EXECUTE ON FUNCTION buscar_followups_pendentes TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION iniciar_avaliacao TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION processar_resposta_avaliacao TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION verificar_avaliacao_pendente TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION metricas_satisfacao TO authenticated, service_role;

-- Permissões para anon (Edge Functions)
GRANT SELECT, INSERT, UPDATE ON followups_agendados TO anon;
GRANT SELECT, INSERT, UPDATE ON avaliacoes_pedido TO anon;
GRANT USAGE, SELECT ON SEQUENCE followups_agendados_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE avaliacoes_pedido_id_seq TO anon;
GRANT EXECUTE ON FUNCTION buscar_followups_pendentes TO anon;
GRANT EXECUTE ON FUNCTION iniciar_avaliacao TO anon;
GRANT EXECUTE ON FUNCTION processar_resposta_avaliacao TO anon;
GRANT EXECUTE ON FUNCTION verificar_avaliacao_pendente TO anon;
GRANT EXECUTE ON FUNCTION metricas_satisfacao TO anon;

-- ============================================
-- RESUMO DAS TABELAS E FUNÇÕES CRIADAS:
-- ============================================
-- Tabelas:
--   - followups_agendados: agenda envio do quiz
--   - avaliacoes_pedido: armazena respostas
--
-- Triggers:
--   - trigger_agendar_followup: dispara ao marcar pedido como entregue
--
-- Funções RPC:
--   - buscar_followups_pendentes: lista follow-ups prontos para envio
--   - iniciar_avaliacao: cria avaliação e marca follow-up
--   - processar_resposta_avaliacao: processa resposta do cliente
--   - verificar_avaliacao_pendente: verifica se tem quiz ativo
--   - metricas_satisfacao: retorna métricas para dashboard
-- ============================================

