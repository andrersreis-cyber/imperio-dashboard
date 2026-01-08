-- Adicionar instance_name em whatsapp_messages para suporte a multi-inquilino/multi-instância
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS instance_name text DEFAULT 'avello';

-- Índices para performance do dashboard (lista de conversas e mensagens)
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_instance_jid_created 
ON public.whatsapp_messages (instance_name, remote_jid, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_instance_created 
ON public.whatsapp_messages (instance_name, created_at DESC);

-- Opcional: Atualizar linhas antigas para garantir consistência (já coberto pelo DEFAULT, mas bom reforçar se remover o default depois)
UPDATE public.whatsapp_messages 
SET instance_name = 'avello' 
WHERE instance_name IS NULL;

