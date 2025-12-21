// Supabase Edge Function: ai-agent
// Processa mensagens com OpenAI e executa tools

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// System prompt da Imperatriz
const SYSTEM_PROMPT = `Você é Imperatriz, assistente virtual do Império das Porções (restaurante de porções em Cariacica-ES).

HORÁRIO: Quarta a Domingo, 19h30-23h. Fechado Segunda e Terça.

## FLUXO DE PEDIDO (siga na ordem):

1. ITENS DO PEDIDO
   - Quando cliente pedir algo, use buscar_preco_item para obter o preço
   - Se pedir "porção" sem especificar, pergunte: Mini (R$31), Média (R$65-78) ou Grande (R$84-96)?
   - Se pedir "suco" sem especificar, pergunte qual sabor (todos R$8)
   - Anote quantidade e preço de cada item

2. MODALIDADE
   - Pergunte: "Será ENTREGA ou RETIRADA no local?"
   - Se RETIRADA: taxa = R$0, pule para passo 4
   - Se ENTREGA: continue com passo 3

3. ENDEREÇO (só se entrega)
   - Pergunte o BAIRRO
   - Use calcular_taxa_entrega para ver se atendemos e qual a taxa
   - Se não atendemos, sugira retirada
   - Peça: rua, número e ponto de referência

4. NOME DO CLIENTE
   - Pergunte: "Qual seu nome completo?"

5. FORMA DE PAGAMENTO
   - Opções: PIX (5% desconto), Dinheiro, Crédito ou Débito
   - Se dinheiro: "Precisa de troco? Para quanto?"

6. CONFIRMAR PEDIDO
   - Mostre resumo COM VALORES REAIS:
     * Itens: nome e preço de cada
     * Subtotal dos itens
     * Taxa de entrega (ou R$0 se retirada)
     * Total final (com desconto PIX se aplicável)
   - Peça confirmação: "Confirma este pedido?"

7. CRIAR PEDIDO
   - Só após cliente confirmar, use criar_pedido
   - Informe tempo: 50-70 minutos para entrega

## BAIRROS E TAXAS:
Porto Novo R$3 | Presidente Medice R$3 | Porto de Santana R$3 | Del Porto R$3 | Morro do Sesi R$3 | Morada Feliz R$3
Retiro R$4 | Vila Oasis R$4 | Morro do Meio R$4 | Bairro Aparecida R$4
Nova Canaã R$5 | Sotema R$5
Santana R$6 | Tucum R$6 | Boa Vista R$6 | Flexal I R$6 | Itaquari R$6
Itacibá R$7 | Tabajara R$12 | Campo Grande R$12

## REGRAS IMPORTANTES:
- SEMPRE use buscar_preco_item antes de confirmar pedido
- NUNCA invente preços ou mostre "XX" - sempre valores reais
- Valor mínimo do pedido: R$15 (sem contar taxa)
- NUNCA peça os itens novamente se o cliente já informou! Consulte o histórico da conversa.
- Mantenha os itens na memória durante TODO o fluxo até criar o pedido
- Seja objetivo e profissional`

// Definição das tools
const tools = [
    {
        type: 'function',
        function: {
            name: 'buscar_cardapio',
            description: 'Busca produtos e categorias do cardápio do restaurante com preços',
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
            name: 'buscar_preco_item',
            description: 'Busca o preço de um item específico do cardápio pelo nome',
            parameters: {
                type: 'object',
                properties: {
                    nome_item: {
                        type: 'string',
                        description: 'Nome do item a buscar (ex: "batata frita", "suco")'
                    }
                },
                required: ['nome_item']
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
            description: 'Cria um novo pedido no sistema. IMPORTANTE: valor_total deve incluir o preço dos itens (buscados com buscar_preco_item) + taxa de entrega. Valor mínimo: R$15.',
            parameters: {
                type: 'object',
                properties: {
                    telefone: { type: 'string' },
                    nome_cliente: { type: 'string', description: 'Nome completo do cliente' },
                    itens: { type: 'string', description: 'Descrição dos itens do pedido com preços (ex: Batata Frita R$18 + Fanta R$6,50)' },
                    valor_total: { type: 'number', description: 'Valor total = soma dos itens + taxa de entrega. Mínimo R$15.' },
                    taxa_entrega: { type: 'number' },
                    forma_pagamento: { type: 'string' },
                    endereco: { type: 'string' },
                    bairro: { type: 'string' },
                    observacoes: { type: 'string' }
                },
                required: ['telefone', 'nome_cliente', 'itens', 'valor_total']
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
            const toolResults: any[] = []

            for (const toolCall of choice.message.tool_calls) {
                const functionName = toolCall.function.name
                const args = JSON.parse(toolCall.function.arguments)

                console.log(`Executando tool: ${functionName}`, args)

                let toolResult = ''

                switch (functionName) {
                    case 'buscar_cardapio':
                        // Sempre enviar link do PDF
                        toolResult = JSON.stringify({
                            pdf_url: 'https://cxhypcvdijqauaibcgyp.supabase.co/storage/v1/object/public/arquivos/Cardapio_Imperio.pdf',
                            mensagem: 'O cardápio completo está disponível neste link. Após ver, me diga o que deseja pedir que busco o preço para você!'
                        })
                        break

                    case 'buscar_preco_item':
                        // Buscar preço de um item específico
                        try {
                            const nomeItem = (args.nome_item || '').toLowerCase().trim()
                            if (!nomeItem) {
                                toolResult = JSON.stringify({
                                    encontrado: false,
                                    mensagem: 'Nome do item não informado. Pergunte ao cliente qual item deseja.'
                                })
                                break
                            }

                            const { data: itemEncontrado, error: erroBusca } = await supabase
                                .from('produtos')
                                .select('nome, preco, preco_promocional')
                                .eq('disponivel', true)
                                .ilike('nome', `%${nomeItem}%`)
                                .limit(1)
                                .single()

                            if (erroBusca || !itemEncontrado) {
                                toolResult = JSON.stringify({
                                    encontrado: false,
                                    mensagem: `Não encontrei "${args.nome_item}" no cardápio. Pergunte ao cliente qual item específico deseja.`
                                })
                            } else {
                                toolResult = JSON.stringify({
                                    encontrado: true,
                                    nome: itemEncontrado.nome,
                                    preco: Number(itemEncontrado.preco_promocional || itemEncontrado.preco)
                                })
                            }
                        } catch (e) {
                            console.error('Erro em buscar_preco_item:', e)
                            toolResult = JSON.stringify({
                                encontrado: false,
                                mensagem: 'Erro ao buscar item. Tente perguntar ao cliente o item específico.'
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
                        // Validação: valor mínimo (não pode ser só taxa de entrega)
                        const valorTotal = args.valor_total || 0
                        const taxaEntregaPedido = args.taxa_entrega || 0

                        if (valorTotal <= taxaEntregaPedido || valorTotal < 15) {
                            toolResult = JSON.stringify({
                                sucesso: false,
                                erro: 'Valor do pedido muito baixo. Verifique se buscou o preço dos itens com buscar_preco_item antes de criar o pedido.'
                            })
                            break
                        }

                        const { data: pedido } = await supabase.from('pedidos').insert({
                            phone: args.telefone,
                            nome_cliente: args.nome_cliente || pushName || 'Cliente WhatsApp',
                            itens: args.itens,
                            valor_total: valorTotal,
                            taxa_entrega: taxaEntregaPedido,
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

                    case 'calcular_taxa_entrega':
                        const bairrosAtendidos = [
                            { nome: 'Porto Novo', taxa: 3 },
                            { nome: 'Presidente Medice', taxa: 3 },
                            { nome: 'Retiro', taxa: 4 },
                            { nome: 'Santana', taxa: 6 },
                            { nome: 'Sotema', taxa: 5 },
                            { nome: 'Tabajara', taxa: 12 },
                            { nome: 'Tucum', taxa: 6 },
                            { nome: 'Vila Oasis', taxa: 4 },
                            { nome: 'Morro do Meio', taxa: 4 },
                            { nome: 'Morro do Sesi', taxa: 3 },
                            { nome: 'Nova Canaã', taxa: 5 },
                            { nome: 'Porto de Santana', taxa: 3 },
                            { nome: 'Bairro Aparecida', taxa: 4 },
                            { nome: 'Boa Vista', taxa: 6 },
                            { nome: 'Campo Grande', taxa: 12 },
                            { nome: 'Del Porto', taxa: 3 },
                            { nome: 'Flexal I', taxa: 6 },
                            { nome: 'Itacibá', taxa: 7 },
                            { nome: 'Itaquari', taxa: 6 },
                            { nome: 'Morada Feliz', taxa: 3 }
                        ]
                        const bairroNormalizado = args.bairro.toLowerCase().trim()
                        const bairroEncontrado = bairrosAtendidos.find(b =>
                            b.nome.toLowerCase() === bairroNormalizado ||
                            b.nome.toLowerCase().includes(bairroNormalizado) ||
                            bairroNormalizado.includes(b.nome.toLowerCase())
                        )
                        if (bairroEncontrado) {
                            toolResult = JSON.stringify({
                                atendido: true,
                                bairro: bairroEncontrado.nome,
                                taxa: bairroEncontrado.taxa,
                                mensagem: `Atendemos ${bairroEncontrado.nome}! Taxa de entrega: R$ ${bairroEncontrado.taxa.toFixed(2)}`
                            })
                        } else {
                            toolResult = JSON.stringify({
                                atendido: false,
                                mensagem: 'Infelizmente não atendemos esse bairro no momento. Você pode retirar no local se preferir!'
                            })
                        }
                        break
                }

                // Adicionar resultado da tool (uma entrada para cada tool)
                toolResults.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolResult
                })
            }

            // Adicionar mensagem do assistente com tool_calls UMA VEZ (fora do loop)
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
