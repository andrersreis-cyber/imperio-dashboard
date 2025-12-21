// Supabase Edge Function: ai-agent
// Processa mensagens com OpenAI e executa tools

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// System prompt da Imperatriz
const SYSTEM_PROMPT = `# IDENTIDADE

Você é a **Imperatriz**, assistente virtual do **Império das Porções**.

## REGRA DE OURO
"Nunca seja mais carinhoso que o cliente. Seja acolhedor, mas profissional."

## TOM POR TIPO DE CLIENTE
- Cliente DIRETO: Responda objetivamente, sem emojis em excesso
- Cliente CORDIAL: Seja acolhedor, use 1-2 emojis
- Cliente CARINHOSO: Espelhe o carinho, use 2-3 emojis

## IDENTIFICAÇÃO DE GÊNERO
- MULHER: usar "querida", "minha amiga"
- HOMEM: usar "querido", "meu amigo"
- NÃO IDENTIFICADO: usar "olá!", saudações neutras

## EXEMPLOS DE RESPOSTAS
- Saudação: "Boa tarde! Eu sou a Imperatriz, do Império das Porções. Como posso ajudar?"
- Coleta: "Perfeito! Para finalizar, preciso de: nome, endereço, bairro, ponto de referência e forma de pagamento."
- Confirmação: "Pedido confirmado! Entrega em aproximadamente 70 minutos. Obrigada pela preferência! 🍗"

## O QUE EVITAR
- "Meu amor" como saudação padrão
- Excesso de emojis (máximo 2 por mensagem)
- Repetir termos carinhosos

## INFORMAÇÕES DO RESTAURANTE
- Local: Porto de Santana, Cariacica - ES
- Horário: Quarta a Domingo, 19h30-23h (último pedido 22h30)
- Fechado: Segunda e Terça
- Pagamento: Dinheiro, PIX, Débito, Crédito
- Especialidade: Porções com maionese caseira especial

## DADOS A COLETAR (DELIVERY)
1. Nome do cliente
2. Endereço (rua e número)
3. Bairro
4. Ponto de referência
5. Itens do pedido
6. Forma de pagamento

## FERRAMENTAS DISPONÍVEIS
Você tem acesso às seguintes funções:
- buscar_cardapio: Lista produtos do cardápio
- buscar_cliente: Busca dados do cliente pelo telefone
- salvar_cliente: Salva/atualiza dados do cliente
- criar_pedido: Cria um novo pedido
- buscar_ultimo_pedido: Busca o último pedido do cliente
- pausar_ia: Pausa o atendimento automático (escala para humano)
- calcular_total: Calcula o total do pedido

## FLUXO DE ATENDIMENTO
1. Saudar o cliente
2. Se pedir cardápio, usar buscar_cardapio
3. Anotar pedido
4. Coletar dados de entrega
5. Confirmar pedido (usar criar_pedido)
6. Informar tempo de entrega (~70 min)

## QUANDO ESCALAR PARA HUMANO
- Alergias alimentares
- Reclamações
- Mais de 2 modificações no pedido
- Cliente insatisfeito`

// Definição das tools
const tools = [
    {
        type: 'function',
        function: {
            name: 'buscar_cardapio',
            description: 'Busca produtos e categorias do cardápio do restaurante',
            parameters: {
                type: 'object',
                properties: {
                    categoria: {
                        type: 'string',
                        description: 'Categoria para filtrar (opcional)'
                    }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'buscar_cliente',
            description: 'Busca dados do cliente pelo telefone',
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
            description: 'Cria um novo pedido no sistema',
            parameters: {
                type: 'object',
                properties: {
                    telefone: { type: 'string' },
                    itens: { type: 'string', description: 'Descrição dos itens do pedido' },
                    valor_total: { type: 'number' },
                    taxa_entrega: { type: 'number' },
                    forma_pagamento: { type: 'string' },
                    endereco: { type: 'string' },
                    bairro: { type: 'string' },
                    observacoes: { type: 'string' }
                },
                required: ['telefone', 'itens', 'valor_total']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'buscar_ultimo_pedido',
            description: 'Busca o último pedido do cliente',
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
            name: 'pausar_ia',
            description: 'Pausa o atendimento automático e escala para humano',
            parameters: {
                type: 'object',
                properties: {
                    telefone: { type: 'string' },
                    motivo: { type: 'string' }
                },
                required: ['telefone']
            }
        }
    }
]

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
        const { data: cliente } = await supabase
            .from('dados_cliente')
            .select('*')
            .eq('telefone', remoteJid)
            .single()

        // Buscar histórico de mensagens (últimas 10)
        const { data: historico } = await supabase
            .from('whatsapp_messages')
            .select('content, from_me, created_at')
            .eq('remote_jid', remoteJid)
            .order('created_at', { ascending: false })
            .limit(10)

        // Montar mensagens para o OpenAI
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'system',
                content: `Contexto atual:
- Telefone: ${remoteJid}
- Nome WhatsApp: ${pushName || 'Não identificado'}
- Cliente cadastrado: ${cliente ? 'Sim - ' + (cliente.nome_completo || cliente.nomewpp) : 'Não'}
${cliente ? `- Endereço: ${cliente.endereco || 'Não informado'}
- Bairro: ${cliente.bairro || 'Não informado'}` : ''}
- Horário atual: ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
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
                max_tokens: 500
            })
        })

        const openaiResult = await openaiResponse.json()
        console.log('OpenAI Response:', JSON.stringify(openaiResult, null, 2))

        const choice = openaiResult.choices?.[0]
        let responseText = ''

        // Processar tool calls se houver
        if (choice?.message?.tool_calls) {
            for (const toolCall of choice.message.tool_calls) {
                const functionName = toolCall.function.name
                const args = JSON.parse(toolCall.function.arguments)

                console.log(`Executando tool: ${functionName}`, args)

                let toolResult = ''

                switch (functionName) {
                    case 'buscar_cardapio':
                        const { data: produtos } = await supabase
                            .from('produtos')
                            .select('nome, descricao, preco')
                            .eq('ativo', true)
                        toolResult = JSON.stringify(produtos)
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
                        const { data: pedido } = await supabase.from('pedidos').insert({
                            phone: args.telefone,
                            itens: args.itens,
                            valor_total: args.valor_total,
                            taxa_entrega: args.taxa_entrega || 0,
                            forma_pagamento: args.forma_pagamento,
                            endereco_entrega: args.endereco,
                            bairro: args.bairro,
                            observacoes: args.observacoes,
                            status: 'pendente',
                            modalidade: 'delivery'
                        }).select().single()

                        // Atualizar último pedido do cliente
                        await supabase.from('dados_cliente').update({
                            ultimo_pedido: new Date().toISOString()
                        }).eq('telefone', args.telefone)

                        toolResult = JSON.stringify({ sucesso: true, pedido_id: pedido?.id })
                        break

                    case 'buscar_ultimo_pedido':
                        const { data: ultimoPedido } = await supabase
                            .from('pedidos')
                            .select('*')
                            .eq('phone', args.telefone)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .single()
                        toolResult = JSON.stringify(ultimoPedido || { encontrado: false })
                        break

                    case 'pausar_ia':
                        await supabase.from('dados_cliente').upsert({
                            telefone: args.telefone,
                            atendimento_ia: 'pause'
                        }, { onConflict: 'telefone' })
                        toolResult = JSON.stringify({ sucesso: true, motivo: args.motivo })
                        break
                }

                // Segunda chamada para gerar resposta com resultado da tool
                messages.push(choice.message)
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolResult
                })
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
                    max_tokens: 500
                })
            })

            const finalResult = await finalResponse.json()
            responseText = finalResult.choices?.[0]?.message?.content || ''
        } else {
            responseText = choice?.message?.content || 'Desculpe, não consegui processar sua mensagem.'
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
            response: 'Desculpe, ocorreu um erro. Por favor, tente novamente.'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
