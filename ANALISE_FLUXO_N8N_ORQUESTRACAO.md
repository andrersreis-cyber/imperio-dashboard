# Análise: Fluxo de Criação de Pedidos via n8n

## 📋 Contexto

**Requisito**: Os pedidos do WhatsApp devem ser criados via **n8n**, não diretamente pela Edge Function.  
**Arquitetura desejada**: n8n orquestra toda a ação de criação de pedidos.

---

## 🔍 Situação Atual

### Fluxo Atual (SEM n8n)

```
WhatsApp (Evolution API)
    ↓
whatsapp-webhook (Edge Function)
    ↓
ai-agent (Edge Function)
    ↓
criar_pedido_rpc (RPC Function no Banco)
    ↓
Tabela pedidos
```

**Código atual** (`supabase/functions/ai-agent/index.ts` linhas 950-986):
```typescript
case 'criar_pedido':
    // Chamar RPC function que encapsula toda a lógica
    const { data: resultado, error: erroRPC } = await supabase
        .rpc('criar_pedido_rpc', {
            p_telefone: telefonePadrao,
            p_nome_cliente: args.nome_cliente || pushName || 'Cliente WhatsApp',
            p_itens: args.itens || [],
            p_modalidade: args.modalidade,
            p_forma_pagamento: args.forma_pagamento,
            // ... outros parâmetros
        })
```

**Problema**: A Edge Function `ai-agent` está criando pedidos **diretamente**, sem passar pelo n8n.

---

## 🎯 Arquitetura Desejada (COM n8n)

### Fluxo Desejado

```
WhatsApp (Evolution API)
    ↓
whatsapp-webhook (Edge Function)
    ↓
ai-agent (Edge Function)
    ↓ [quando precisa criar pedido]
    ↓
n8n Workflow (orquestração)
    ↓
criar_pedido_rpc (RPC Function no Banco)
    ↓
Tabela pedidos
```

**Além disso**:
- ✅ Conversas espelhadas no dashboard (já funciona via `whatsapp_messages`)
- ✅ n8n orquestra toda ação de criação de pedidos

---

## 📊 Análise Detalhada

### 1. **Espelhamento de Conversas no Dashboard**

**Status**: ✅ **JÁ FUNCIONA**

**Como funciona atualmente**:
- `whatsapp-webhook` salva todas as mensagens em `whatsapp_messages` (linhas 174-181)
- Dashboard lê de `whatsapp_messages` para exibir conversas
- Não precisa mudar nada aqui

**Código relevante** (`supabase/functions/whatsapp-webhook/index.ts`):
```typescript
// 1. Salvar mensagem recebida
await supabase.from('whatsapp_messages').insert({
    instance_name: instanceName,
    remote_jid: remoteJid,
    message_id: messageId,
    from_me: false,
    message_type: messageType,
    content: content
})

// ... depois do agente responder ...

// 7. Salvar resposta no banco
await supabase.from('whatsapp_messages').insert({
    instance_name: instanceName,
    remote_jid: remoteJid,
    from_me: true,
    message_type: 'text',
    content: aiResult.response
})
```

---

### 2. **Criação de Pedidos via n8n**

**Status**: ❌ **NÃO ESTÁ IMPLEMENTADO**

**O que precisa mudar**:

#### Opção A: Edge Function chama n8n (Recomendada)

**Fluxo**:
```
ai-agent detecta que precisa criar pedido
    ↓
Chama workflow n8n via HTTP
    ↓
n8n workflow processa e chama criar_pedido_rpc
    ↓
Retorna resultado para ai-agent
    ↓
ai-agent responde ao cliente
```

**Mudanças necessárias**:
1. **Edge Function `ai-agent`**: 
   - Remover chamada direta a `criar_pedido_rpc`
   - Adicionar chamada HTTP para workflow n8n
   - Passar todos os parâmetros do pedido para n8n

2. **n8n Workflow**:
   - Criar workflow que recebe dados do pedido
   - Validar dados
   - Chamar `criar_pedido_rpc` via Postgres node
   - Retornar resultado para Edge Function

#### Opção B: n8n intercepta antes do ai-agent

**Fluxo**:
```
whatsapp-webhook recebe mensagem
    ↓
Chama n8n primeiro
    ↓
n8n decide: processar com IA ou criar pedido
    ↓
Se criar pedido: n8n chama criar_pedido_rpc
    ↓
Se processar: n8n chama ai-agent
```

**Mudanças necessárias**:
- Mudança mais significativa na arquitetura
- `whatsapp-webhook` precisaria chamar n8n primeiro
- n8n seria o orquestrador principal

---

### 3. **Migration `epic14_criar_pedido_rpc.sql`**

**Status**: ✅ **AINDA É NECESSÁRIA**

**Por quê**:
- A RPC function `criar_pedido_rpc` será chamada pelo **n8n**, não diretamente pela Edge Function
- n8n vai usar o node Postgres para chamar a RPC function
- A lógica de validação e criação continua no banco (melhor prática)

**Como n8n vai usar**:
```sql
SELECT criar_pedido_rpc(
    p_telefone := $1,
    p_nome_cliente := $2,
    p_itens := $3::jsonb,
    -- ... outros parâmetros
) as resultado
```

---

### 4. **Migration `epic13_whatsapp_messages_instance.sql`**

**Status**: ✅ **AINDA É NECESSÁRIA**

**Por quê**:
- Suporta multi-instância WhatsApp
- Necessária para espelhamento correto das conversas no dashboard
- Não afeta criação de pedidos, mas é importante para organização

---

## 🔄 Mudanças Necessárias (Quando Autorizado)

### 1. **Modificar Edge Function `ai-agent`**

**Arquivo**: `supabase/functions/ai-agent/index.ts`

**Mudança**: Substituir chamada direta à RPC por chamada ao n8n

**Antes** (linhas 950-986):
```typescript
case 'criar_pedido':
    const { data: resultado, error: erroRPC } = await supabase
        .rpc('criar_pedido_rpc', { ... })
```

**Depois** (proposta):
```typescript
case 'criar_pedido':
    // Chamar workflow n8n que orquestra a criação
    const n8nUrl = Deno.env.get('N8N_WEBHOOK_URL') // Ex: https://n8n.exemplo.com/webhook/criar-pedido
    const n8nResponse = await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            telefone: telefonePadrao,
            nome_cliente: args.nome_cliente || pushName || 'Cliente WhatsApp',
            itens: args.itens || [],
            modalidade: args.modalidade,
            forma_pagamento: args.forma_pagamento,
            bairro: args.bairro || null,
            endereco: args.endereco || null,
            rua: args.rua || null,
            numero: args.numero || null,
            ponto_referencia: args.ponto_referencia || null,
            observacoes: args.observacoes || null,
            troco_para: args.troco_para || null
        })
    })
    
    const resultado = await n8nResponse.json()
    toolResult = JSON.stringify(resultado)
```

### 2. **Criar Workflow n8n**

**Workflow**: "Criar Pedido WhatsApp"

**Estrutura proposta**:
```
1. Webhook Trigger (recebe dados do ai-agent)
2. Validar Dados (Code node)
3. Chamar criar_pedido_rpc (Postgres node)
4. Processar Resultado (Code node)
5. Responder ao Webhook (HTTP Response)
```

**Node Postgres** (chamar RPC):
```sql
SELECT criar_pedido_rpc(
    p_telefone := $1,
    p_nome_cliente := $2,
    p_itens := $3::jsonb,
    p_modalidade := $4,
    p_forma_pagamento := $5,
    p_bairro := $6,
    p_endereco := $7,
    p_rua := $8,
    p_numero := $9,
    p_ponto_referencia := $10,
    p_observacoes := $11,
    p_troco_para := $12
) as resultado
```

### 3. **Variáveis de Ambiente**

**Adicionar**:
- `N8N_WEBHOOK_URL`: URL do webhook do n8n para criar pedidos

---

## ✅ O que NÃO Precisa Mudar

1. ✅ **Espelhamento de conversas**: Já funciona corretamente
2. ✅ **Migration `epic14_criar_pedido_rpc.sql`**: Ainda necessária (n8n vai chamar)
3. ✅ **Migration `epic13_whatsapp_messages_instance.sql`**: Ainda necessária (suporte multi-instância)
4. ✅ **Edge Function `whatsapp-webhook`**: Não precisa mudar (apenas recebe e salva mensagens)
5. ✅ **Edge Function `ai-agent`**: Apenas mudar o case `criar_pedido` (resto continua igual)

---

## 🎯 Resumo da Análise

### Situação Atual
- ❌ Pedidos criados diretamente pela Edge Function
- ✅ Conversas espelhadas no dashboard

### Situação Desejada
- ✅ Pedidos criados via n8n (orquestração)
- ✅ Conversas espelhadas no dashboard (mantém)

### Mudanças Necessárias
1. **Edge Function `ai-agent`**: Substituir chamada RPC por chamada n8n
2. **n8n Workflow**: Criar workflow que recebe dados e chama RPC
3. **Variáveis de Ambiente**: Adicionar `N8N_WEBHOOK_URL`

### Migrations
- ✅ `epic14_criar_pedido_rpc.sql`: **AINDA NECESSÁRIA** (n8n vai chamar)
- ✅ `epic13_whatsapp_messages_instance.sql`: **AINDA NECESSÁRIA** (suporte multi-instância)

---

## ⚠️ Pontos de Atenção

1. **Latência**: Adicionar n8n pode aumentar latência (HTTP adicional)
2. **Disponibilidade**: n8n precisa estar disponível para criar pedidos
3. **Tratamento de Erros**: n8n precisa retornar erros de forma compatível com o agente
4. **Logging**: Garantir logs adequados no n8n para debug
5. **Segurança**: Webhook do n8n precisa ser protegido (autenticação)

---

## 📝 Próximos Passos (Quando Autorizado)

1. ✅ Confirmar URL do webhook n8n
2. ✅ Criar workflow n8n "Criar Pedido WhatsApp"
3. ✅ Modificar Edge Function `ai-agent` para chamar n8n
4. ✅ Testar fluxo completo
5. ✅ Aplicar migrations no banco

---

**Status**: 🔍 **ANÁLISE CONCLUÍDA - AGUARDANDO AUTORIZAÇÃO PARA IMPLEMENTAR**


