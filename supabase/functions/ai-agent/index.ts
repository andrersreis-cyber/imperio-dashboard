// Supabase Edge Function: ai-agent
// Processa mensagens com OpenAI e executa tools
// Versão 2.0 - Busca Fuzzy Inteligente

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// System prompt da Imperatriz - Versão humanizada e sem dados hardcoded
const SYSTEM_PROMPT = `Você é **Imperatriz**, a assistente virtual do **Império das Porções**, um restaurante familiar em Porto de Santana, Cariacica - ES.
A filosofia da casa é: **"Nossa família servindo a sua família"**.

## SUA PERSONALIDADE
- **Acolhedora e Familiar**: Trate o cliente como parte da família.
- **Simpática e Eficiente**: Use emojis com moderação (1-2 por mensagem) para manter a leveza.
- **Orgulhosa da Qualidade**: Destaque nossos diferenciais, especialmente a **Maionese Caseira Especial** (que fideliza nossos clientes!) e nossas porções generosas.
- **Humana**: Nunca seja robótica. Se não entender, peça desculpas com gentileza.

## HORÁRIO DE FUNCIONAMENTO & LOCALIZAÇÃO
- **Local**: Porto de Santana, Cariacica - ES.
- **Horário**: Quarta a Domingo, das 19h30 às 23h.
- **Retirada**: O cliente retira no nosso endereço em Porto de Santana.

## ⚠️ REGRA ABSOLUTA - LEIA COM ATENÇÃO ⚠️
**VOCÊ NÃO SABE NENHUM PRODUTO OU PREÇO DE MEMÓRIA!**
- SEMPRE use as ferramentas ANTES de responder sobre produtos
- NUNCA invente nomes de produtos, sabores ou preços
- Se o cliente mencionar um item (ex: "bata", "cervela", "suco"), use **buscar_item** IMEDIATAMENTE
- A ferramenta buscar_item agora é "inteligente": ela pode devolver o produto exato, uma lista de sugestões, ou informar que é uma CATEGORIA.
- Se buscar_item retornar que é uma CATEGORIA (ex: "refri" -> "Refrigerantes"), sua PRÓXIMA ação OBRIGATÓRIA é chamar **listar_produtos_categoria**.

## FLUXO DE ATENDIMENTO (siga na ordem)

### 1. ITENS DO PEDIDO
**OBRIGATÓRIO**: Quando o cliente mencionar QUALQUER item, use **buscar_item** primeiro!
- "quero uma bata" → Use buscar_item("bata") → Ferramenta retorna "Batata Frita" → Você confirma.
- "quero uma cervela" → Use buscar_item("cervela") → Ferramenta retorna "Calabresa".
- "quero um refri" → Use buscar_item("refri") → Ferramenta diz: "É categoria Refrigerantes" → VOCÊ CHAMA: listar_produtos_categoria("Refrigerantes").
- "quais sucos" → Use listar_produtos_categoria("Sucos").

**NUNCA**:
- ❌ Diga "todos custam X" sem verificar
- ❌ Liste sabores que você não verificou (ex: "Laranja, Abacaxi" - se não veio da ferramenta, NÃO EXISTE!)
- ❌ Invente nomes de produtos
- ❌ Mande link de PDF quando perguntarem "quais sucos" ou "qual refri" - LISTE OS PRODUTOS!

### 2. MODALIDADE
   - Pergunte: "Será ENTREGA ou RETIRADA no local?"
- **RETIRADA**: Taxa = R$0. **NÃO PEÇA ENDEREÇO!** Pule direto para etapa 4 (Nome).
- **ENTREGA**: Continue com etapa 3 abaixo.

### 3. ENDEREÇO (APENAS PARA ENTREGA) - ⚠️ CRÍTICO: SIGA EM ETAPAS ⚠️
**SE FOR RETIRADA: PULE ESTA ETAPA!**

**ETAPA 3.1 - BAIRRO:**
- Pergunte: "Qual o bairro do endereço de entrega?"
- Use **calcular_taxa_entrega** para verificar se atendemos
- ⚠️ SE calcular_taxa_entrega retornar ERRO ou "bairro não encontrado": NÃO aceite o pedido! Informe: "Infelizmente não atendemos este bairro. Você pode retirar no local?"
- Se bairro for atendido, mostre a taxa e continue

**ETAPA 3.2 - RUA:**
- Pergunte: "Qual a rua do endereço?"
- Aguarde resposta do cliente
- Guarde a resposta para usar em criar_pedido

**ETAPA 3.3 - NÚMERO:**
- Pergunte: "Qual o número?"
- Aguarde resposta do cliente
- Guarde a resposta para usar em criar_pedido

**ETAPA 3.4 - PONTO DE REFERÊNCIA (opcional):**
- Pergunte: "Tem algum ponto de referência? (ex: perto da padaria, casa amarela)"
- Se cliente não quiser informar, pode pular esta etapa

**VALIDAÇÃO OBRIGATÓRIA (SÓ PARA ENTREGA):**
- Antes de prosseguir, certifique-se de ter: BAIRRO + RUA + NÚMERO
- Se faltar algum, pergunte novamente até ter todos
- Ao chamar criar_pedido, passe rua e número separadamente nos parâmetros "rua" e "numero", OU combine em "endereco" como "Rua X, 123"

### 4. NOME DO CLIENTE
- Pergunte: "Qual seu nome completo para o pedido?"
- Aguarde resposta completa antes de prosseguir

### 5. FORMA DE PAGAMENTO
- Opções: PIX (5% desconto), Dinheiro, Cartão Crédito, Cartão Débito
   - Se dinheiro: "Precisa de troco? Para quanto?"

### 6. CONFIRMAR PEDIDO - ⚠️ CRÍTICO: CONFIRMAÇÃO EXPLÍCITA ⚠️
- Use **calcular_total_pedido** para obter o valor correto
- Mostre resumo completo com valores calculados pelo sistema
   - Peça confirmação: "Confirma este pedido?"
- ⚠️ NUNCA crie pedido sem confirmação EXPLÍCITA do cliente!
- Palavras aceitas como confirmação: "sim", "confirma", "pode fechar", "quero", "ok pode fazer", "pode fazer"
- Se cliente não confirmar explicitamente, pergunte novamente: "Você confirma este pedido?"

### 7. CRIAR PEDIDO - ⚠️ VALIDAÇÕES ANTES DE CRIAR ⚠️
**ANTES de chamar criar_pedido:**
1. Verifique se houve confirmação EXPLÍCITA na última mensagem do cliente
2. Se não houver confirmação explícita, NÃO crie o pedido - peça confirmação novamente
3. Para ENTREGA: certifique-se de ter bairro + rua + número preenchidos
4. Use **verificar_pedido_duplicado** antes de criar (se disponível)

**APÓS criar pedido com sucesso:**
- Se modalidade = "retirada": "Seu pedido estará pronto em aproximadamente **30-40 minutos**! Você pode retirar aqui em Porto de Santana."
- Se modalidade = "entrega": "Entrega estimada em **50-70 minutos**!"
- Finalize com um toque pessoal: "Agradecemos a preferência! Nossa família servindo a sua família! ❤️"

## REGRAS DE OURO (PRIORIDADE MÁXIMA)
1. **SEMPRE use ferramentas ANTES de responder sobre produtos/preços**
2. **NUNCA invente nomes de produtos ou sabores** - use listar_produtos_categoria para ver o que realmente existe
3. **TEMOS CERVEJA SIM!** Se perguntarem, use listar_produtos_categoria("Cervejas").
4. **Se buscar_item retornar uma CATEGORIA**, sua obrigação imediata é listar os produtos dessa categoria
5. **Se buscar_item retornar SUGESTÕES**, apresente-as ao cliente: "Não encontrei X, você quis dizer Y?"
6. Mantenha contexto: lembre dos itens já pedidos durante toda a conversa
7. Valor mínimo do pedido: R$15 (sem contar taxa de entrega)

## EXEMPLOS OBRIGATÓRIOS
- Cliente: "tem cerveja?" → listar_produtos_categoria("Cervejas")
- Cliente: "quero uma bata" → buscar_item("bata")
- Cliente: "quero uma cervela" → buscar_item("cervela")
- Cliente: "qual refri vc tem" → listar_produtos_categoria("Refrigerantes")
- Cliente: "quero um refri" → buscar_item("refri") (Ferramenta avisa que é categoria) → listar_produtos_categoria("Refrigerantes")

## TRATAMENTO DE ERROS COMUNS
- Cliente digita errado (ex: "bata" → batata): A ferramenta corrige automaticamente - USE A FERRAMENTA!
- Item não existe: Informe e sugira itens similares usando buscar_item
- Bairro não atendido: Sugira retirada no local (Porto de Santana)

## PROBLEMAS, ERROS E DEVOLUÇÕES
- **Se o cliente reclamar de erro no pedido, atraso excessivo ou pedir devolução:**
  1. Peça desculpas sinceras em nome da família Império.
  2. Use IMEDIATAMENTE a ferramenta **pausar_ia** com motivo "Reclamação/Erro no Pedido".
  3. Informe: "Peço mil desculpas pelo transtorno! 😔 Estou chamando um de nossos atendentes humanos para resolver isso agora mesmo com você."

## ÁUDIO TRANSCRITO
- Se a mensagem começar com "[ÁUDIO TRANSCRITO]:", trate como texto normal dito pelo cliente.
- Pode haver erros fonéticos na transcrição. Tente inferir a intenção pelo contexto.
- Ex: "Quero uma coca 2 litros" pode vir como "Quero uma toca dos mitos". Use o bom senso.

## LEMBRE-SE
Você é **Imperatriz**, acolhedora e eficiente. Use as ferramentas para TUDO relacionado a produtos e preços!`

// Definição das tools - Versão 2.0 com busca inteligente
const tools = [
    {
        type: 'function',
        function: {
            name: 'buscar_item',
            description: '⚠️ OBRIGATÓRIO: Use SEMPRE que o cliente mencionar um item (ex: "bata", "cervela", "suco", "coca"). Esta ferramenta corrige erros de digitação automaticamente. NUNCA responda sobre produtos sem usar esta ferramenta primeiro!',
            parameters: {
                type: 'object',
                properties: {
                    termo_busca: {
                        type: 'string',
                        description: 'Nome ou parte do nome do item mencionado pelo cliente (ex: "batata", "bata", "calabresa", "cervela", "suco", "coca", "garrafa")'
                    }
                },
                required: ['termo_busca']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'consultar_cardapio',
            description: 'Retorna as categorias gerais do cardápio. Use quando o cliente pedir para ver opções gerais. Para ver produtos com preços de uma categoria específica, use listar_produtos_categoria.',
            parameters: {
                type: 'object',
                properties: {
                    categoria: {
                        type: 'string',
                        description: 'Filtrar por categoria específica (opcional). Se não especificar, retorna todas as categorias.'
                    }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'listar_produtos_categoria',
            description: '⚠️ OBRIGATÓRIO: Use SEMPRE que o cliente perguntar sobre uma categoria (ex: "qual refri vc tem", "quais sucos", "quais cervejas", "quais as opcoes" de uma categoria). Retorna TODOS os produtos da categoria com preços reais. NUNCA invente produtos ou preços - use esta ferramenta!',
            parameters: {
                type: 'object',
                properties: {
                    categoria: {
                        type: 'string',
                        description: 'Nome da categoria: "Refrigerantes", "Sucos", "Porções", "Cervejas" ou "Água"',
                        enum: ['Refrigerantes', 'Sucos', 'Porções', 'Cervejas', 'Água']
                    }
                },
                required: ['categoria']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'calcular_total_pedido',
            description: 'Calcula o total do pedido baseado nos itens. Use SEMPRE antes de confirmar o pedido para garantir valores corretos.',
            parameters: {
                type: 'object',
                properties: {
                    itens: {
                        type: 'array',
                        description: 'Lista de itens do pedido',
                        items: {
                            type: 'object',
                            properties: {
                                nome: { type: 'string', description: 'Nome exato do produto' },
                                quantidade: { type: 'number', description: 'Quantidade' }
                            },
                            required: ['nome', 'quantidade']
                        }
                    },
                    bairro: {
                        type: 'string',
                        description: 'Bairro para cálculo da taxa (opcional, se retirada não informar)'
                    },
                    forma_pagamento: {
                        type: 'string',
                        description: 'Forma de pagamento para aplicar desconto PIX se aplicável'
                    }
                },
                required: ['itens']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'buscar_cliente',
            description: 'Busca dados cadastrados do cliente pelo telefone',
            parameters: {
                type: 'object',
                properties: {
                    telefone: {
                        type: 'string',
                        description: 'Telefone do cliente'
                    }
                },
                required: ['telefone']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'salvar_cliente',
            description: 'Salva ou atualiza dados do cliente',
            parameters: {
                type: 'object',
                properties: {
                    telefone: { type: 'string' },
                    nome: { type: 'string' },
                    endereco: { type: 'string' },
                    bairro: { type: 'string' },
                    ponto_referencia: { type: 'string' }
                },
                required: ['telefone', 'nome']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'criar_pedido',
            description: 'Cria um novo pedido no sistema. Use APENAS após o cliente confirmar explicitamente.',
            parameters: {
                type: 'object',
                properties: {
                    telefone: { type: 'string' },
                    nome_cliente: { type: 'string', description: 'Nome completo do cliente' },
                    itens: {
                        type: 'array',
                        description: 'Lista de itens com nome e quantidade',
                        items: {
                            type: 'object',
                            properties: {
                                nome: { type: 'string' },
                                quantidade: { type: 'number' },
                                preco_unitario: { type: 'number' }
                            }
                        }
                    },
                    forma_pagamento: { type: 'string' },
                    modalidade: { type: 'string', enum: ['entrega', 'retirada'] },
                    endereco: { type: 'string', description: 'Endereço completo: rua e número (ex: "Rua das Flores, 123")' },
                    rua: { type: 'string', description: 'Nome da rua (opcional, pode estar em endereco)' },
                    numero: { type: 'string', description: 'Número do endereço (opcional, pode estar em endereco)' },
                    bairro: { type: 'string' },
                    ponto_referencia: { type: 'string' },
                    observacoes: { type: 'string' },
                    troco_para: { type: 'number' }
                },
                required: ['telefone', 'nome_cliente', 'itens', 'forma_pagamento', 'modalidade']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'buscar_ultimo_pedido',
            description: 'Busca o último pedido do cliente para referência ou repetição',
            parameters: {
                type: 'object',
                properties: {
                    telefone: { type: 'string' }
                },
                required: ['telefone']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'verificar_pedido_duplicado',
            description: '⚠️ OBRIGATÓRIO antes de criar pedido: Verifica se existe pedido similar criado nos últimos 5 minutos para evitar duplicação',
            parameters: {
                type: 'object',
                properties: {
                    telefone: { type: 'string' },
                    itens: {
                        type: 'array',
                        description: 'Lista de itens do pedido a verificar',
                        items: {
                            type: 'object',
                            properties: {
                                nome: { type: 'string' },
                                quantidade: { type: 'number' }
                            }
                        }
                    }
                },
                required: ['telefone', 'itens']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'pausar_ia',
            description: 'Pausa o atendimento automático e escala para atendente humano. Use quando o cliente solicitar falar com humano ou em situações complexas.',
            parameters: {
                type: 'object',
                properties: {
                    telefone: { type: 'string' },
                    motivo: { type: 'string' }
                },
                required: ['telefone']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'calcular_taxa_entrega',
            description: 'Verifica se o bairro é atendido e calcula a taxa de entrega',
            parameters: {
                type: 'object',
                properties: {
                    bairro: {
                        type: 'string',
                        description: 'Nome do bairro do cliente'
                    }
                },
                required: ['bairro']
            }
        }
    }
]

// Tabela de bairros e taxas (pode ser movida para banco futuramente)
// ========================================
// BAIRROS: Agora vem do banco de dados
// RPC: buscar_bairro_taxa(bairro_busca)
// Tabela: bairros_entrega
// ========================================

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { remoteJid, content, pushName, session } = await req.json()

        // Criar cliente Supabase
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const openaiKey = Deno.env.get('OPENAI_API_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Buscar dados do cliente
        let { data: cliente } = await supabase
            .from('dados_cliente')
            .select('*')
            .eq('telefone', remoteJid)
            .single()

        // Se cliente não existe, criar automaticamente
        if (!cliente) {
            const { data: novoCliente } = await supabase
                .from('dados_cliente')
                .insert({
                    telefone: remoteJid,
                    nomewpp: pushName || 'Cliente WhatsApp',
                    created_at: new Date().toISOString()
                })
                .select()
                .single()
            cliente = novoCliente
            console.log('Novo cliente criado:', remoteJid)
        }

        // Buscar histórico de mensagens (últimas 20 para manter contexto)
        const { data: historico } = await supabase
            .from('whatsapp_messages')
            .select('content, from_me, created_at')
            .eq('remote_jid', remoteJid)
            .order('created_at', { ascending: false })
            .limit(20)

        // Montar mensagens para o OpenAI
        const messages: any[] = [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'system',
                content: `## CONTEXTO ATUAL
- Telefone: ${remoteJid}
- Nome WhatsApp: ${pushName || 'Não identificado'}
- Cliente cadastrado: ${cliente ? 'Sim - ' + (cliente.nome_completo || cliente.nomewpp) : 'Não'}
${cliente?.endereco ? `- Último endereço: ${cliente.endereco}` : ''}
${cliente?.bairro ? `- Último bairro: ${cliente.bairro}` : ''}
- Horário atual (Simulado): 20:30
- Dia da semana (Simulado): Sexta-feira`
            }
        ]

        // Adicionar histórico
        if (historico && historico.length > 0) {
            historico.reverse().forEach(msg => {
                messages.push({
                    role: msg.from_me ? 'assistant' : 'user',
                    content: msg.content
                })
            })
        }

        // Adicionar mensagem atual
        messages.push({ role: 'user', content: content })

        // Chamar OpenAI
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: messages,
                tools: tools,
                tool_choice: 'auto',
                max_tokens: 600,
                temperature: 0.7
            })
        })

        const openaiResult = await openaiResponse.json()
        console.log('OpenAI Response:', JSON.stringify(openaiResult, null, 2))

        const choice = openaiResult.choices?.[0]
        let responseText = ''

        // Processar tool calls se houver
        if (choice?.message?.tool_calls) {
            const toolResults: any[] = []

            for (const toolCall of choice.message.tool_calls) {
                const functionName = toolCall.function.name
                const args = JSON.parse(toolCall.function.arguments)

                console.log(`Executando tool: ${functionName}`, args)

                let toolResult = ''

                switch (functionName) {
                    case 'buscar_item':
                        // MOTOR DE BUSCA V1 (Dicionário -> FTS -> Fuzzy)
                        try {
                            const termoBusca = (args.termo_busca || '').trim()
                            if (!termoBusca) {
                        toolResult = JSON.stringify({
                                    status: 'erro',
                                    mensagem: 'Termo de busca não informado.'
                        })
                        break
                            }

                            // Chamar o novo Motor de Busca Híbrido
                            const { data: resultados, error: erroBusca } = await supabase
                                .rpc('search_engine_v1', { 
                                    termo_busca: termoBusca,
                                    limite: 5
                                })

                            if (erroBusca) {
                                console.error('Erro na RPC search_engine_v1:', erroBusca)
                                throw erroBusca
                            }

                            if (!resultados || resultados.length === 0) {
                                toolResult = JSON.stringify({
                                    status: 'nao_encontrado',
                                    termo: termoBusca,
                                    mensagem: `Não encontrei nada parecido com "${termoBusca}". Sugira ver o cardápio.`
                                })
                            } else {
                                // Analisar o melhor resultado (o primeiro é sempre o melhor rankeado)
                                const melhorMatch = resultados[0]

                                // CASO 1: É UMA CATEGORIA (ex: "refri" -> Categoria Refrigerantes)
                                if (melhorMatch.tipo_resultado === 'categoria') {
                                    // AUTOMATION: Busca automática dos produtos da categoria para evitar "preguiça" do agente
                                    const { data: produtosCat } = await supabase
                                        .from('produtos')
                                        .select('nome, preco, preco_promocional')
                                        .eq('categoria_id', melhorMatch.id)
                                        .eq('disponivel', true)
                                        .order('preco', { ascending: true })

                                    if (produtosCat && produtosCat.length > 0) {
                                        toolResult = JSON.stringify({
                                            status: 'sucesso',
                                            categoria: melhorMatch.nome,
                                            mensagem: `Encontrei a categoria "${melhorMatch.nome}" e já trouxe os itens disponíveis:`,
                                            itens: produtosCat.map(p => ({
                                                nome: p.nome,
                                                preco: Number(p.preco_promocional || p.preco)
                                            })),
                                            instrucao: 'APENAS liste estes produtos exatos. NÃO invente nada.'
                                        })
                                    } else {
                                        toolResult = JSON.stringify({
                                            status: 'vazio',
                                            categoria: melhorMatch.nome,
                                            mensagem: `A categoria "${melhorMatch.nome}" foi encontrada, mas não tem produtos disponíveis no momento.`
                                        })
                                    }
                                }
                                // CASO 2: MATCH EXATO/PERFEITO (Dicionário ou Score Alto)
                                else if (melhorMatch.score >= 0.9) {
                                    toolResult = JSON.stringify({
                                        status: 'encontrado_com_certeza',
                                        item: {
                                            id: melhorMatch.id,
                                            nome: melhorMatch.nome,
                                            preco: Number(melhorMatch.preco),
                                            descricao: melhorMatch.descricao
                                        },
                                        nota: melhorMatch.metodo === 'dicionario' ? 'Identificado via dicionário de termos.' : 'Match exato encontrado.'
                                    })
                                }
                                // CASO 3: MATCH PROVÁVEL (FTS ou Fuzzy bom)
                                else if (melhorMatch.score >= 0.4) {
                                    toolResult = JSON.stringify({
                                        status: 'sugestoes',
                                        mensagem: `Não encontrei "${termoBusca}" exatamente, mas tenho estas opções parecidas:`,
                                        opcoes: resultados.map((r: any) => ({
                                            nome: r.nome,
                                            preco: Number(r.preco),
                                            descricao: r.descricao,
                                            score: r.score
                                        })),
                                        instrucao: 'Apresente as opções ao cliente perguntando "Você quis dizer...?"'
                                    })
                                }
                                // CASO 4: RESULTADO RUIM (Score baixo)
                                else {
                                    toolResult = JSON.stringify({
                                        status: 'incerto',
                                        mensagem: `Encontrei algo vagamente similar a "${termoBusca}", mas não tenho certeza.`,
                                        sugestao_fraca: {
                                            nome: melhorMatch.nome,
                                            preco: Number(melhorMatch.preco)
                                        },
                                        instrucao: 'Diga que não encontrou exatamente e pergunte se ele quis dizer a sugestão acima, ou ofereça o cardápio.'
                                    })
                                }
                            }

                        } catch (e) {
                            console.error('Erro em buscar_item:', e)
                            toolResult = JSON.stringify({
                                status: 'erro',
                                mensagem: 'Erro técnico na busca. Peça para o cliente reformular.'
                            })
                        }
                        break

                    case 'consultar_cardapio':
                        // NOVA FUNÇÃO: Retorna cardápio estruturado
                        try {
                            // Se categoria específica foi solicitada, usar listar_produtos_categoria
                            if (args.categoria) {
                                const { data: categoria } = await supabase
                                    .from('categorias')
                                    .select('id, nome')
                                    .ilike('nome', `%${args.categoria}%`)
                                    .limit(1)
                                    .single()

                                if (categoria) {
                                    const { data: produtos } = await supabase
                                        .from('produtos')
                                        .select('nome, preco, preco_promocional, descricao')
                                        .eq('categoria_id', categoria.id)
                                        .eq('disponivel', true)
                                        .order('preco', { ascending: true })

                                    if (produtos && produtos.length > 0) {
                                toolResult = JSON.stringify({
                                            status: 'sucesso',
                                            categoria: categoria.nome,
                                            produtos: produtos.map(p => ({
                                                nome: p.nome,
                                                preco: Number(p.preco_promocional || p.preco),
                                                descricao: p.descricao || null
                                            })),
                                            instrucao: 'Apresente TODOS os produtos listados acima com seus preços exatos.'
                                })
                                break
                                    }
                                }
                            }

                            // Tentar usar RPC para todas as categorias
                            const { data: categorias, error: erroCat } = await supabase
                                .rpc('get_menu_categories')

                            if (erroCat || !categorias) {
                                // Fallback: buscar diretamente
                                const { data: produtos } = await supabase
                                .from('produtos')
                                    .select('nome, preco, preco_promocional, categoria_id')
                                .eq('disponivel', true)
                                    .order('nome')
                                    .limit(30)

                                if (produtos && produtos.length > 0) {
                                    toolResult = JSON.stringify({
                                        status: 'sucesso',
                                        mensagem: 'Cardápio disponível:',
                                        itens: produtos.map(p => ({
                                            nome: p.nome,
                                            preco: Number(p.preco_promocional || p.preco)
                                        }))
                                    })
                                } else {
                                    toolResult = JSON.stringify({
                                        status: 'erro',
                                        mensagem: 'Não foi possível carregar o cardápio. Pergunte o que o cliente deseja.'
                                    })
                                }
                            } else {
                                toolResult = JSON.stringify({
                                    status: 'sucesso',
                                    categorias: categorias.map((c: any) => ({
                                        nome: c.categoria_nome,
                                        total: c.total_produtos,
                                        exemplos: c.produtos_exemplo?.slice(0, 3) || []
                                    })),
                                    instrucao: 'Apresente as categorias e PERGUNTE qual delas o cliente quer ver.'
                                })
                            }
                        } catch (e) {
                            console.error('Erro em consultar_cardapio:', e)
                        toolResult = JSON.stringify({
                                status: 'erro',
                                mensagem: 'Erro ao consultar cardápio. Peça para o cliente dizer o que quer.'
                        })
                        }
                        break

                    case 'listar_produtos_categoria':
                        // NOVA FUNÇÃO: Lista TODOS os produtos de uma categoria com preços
                        try {
                            const categoriaNome = args.categoria || ''
                            if (!categoriaNome) {
                                toolResult = JSON.stringify({
                                    status: 'erro',
                                    mensagem: 'Categoria não informada. Use: Refrigerantes, Sucos, Porções, Cervejas ou Água.'
                                })
                                break
                            }

                            // Buscar categoria pelo nome
                            const { data: categoria, error: erroCat } = await supabase
                                .from('categorias')
                                .select('id, nome')
                                .ilike('nome', `%${categoriaNome}%`)
                                .limit(1)
                                .single()

                            if (erroCat || !categoria) {
                                toolResult = JSON.stringify({
                                    status: 'erro',
                                    mensagem: `Categoria "${categoriaNome}" não encontrada. Categorias disponíveis: Refrigerantes, Sucos, Porções, Cervejas, Água.`
                                })
                                break
                            }

                            // Buscar TODOS os produtos da categoria com preços
                            const { data: produtos, error: erroProd } = await supabase
                                .from('produtos')
                                .select('nome, preco, preco_promocional, descricao')
                                .eq('categoria_id', categoria.id)
                                .eq('disponivel', true)
                                .order('preco', { ascending: true })

                            if (erroProd || !produtos || produtos.length === 0) {
                                toolResult = JSON.stringify({
                                    status: 'erro',
                                    mensagem: `Nenhum produto disponível na categoria "${categoria.nome}".`
                                })
                                break
                            }

                            toolResult = JSON.stringify({
                                status: 'sucesso',
                                categoria: categoria.nome,
                                total_produtos: produtos.length,
                                produtos: produtos.map(p => ({
                                    nome: p.nome,
                                    preco: Number(p.preco_promocional || p.preco)
                                })),
                                instrucao_CRITICA: `APENAS liste estes ${produtos.length} produtos exatos. NÃO invente outros sabores como Laranja ou Limão se eles não estiverem nesta lista!`
                            })
                        } catch (e) {
                            console.error('Erro em listar_produtos_categoria:', e)
                            toolResult = JSON.stringify({
                                status: 'erro',
                                mensagem: 'Erro ao buscar produtos da categoria.'
                            })
                        }
                        break

                    case 'calcular_total_pedido':
                        // NOVA FUNÇÃO: Calcula total com validação
                        try {
                            const itens = args.itens || []
                            if (itens.length === 0) {
                                toolResult = JSON.stringify({
                                    status: 'erro',
                                    mensagem: 'Nenhum item informado para calcular.'
                                })
                                break
                            }

                            let subtotal = 0
                            const itensCalculados: any[] = []
                            const itensNaoEncontrados: string[] = []

                            // Buscar preço de cada item no banco usando a BUSCA ROBUSTA
                            for (const item of itens) {
                                // Usa a mesma search_engine_v1 que salva o agente na busca normal
                                const { data: resultadosBusca } = await supabase
                                    .rpc('search_engine_v1', { 
                                        termo_busca: item.nome,
                                        limite: 1
                                    })
                                
                                const produtoEncontrado = resultadosBusca && resultadosBusca.length > 0 ? resultadosBusca[0] : null

                                if (produtoEncontrado) {
                                    const precoUnit = Number(produtoEncontrado.preco)
                                    const quantidade = item.quantidade || 1
                                    const subtotalItem = precoUnit * quantidade

                                    itensCalculados.push({
                                        nome: produtoEncontrado.nome,
                                        quantidade,
                                        preco_unitario: precoUnit,
                                        subtotal: subtotalItem
                                    })
                                    subtotal += subtotalItem
                            } else {
                                    // Fallback: Tenta busca direta se a engine falhar (raro)
                                    const { data: produtoDireto } = await supabase
                                        .from('produtos')
                                        .select('nome, preco, preco_promocional')
                                        .eq('disponivel', true)
                                        .ilike('nome', `%${item.nome}%`)
                                        .limit(1)
                                        .single()

                                    if (produtoDireto) {
                                        const precoUnit = Number(produtoDireto.preco_promocional || produtoDireto.preco)
                                        const quantidade = item.quantidade || 1
                                        const subtotalItem = precoUnit * quantidade

                                        itensCalculados.push({
                                            nome: produtoDireto.nome,
                                            quantidade,
                                            preco_unitario: precoUnit,
                                            subtotal: subtotalItem
                                        })
                                        subtotal += subtotalItem
                            } else {
                                        itensNaoEncontrados.push(item.nome)
                                    }
                                }
                            }

                            if (itensNaoEncontrados.length > 0) {
                                toolResult = JSON.stringify({
                                    status: 'erro_itens',
                                    mensagem: `Itens não encontrados: ${itensNaoEncontrados.join(', ')}. Busque-os novamente com buscar_item.`,
                                    itens_validos: itensCalculados
                                })
                                break
                            }

                            // Calcular taxa de entrega via banco de dados
                            let taxaEntrega = 0
                            let bairroNome: string | null = null
                            if (args.bairro) {
                                const { data: bairroData } = await supabase
                                    .rpc('buscar_bairro_taxa', { bairro_busca: args.bairro })
                                if (bairroData && bairroData.length > 0) {
                                    taxaEntrega = parseFloat(bairroData[0].taxa_entrega)
                                    bairroNome = bairroData[0].nome
                                }
                            }

                            // Calcular desconto PIX (5%)
                            let desconto = 0
                            if (args.forma_pagamento?.toLowerCase() === 'pix') {
                                desconto = subtotal * 0.05
                            }

                            const total = subtotal + taxaEntrega - desconto

                            toolResult = JSON.stringify({
                                status: 'sucesso',
                                itens: itensCalculados,
                                subtotal_itens: subtotal,
                                taxa_entrega: taxaEntrega,
                                bairro: bairroNome,
                                desconto_pix: desconto > 0 ? desconto : null,
                                total_final: total,
                                resumo: `Subtotal: R$ ${subtotal.toFixed(2)}${taxaEntrega > 0 ? ` + Taxa: R$ ${taxaEntrega.toFixed(2)}` : ''}${desconto > 0 ? ` - Desconto PIX: R$ ${desconto.toFixed(2)}` : ''} = Total: R$ ${total.toFixed(2)}`
                            })
                        } catch (e) {
                            console.error('Erro em calcular_total_pedido:', e)
                            toolResult = JSON.stringify({
                                status: 'erro',
                                mensagem: 'Erro ao calcular total. Verifique os itens.'
                            })
                        }
                        break

                    case 'buscar_cliente':
                        const { data: cli } = await supabase
                            .from('dados_cliente')
                            .select('*')
                            .eq('telefone', args.telefone)
                            .single()
                        toolResult = JSON.stringify(cli || { encontrado: false })
                        break

                    case 'salvar_cliente':
                        await supabase.from('dados_cliente').upsert({
                            telefone: args.telefone,
                            nome_completo: args.nome,
                            nomewpp: pushName,
                            endereco: args.endereco,
                            bairro: args.bairro,
                            ponto_referencia: args.ponto_referencia,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'telefone' })
                        toolResult = JSON.stringify({ sucesso: true })
                        break

                    case 'criar_pedido':
                        try {
                            const itens = args.itens || []
                            
                            // VALIDAÇÃO 1: Para entrega, verificar endereço completo
                            const modalidadeFinal = (args.modalidade || '').toLowerCase().trim()
                            if (modalidadeFinal === 'entrega') {
                                // Validar bairro
                                if (!args.bairro) {
                            toolResult = JSON.stringify({
                                sucesso: false,
                                        erro: 'Bairro não informado',
                                        mensagem_erro: 'Para entrega, é necessário informar o bairro.',
                                        instrucao: 'Peça ao cliente o bairro do endereço de entrega.'
                            })
                            break
                        }

                                // Verificar se bairro está na área de atendimento
                                const { data: bairroCheck } = await supabase
                                    .rpc('buscar_bairro_taxa', { bairro_busca: args.bairro })
                                
                                if (!bairroCheck || bairroCheck.length === 0) {
                                    toolResult = JSON.stringify({
                                        sucesso: false,
                                        erro: 'Bairro não atendido',
                                        mensagem_erro: `Não atendemos o bairro "${args.bairro}". Você pode optar pela retirada no local (gratuita)!`,
                                        instrucao: 'NÃO crie pedido de entrega. Sugira retirada no local.'
                                    })
                                    break
                                }
                                
                                // Validar endereço (rua e número)
                                const enderecoCompleto = args.endereco || ''
                                const rua = args.rua || ''
                                const numero = args.numero || ''
                                
                                // Verificar se tem endereço completo de alguma forma
                                const temRuaENumeroSeparados = rua && numero
                                const temEnderecoComNumero = enderecoCompleto && enderecoCompleto.match(/\d+/)
                                const temEnderecoComVirgula = enderecoCompleto.includes(',')
                                
                                if (!temRuaENumeroSeparados && !temEnderecoComNumero && !temEnderecoComVirgula) {
                                    toolResult = JSON.stringify({
                                        sucesso: false,
                                        erro: 'Endereço incompleto',
                                        mensagem_erro: 'Para entrega, é necessário informar rua e número do endereço.',
                                        instrucao: 'Peça ao cliente: "Qual a rua?" e depois "Qual o número?" ou peça o endereço completo com número.'
                                    })
                                    break
                                }
                            }
                            
                            // VALIDAÇÃO 2: Verificar duplicação de pedidos
                            const cincoMinutosAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString()
                            const { data: pedidosRecentes } = await supabase
                                .from('pedidos')
                                .select('id, itens, created_at')
                                .eq('phone', args.telefone)
                                .gte('created_at', cincoMinutosAtras)
                                .order('created_at', { ascending: false })
                                .limit(3)
                            
                            if (pedidosRecentes && pedidosRecentes.length > 0) {
                                // Verificar se itens são similares
                                const itensAtuaisStr = JSON.stringify(itens.map((i: any) => ({ nome: i.nome, quantidade: i.quantidade })))
                                const pedidoSimilar = pedidosRecentes.find((p: any) => {
                                    const itensPedido = Array.isArray(p.itens) ? p.itens : []
                                    const itensPedidoStr = JSON.stringify(itensPedido.map((i: any) => ({ nome: i.nome, quantidade: i.quantidade })))
                                    return itensPedidoStr === itensAtuaisStr
                                })
                                
                                if (pedidoSimilar) {
                                    toolResult = JSON.stringify({
                                        sucesso: false,
                                        erro: 'Pedido duplicado detectado',
                                        mensagem_erro: `Encontrei um pedido similar criado há pouco tempo (Pedido #${pedidoSimilar.id}). Este é um pedido duplicado?`,
                                        instrucao: 'Pergunte ao cliente se este é um pedido duplicado ou se ele realmente quer criar um novo pedido.'
                                    })
                                    break
                                }
                            }
                            
                            // Validar e calcular total real
                            let subtotal = 0
                            const itensValidados: any[] = []
                            
                            // SIMPLIFICAÇÃO ROBUSTA: Confiar nos dados passados pelo agente se ele mandar preço
                            // O agente já chamou calcular_total_pedido antes, então ele sabe os preços.
                            for (const item of itens) {
                                let preco = Number(item.preco_unitario)
                                let nome = item.nome

                                // Se o agente não mandou preço (esqueceu), aí sim buscamos no banco
                                if (!preco || preco <= 0) {
                                    // Busca simplificada para fallback
                                    const { data: produto } = await supabase
                                        .from('produtos')
                                        .select('nome, preco, preco_promocional')
                                        .ilike('nome', `%${item.nome.split('(')[0].trim()}%`)
                                        .limit(1)
                                        .single()
                                    
                                    if (produto) {
                                        preco = Number(produto.preco_promocional || produto.preco)
                                        nome = produto.nome // Normaliza o nome
                                    } else {
                                        // Se não achou, usa o que tem (melhor fechar o pedido do que travar)
                                        console.warn(`Produto não encontrado no banco na hora de fechar: ${item.nome}`)
                                        preco = 0 // Alerta para revisão humana
                                    }
                                }

                                const qtd = item.quantidade || 1
                                subtotal += preco * qtd
                                itensValidados.push({
                                    nome: nome,
                                    quantidade: qtd,
                                    preco_unitario: preco
                                })
                            }

                            if (itensValidados.length === 0) {
                                toolResult = JSON.stringify({
                                    sucesso: false,
                                    erro: 'Nenhum item válido no pedido. Use buscar_item para confirmar os itens.'
                                })
                                break
                            }

                            // Calcular taxa de entrega via banco de dados
                            let taxaEntrega = 0
                            if (args.modalidade === 'entrega' && args.bairro) {
                                const { data: bairroData } = await supabase
                                    .rpc('buscar_bairro_taxa', { bairro_busca: args.bairro })
                                if (bairroData && bairroData.length > 0) {
                                    taxaEntrega = parseFloat(bairroData[0].taxa_entrega)
                                }
                            }

                            // Calcular desconto PIX
                            let desconto = 0
                            if (args.forma_pagamento?.toLowerCase() === 'pix') {
                                desconto = subtotal * 0.05
                            }

                            const valorTotal = subtotal + taxaEntrega - desconto

                            // Validar valor mínimo
                            if (subtotal < 15) {
                            toolResult = JSON.stringify({
                                sucesso: false,
                                    erro: `Valor mínimo do pedido é R$ 15,00. Subtotal atual: R$ ${subtotal.toFixed(2)}. Sugira adicionar mais itens.`
                            })
                            break
                        }

                            // Criar descrição dos itens
                            const itensDescricao = itensValidados
                                .map(i => `${i.quantidade}x ${i.nome} (R$ ${(i.preco_unitario * i.quantidade).toFixed(2)})`)
                                .join(' + ')

                            // Validar e sanitizar dados finais (modalidadeFinal já foi declarada acima)
                            const pagamentoFinal = (args.forma_pagamento || '').toLowerCase().trim()
                            
                            // Montar endereço completo (rua + número)
                            let enderecoCompleto = args.endereco || ''
                            if (args.rua && args.numero) {
                                enderecoCompleto = `${args.rua}, ${args.numero}`
                            } else if (!enderecoCompleto && args.rua) {
                                enderecoCompleto = args.rua + (args.numero ? `, ${args.numero}` : '')
                            }
                            
                            // Payload para debug
                            const pedidoPayload = {
                            phone: args.telefone,
                            nome_cliente: args.nome_cliente || pushName || 'Cliente WhatsApp',
                                itens: itensValidados,
                            valor_total: valorTotal,
                                taxa_entrega: taxaEntrega,
                                forma_pagamento: pagamentoFinal,
                            endereco_entrega: enderecoCompleto || (modalidadeFinal === 'entrega' ? 'Endereço não informado' : null),
                            bairro: args.bairro || null,
                                ponto_referencia: args.ponto_referencia || null,
                                observacoes: args.observacoes || (args.troco_para ? `Troco para R$ ${args.troco_para}` : null),
                            status: 'pendente',
                                modalidade: modalidadeFinal
                            }
                            
                            console.log('Tentando inserir pedido:', JSON.stringify(pedidoPayload))

                            // Inserir pedido
                            const { data: pedido, error: erroPedido } = await supabase
                                .from('pedidos')
                                .insert(pedidoPayload)
                                .select()
                                .single()

                            if (erroPedido) {
                                console.error('Erro Supabase Insert:', erroPedido)
                                throw new Error(`Erro Banco: ${erroPedido.message} (${erroPedido.details || ''})`)
                            }

                            // Mensagem de sucesso baseada na modalidade
                            const mensagemSucesso = modalidadeFinal === 'retirada' 
                                ? 'Seu pedido estará pronto em aproximadamente **30-40 minutos**! Você pode retirar no nosso restaurante.'
                                : 'Entrega estimada em **50-70 minutos**!'

                            toolResult = JSON.stringify({
                                sucesso: true,
                                pedido_id: pedido.id,
                                mensagem_sucesso: mensagemSucesso,
                                resumo: `Pedido #${pedido.id} criado com sucesso! ${mensagemSucesso}`
                            })
                        } catch (e) {
                            console.error('Erro em criar_pedido:', e)
                            
                            // LOGAR ERRO NO BANCO PARA DEBUG
                            await supabase.from('error_logs').insert({
                                context: 'criar_pedido',
                                error_message: e.message,
                                payload: args
                            })

                            // RETORNA O ERRO TÉCNICO PARA O AGENTE
                            toolResult = JSON.stringify({
                                sucesso: false,
                                erro_tecnico: e.message,
                                erro_usuario: 'Houve um erro técnico ao salvar o pedido. Por favor, verifique os dados.'
                            })
                        }
                        break

                    case 'verificar_pedido_duplicado':
                        try {
                            const cincoMinutosAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString()
                            const { data: pedidosRecentes } = await supabase
                                .from('pedidos')
                                .select('id, itens, created_at, valor_total')
                                .eq('phone', args.telefone)
                                .gte('created_at', cincoMinutosAtras)
                                .order('created_at', { ascending: false })
                                .limit(5)
                            
                            if (!pedidosRecentes || pedidosRecentes.length === 0) {
                                toolResult = JSON.stringify({
                                    duplicado: false,
                                    mensagem: 'Nenhum pedido recente encontrado. Pode prosseguir.'
                                })
                                break
                            }
                            
                            // Comparar itens do pedido atual com pedidos recentes
                            const itensAtuais = args.itens || []
                            const itensAtuaisStr = JSON.stringify(itensAtuais.map((i: any) => ({ 
                                nome: (i.nome || '').toLowerCase().trim(), 
                                quantidade: i.quantidade || 1 
                            })).sort((a: any, b: any) => a.nome.localeCompare(b.nome)))
                            
                            const pedidoSimilar = pedidosRecentes.find((p: any) => {
                                const itensPedido = Array.isArray(p.itens) ? p.itens : []
                                const itensPedidoStr = JSON.stringify(itensPedido.map((i: any) => ({ 
                                    nome: (typeof i === 'string' ? i : i.nome || '').toLowerCase().trim(), 
                                    quantidade: typeof i === 'object' ? (i.quantidade || 1) : 1 
                                })).sort((a: any, b: any) => a.nome.localeCompare(b.nome)))
                                
                                return itensPedidoStr === itensAtuaisStr
                            })
                            
                            if (pedidoSimilar) {
                                toolResult = JSON.stringify({
                                    duplicado: true,
                                    pedido_id: pedidoSimilar.id,
                                    mensagem: `⚠️ ATENÇÃO: Encontrei um pedido similar criado há pouco tempo (Pedido #${pedidoSimilar.id}).`,
                                    instrucao: 'Pergunte ao cliente se este é um pedido duplicado ou se ele realmente quer criar um novo pedido com os mesmos itens.'
                                })
                            } else {
                                toolResult = JSON.stringify({
                                    duplicado: false,
                                    mensagem: 'Nenhum pedido duplicado encontrado. Pode prosseguir.'
                                })
                            }
                        } catch (e) {
                            console.error('Erro em verificar_pedido_duplicado:', e)
                            toolResult = JSON.stringify({
                                duplicado: false,
                                erro: 'Erro ao verificar duplicação, mas pode prosseguir.'
                            })
                        }
                        break

                    case 'buscar_ultimo_pedido':
                        const { data: ultimoPedido } = await supabase
                            .from('pedidos')
                            .select('*')
                            .eq('phone', args.telefone)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .single()
                        
                        if (ultimoPedido) {
                            toolResult = JSON.stringify({
                                encontrado: true,
                                pedido: {
                                    id: ultimoPedido.id,
                                    itens: ultimoPedido.itens,
                                    valor: ultimoPedido.valor_total,
                                    status: ultimoPedido.status,
                                    data: ultimoPedido.created_at
                                }
                            })
                        } else {
                            toolResult = JSON.stringify({ encontrado: false })
                        }
                        break

                    case 'pausar_ia':
                        try {
                            // 1. Pausar IA para o cliente
                            const { data: clienteAtualizado } = await supabase.from('dados_cliente').upsert({
                                telefone: args.telefone,
                                atendimento_ia: 'pause'
                            }, { onConflict: 'telefone' }).select().single()

                            // 2. Buscar dados do cliente para o alerta
                            const { data: cliente } = await supabase
                                .from('dados_cliente')
                                .select('nome_completo, nomewpp, telefone')
                                .eq('telefone', args.telefone)
                                .single()

                            const nomeCliente = cliente?.nome_completo || cliente?.nomewpp || 'Cliente'
                            const telefoneCliente = args.telefone.replace('@s.whatsapp.net', '').replace(/\D/g, '')

                            // 3. Buscar instância WhatsApp conectada
                            const { data: instance } = await supabase
                                .from('whatsapp_instances')
                                .select('instance_name, status')
                                .eq('status', 'connected')
                                .single()

                            // 4. Enviar alerta para o gerente (5527996205115)
                            if (instance) {
                                const evolutionUrl = Deno.env.get('EVOLUTION_API_URL')
                                const evolutionKey = Deno.env.get('EVOLUTION_API_KEY')
                                
                                if (evolutionUrl && evolutionKey) {
                                    const telefoneGerente = '5527996205115@s.whatsapp.net'
                                    const motivo = args.motivo || 'Solicitação do cliente'
                                    
                                    const mensagemAlerta = `🚨 *ATENÇÃO: Cliente precisa de atendimento humano*

👤 *Cliente:* ${nomeCliente}
📱 *Telefone:* ${telefoneCliente}
⚠️ *Motivo:* ${motivo}

A IA foi pausada para este cliente. Por favor, assuma o atendimento manualmente.`

                                    try {
                                        await fetch(`${evolutionUrl}/message/sendText/${instance.instance_name}`, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'apikey': evolutionKey
                                            },
                                            body: JSON.stringify({
                                                number: telefoneGerente,
                                                text: mensagemAlerta,
                                                delay: 1000
                                            })
                                        })

                                        // Salvar mensagem de alerta no banco
                                        await supabase.from('whatsapp_messages').insert({
                                            remote_jid: telefoneGerente,
                                            from_me: true,
                                            message_type: 'text',
                                            content: mensagemAlerta,
                                            status: 'sent'
                                        })
                                    } catch (erroAlerta) {
                                        console.error('Erro ao enviar alerta para gerente:', erroAlerta)
                                        // Não falhar a operação se o alerta falhar
                                    }
                                }
                            }

                            toolResult = JSON.stringify({ 
                                sucesso: true, 
                                motivo: args.motivo,
                                mensagem: 'Transferindo para atendente humano...',
                                alerta_enviado: true
                            })
                        } catch (e) {
                            console.error('Erro em pausar_ia:', e)
                            toolResult = JSON.stringify({ 
                                sucesso: false,
                                erro: e.message,
                                mensagem: 'Erro ao pausar IA, mas tentando continuar...'
                            })
                        }
                        break

                    case 'calcular_taxa_entrega':
                        // Usar RPC do banco de dados para busca inteligente de bairros
                        const { data: bairrosData, error: bairroError } = await supabase
                            .rpc('buscar_bairro_taxa', { bairro_busca: args.bairro })
                        
                        if (bairroError) {
                            console.error('Erro ao buscar bairro:', bairroError)
                            toolResult = JSON.stringify({
                                atendido: false,
                                erro: 'Erro ao verificar bairro',
                                opcao_retirada: 'Você pode optar pela retirada no local (gratuita)!'
                            })
                        } else if (bairrosData && bairrosData.length > 0) {
                            const bairroEncontrado = bairrosData[0]
                            toolResult = JSON.stringify({
                                atendido: true,
                                bairro: bairroEncontrado.nome,
                                taxa: parseFloat(bairroEncontrado.taxa_entrega),
                                mensagem: `Atendemos ${bairroEncontrado.nome}! Taxa de entrega: R$ ${parseFloat(bairroEncontrado.taxa_entrega).toFixed(2)}`,
                                // Se houver mais sugestões com score menor, incluir
                                outras_opcoes: bairrosData.length > 1 
                                    ? bairrosData.slice(1).map((b: any) => b.nome) 
                                    : []
                            })
                        } else {
                            // Bairro não encontrado - sugerir retirada
                            toolResult = JSON.stringify({
                                atendido: false,
                                bairro_informado: args.bairro,
                                mensagem: 'Infelizmente não atendemos esse bairro no momento.',
                                sugestao: 'Você pode optar pela retirada no local!',
                                opcao_retirada: 'A retirada é gratuita!',
                                instrucao_CRITICA: 'NÃO aceite pedido de entrega para este bairro. Sugira retirada no local ou pergunte se o cliente quer mudar para retirada.'
                            })
                        }
                        break

                    default:
                        toolResult = JSON.stringify({ erro: 'Função não reconhecida' })
                }

                // Adicionar resultado da tool
                toolResults.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolResult
                })
            }

            // Adicionar mensagem do assistente com tool_calls
            messages.push(choice.message)

            // Adicionar todos os resultados das tools
            for (const tr of toolResults) {
                messages.push(tr)
            }

            // Nova chamada para gerar resposta final
            const finalResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openaiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: messages,
                    max_tokens: 600,
                    temperature: 0.7
                })
            })

            const finalResult = await finalResponse.json()
            responseText = finalResult.choices?.[0]?.message?.content || ''
        } else {
            responseText = choice?.message?.content || 'Desculpe, não consegui processar sua mensagem. Pode repetir?'
        }

        // Atualizar sessão
        await supabase.from('agent_sessions').update({
            updated_at: new Date().toISOString(),
            last_message_at: new Date().toISOString()
        }).eq('remote_jid', remoteJid)

        return new Response(JSON.stringify({ response: responseText }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Erro no ai-agent:', error)
        return new Response(JSON.stringify({
            error: error.message,
            response: 'Desculpe, ocorreu um erro. Por favor, tente novamente em alguns instantes.'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
