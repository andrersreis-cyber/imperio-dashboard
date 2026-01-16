-- Migration: Adicionar caixa_id na tabela comandas e origem na tabela vendas_pdv
-- Fase 1 do plano de correção PDV-Comandas
-- Data: 2026-01-16

-- =====================================================
-- 1. Adicionar coluna caixa_id na tabela comandas
-- =====================================================
-- Permite vincular a comanda ao caixa que recebeu o pagamento
ALTER TABLE comandas 
ADD COLUMN IF NOT EXISTS caixa_id BIGINT REFERENCES caixa(id);

-- Índice para buscas por caixa
CREATE INDEX IF NOT EXISTS idx_comandas_caixa_id ON comandas(caixa_id);

-- Comentário explicativo
COMMENT ON COLUMN comandas.caixa_id IS 'ID do caixa que recebeu o pagamento ao fechar a comanda';

-- =====================================================
-- 2. Adicionar coluna origem na tabela vendas_pdv
-- =====================================================
-- Permite identificar se a venda veio do PDV ou de uma comanda fechada
ALTER TABLE vendas_pdv 
ADD COLUMN IF NOT EXISTS origem VARCHAR(50) DEFAULT 'pdv';

-- Adicionar coluna para vincular à comanda original (se aplicável)
ALTER TABLE vendas_pdv 
ADD COLUMN IF NOT EXISTS comanda_id INTEGER REFERENCES comandas(id);

-- Adicionar coluna para identificar mesa (se aplicável)
ALTER TABLE vendas_pdv 
ADD COLUMN IF NOT EXISTS mesa_numero INTEGER;

-- Índices
CREATE INDEX IF NOT EXISTS idx_vendas_pdv_origem ON vendas_pdv(origem);
CREATE INDEX IF NOT EXISTS idx_vendas_pdv_comanda_id ON vendas_pdv(comanda_id);

-- Comentários
COMMENT ON COLUMN vendas_pdv.origem IS 'Origem da venda: pdv, comanda, pdv_mesa';
COMMENT ON COLUMN vendas_pdv.comanda_id IS 'ID da comanda original (se origem=comanda)';
COMMENT ON COLUMN vendas_pdv.mesa_numero IS 'Número da mesa (se aplicável)';

-- =====================================================
-- 3. Atualizar vendas existentes com origem padrão
-- =====================================================
UPDATE vendas_pdv SET origem = 'pdv' WHERE origem IS NULL;

