-- Trigger para atualizar valor_total da comanda automaticamente
-- Quando itens são inseridos, atualizados ou deletados em itens_comanda
-- Data: 2026-01-16

CREATE OR REPLACE FUNCTION atualizar_valor_comanda()
RETURNS TRIGGER AS $$
DECLARE
    v_comanda_id INTEGER;
    v_novo_total NUMERIC;
BEGIN
    -- Determinar qual comanda atualizar
    IF TG_OP = 'DELETE' THEN
        v_comanda_id := OLD.comanda_id;
    ELSE
        v_comanda_id := NEW.comanda_id;
    END IF;
    
    -- Calcular novo total
    SELECT COALESCE(SUM(quantidade * preco_unitario), 0)
    INTO v_novo_total
    FROM itens_comanda
    WHERE comanda_id = v_comanda_id;
    
    -- Atualizar comanda
    UPDATE comandas 
    SET valor_total = v_novo_total
    WHERE id = v_comanda_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_atualizar_valor_comanda ON itens_comanda;

CREATE TRIGGER trigger_atualizar_valor_comanda
AFTER INSERT OR UPDATE OR DELETE ON itens_comanda
FOR EACH ROW
EXECUTE FUNCTION atualizar_valor_comanda();

-- Atualizar valores existentes (recalcular todas as comandas abertas)
UPDATE comandas c
SET valor_total = (
    SELECT COALESCE(SUM(quantidade * preco_unitario), 0)
    FROM itens_comanda ic
    WHERE ic.comanda_id = c.id
)
WHERE status = 'aberta';

