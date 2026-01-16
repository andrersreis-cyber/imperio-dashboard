// Supabase Edge Function: ai-agent
// Agente Simplificado - Envia link do app de delivery e consulta status de pedidos
// Versão 3.0 - Simplificado

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizePhoneDigits(input: string | null | undefined): string {
    const digits = String(input ?? '').replace(/\D/g, '')
    if (!digits) return ''
    if (digits.startsWith('55')) return digits
    if (digits.length === 10 || digits.length === 11) return `55${digits}`
    return digits
}

// URL do App de Delivery
const APP_DELIVERY_URL = 'https://imperiofood.netlify.app/cardapio'

// System prompt - Agente persuasivo para cardápio online
const SYSTEM_PROMPT = `Você é **Imperatriz**, a assistente virtual do **Império das Porções**, um restaurante familiar em Porto de Santana, Cariacica - ES.

## SUA MISSÃO PRINCIPAL
🎯 Ajudar os clientes e apresentar nosso **cardápio online** como uma forma prática de fazer pedidos!
Seja simpática, acolhedora e deixe claro que o acompanhamento é TODO pelo WhatsApp.

## SUA PERSONALIDADE
- Acolhedora, simpática e prestativa
- Use emojis de forma moderada para ser amigável
- Seja paciente e clara nas explicações
- Mostre genuíno interesse em ajudar

## INFORMAÇÕES DO RESTAURANTE
- **Horário**: Quarta a Domingo, das 19h30 às 23h
- **Local**: Porto de Santana, Cariacica - ES
- **Filosofia**: "Nossa família servindo a sua família"

## 📱 SOBRE O CARDÁPIO ONLINE

### Link:
https://imperiofood.netlify.app/cardapio

### ⚠️ ESCLARECIMENTOS OBRIGATÓRIOS (SEMPRE FALAR):
1. **É um SITE normal** - Abre no navegador como qualquer página
2. **NÃO precisa instalar nada** - É só clicar e usar
3. **NÃO precisa criar conta** - Só escolher e pedir
4. **O acompanhamento é TODO pelo WhatsApp** - Você não precisa entrar no site de novo!

### COMO FUNCIONA:
1. Você acessa o link, escolhe os pratos e finaliza o pedido
2. **Pronto! Agora é só esperar minhas mensagens aqui** 📲
3. Te aviso quando aceitarmos, quando começar a preparar, e quando sair pra entrega!

### BENEFÍCIOS:
✅ Ver cardápio completo com fotos
✅ Preços atualizados 
✅ Escolher sem pressa
✅ Sem erro na anotação

## 📲 ACOMPANHAMENTO DO PEDIDO (PELO WHATSAPP!)

**IMPORTANTE:** O cliente NÃO precisa voltar ao site. Todo acompanhamento é aqui:
- ✅ Aviso quando o restaurante aceita o pedido
- 🍳 Aviso quando começa a preparar
- 🛵 Aviso quando sai para entrega
- ⏱️ Informo o tempo restante baseado no bairro

## FLUXO DE ATENDIMENTO

### 1️⃣ QUANDO CLIENTE QUER FAZER PEDIDO:

"Oba, que bom que quer pedir! 😊

Pra fazer seu pedido é simples - acesse nosso cardápio online:

👉 https://imperiofood.netlify.app/cardapio

É só clicar no link (abre no navegador, não precisa instalar nada!):
• Escolha os pratos com calma
• Coloque seu endereço
• Finalize

E o melhor: você acompanha tudo por aqui no WhatsApp! 
Te aviso quando aceitarmos, quando começar a preparar e quando sair pra entrega 🛵

Quer experimentar?"

### 2️⃣ SE CLIENTE RESISTIR:

"Entendo! 😊 Deixa eu explicar melhor:

É só clicar aqui:
👉 https://imperiofood.netlify.app/cardapio

Funciona como qualquer site (tipo Google, Facebook):
• Não baixa nada
• Não instala nada
• Não cria conta

Você só entra, escolhe e pronto! Depois disso eu cuido de tudo por aqui:
- Te aviso quando aceitar ✅
- Te aviso quando preparar 🍳
- Te aviso quando sair 🛵

Tenta acessar? Qualquer dúvida me fala! 💪"

### 3️⃣ SE AINDA RESISTIR - Chamar humano:

"Tudo bem! Vou chamar um atendente pra te ajudar. Aguarda só um minutinho! 😊

💡 Se mudar de ideia, o cardápio tá sempre em: https://imperiofood.netlify.app/cardapio"

Use a ferramenta **pausar_ia** com motivo "Cliente precisa de atendimento humano para fazer pedido"

### 4️⃣ STATUS DO PEDIDO / TEMPO DE ENTREGA

Quando cliente perguntar "cadê meu pedido?", "quanto tempo?", "já saiu?":
- Use a ferramenta **consultar_status_pedido**
- A ferramenta calcula automaticamente o tempo restante baseado no bairro e horário do pedido
- Informe de forma clara

**IMPORTANTE SOBRE TEMPO:**
- O tempo de entrega varia por bairro (30 a 60 minutos)
- A ferramenta já faz o cálculo: tempo_total - tempo_decorrido = tempo_restante
- Use a previsao_entrega que vem calculada!

Exemplos de resposta:
- "Seu pedido #123 está sendo preparado! 🍳 Faltam aproximadamente 25 minutos. Te aviso quando sair!"
- "Oi! Seu pedido foi feito há 20 minutos. O tempo total pro seu bairro é 45 min, então faltam uns 25 minutinhos! 😊"
- "Seu pedido #456 já saiu pra entrega! 🛵 Deve chegar em 10-15 minutos!"

### 5️⃣ DÚVIDAS SOBRE O CARDÁPIO

Se perguntar "preciso instalar?", "é app?", "como funciona?":

"Não precisa instalar nada! 😊 É um site normal que abre no navegador. 
Você faz o pedido lá e **todo o acompanhamento você recebe aqui no WhatsApp!**
Te aviso de tudo: quando aceitar, preparar e sair pra entrega."

### 6️⃣ RECLAMAÇÕES
- Peça desculpas
- Use **pausar_ia** imediatamente
- "Puxa, sinto muito! 😔 Vou chamar nosso gerente agora!"

## REGRAS

### ✅ FAZER:
- Deixar MUITO claro que é um SITE, não app
- Enfatizar que o acompanhamento é TODO pelo WhatsApp
- Explicar que não precisa criar conta
- Tentar 2 vezes antes de chamar humano
- Usar o tempo calculado pela ferramenta

### ❌ NÃO FAZER:
- Usar "instalar" ou "baixar" (exceto para dizer que NÃO precisa)
- Usar a palavra "app" (preferir "cardápio online" ou "site")
- Fazer parecer complicado
- Fazer pedido pelo WhatsApp
- Inventar tempo de entrega (sempre usar a ferramenta!)

### ⚠️ FORMATAÇÃO DE LINKS (MUITO IMPORTANTE!):
- NUNCA use formatação Markdown para links!
- NUNCA escreva [texto](url) - o WhatsApp não interpreta isso!
- SEMPRE escreva a URL pura e simples, assim:
  
  ERRADO: [https://imperiofood.netlify.app/cardapio](https://imperiofood.netlify.app/cardapio)
  ERRADO: [Clique aqui](https://imperiofood.netlify.app/cardapio)
  
  CERTO: https://imperiofood.netlify.app/cardapio
  CERTO: 👉 https://imperiofood.netlify.app/cardapio

- Também NUNCA use **texto** para negrito - o WhatsApp usa *texto* para itálico apenas

## FRASES CORRETAS
- "É um site normal, abre no navegador"
- "Não precisa instalar nada"
- "O acompanhamento é todo aqui no WhatsApp"
- "Te aviso quando sair pra entrega"

## FRASES PROIBIDAS ❌
- "Baixe o app"
- "Instale no celular"  
- "Acompanhe pelo app"
- "Abra o aplicativo"

## LEMBRE-SE
Você é **Imperatriz**! 
O cardápio online é uma FACILIDADE.
O cliente faz o pedido no site e recebe TUDO pelo WhatsApp!`

// Definição das tools - Versão simplificada
const tools = [
    {
        type: 'function',
        function: {
            name: 'consultar_status_pedido',
            description: 'Consulta o status dos pedidos do cliente pelo telefone. Use quando o cliente perguntar sobre seu pedido, status, previsão de entrega, etc.',
            parameters: {
                type: 'object',
                properties: {
                    telefone: {
                        type: 'string',
                        description: 'Telefone do cliente (será preenchido automaticamente se não informado)'
                    }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'pausar_ia',
            description: 'Pausa o atendimento automático e transfere para atendente humano. Use quando: 1) Cliente insistir em pedir pelo WhatsApp, 2) Cliente tiver reclamação, 3) Situação complexa que precisa de humano.',
            parameters: {
                type: 'object',
                properties: {
                    telefone: { 
                        type: 'string',
                        description: 'Telefone do cliente'
                    },
                    motivo: { 
                        type: 'string',
                        description: 'Motivo da transferência para humano'
                    }
                },
                required: ['motivo']
            }
        }
    }
]

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { remoteJid, content, pushName, instanceName: instanceNameFromRequest } = await req.json()
        const phoneDigits = normalizePhoneDigits(remoteJid)

        // Criar cliente Supabase
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const openaiKey = Deno.env.get('OPENAI_API_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Buscar/criar cliente
        let { data: cliente } = await supabase
            .from('dados_cliente')
            .select('*')
            .eq('telefone', phoneDigits)
            .single()

        if (!cliente) {
            const { data: novoCliente } = await supabase
                .from('dados_cliente')
                .insert({
                    telefone: phoneDigits,
                    whatsapp_jid: remoteJid,
                    nomewpp: pushName || 'Cliente WhatsApp',
                    created_at: new Date().toISOString()
                })
                .select()
                .single()
            cliente = novoCliente
        }

        // Atualizar whatsapp_jid se necessário
        if (remoteJid && cliente?.whatsapp_jid !== remoteJid) {
            await supabase
                .from('dados_cliente')
                .update({ whatsapp_jid: remoteJid, updated_at: new Date().toISOString() })
                .eq('telefone', phoneDigits)
        }

        // Buscar histórico de mensagens (últimas 10 para contexto)
        const { data: historico } = await supabase
            .from('whatsapp_messages')
            .select('content, from_me, created_at')
            .eq('remote_jid', remoteJid)
            .order('created_at', { ascending: false })
            .limit(10)

        // Montar mensagens para o OpenAI
        const messages: any[] = [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'system',
                content: `## CONTEXTO ATUAL
- Telefone do cliente: ${phoneDigits}
- Nome no WhatsApp: ${pushName || 'Não identificado'}
- Cliente cadastrado: ${cliente ? 'Sim - ' + (cliente.nome_completo || cliente.nomewpp) : 'Não'}
- Horário atual: ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
- Dia: ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' })}`
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
                max_tokens: 500,
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
                const args = JSON.parse(toolCall.function.arguments || '{}')
                const telefonePadrao = normalizePhoneDigits(args?.telefone) || phoneDigits

                console.log(`Executando tool: ${functionName}`, args)

                let toolResult = ''

                switch (functionName) {
                    case 'consultar_status_pedido':
                        try {
                            // Buscar pedidos do cliente
                            const { data: pedidos, error } = await supabase
                                .from('pedidos')
                                .select('id, status, itens, valor_total, created_at, modalidade, bairro')
                                .eq('phone', telefonePadrao)
                                .order('created_at', { ascending: false })
                                .limit(3)

                            if (error) throw error

                            if (!pedidos || pedidos.length === 0) {
                                toolResult = JSON.stringify({
                                    encontrado: false,
                                    mensagem: 'Não encontrei pedidos recentes para este telefone. O cliente pode ter feito o pedido com outro número ou ainda não fez nenhum pedido.'
                                })
                            } else {
                                // Buscar tempos de entrega dos bairros
                                const bairrosUnicos = [...new Set(pedidos.map(p => p.bairro).filter(Boolean))]
                                let temposBairros: { [key: string]: number } = {}
                                
                                if (bairrosUnicos.length > 0) {
                                    const { data: bairrosData } = await supabase
                                        .from('bairros_entrega')
                                        .select('nome, tempo_entrega_minutos')
                                        .in('nome', bairrosUnicos)
                                    
                                    if (bairrosData) {
                                        bairrosData.forEach(b => {
                                            temposBairros[b.nome] = b.tempo_entrega_minutos || 45
                                        })
                                    }
                                }

                                const agora = new Date()
                                const pedidosFormatados = pedidos.map(p => {
                                    const statusTexto: { [key: string]: string } = {
                                        'pendente': '⏳ Aguardando confirmação do restaurante',
                                        'confirmado': '✅ Pedido confirmado, entrando na fila',
                                        'preparando': '🍳 Sendo preparado na cozinha',
                                        'pronto': '✨ Pronto! Aguardando entregador',
                                        'saiu': '🛵 Saiu para entrega',
                                        'entregue': '✅ Entregue',
                                        'cancelado': '❌ Cancelado'
                                    }
                                    
                                    // Calcular tempo restante para entrega
                                    const horarioPedido = new Date(p.created_at)
                                    const tempoDecorridoMs = agora.getTime() - horarioPedido.getTime()
                                    const tempoDecorridoMin = Math.floor(tempoDecorridoMs / 60000)
                                    
                                    const tempoTotalEntrega = temposBairros[p.bairro] || 45
                                    const tempoRestante = Math.max(0, tempoTotalEntrega - tempoDecorridoMin)
                                    
                                    let previsaoTexto = ''
                                    if (p.modalidade === 'entrega') {
                                        if (p.status === 'entregue' || p.status === 'cancelado') {
                                            previsaoTexto = ''
                                        } else if (p.status === 'saiu') {
                                            previsaoTexto = 'Entregador a caminho! Deve chegar em breve (5-15 min)'
                                        } else if (tempoRestante <= 0) {
                                            previsaoTexto = 'Previsão original já passou. Deve sair para entrega em breve!'
                                        } else if (tempoRestante <= 10) {
                                            previsaoTexto = `Faltam aproximadamente ${tempoRestante} minutinhos!`
                                        } else if (tempoRestante <= 30) {
                                            previsaoTexto = `Previsão: mais uns ${tempoRestante} minutos`
                                        } else {
                                            previsaoTexto = `Previsão de entrega: aproximadamente ${tempoRestante} minutos`
                                        }
                                    } else if (p.modalidade === 'retirada') {
                                        if (p.status === 'pronto') {
                                            previsaoTexto = '🎉 Já pode vir buscar!'
                                        } else if (p.status !== 'entregue' && p.status !== 'cancelado') {
                                            previsaoTexto = `Tempo estimado para ficar pronto: ${Math.max(15, tempoTotalEntrega - 15)} min`
                                        }
                                    }

                                    return {
                                        numero: p.id,
                                        status: p.status,
                                        status_texto: statusTexto[p.status] || p.status,
                                        valor: `R$ ${Number(p.valor_total).toFixed(2)}`,
                                        modalidade: p.modalidade,
                                        bairro: p.bairro || '',
                                        horario_pedido: new Date(p.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
                                        tempo_decorrido_minutos: tempoDecorridoMin,
                                        previsao_entrega: previsaoTexto
                                    }
                                })

                                toolResult = JSON.stringify({
                                    encontrado: true,
                                    total_pedidos: pedidos.length,
                                    pedidos: pedidosFormatados,
                                    instrucao: 'Informe o status e a previsão de tempo de forma clara e amigável. Use a previsao_entrega que já foi calculada. Lembre que o cliente recebe notificações pelo WhatsApp quando o status muda!'
                                })
                            }
                        } catch (e) {
                            console.error('Erro em consultar_status_pedido:', e)
                            toolResult = JSON.stringify({
                                erro: true,
                                mensagem: 'Erro ao consultar pedidos. Peça desculpas e sugira que o cliente aguarde ou tente novamente.'
                            })
                        }
                        break

                    case 'pausar_ia':
                        try {
                            // Pausar IA para o cliente
                            await supabase.from('dados_cliente').upsert({
                                telefone: telefonePadrao,
                                whatsapp_jid: remoteJid,
                                atendimento_ia: 'pause',
                                updated_at: new Date().toISOString()
                            }, { onConflict: 'telefone' })

                            // Enviar alerta para o gerente
                            const evolutionUrl = Deno.env.get('EVOLUTION_API_URL')
                            const evolutionKey = Deno.env.get('EVOLUTION_API_KEY')
                            const instanceName = instanceNameFromRequest || 'avello'

                            if (evolutionUrl && evolutionKey) {
                                const telefoneGerente = '5527996205115@s.whatsapp.net'
                                const motivo = args.motivo || 'Solicitação do cliente'
                                const nomeCliente = cliente?.nome_completo || cliente?.nomewpp || pushName || 'Cliente'

                                const mensagemAlerta = `🚨 *ATENDIMENTO HUMANO SOLICITADO*

👤 *Cliente:* ${nomeCliente}
📱 *Telefone:* ${telefonePadrao}
⚠️ *Motivo:* ${motivo}

A IA foi pausada. Por favor, assuma o atendimento.`

                                try {
                                    await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'apikey': evolutionKey
                                        },
                                        body: JSON.stringify({
                                            number: telefoneGerente,
                                            text: mensagemAlerta
                                        })
                                    })
                                } catch (alertError) {
                                    console.error('Erro ao enviar alerta:', alertError)
                                }
                            }

                            toolResult = JSON.stringify({
                                sucesso: true,
                                mensagem: 'Atendimento transferido para humano. Informe ao cliente que um atendente irá ajudá-lo em breve.'
                            })
                        } catch (e) {
                            console.error('Erro em pausar_ia:', e)
                            toolResult = JSON.stringify({
                                sucesso: false,
                                mensagem: 'Erro ao transferir. Peça desculpas e diga que um atendente entrará em contato.'
                            })
                        }
                        break

                    default:
                        toolResult = JSON.stringify({ erro: 'Função não reconhecida' })
                }

                toolResults.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolResult
                })
            }

            // Adicionar mensagem do assistente com tool_calls
            messages.push(choice.message)

            // Adicionar resultados das tools
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
                    max_tokens: 500,
                    temperature: 0.7
                })
            })

            const finalResult = await finalResponse.json()
            responseText = finalResult.choices?.[0]?.message?.content || ''
        } else {
            responseText = choice?.message?.content || 'Desculpe, não consegui processar sua mensagem. Pode repetir?'
        }

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
