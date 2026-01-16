# 📋 DOCUMENTAÇÃO COMPLETA DO SISTEMA
## Império das Porções - Dashboard & Delivery

**Versão:** 1.0.0  
**Data de Entrega:** 16 de Janeiro de 2026  
**Desenvolvido por:** Claude (Anthropic) - Opus 4.5

---

## 📑 ÍNDICE

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Funcionalidades](#3-funcionalidades)
4. [Módulos do Dashboard](#4-módulos-do-dashboard)
5. [Integração WhatsApp](#5-integração-whatsapp)
6. [Banco de Dados](#6-banco-de-dados)
7. [Edge Functions (Backend)](#7-edge-functions-backend)
8. [Configuração e Deploy](#8-configuração-e-deploy)
9. [Manutenção e Operação](#9-manutenção-e-operação)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. VISÃO GERAL

### 1.1 Descrição do Sistema

O **Império Dashboard** é uma solução completa de gestão para restaurantes, composta por:

- **Dashboard Web** - Painel administrativo para gestão completa
- **App de Delivery** - Cardápio online para clientes
- **Agente IA (Imperatriz)** - Assistente virtual via WhatsApp
- **App do Garçom** - Interface mobile para atendimento em mesas
- **PDV (Ponto de Venda)** - Sistema de caixa e vendas

### 1.2 Tecnologias Utilizadas

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 19, Vite 7, TailwindCSS 4 |
| Backend | Supabase Edge Functions (Deno) |
| Banco de Dados | PostgreSQL (Supabase) |
| Hospedagem | Netlify (Frontend), Supabase (Backend) |
| WhatsApp | Evolution API |
| IA | OpenAI GPT-4o-mini |

### 1.3 URLs de Acesso

| Ambiente | URL |
|----------|-----|
| Dashboard Produção | https://imperiofood.netlify.app |
| Cardápio Online | https://imperiofood.netlify.app/cardapio |
| App do Garçom | https://imperiofood.netlify.app/garcom |
| Supabase Dashboard | https://supabase.com/dashboard/project/cxhypcvdijqauaibcgyp |

---

## 2. ARQUITETURA DO SISTEMA

### 2.1 Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTES                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  WhatsApp   │  │  Cardápio   │  │      Dashboard          │  │
│  │  (Cliente)  │  │   Online    │  │   (Administração)       │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                      │                │
└─────────┼────────────────┼──────────────────────┼────────────────┘
          │                │                      │
          ▼                ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EVOLUTION API                               │
│                    (WhatsApp Gateway)                            │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE EDGE FUNCTIONS                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ whatsapp-webhook │  │    ai-agent      │  │ whatsapp-send │  │
│  │   (Recebe msg)   │  │  (Imperatriz)    │  │ (Envia msg)   │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ whatsapp-notify  │  │ transcribe-audio │  │enviar-followup│  │
│  │ (Notificações)   │  │ (Áudio → Texto)  │  │ (Quiz Satisf.)│  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (PostgreSQL)                         │
├─────────────────────────────────────────────────────────────────┤
│  Tabelas: pedidos, produtos, categorias, mesas, comandas,       │
│           dados_cliente, whatsapp_messages, avaliacoes_pedido,  │
│           caixa, movimentacoes_caixa, vendas_pdv, etc.          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Fluxo de Pedido via WhatsApp

```
Cliente → WhatsApp → Evolution API → whatsapp-webhook → ai-agent
                                                           │
                                          ┌────────────────┴────────────────┐
                                          │                                  │
                                          ▼                                  ▼
                                    Envia link do                    Consulta status
                                    cardápio online                    do pedido
                                          │                                  │
                                          ▼                                  ▼
                              Cliente faz pedido              Retorna informações
                              no cardápio online                  ao cliente
                                          │
                                          ▼
                              Pedido salvo no banco
                                          │
                                          ▼
                              Notificação WhatsApp
                              (confirmação, preparo, saída)
```

---

## 3. FUNCIONALIDADES

### 3.1 Dashboard Administrativo

| Módulo | Funcionalidades |
|--------|-----------------|
| **Dashboard** | Métricas em tempo real, pedidos do dia, faturamento |
| **Pedidos** | Gestão de pedidos, alteração de status, histórico |
| **Cardápio** | CRUD de produtos e categorias |
| **Clientes** | Base de clientes, histórico de pedidos |
| **Mesas** | Gestão de mesas, QR Codes |
| **Comandas** | Comandas abertas, fechamento, pagamentos |
| **PDV** | Ponto de venda, caixa, vendas rápidas |
| **Relatórios** | Faturamento, produtos vendidos, satisfação |
| **WhatsApp** | Conexão, templates, histórico de mensagens |

### 3.2 Agente IA (Imperatriz)

| Capacidade | Descrição |
|------------|-----------|
| **Direcionamento** | Envia link do cardápio online |
| **Status de Pedido** | Consulta e informa status em tempo real |
| **Cálculo de Tempo** | Calcula tempo restante baseado no bairro |
| **Transferência Humana** | Escala para atendente quando necessário |
| **Quiz de Satisfação** | Envia pesquisa pós-entrega |

### 3.3 Sistema de Avaliações

O sistema envia automaticamente um quiz de satisfação 30 minutos após a entrega:

1. **Pergunta 1**: Como estava a COMIDA? (1-4)
2. **Pergunta 2**: Como foi a ENTREGA? (1-4)
3. **Pergunta 3**: Você recomendaria? (1-4)

Métricas disponíveis no dashboard de Relatórios.

---

## 4. MÓDULOS DO DASHBOARD

### 4.1 Dashboard (`/`)

**Arquivo:** `src/pages/Dashboard.jsx`

Exibe:
- Total de pedidos do dia
- Faturamento do dia
- Pedidos pendentes
- Gráfico de pedidos por hora
- Lista dos últimos pedidos

### 4.2 Pedidos (`/pedidos`)

**Arquivo:** `src/pages/Pedidos.jsx`

Funcionalidades:
- Listagem de pedidos com filtros
- Alteração de status (pendente → confirmado → preparando → pronto → saiu → entregue)
- Visualização de detalhes do pedido
- Notificação automática ao cliente via WhatsApp

### 4.3 Cardápio (`/cardapio`)

**Arquivo:** `src/pages/Cardapio.jsx`

Funcionalidades:
- CRUD de produtos
- CRUD de categorias
- Upload de imagens
- Controle de disponibilidade
- Ordenação de produtos

### 4.4 Clientes (`/clientes`)

**Arquivo:** `src/pages/Clients.jsx`

Funcionalidades:
- Listagem de clientes
- Histórico de pedidos por cliente
- Dados de contato e endereço

### 4.5 Mesas (`/mesas`)

**Arquivo:** `src/pages/Mesas.jsx`

Funcionalidades:
- Cadastro de mesas
- Geração de QR Code
- Status da mesa (livre/ocupada)

### 4.6 Comandas (`/comandas`)

**Arquivo:** `src/pages/Comandas.jsx`

Funcionalidades:
- Listagem de comandas abertas
- Visualização de itens
- Fechamento de comanda com forma de pagamento
- Integração com caixa

### 4.7 PDV (`/pdv`)

**Arquivo:** `src/pages/PDV.jsx`

Funcionalidades:
- Abertura/fechamento de caixa
- Venda rápida (balcão)
- Integração com mesas/comandas
- Adição de itens a comandas existentes
- Histórico de vendas do caixa

### 4.8 Relatórios (`/relatorios`)

**Arquivo:** `src/pages/Reports.jsx`

Métricas:
- Faturamento por período
- Pedidos por dia
- Formas de pagamento
- Bairros mais atendidos
- **Satisfação dos clientes** (novo!)
  - Média geral
  - Nota da comida
  - Nota da entrega
  - Nota de recomendação
  - Distribuição de notas

### 4.9 WhatsApp (`/whatsapp`)

**Arquivo:** `src/pages/WhatsApp.jsx`

Funcionalidades:
- Conexão via QR Code
- Status da instância
- Templates de mensagem
- Histórico de conversas

### 4.10 App do Garçom (`/garcom`)

**Arquivo:** `src/pages/Garcom.jsx`

Funcionalidades:
- Scanner de QR Code (câmera traseira)
- Seleção de mesa
- Adição de itens à comanda
- Visualização de comanda aberta
- Atualização em tempo real

---

## 5. INTEGRAÇÃO WHATSAPP

### 5.1 Evolution API

O sistema utiliza a Evolution API para comunicação com WhatsApp.

**Configuração necessária:**
- `EVOLUTION_API_URL` - URL da instância Evolution
- `EVOLUTION_API_KEY` - Chave de API
- `EVOLUTION_API_INSTANCE_NAME` - Nome da instância (padrão: `avello`)

### 5.2 Webhook

O webhook deve ser configurado na Evolution API para:

```
URL: https://cxhypcvdijqauaibcgyp.supabase.co/functions/v1/whatsapp-webhook
Eventos: MESSAGES_UPSERT
```

### 5.3 Fluxo de Mensagens

1. **Mensagem recebida** → `whatsapp-webhook`
2. **Processamento IA** → `ai-agent`
3. **Resposta enviada** → Evolution API
4. **Notificações** → `whatsapp-notify`

### 5.4 Regras do Agente

O agente (Imperatriz) segue estas regras:

**QUANDO CHAMAR HUMANO:**
- Reclamações
- Pedido errado/faltando
- Produto com problema
- Situações fora do padrão

**NÃO CHAMAR HUMANO PARA:**
- Dúvidas sobre cardápio
- Status de pedido
- Cliente confuso com site
- Informações gerais

---

## 6. BANCO DE DADOS

### 6.1 Tabelas Principais

| Tabela | Descrição | Registros |
|--------|-----------|-----------|
| `pedidos` | Pedidos de delivery/retirada | 27 |
| `produtos` | Cardápio de produtos | 48 |
| `categorias` | Categorias de produtos | 5 |
| `dados_cliente` | Cadastro de clientes | 10 |
| `mesas` | Mesas do restaurante | 6 |
| `comandas` | Comandas abertas/fechadas | 10 |
| `itens_comanda` | Itens das comandas | 34 |
| `caixa` | Controle de caixa | 4 |
| `movimentacoes_caixa` | Entradas/saídas do caixa | 15 |
| `vendas_pdv` | Vendas do PDV | 15 |
| `bairros_entrega` | Bairros e taxas | 20 |
| `whatsapp_messages` | Histórico de mensagens | 44 |
| `avaliacoes_pedido` | Avaliações de satisfação | 0 |
| `followups_agendados` | Quiz agendados | 0 |

### 6.2 Funções RPC (Stored Procedures)

| Função | Descrição |
|--------|-----------|
| `criar_pedido_rpc` | Cria pedido via WhatsApp |
| `buscar_cliente` | Busca dados do cliente |
| `calcular_taxa_entrega` | Calcula taxa por bairro |
| `search_products_smart` | Busca inteligente de produtos |
| `metricas_satisfacao` | Métricas do quiz de satisfação |
| `processar_resposta_avaliacao` | Processa respostas do quiz |
| `verificar_avaliacao_pendente` | Verifica quiz pendente |
| `buscar_followups_pendentes` | Lista quiz a enviar |
| `iniciar_avaliacao` | Inicia avaliação |
| `atualizar_valor_comanda` | Atualiza total da comanda |
| `liberar_mesa_ao_fechar_comanda` | Libera mesa automaticamente |

### 6.3 Triggers

| Trigger | Tabela | Evento | Ação |
|---------|--------|--------|------|
| `trigger_agendar_followup` | `pedidos` | UPDATE (status='entregue') | Agenda quiz |
| `trigger_atualizar_valor_comanda` | `itens_comanda` | INSERT/UPDATE/DELETE | Recalcula total |
| `trigger_liberar_mesa` | `comandas` | UPDATE (status='fechada') | Libera mesa |

### 6.4 Cron Jobs

| Job | Schedule | Ação |
|-----|----------|------|
| `enviar-followups-satisfacao` | A cada 5 minutos | Envia quiz pendentes |

---

## 7. EDGE FUNCTIONS (BACKEND)

### 7.1 Lista de Funções

| Função | Versão | JWT | Descrição |
|--------|--------|-----|-----------|
| `ai-agent` | v63 | ❌ | Agente IA (Imperatriz) |
| `whatsapp-webhook` | v30 | ❌ | Recebe mensagens |
| `whatsapp-send` | v15 | ✅ | Envia mensagens |
| `whatsapp-connect` | v18 | ✅ | Conecta instância |
| `whatsapp-notify` | v14 | ✅ | Notificações automáticas |
| `transcribe-audio` | v23 | ❌ | Transcreve áudios |
| `enviar-followup` | v1 | ❌ | Envia quiz de satisfação |

### 7.2 Variáveis de Ambiente

```env
# Supabase
SUPABASE_URL=https://cxhypcvdijqauaibcgyp.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI
OPENAI_API_KEY=sk-...

# Evolution API
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua-api-key
EVOLUTION_API_INSTANCE_NAME=avello
```

---

## 8. CONFIGURAÇÃO E DEPLOY

### 8.1 Requisitos

- Node.js 18+
- pnpm 8+
- Conta Supabase
- Conta Netlify
- Evolution API configurada

### 8.2 Instalação Local

```bash
# Clonar repositório
git clone https://github.com/andrersreis-cyber/imperio-dashboard.git
cd imperio-dashboard

# Instalar dependências
pnpm install

# Configurar variáveis de ambiente
cp docs/ENV_EXEMPLO.txt .env.local

# Iniciar servidor de desenvolvimento
pnpm dev
```

### 8.3 Deploy

**Frontend (Netlify):**
- Conectado ao GitHub (branch `main`)
- Build automático em cada push
- Build command: `pnpm build`
- Publish directory: `dist`

**Backend (Supabase):**
- Edge Functions deployadas via CLI ou MCP
- Migrations aplicadas via SQL Editor

### 8.4 Estrutura de Diretórios

```
imperio-dashboard/
├── src/
│   ├── components/       # Componentes reutilizáveis
│   │   ├── ui/          # Componentes de UI (Button, Card, etc)
│   │   └── whatsapp/    # Componentes de WhatsApp
│   ├── pages/           # Páginas da aplicação
│   ├── lib/             # Utilitários (supabase.js)
│   └── main.jsx         # Entry point
├── supabase/
│   └── functions/       # Edge Functions
│       ├── ai-agent/
│       ├── whatsapp-webhook/
│       ├── whatsapp-send/
│       ├── whatsapp-notify/
│       ├── whatsapp-connect/
│       ├── transcribe-audio/
│       └── enviar-followup/
├── migrations/          # Scripts SQL de migração
├── public/              # Assets estáticos
└── docs/                # Documentação
```

---

## 9. MANUTENÇÃO E OPERAÇÃO

### 9.1 Rotinas Diárias

1. **Verificar caixa** - Abrir no início do expediente
2. **Verificar WhatsApp** - Confirmar conexão ativa
3. **Monitorar pedidos** - Acompanhar fila de pedidos

### 9.2 Rotinas Semanais

1. **Revisar relatórios** - Analisar métricas de satisfação
2. **Atualizar cardápio** - Verificar disponibilidade
3. **Backup** - Supabase faz backup automático

### 9.3 Monitoramento

**Logs do Agente:**
- Supabase Dashboard → Edge Functions → ai-agent → Logs

**Logs do Webhook:**
- Supabase Dashboard → Edge Functions → whatsapp-webhook → Logs

**Métricas:**
- Dashboard → Relatórios

### 9.4 Atualizações

Para atualizar o sistema:

```bash
git pull origin main
pnpm install
pnpm build
# Push automático via Netlify
```

---

## 10. TROUBLESHOOTING

### 10.1 WhatsApp não responde

1. Verificar conexão no dashboard (`/whatsapp`)
2. Verificar logs do `whatsapp-webhook`
3. Verificar se Evolution API está online
4. Reconectar via QR Code se necessário

### 10.2 Pedido não aparece no dashboard

1. Verificar se o pedido foi criado no banco
2. Verificar logs do `ai-agent`
3. Verificar se o cliente está na tabela `dados_cliente`

### 10.3 Quiz de satisfação não enviado

1. Verificar se pedido está como "entregue"
2. Verificar tabela `followups_agendados`
3. Verificar logs do `enviar-followup`
4. Verificar cron job no Supabase

### 10.4 Comanda não fecha

1. Verificar se há caixa aberto
2. Verificar se a mesa está ocupada
3. Verificar logs do console (F12)

### 10.5 Erros comuns

| Erro | Causa | Solução |
|------|-------|---------|
| "Caixa não aberto" | Nenhum caixa aberto | Abrir caixa no PDV |
| "Mesa não encontrada" | QR Code inválido | Verificar cadastro da mesa |
| "Bairro não atendido" | Bairro não cadastrado | Adicionar em configurações |
| "Evolution API error" | API offline | Verificar servidor Evolution |

---

## 📞 SUPORTE

Para suporte técnico, entre em contato com o desenvolvedor.

---

## 📝 CHANGELOG

### v1.0.0 (16/01/2026)
- Sistema completo de gestão
- Integração WhatsApp com agente IA
- PDV integrado com comandas
- Sistema de avaliação de satisfação
- Dashboard de relatórios

---

**© 2026 Império das Porções - Todos os direitos reservados**

