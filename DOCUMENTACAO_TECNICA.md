# 🔧 DOCUMENTAÇÃO TÉCNICA
## Império Dashboard - Guia do Desenvolvedor

---

## 1. STACK TECNOLÓGICA

### Frontend
```json
{
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-router-dom": "^7.10.1",
  "tailwindcss": "^4.1.18",
  "lucide-react": "^0.561.0",
  "recharts": "^3.5.1",
  "@supabase/supabase-js": "^2.87.1",
  "html5-qrcode": "^2.3.8"
}
```

### Backend
- **Runtime:** Deno (Supabase Edge Functions)
- **Database:** PostgreSQL 15 (Supabase)
- **AI:** OpenAI GPT-4o-mini
- **WhatsApp:** Evolution API

---

## 2. ESTRUTURA DO PROJETO

```
imperio-dashboard/
├── src/
│   ├── main.jsx              # Entry point
│   ├── App.jsx               # Router principal
│   ├── index.css             # Estilos globais
│   │
│   ├── components/
│   │   ├── Header.jsx        # Cabeçalho com título e ações
│   │   ├── Sidebar.jsx       # Menu lateral
│   │   ├── Layout.jsx        # Layout base
│   │   ├── MetricCard.jsx    # Card de métrica
│   │   ├── StatusBadge.jsx   # Badge de status
│   │   ├── Checkout.jsx      # Componente de checkout
│   │   │
│   │   ├── ui/               # Componentes genéricos
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Input.jsx
│   │   │   └── Select.jsx
│   │   │
│   │   └── whatsapp/
│   │       └── InstanceSelector.jsx
│   │
│   ├── pages/
│   │   ├── Dashboard.jsx     # Página inicial
│   │   ├── Pedidos.jsx       # Gestão de pedidos
│   │   ├── Cardapio.jsx      # Gestão de cardápio
│   │   ├── Clients.jsx       # Gestão de clientes
│   │   ├── Mesas.jsx         # Gestão de mesas
│   │   ├── Comandas.jsx      # Gestão de comandas
│   │   ├── PDV.jsx           # Ponto de venda
│   │   ├── Reports.jsx       # Relatórios
│   │   ├── WhatsApp.jsx      # Configuração WhatsApp
│   │   ├── Garcom.jsx        # App do garçom (mobile)
│   │   └── Login.jsx         # Tela de login
│   │
│   └── lib/
│       └── supabase.js       # Cliente Supabase
│
├── supabase/
│   ├── config.toml           # Configuração Supabase CLI
│   │
│   └── functions/
│       ├── ai-agent/
│       │   └── index.ts      # Agente IA (690 linhas)
│       │
│       ├── whatsapp-webhook/
│       │   └── index.ts      # Recebe mensagens WhatsApp
│       │
│       ├── whatsapp-send/
│       │   └── index.ts      # Envia mensagens WhatsApp
│       │
│       ├── whatsapp-connect/
│       │   └── index.ts      # Conecta instância WhatsApp
│       │
│       ├── whatsapp-notify/
│       │   └── index.ts      # Notificações automáticas
│       │
│       ├── transcribe-audio/
│       │   ├── index.ts      # Transcrição de áudio
│       │   └── deno.json     # Import map
│       │
│       └── enviar-followup/
│           └── index.ts      # Quiz de satisfação
│
├── migrations/               # Scripts SQL
│   ├── epic9_*.sql          # Busca inteligente
│   ├── epic11_*.sql         # Notificações
│   ├── epic14_*.sql         # RPC criar_pedido
│   ├── epic16_*.sql         # Avaliações
│   └── trigger_*.sql        # Triggers
│
├── public/
│   ├── manifest.json        # PWA manifest
│   └── icons/               # Ícones PWA
│
├── docs/
│   └── ENV_EXEMPLO.txt      # Exemplo de .env
│
├── vite.config.js           # Configuração Vite
├── eslint.config.js         # Configuração ESLint
├── tailwind.config.js       # Configuração Tailwind
└── package.json             # Dependências
```

---

## 3. BANCO DE DADOS

### 3.1 Diagrama ER (Principais)

```
┌─────────────────┐       ┌─────────────────┐
│    categorias   │       │    produtos     │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │◄──────│ categoria_id    │
│ nome            │       │ id (PK)         │
│ descricao       │       │ nome            │
│ ordem           │       │ descricao       │
│ ativo           │       │ preco           │
└─────────────────┘       │ disponivel      │
                          └────────┬────────┘
                                   │
                                   ▼
┌─────────────────┐       ┌─────────────────┐
│     mesas       │       │ itens_comanda   │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ numero          │       │ comanda_id (FK) │
│ qr_code         │       │ produto_id (FK) │
│ status          │       │ quantidade      │
└────────┬────────┘       │ preco_unitario  │
         │                └────────┬────────┘
         ▼                         │
┌─────────────────┐                │
│    comandas     │◄───────────────┘
├─────────────────┤
│ id (PK)         │
│ mesa_id (FK)    │
│ caixa_id (FK)   │
│ status          │
│ valor_total     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐       ┌─────────────────┐
│     caixa       │       │   vendas_pdv    │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │◄──────│ caixa_id (FK)   │
│ data_abertura   │       │ id (PK)         │
│ data_fechamento │       │ itens           │
│ valor_inicial   │       │ total           │
│ status          │       │ origem          │
└─────────────────┘       └─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│  dados_cliente  │       │    pedidos      │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ telefone (UK)   │◄──────│ phone           │
│ nome_completo   │       │ itens           │
│ endereco        │       │ valor_total     │
│ bairro          │       │ status          │
│ atendimento_ia  │       │ modalidade      │
└─────────────────┘       └────────┬────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│followups_agend. │       │avaliacoes_pedido│       │whatsapp_messages│
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │       │ id (PK)         │
│ pedido_id (FK)  │       │ pedido_id (FK)  │       │ remote_jid      │
│ telefone        │       │ nota_comida     │       │ content         │
│ enviar_em       │       │ nota_entrega    │       │ from_me         │
│ status          │       │ nota_recomend.  │       │ message_type    │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

### 3.2 Funções RPC Customizadas

```sql
-- Criar pedido via WhatsApp
CREATE FUNCTION criar_pedido_rpc(
    p_telefone TEXT,
    p_nome_cliente TEXT,
    p_itens TEXT,          -- JSON string
    p_modalidade TEXT,
    p_forma_pagamento TEXT,
    p_endereco TEXT,
    p_bairro TEXT,
    p_observacoes TEXT,
    p_troco_para TEXT
) RETURNS JSONB

-- Métricas de satisfação
CREATE FUNCTION metricas_satisfacao(
    p_data_inicio DATE DEFAULT NULL,
    p_data_fim DATE DEFAULT NULL
) RETURNS JSONB

-- Processar resposta do quiz
CREATE FUNCTION processar_resposta_avaliacao(
    p_telefone TEXT,
    p_resposta TEXT
) RETURNS JSONB

-- Verificar quiz pendente
CREATE FUNCTION verificar_avaliacao_pendente(
    p_telefone TEXT
) RETURNS JSONB

-- Buscar follow-ups pendentes
CREATE FUNCTION buscar_followups_pendentes(
    p_limite INTEGER DEFAULT 10
) RETURNS TABLE(...)
```

### 3.3 Triggers

```sql
-- Agendar quiz após entrega
CREATE TRIGGER trigger_agendar_followup
AFTER UPDATE ON pedidos
FOR EACH ROW
WHEN (NEW.status = 'entregue' AND OLD.status != 'entregue')
EXECUTE FUNCTION agendar_followup_satisfacao();

-- Atualizar total da comanda
CREATE TRIGGER trigger_atualizar_valor_comanda
AFTER INSERT OR UPDATE OR DELETE ON itens_comanda
FOR EACH ROW
EXECUTE FUNCTION atualizar_valor_comanda();

-- Liberar mesa ao fechar comanda
CREATE TRIGGER trigger_liberar_mesa
AFTER UPDATE ON comandas
FOR EACH ROW
WHEN (NEW.status = 'fechada' AND OLD.status != 'fechada')
EXECUTE FUNCTION liberar_mesa_ao_fechar_comanda();
```

### 3.4 Cron Jobs (pg_cron)

```sql
-- Enviar quiz de satisfação a cada 5 minutos
SELECT cron.schedule(
    'enviar-followups-satisfacao',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://cxhypcvdijqauaibcgyp.supabase.co/functions/v1/enviar-followup',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := '{}'::jsonb
    );
    $$
);
```

---

## 4. EDGE FUNCTIONS

### 4.1 ai-agent (Agente IA)

**Arquivo:** `supabase/functions/ai-agent/index.ts`

**Responsabilidades:**
- Processar mensagens do WhatsApp
- Verificar quiz de satisfação pendente
- Chamar OpenAI para gerar resposta
- Executar tools (consultar_status_pedido, pausar_ia)

**Fluxo:**
```
1. Recebe mensagem (remoteJid, content, pushName)
2. Normaliza telefone
3. Busca/cria cliente
4. Verifica quiz pendente → Se sim, processa resposta
5. Busca histórico de mensagens
6. Monta contexto para OpenAI
7. Chama OpenAI com tools
8. Se tool_call → executa tool → chama OpenAI novamente
9. Retorna resposta
```

**Tools disponíveis:**
- `consultar_status_pedido` - Busca pedidos do cliente
- `pausar_ia` - Transfere para atendente humano

### 4.2 whatsapp-webhook

**Arquivo:** `supabase/functions/whatsapp-webhook/index.ts`

**Responsabilidades:**
- Receber eventos da Evolution API
- Filtrar mensagens válidas
- Salvar mensagem no banco
- Chamar ai-agent
- Enviar resposta via Evolution API

### 4.3 whatsapp-notify

**Arquivo:** `supabase/functions/whatsapp-notify/index.ts`

**Responsabilidades:**
- Enviar notificações de mudança de status
- Templates por status (confirmado, preparando, etc)

### 4.4 enviar-followup

**Arquivo:** `supabase/functions/enviar-followup/index.ts`

**Responsabilidades:**
- Buscar follow-ups pendentes
- Enviar primeira pergunta do quiz
- Marcar como enviado

---

## 5. VARIÁVEIS DE AMBIENTE

### Frontend (.env.local)
```env
VITE_SUPABASE_URL=https://cxhypcvdijqauaibcgyp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Backend (Supabase Secrets)
```env
SUPABASE_URL=https://cxhypcvdijqauaibcgyp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
EVOLUTION_API_URL=https://...
EVOLUTION_API_KEY=...
EVOLUTION_API_INSTANCE_NAME=avello
```

---

## 6. DEPLOY

### Frontend (Netlify)

**Build Settings:**
- Build command: `pnpm build`
- Publish directory: `dist`
- Node version: 18

**Redirects (_redirects):**
```
/* /index.html 200
```

### Backend (Supabase)

**Deploy via CLI:**
```bash
supabase functions deploy ai-agent --no-verify-jwt
supabase functions deploy whatsapp-webhook --no-verify-jwt
supabase functions deploy enviar-followup --no-verify-jwt
```

**Deploy via MCP:**
```
mcp_supabase_deploy_edge_function
```

---

## 7. TESTES

### Testar Agente IA
```bash
curl -X POST https://cxhypcvdijqauaibcgyp.supabase.co/functions/v1/ai-agent \
  -H "Content-Type: application/json" \
  -d '{
    "remoteJid": "5527999999999@s.whatsapp.net",
    "content": "Oi, quero fazer um pedido",
    "pushName": "Teste"
  }'
```

### Testar Quiz
```sql
-- Simular pedido entregue
UPDATE pedidos SET status = 'entregue' WHERE id = 1;

-- Verificar follow-up agendado
SELECT * FROM followups_agendados ORDER BY created_at DESC;

-- Testar função de métricas
SELECT metricas_satisfacao();
```

---

## 8. MONITORAMENTO

### Logs
- Supabase Dashboard → Edge Functions → Logs
- Filtrar por função específica

### Métricas
- Supabase Dashboard → Reports
- Netlify → Analytics

### Alertas
- Configurar alertas no Supabase para erros de função

---

## 9. SEGURANÇA

### Recomendações Pendentes

1. **Habilitar RLS** nas tabelas:
   - `dados_cliente`
   - `pedidos`
   - `whatsapp_messages`
   - `avaliacoes_pedido`
   - `followups_agendados`

2. **Mover extensões** do schema `public`:
   - `vector`
   - `pg_trgm`
   - `unaccent`

3. **Definir search_path** nas funções

---

## 10. ROADMAP FUTURO

### Sugestões de Melhorias

1. **Autenticação** - Implementar login com Supabase Auth
2. **Multi-tenant** - Suporte a múltiplos restaurantes
3. **Pagamento Online** - Integração PIX/cartão
4. **App Mobile** - React Native para garçom
5. **Relatórios Avançados** - Exportação PDF, gráficos

---

**Documentação atualizada em:** 16/01/2026

