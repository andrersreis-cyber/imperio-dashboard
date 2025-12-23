-- ============================================
-- EPIC 9.2: Motor de Busca Híbrido (Antifalha)
-- ============================================

-- 1. Tabela de Termos Inteligentes (Dicionário)
-- Mapeia "bata" -> Produto ID 10
-- Mapeia "refri" -> Categoria "Refrigerantes"
CREATE TABLE IF NOT EXISTS search_terms (
    id SERIAL PRIMARY KEY,
    termo VARCHAR(100) NOT NULL, -- O que o usuário digita (ex: "bata", "cervela")
    termo_normalizado VARCHAR(100) NOT NULL, -- Sem acento, minúsculo (ex: "bata")
    tipo_alvo VARCHAR(20) NOT NULL CHECK (tipo_alvo IN ('produto', 'categoria')), -- O que isso representa
    alvo_id INT, -- ID do produto ou categoria (opcional, pode ser NULL se for só keyword)
    nome_alvo VARCHAR(200), -- Nome legível para retorno rápido (ex: "Batata Frita")
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_terms_norm ON search_terms(termo_normalizado);

-- População Inicial do Dicionário (Termos Críticos)
INSERT INTO search_terms (termo, termo_normalizado, tipo_alvo, nome_alvo) VALUES
-- Mapeamento de Categorias
('refri', 'refri', 'categoria', 'Refrigerantes'),
('refrigerante', 'refrigerante', 'categoria', 'Refrigerantes'),
('suco', 'suco', 'categoria', 'Sucos'),
('sucos', 'sucos', 'categoria', 'Sucos'),
('bebida', 'bebida', 'categoria', 'Bebidas'),
('cerveja', 'cerveja', 'categoria', 'Cervejas'),
('cerva', 'cerva', 'categoria', 'Cervejas'),
('breja', 'breja', 'categoria', 'Cervejas'),
('agua', 'agua', 'categoria', 'Água'),
('porcao', 'porcao', 'categoria', 'Porções'),
('porções', 'porcoes', 'categoria', 'Porções'),
('comida', 'comida', 'categoria', 'Porções'),

-- Mapeamento de Erros Comuns -> Produtos Específicos
('bata', 'bata', 'produto', 'Batata Frita'),
('batata', 'batata', 'produto', 'Batata Frita'),
('fritas', 'fritas', 'produto', 'Batata Frita'),
('cervela', 'cervela', 'produto', 'Calabresa'),
('salsicha', 'salsicha', 'produto', 'Calabresa'),
('calabresa', 'calabreza', 'produto', 'Calabresa'),
('linguica', 'linguica', 'produto', 'Calabresa'),
('frango', 'frango', 'produto', 'Frango à Passarinho'),
('galinha', 'galinha', 'produto', 'Frango à Passarinho'),
('passarinho', 'passarinho', 'produto', 'Frango à Passarinho'),
('carne', 'carne', 'produto', 'Carne de Sol'),
('sol', 'sol', 'produto', 'Carne de Sol')
ON CONFLICT DO NOTHING;

-- 2. Configuração de Full Text Search (FTS) na Tabela Produtos
-- Adiciona coluna vetorizada que entende radicais de palavras
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS fts_vector tsvector;

-- Função para atualizar o vetor FTS automaticamente
CREATE OR REPLACE FUNCTION produtos_fts_update() RETURNS TRIGGER AS $$
BEGIN
    -- Peso A: Nome do produto (Mais importante)
    -- Peso B: Categoria (Importante)
    -- Peso C: Descrição (Menos importante)
    NEW.fts_vector := 
        setweight(to_tsvector('portuguese', unaccent(COALESCE(NEW.nome, ''))), 'A') ||
        setweight(to_tsvector('portuguese', unaccent(COALESCE((SELECT nome FROM categorias WHERE id = NEW.categoria_id), ''))), 'B') ||
        setweight(to_tsvector('portuguese', unaccent(COALESCE(NEW.descricao, ''))), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para manter atualizado
DROP TRIGGER IF EXISTS trg_produtos_fts ON produtos;
CREATE TRIGGER trg_produtos_fts
    BEFORE INSERT OR UPDATE ON produtos
    FOR EACH ROW
    EXECUTE FUNCTION produtos_fts_update();

-- Atualizar dados existentes
UPDATE produtos SET id = id; -- Força o trigger a rodar em todos

-- Índice GIN para busca instantânea
CREATE INDEX IF NOT EXISTS idx_produtos_fts ON produtos USING GIN(fts_vector);

-- 3. MOTOR DE BUSCA V1 (A Lógica Robusta)
CREATE OR REPLACE FUNCTION search_engine_v1(
    termo_busca TEXT,
    limite INT DEFAULT 5
)
RETURNS TABLE (
    tipo_resultado VARCHAR, -- 'produto', 'categoria', 'sugestao'
    id INT,
    nome VARCHAR,
    descricao VARCHAR,
    preco NUMERIC,
    score NUMERIC, -- Grau de certeza (0.0 a 1.0)
    metodo VARCHAR -- 'dicionario', 'fulltext', 'fuzzy'
) AS $$
DECLARE
    termo_norm TEXT;
    termo_tsquery TSQUERY;
BEGIN
    -- 1. Normalização
    termo_norm := LOWER(unaccent(termo_busca));
    
    -- ====================================================
    -- CAMADA 1: DICIONÁRIO (Busca Exata e Intenção)
    -- ====================================================
    RETURN QUERY
    SELECT 
        st.tipo_alvo::VARCHAR,
        COALESCE(p.id, c.id, 0),
        COALESCE(p.nome, c.nome, st.nome_alvo),
        COALESCE(p.descricao, 'Categoria do cardápio'),
        COALESCE(p.preco, 0),
        1.0::NUMERIC as score, -- Certeza absoluta
        'dicionario'::VARCHAR as metodo
    FROM search_terms st
    LEFT JOIN produtos p ON st.tipo_alvo = 'produto' AND (p.nome = st.nome_alvo OR p.id = st.alvo_id)
    LEFT JOIN categorias c ON st.tipo_alvo = 'categoria' AND (c.nome = st.nome_alvo OR c.id = st.alvo_id)
    WHERE st.termo_normalizado = termo_norm
    LIMIT 5;

    -- Se achou no dicionário, encerra por aqui (prioridade máxima)
    IF FOUND THEN
        RETURN;
    END IF;

    -- ====================================================
    -- CAMADA 2: FULL TEXT SEARCH (Busca Semântica/Radical)
    -- ====================================================
    -- Converte "batatas" -> "batata" (radical)
    BEGIN
        termo_tsquery := plainto_tsquery('portuguese', unaccent(termo_busca));
    EXCEPTION WHEN OTHERS THEN
        termo_tsquery := NULL;
    END;

    IF termo_tsquery IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            'produto'::VARCHAR,
            p.id,
            p.nome,
            p.descricao,
            p.preco,
            ts_rank(p.fts_vector, termo_tsquery)::NUMERIC as score,
            'fulltext'::VARCHAR
        FROM produtos p
        WHERE p.fts_vector @@ termo_tsquery
        AND p.disponivel = true
        ORDER BY score DESC
        LIMIT limite;
        
        IF FOUND THEN
            RETURN;
        END IF;
    END IF;

    -- ====================================================
    -- CAMADA 3: FUZZY SEARCH (Aproximação / Erro Digitação)
    -- ====================================================
    -- Só roda se as anteriores falharem. Usa trigramas.
    RETURN QUERY
    SELECT 
        'produto'::VARCHAR,
        p.id,
        p.nome,
        p.descricao,
        p.preco,
        similarity(normalize_text(p.nome), termo_norm)::NUMERIC as score,
        'fuzzy'::VARCHAR
    FROM produtos p
    WHERE 
        p.disponivel = true
        AND similarity(normalize_text(p.nome), termo_norm) > 0.3 -- Threshold de segurança
    ORDER BY score DESC
    LIMIT limite;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

