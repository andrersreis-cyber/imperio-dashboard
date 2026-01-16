-- Trigger para liberar mesa automaticamente quando comanda é fechada
-- Garante consistência entre status da comanda e status da mesa
-- Data: 2026-01-16

CREATE OR REPLACE FUNCTION liberar_mesa_ao_fechar_comanda()
RETURNS TRIGGER AS $$
BEGIN
    -- Se a comanda foi fechada (status mudou para 'fechada')
    IF NEW.status = 'fechada' AND (OLD.status IS NULL OR OLD.status = 'aberta') THEN
        -- Liberar a mesa
        UPDATE mesas 
        SET status = 'livre'
        WHERE id = NEW.mesa_id;
        
        RAISE NOTICE 'Mesa % liberada automaticamente', NEW.mesa_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_liberar_mesa_ao_fechar_comanda ON comandas;

CREATE TRIGGER trigger_liberar_mesa_ao_fechar_comanda
AFTER UPDATE ON comandas
FOR EACH ROW
EXECUTE FUNCTION liberar_mesa_ao_fechar_comanda();

