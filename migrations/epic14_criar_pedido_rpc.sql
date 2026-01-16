-- ============================================
-- EPIC 14: RPC Function para Criar Pedidos
-- Substitui lógica complexa da Edge Function
-- ============================================

-- Função RPC robusta que encapsula toda a lógica de criação de pedidos
-- Retorna JSONB com resultado estruturado (sucesso/erro)
CREATE OR REPLACE FUNCTION criar_pedido_rpc(
    p_telefone TEXT,
    p_nome_cliente TEXT,
    p_itens JSONB,  -- Array de {nome, quantidade, preco_unitario?}
    p_modalidade TEXT,  -- 'entrega' ou 'retirada'
    p_forma_pagamento TEXT,
    p_bairro TEXT DEFAULT NULL,  -- Obrigatório se entrega
    p_endereco TEXT DEFAULT NULL,  -- Pode ser completo ou separado
    p_rua TEXT DEFAULT NULL,
    p_numero TEXT DEFAULT NULL,
    p_ponto_referencia TEXT DEFAULT NULL,
    p_observacoes TEXT DEFAULT NULL,
    p_troco_para NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subtotal NUMERIC := 0;
    v_taxa_entrega NUMERIC := 0;
    v_desconto_pix NUMERIC := 0;
    v_valor_total NUMERIC;
    v_pedido_id INTEGER;
    v_bairro_data RECORD;
    v_item JSONB;
    v_produto RECORD;
    v_itens_validados JSONB := '[]'::JSONB;
    v_modalidade_final TEXT;
    v_pagamento_final TEXT;
    v_endereco_completo TEXT;
    v_erro TEXT;
    v_itens_invalidos JSONB := '[]'::JSONB;
    v_cinco_minutos_atras TIMESTAMP;
    v_pedido_similar RECORD;
    v_itens_atuais_str TEXT;
    v_mensagem_sucesso TEXT;
    v_bairro_nome_final TEXT;  -- Nome do bairro (só preenchido se entrega)
BEGIN
    -- ============================================
    -- 1. VALIDAÇÕES INICIAIS
    -- ============================================
    
    -- Normalizar modalidade
    v_modalidade_final := LOWER(TRIM(COALESCE(p_modalidade, '')));
    
    -- Normalizar forma de pagamento
    v_pagamento_final := LOWER(TRIM(COALESCE(p_forma_pagamento, '')));
    
    -- Validar telefone obrigatório
    IF COALESCE(p_telefone, '') = '' THEN
        RETURN jsonb_build_object(
            'sucesso', false,
            'erro', 'Telefone obrigatório',
            'mensagem_erro', 'Telefone não informado.',
            'instrucao', 'Informe o telefone do cliente.'
        );
    END IF;
    
    -- Validar modalidade
    IF v_modalidade_final NOT IN ('entrega', 'retirada') THEN
        RETURN jsonb_build_object(
            'sucesso', false,
            'erro', 'Modalidade inválida',
            'mensagem_erro', 'Modalidade deve ser "entrega" ou "retirada".',
            'instrucao', 'Informe a modalidade correta.'
        );
    END IF;
    
    -- Validar forma de pagamento
    IF v_pagamento_final = '' THEN
        RETURN jsonb_build_object(
            'sucesso', false,
            'erro', 'Forma de pagamento obrigatória',
            'mensagem_erro', 'Forma de pagamento não informada.',
            'instrucao', 'Informe a forma de pagamento (pix, dinheiro, cartao_credito, cartao_debito).'
        );
    END IF;
    
    IF v_pagamento_final NOT IN ('pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'cartao') THEN
        RETURN jsonb_build_object(
            'sucesso', false,
            'erro', 'Forma de pagamento inválida',
            'mensagem_erro', 'Forma de pagamento deve ser: pix, dinheiro, cartao_credito ou cartao_debito.',
            'instrucao', 'Informe uma forma de pagamento válida.'
        );
    END IF;
    
    -- Normalizar "cartao" para "cartao_credito"
    IF v_pagamento_final = 'cartao' THEN
        v_pagamento_final := 'cartao_credito';
    END IF;
    
    -- Validar itens
    IF jsonb_typeof(p_itens) IS DISTINCT FROM 'array' OR jsonb_array_length(p_itens) = 0 THEN
        RETURN jsonb_build_object(
            'sucesso', false,
            'erro', 'Nenhum item informado',
            'mensagem_erro', 'O pedido deve conter pelo menos um item.',
            'instrucao', 'Adicione itens ao pedido antes de confirmar.'
        );
    END IF;
    
    -- ============================================
    -- 2. VALIDAÇÃO DE MODALIDADE E ENDEREÇO (se entrega)
    -- ============================================
    
    IF v_modalidade_final = 'entrega' THEN
        -- Validar bairro obrigatório
        IF COALESCE(p_bairro, '') = '' THEN
            RETURN jsonb_build_object(
                'sucesso', false,
                'erro', 'Bairro não informado',
                'mensagem_erro', 'Para entrega, é necessário informar o bairro.',
                'instrucao', 'Peça ao cliente o bairro do endereço de entrega.'
            );
        END IF;
        
        -- Verificar se bairro está na área de atendimento
        SELECT * INTO v_bairro_data
        FROM buscar_bairro_taxa(p_bairro)
        LIMIT 1;
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'sucesso', false,
                'erro', 'Bairro não atendido',
                'mensagem_erro', format('Não atendemos o bairro "%s". Você pode optar pela retirada no local (gratuita)!', p_bairro),
                'instrucao', 'NÃO crie pedido de entrega. Sugira retirada no local.'
            );
        END IF;
        
        v_taxa_entrega := COALESCE(v_bairro_data.taxa_entrega::NUMERIC, 0);
        v_bairro_nome_final := COALESCE(v_bairro_data.nome, p_bairro);
        
        -- Montar endereço completo
        v_endereco_completo := COALESCE(p_endereco, '');
        IF p_rua IS NOT NULL AND p_numero IS NOT NULL THEN
            v_endereco_completo := p_rua || ', ' || p_numero;
        ELSIF v_endereco_completo = '' AND p_rua IS NOT NULL THEN
            v_endereco_completo := p_rua || COALESCE(', ' || p_numero, '');
        END IF;
        
        -- Validar endereço completo (deve ter número)
        IF v_endereco_completo = '' OR v_endereco_completo !~ '\d+' THEN
            RETURN jsonb_build_object(
                'sucesso', false,
                'erro', 'Endereço incompleto',
                'mensagem_erro', 'Para entrega, é necessário informar rua e número do endereço.',
                'instrucao', 'Peça ao cliente: "Qual a rua?" e depois "Qual o número?" ou peça o endereço completo com número.'
            );
        END IF;
    ELSE
        -- Retirada: não precisa endereço
        v_endereco_completo := NULL;
        v_taxa_entrega := 0;
        v_bairro_nome_final := NULL;
    END IF;
    
    -- ============================================
    -- 3. VERIFICAÇÃO DE DUPLICAÇÃO
    -- ============================================
    
    v_cinco_minutos_atras := NOW() - INTERVAL '5 minutes';
    
    -- Normalizar itens atuais para comparação (fora do loop)
    v_itens_atuais_str := (
        SELECT jsonb_agg(
            jsonb_build_object(
                'nome', LOWER(TRIM(item->>'nome')),
                'quantidade', COALESCE((item->>'quantidade')::NUMERIC, 1)
            ) ORDER BY LOWER(TRIM(item->>'nome'))
        )::TEXT
        FROM jsonb_array_elements(p_itens) item
        WHERE TRIM(COALESCE(item->>'nome', '')) != ''
    );
    
    -- Buscar pedidos recentes do mesmo telefone
    FOR v_pedido_similar IN
        SELECT id, itens, created_at
        FROM pedidos
        WHERE phone = p_telefone
          AND created_at >= v_cinco_minutos_atras
        ORDER BY created_at DESC
        LIMIT 3
    LOOP
        -- Normalizar itens do pedido similar
        DECLARE
            v_itens_pedido_str TEXT;
        BEGIN
            v_itens_pedido_str := (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'nome', LOWER(TRIM(item->>'nome')),
                        'quantidade', COALESCE((item->>'quantidade')::NUMERIC, 1)
                    ) ORDER BY LOWER(TRIM(item->>'nome'))
                )::TEXT
                FROM jsonb_array_elements(v_pedido_similar.itens) item
                WHERE TRIM(COALESCE(item->>'nome', '')) != ''
            );
            
            -- Comparar strings normalizadas
            IF v_itens_atuais_str = v_itens_pedido_str THEN
                RETURN jsonb_build_object(
                    'sucesso', false,
                    'erro', 'Pedido duplicado detectado',
                    'mensagem_erro', format('Encontrei um pedido similar criado há pouco tempo (Pedido #%s). Este é um pedido duplicado?', v_pedido_similar.id),
                    'instrucao', 'Pergunte ao cliente se este é um pedido duplicado ou se ele realmente quer criar um novo pedido.'
                );
            END IF;
        END;
    END LOOP;
    
    -- ============================================
    -- 4. VALIDAÇÃO E CÁLCULO DE ITENS
    -- ============================================
    
    -- Processar cada item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        DECLARE
            v_nome_item TEXT;
            v_quantidade_item NUMERIC;
            v_preco_unitario NUMERIC;
            v_produto_encontrado BOOLEAN := false;
            v_resultado_busca RECORD;
        BEGIN
            v_nome_item := TRIM(COALESCE(v_item->>'nome', ''));
            v_quantidade_item := COALESCE((v_item->>'quantidade')::NUMERIC, 1);
            v_preco_unitario := COALESCE((v_item->>'preco_unitario')::NUMERIC, 0);
            
            -- Se não tem nome, pular
            IF v_nome_item = '' THEN
                CONTINUE;
            END IF;
            
            -- Se já tem preço válido, usar (confiar no agente)
            IF v_preco_unitario > 0 THEN
                v_itens_validados := v_itens_validados || jsonb_build_object(
                    'nome', v_nome_item,
                    'quantidade', v_quantidade_item,
                    'preco_unitario', v_preco_unitario
                );
                v_subtotal := v_subtotal + (v_preco_unitario * v_quantidade_item);
                CONTINUE;
            END IF;
            
            -- Buscar produto usando search_engine_v1
            SELECT * INTO v_resultado_busca
            FROM search_engine_v1(v_nome_item, 1)
            WHERE tipo_resultado = 'produto'
            LIMIT 1;
            
            IF FOUND AND v_resultado_busca.score >= 0.4 THEN
                -- Buscar produto completo
                SELECT p.* INTO v_produto
                FROM produtos p
                WHERE p.id = v_resultado_busca.id
                  AND p.disponivel = true
                LIMIT 1;
                
                IF FOUND THEN
                    v_preco_unitario := COALESCE(v_produto.preco_promocional, v_produto.preco);
                    v_nome_item := v_produto.nome;  -- Normalizar nome
                    v_produto_encontrado := true;
                END IF;
            END IF;
            
            -- Se não encontrou, tentar busca direta como fallback
            IF NOT v_produto_encontrado THEN
                SELECT p.* INTO v_produto
                FROM produtos p
                WHERE p.nome ILIKE '%' || v_nome_item || '%'
                  AND p.disponivel = true
                ORDER BY 
                    CASE WHEN p.nome ILIKE v_nome_item THEN 1 ELSE 2 END,
                    p.nome
                LIMIT 1;
                
                IF FOUND THEN
                    v_preco_unitario := COALESCE(v_produto.preco_promocional, v_produto.preco);
                    v_nome_item := v_produto.nome;
                    v_produto_encontrado := true;
                END IF;
            END IF;
            
            -- Adicionar item válido ou inválido
            IF v_produto_encontrado AND v_preco_unitario > 0 THEN
                v_itens_validados := v_itens_validados || jsonb_build_object(
                    'nome', v_nome_item,
                    'quantidade', v_quantidade_item,
                    'preco_unitario', v_preco_unitario
                );
                v_subtotal := v_subtotal + (v_preco_unitario * v_quantidade_item);
            ELSE
                v_itens_invalidos := v_itens_invalidos || jsonb_build_object(
                    'nome_busca', v_nome_item,
                    'motivo', CASE 
                        WHEN NOT v_produto_encontrado THEN 'produto não encontrado'
                        WHEN v_preco_unitario <= 0 THEN 'preço inválido'
                        ELSE 'indisponível'
                    END
                );
            END IF;
        END;
    END LOOP;
    
    -- Validar se há itens válidos
    IF jsonb_array_length(v_itens_validados) = 0 THEN
        RETURN jsonb_build_object(
            'sucesso', false,
            'erro', 'Nenhum item válido no pedido',
            'mensagem_erro', 'Nenhum item válido foi encontrado. Use buscar_item para confirmar os itens.',
            'itens_invalidos', v_itens_invalidos,
            'instrucao', 'Verifique os itens e tente novamente.'
        );
    END IF;
    
    -- Se há itens inválidos, retornar erro (mas não bloquear se houver itens válidos)
    -- Na prática, vamos apenas avisar mas permitir criar com itens válidos
    
    -- ============================================
    -- 5. CÁLCULO DE TAXA E DESCONTO
    -- ============================================
    
    -- Taxa já calculada acima se entrega
    
    -- Calcular desconto PIX (5% sobre subtotal)
    IF v_pagamento_final = 'pix' THEN
        v_desconto_pix := v_subtotal * 0.05;
    END IF;
    
    v_valor_total := v_subtotal + v_taxa_entrega - v_desconto_pix;
    
    -- ============================================
    -- 6. VALIDAÇÃO DE VALOR MÍNIMO
    -- ============================================
    
    IF v_subtotal < 20 THEN
        RETURN jsonb_build_object(
            'sucesso', false,
            'erro', format('Valor mínimo do pedido é R$ 20,00. Subtotal atual: R$ %s.', ROUND(v_subtotal, 2)::TEXT),
            'mensagem_erro', format('O valor mínimo do pedido é R$ 20,00. Seu subtotal atual é R$ %s.', ROUND(v_subtotal, 2)::TEXT),
            'instrucao', 'Sugira adicionar mais itens ao pedido.'
        );
    END IF;
    
    -- ============================================
    -- 7. PREPARAR OBSERVAÇÕES
    -- ============================================
    
    DECLARE
        v_observacoes_final TEXT;
    BEGIN
        v_observacoes_final := COALESCE(p_observacoes, '');
        
        -- Adicionar desconto PIX nas observações
        IF v_desconto_pix > 0 THEN
            IF v_observacoes_final != '' THEN
                v_observacoes_final := format('Desconto PIX: R$ %s | %s', ROUND(v_desconto_pix, 2)::TEXT, v_observacoes_final);
            ELSE
                v_observacoes_final := format('Desconto PIX: R$ %s', ROUND(v_desconto_pix, 2)::TEXT);
            END IF;
        END IF;
        
        -- Adicionar troco se dinheiro
        IF v_pagamento_final = 'dinheiro' AND p_troco_para IS NOT NULL THEN
            IF v_observacoes_final != '' THEN
                v_observacoes_final := v_observacoes_final || format(' | Troco para R$ %s', ROUND(p_troco_para, 2)::TEXT);
            ELSE
                v_observacoes_final := format('Troco para R$ %s', ROUND(p_troco_para, 2)::TEXT);
            END IF;
        END IF;
        
        -- ============================================
        -- 8. INSERIR PEDIDO
        -- ============================================
        
        INSERT INTO pedidos (
            phone,
            nome_cliente,
            itens,
            valor_total,
            taxa_entrega,
            forma_pagamento,
            endereco_entrega,
            bairro,
            ponto_referencia,
            observacoes,
            status,
            modalidade
        ) VALUES (
            p_telefone,
            COALESCE(p_nome_cliente, 'Cliente WhatsApp'),
            v_itens_validados,
            v_valor_total,
            v_taxa_entrega,
            v_pagamento_final,
            CASE WHEN v_modalidade_final = 'entrega' THEN v_endereco_completo ELSE NULL END,
            v_bairro_nome_final,
            p_ponto_referencia,
            NULLIF(v_observacoes_final, ''),
            'pendente',
            v_modalidade_final
        )
        RETURNING id INTO v_pedido_id;
        
        -- ============================================
        -- 9. RETORNO DE SUCESSO
        -- ============================================
        
        -- Mensagem de sucesso baseada na modalidade
        IF v_modalidade_final = 'retirada' THEN
            v_mensagem_sucesso := 'Seu pedido estará pronto em aproximadamente **30-40 minutos**! Você pode retirar no nosso restaurante.';
        ELSE
            v_mensagem_sucesso := 'Entrega estimada em **50-70 minutos**!';
        END IF;
        
        RETURN jsonb_build_object(
            'sucesso', true,
            'pedido_id', v_pedido_id,
            'mensagem_sucesso', v_mensagem_sucesso,
            'valor_total', ROUND(v_valor_total, 2),
            'subtotal', ROUND(v_subtotal, 2),
            'taxa_entrega', ROUND(v_taxa_entrega, 2),
            'desconto_pix', CASE WHEN v_desconto_pix > 0 THEN ROUND(v_desconto_pix, 2) ELSE NULL END,
            'modalidade', v_modalidade_final,
            'itens_validados', v_itens_validados,
            'itens_invalidos', CASE WHEN jsonb_array_length(v_itens_invalidos) > 0 THEN v_itens_invalidos ELSE NULL END
        );
    END;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log de erro (se tabela error_logs existir)
        BEGIN
            INSERT INTO error_logs (context, error_message, payload)
            VALUES (
                'criar_pedido_rpc',
                SQLERRM,
                jsonb_build_object(
                    'telefone', p_telefone,
                    'modalidade', p_modalidade,
                    'erro_sql', SQLSTATE
                )
            );
        EXCEPTION
            WHEN OTHERS THEN NULL;  -- Ignorar se tabela não existir
        END;
        
        -- Retornar erro estruturado
        RETURN jsonb_build_object(
            'sucesso', false,
            'erro', 'Erro técnico ao criar pedido',
            'erro_tecnico', SQLERRM,
            'mensagem_erro', 'Houve um erro técnico ao salvar o pedido. Por favor, tente novamente.',
            'instrucao', 'Se o problema persistir, entre em contato com o suporte.'
        );
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION criar_pedido_rpc TO authenticated, anon, service_role;
REVOKE EXECUTE ON FUNCTION criar_pedido_rpc FROM public;

-- Comentário da função
COMMENT ON FUNCTION criar_pedido_rpc IS 'Cria um pedido com todas as validações, cálculos e inserção em uma única transação atômica. Retorna JSONB com resultado estruturado.';

