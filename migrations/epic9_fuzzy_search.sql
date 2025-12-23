-- ============================================
-- EPIC 9.1: Busca Fuzzy de Produtos
-- Execute no SQL Editor do Supabase
-- ============================================

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Função para normalizar texto (remover acentos e lowercase)
CREATE OR REPLACE FUNCTION normalize_text(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(unaccent(COALESCE(input_text, '')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Adicionar coluna de busca normalizada na tabela produtos (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'produtos' AND column_name = 'nome_busca'
    ) THEN
        ALTER TABLE produtos ADD COLUMN nome_busca TEXT;
    END IF;
END $$;

-- 4. Atualizar coluna de busca com nomes normalizados
UPDATE produtos SET nome_busca = normalize_text(nome) WHERE nome_busca IS NULL OR nome_busca = '';

-- 5. Criar trigger para manter nome_busca atualizado
CREATE OR REPLACE FUNCTION update_nome_busca()
RETURNS TRIGGER AS $$
BEGIN
    NEW.nome_busca := normalize_text(NEW.nome);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_nome_busca ON produtos;
CREATE TRIGGER trg_update_nome_busca
    BEFORE INSERT OR UPDATE OF nome ON produtos
    FOR EACH ROW
    EXECUTE FUNCTION update_nome_busca();

-- 6. Criar índice GIN para busca por trigramas (performance)
DROP INDEX IF EXISTS idx_produtos_nome_trgm;
CREATE INDEX idx_produtos_nome_trgm ON produtos USING GIN (nome_busca gin_trgm_ops);

-- 7. Função RPC principal: search_products
-- Retorna produtos ordenados por similaridade, com sugestões inteligentes
CREATE OR REPLACE FUNCTION search_products(
    search_term TEXT,
    limit_results INT DEFAULT 5
)
RETURNS TABLE (
    id INT,
    nome TEXT,
    descricao TEXT,
    preco NUMERIC,
    preco_promocional NUMERIC,
    categoria TEXT,
    disponivel BOOLEAN,
    similaridade REAL,
    tipo_match TEXT
) AS $$
DECLARE
    normalized_search TEXT;
    exact_count INT;
BEGIN
    -- Normalizar termo de busca
    normalized_search := normalize_text(search_term);
    
    -- Se termo vazio, retornar vazio
    IF normalized_search = '' OR normalized_search IS NULL THEN
        RETURN;
    END IF;
    
    -- Primeiro: tentar busca exata ou quase exata (>= 0.5 similaridade)
    RETURN QUERY
    SELECT 
        p.id::INT,
        p.nome::TEXT,
        p.descricao::TEXT,
        p.preco::NUMERIC,
        p.preco_promocional::NUMERIC,
        c.nome::TEXT AS categoria,
        p.disponivel::BOOLEAN,
        similarity(p.nome_busca, normalized_search)::REAL AS similaridade,
        CASE 
            WHEN p.nome_busca = normalized_search THEN 'exato'
            WHEN p.nome_busca LIKE '%' || normalized_search || '%' THEN 'contem'
            WHEN similarity(p.nome_busca, normalized_search) >= 0.4 THEN 'similar'
            ELSE 'aproximado'
        END::TEXT AS tipo_match
    FROM produtos p
    LEFT JOIN categorias c ON p.categoria_id = c.id
    WHERE 
        p.disponivel = true
        AND (
            -- Busca exata
            p.nome_busca = normalized_search
            -- Contém o termo
            OR p.nome_busca LIKE '%' || normalized_search || '%'
            -- Similaridade por trigramas (tolerância a erros de digitação)
            OR similarity(p.nome_busca, normalized_search) >= 0.3
            -- Busca por palavras individuais
            OR EXISTS (
                SELECT 1 FROM unnest(string_to_array(normalized_search, ' ')) AS word
                WHERE length(word) >= 3 AND p.nome_busca LIKE '%' || word || '%'
            )
        )
    ORDER BY 
        -- Prioridade: exato > contém > similar
        CASE 
            WHEN p.nome_busca = normalized_search THEN 0
            WHEN p.nome_busca LIKE '%' || normalized_search || '%' THEN 1
            ELSE 2
        END,
        similarity(p.nome_busca, normalized_search) DESC
    LIMIT limit_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Função RPC: get_menu_categories
-- Retorna categorias com contagem de produtos disponíveis
CREATE OR REPLACE FUNCTION get_menu_categories()
RETURNS TABLE (
    categoria_id INT,
    categoria_nome TEXT,
    total_produtos BIGINT,
    produtos_exemplo TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id::INT,
        c.nome::TEXT,
        COUNT(p.id)::BIGINT AS total_produtos,
        ARRAY_AGG(p.nome ORDER BY p.preco ASC)::TEXT[] FILTER (WHERE p.nome IS NOT NULL) AS produtos_exemplo
    FROM categorias c
    LEFT JOIN produtos p ON p.categoria_id = c.id AND p.disponivel = true
    GROUP BY c.id, c.nome
    HAVING COUNT(p.id) > 0
    ORDER BY c.ordem, c.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Função RPC: get_popular_products
-- Retorna produtos mais vendidos ou em destaque
CREATE OR REPLACE FUNCTION get_popular_products(limit_count INT DEFAULT 10)
RETURNS TABLE (
    id INT,
    nome TEXT,
    preco NUMERIC,
    preco_promocional NUMERIC,
    categoria TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id::INT,
        p.nome::TEXT,
        p.preco::NUMERIC,
        p.preco_promocional::NUMERIC,
        c.nome::TEXT AS categoria
    FROM produtos p
    LEFT JOIN categorias c ON p.categoria_id = c.id
    WHERE p.disponivel = true
    ORDER BY p.destaque DESC NULLS LAST, p.preco ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Tabela de sinônimos para mapeamento de termos comuns
CREATE TABLE IF NOT EXISTS produto_sinonimos (
    id SERIAL PRIMARY KEY,
    termo TEXT NOT NULL,
    termo_normalizado TEXT NOT NULL,
    produto_nome TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sinonimos_termo ON produto_sinonimos(termo_normalizado);

-- Inserir sinônimos comuns (erros de digitação e variações)
INSERT INTO produto_sinonimos (termo, termo_normalizado, produto_nome) VALUES
-- Batata
('bata', 'bata', 'Batata Frita'),
('batatas', 'batatas', 'Batata Frita'),
('fritas', 'fritas', 'Batata Frita'),
('frita', 'frita', 'Batata Frita'),
-- Calabresa
('calabreza', 'calabreza', 'Calabresa'),
('calabreça', 'calabreca', 'Calabresa'),
('linguica', 'linguica', 'Calabresa'),
('salsicha', 'salsicha', 'Calabresa'),
('cervela', 'cervela', 'Calabresa'),
-- Frango
('galinha', 'galinha', 'Frango'),
('asa', 'asa', 'Frango'),
('passarinho', 'passarinho', 'Frango à Passarinho'),
-- Refrigerante
('refri', 'refri', 'Refrigerante'),
('coca', 'coca', 'Coca-Cola'),
('guarana', 'guarana', 'Guaraná'),
('fanta', 'fanta', 'Fanta'),
-- Cerveja
('cerva', 'cerva', 'Cerveja'),
('gelada', 'gelada', 'Cerveja'),
('breja', 'breja', 'Cerveja'),
-- Suco
('sucos', 'sucos', 'Suco'),
('caja', 'caja', 'Suco de Cajá'),
('laranja', 'laranja', 'Suco de Laranja'),
('limao', 'limao', 'Suco de Limão'),
('acerola', 'acerola', 'Suco de Acerola')
ON CONFLICT DO NOTHING;

-- 11. Função aprimorada com sinônimos
CREATE OR REPLACE FUNCTION search_products_smart(
    search_term TEXT,
    limit_results INT DEFAULT 5
)
RETURNS TABLE (
    id INT,
    nome TEXT,
    descricao TEXT,
    preco NUMERIC,
    preco_promocional NUMERIC,
    categoria TEXT,
    disponivel BOOLEAN,
    similaridade REAL,
    tipo_match TEXT,
    sugestao_sinonimo TEXT
) AS $$
DECLARE
    normalized_search TEXT;
    sinonimo_match TEXT;
BEGIN
    normalized_search := normalize_text(search_term);
    
    IF normalized_search = '' OR normalized_search IS NULL THEN
        RETURN;
    END IF;
    
    -- Verificar se há sinônimo cadastrado
    SELECT ps.produto_nome INTO sinonimo_match
    FROM produto_sinonimos ps
    WHERE ps.termo_normalizado = normalized_search
    LIMIT 1;
    
    -- Se encontrou sinônimo, buscar por ele também
    RETURN QUERY
    SELECT 
        p.id::INT,
        p.nome::TEXT,
        p.descricao::TEXT,
        p.preco::NUMERIC,
        p.preco_promocional::NUMERIC,
        c.nome::TEXT AS categoria,
        p.disponivel::BOOLEAN,
        GREATEST(
            similarity(p.nome_busca, normalized_search),
            CASE WHEN sinonimo_match IS NOT NULL 
                 THEN similarity(p.nome_busca, normalize_text(sinonimo_match)) 
                 ELSE 0 END
        )::REAL AS similaridade,
        CASE 
            WHEN p.nome_busca = normalized_search THEN 'exato'
            WHEN sinonimo_match IS NOT NULL AND p.nome_busca LIKE '%' || normalize_text(sinonimo_match) || '%' THEN 'sinonimo'
            WHEN p.nome_busca LIKE '%' || normalized_search || '%' THEN 'contem'
            WHEN similarity(p.nome_busca, normalized_search) >= 0.4 THEN 'similar'
            ELSE 'aproximado'
        END::TEXT AS tipo_match,
        sinonimo_match::TEXT AS sugestao_sinonimo
    FROM produtos p
    LEFT JOIN categorias c ON p.categoria_id = c.id
    WHERE 
        p.disponivel = true
        AND (
            p.nome_busca = normalized_search
            OR p.nome_busca LIKE '%' || normalized_search || '%'
            OR similarity(p.nome_busca, normalized_search) >= 0.25
            OR (sinonimo_match IS NOT NULL AND p.nome_busca LIKE '%' || normalize_text(sinonimo_match) || '%')
            OR EXISTS (
                SELECT 1 FROM unnest(string_to_array(normalized_search, ' ')) AS word
                WHERE length(word) >= 3 AND p.nome_busca LIKE '%' || word || '%'
            )
        )
    ORDER BY 
        CASE 
            WHEN p.nome_busca = normalized_search THEN 0
            WHEN sinonimo_match IS NOT NULL AND p.nome_busca LIKE '%' || normalize_text(sinonimo_match) || '%' THEN 1
            WHEN p.nome_busca LIKE '%' || normalized_search || '%' THEN 2
            ELSE 3
        END,
        similaridade DESC
    LIMIT limit_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FIM DA MIGRAÇÃO - BUSCA FUZZY
-- ============================================

