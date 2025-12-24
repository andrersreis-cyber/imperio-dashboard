// Supabase Edge Function: whatsapp-webhook
// Recebe mensagens da Evolution API e processa com o agente IA
// v1.1 - Suporte a audio e ptt


import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json()
        console.log('Webhook recebido:', JSON.stringify(body, null, 2))

        // Extrair dados da mensagem
        const event = body.event
        const data = body.data

        // Ignorar mensagens enviadas por nós mesmos
        if (data?.key?.fromMe) {
            return new Response(JSON.stringify({ status: 'ignored', reason: 'from_me' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Ignorar eventos que não são mensagens
        if (!['messages.upsert'].includes(event)) {
            return new Response(JSON.stringify({ status: 'ignored', reason: 'not_message' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Extrair informações da mensagem
        const remoteJid = data?.key?.remoteJid
        const messageType = data?.messageType || 'text'

        // Ignorar reações (emojis de reação)
        if (messageType === 'reactionMessage') {
            return new Response(JSON.stringify({ status: 'ignored', reason: 'reaction_message' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        let content = data?.message?.conversation ||
            data?.message?.extendedTextMessage?.text ||
            data?.message?.imageMessage?.caption ||
            '[mídia]'
        const pushName = data?.pushName || ''
        const instanceName = body.instance || body.instanceName || 'avello'
        const messageId = data?.key?.id

        console.log('Instance name:', instanceName)
        console.log('Remote JID:', remoteJid)
        console.log('Content original:', content)
        console.log('Message Type:', messageType)
        console.log('Dados da mensagem (debug áudio):', JSON.stringify(data?.message))

        // Variáveis do Supabase
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // --- LÓGICA DE TRANSCRIÇÃO DE ÁUDIO ---
        // Se for áudio, tentamos transcrever antes de salvar e processar
        let isAudio = false
        if (messageType === 'audioMessage' || messageType === 'audio' || messageType === 'pttMessage') {
            isAudio = true
            const audioUrl = data?.message?.audioMessage?.url || 
                           data?.message?.pttMessage?.url || 
                           data?.message?.url

            if (audioUrl) {
                console.log('Mensagem de áudio detectada. Iniciando transcrição...')
                try {
                    // Chamar função de transcrição
                    const transcribeResponse = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${supabaseKey}`
                        },
                        body: JSON.stringify({
                            audioUrl,
                            message: data?.message,
                            fullData: data, // Passar objeto completo para Evolution API
                            instanceName,
                            messageId
                        })
                    })

                    const transcribeResult = await transcribeResponse.json()

                    if (transcribeResult.status === 'success' && transcribeResult.text) {
                        content = `[ÁUDIO TRANSCRITO]: ${transcribeResult.text}`
                        console.log('Áudio transcrito com sucesso:', content)
                    } else {
                        console.error('Falha na transcrição:', transcribeResult)
                        // DEBUG: Mostrar URL no erro para diagnóstico
                        content = `[ERRO TRANSCRIÇÃO] Não consegui baixar o áudio. URL: ${audioUrl} | Erro: ${JSON.stringify(transcribeResult)}`
                    }
                } catch (err) {
                    console.error('Erro ao chamar transcribe-audio:', err)
                    content = `[ERRO TÉCNICO] Falha ao processar áudio. URL: ${audioUrl} | Erro: ${err.message}`
                }
            } else {
                console.log('URL de áudio não encontrada no payload')
                content = '[Áudio sem URL]'
            }
        }
        // ---------------------------------------

        if (!remoteJid) {
            return new Response(JSON.stringify({ error: 'remoteJid não encontrado' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 1. Salvar mensagem recebida
        await supabase.from('whatsapp_messages').insert({
            remote_jid: remoteJid,
            message_id: messageId,
            from_me: false,
            message_type: messageType, // Mantém o tipo original (audioMessage, etc)
            content: content // Salva o conteúdo transcrito ou o texto original
        })

        // 2. Buscar/criar sessão do agente
        let { data: session } = await supabase
            .from('agent_sessions')
            .select('*')
            .eq('remote_jid', remoteJid)
            .single()

        if (!session) {
            const { data: newSession } = await supabase
                .from('agent_sessions')
                .insert({ remote_jid: remoteJid, status: 'active' })
                .select()
                .single()
            session = newSession
        }

        // 3. Verificar se IA está pausada
        const { data: cliente } = await supabase
            .from('dados_cliente')
            .select('atendimento_ia')
            .eq('telefone', remoteJid)
            .single()

        if (cliente?.atendimento_ia === 'pause') {
            console.log('IA pausada para este cliente')
            return new Response(JSON.stringify({ status: 'paused' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 4. Verificar horário de funcionamento
        const { data: config } = await supabase
            .from('agent_config')
            .select('*')
            .single()

        if (!config?.ativo) {
            console.log('Agente desativado')
            return new Response(JSON.stringify({ status: 'agent_disabled' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 5. Processar com o agente IA
        // Se for áudio, passamos o conteúdo transcrito. O agente deve saber lidar com isso.
        const aiResponse = await fetch(`${supabaseUrl}/functions/v1/ai-agent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({
                remoteJid,
                content, // Aqui vai o texto transcrito se for áudio
                pushName,
                instanceName,
                session
            })
        })

        const aiResult = await aiResponse.json()
        console.log('Resposta do AI Agent:', aiResult)

        // 6. Enviar resposta via Evolution API
        if (aiResult.response) {
            const evolutionUrl = Deno.env.get('EVOLUTION_API_URL')
            const evolutionKey = Deno.env.get('EVOLUTION_API_KEY')

            console.log('Enviando para Evolution:', `${evolutionUrl}/message/sendText/${instanceName}`)
            console.log('Número:', remoteJid)
            console.log('API Key presente:', !!evolutionKey)

            const sendResponse = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': evolutionKey!
                },
                body: JSON.stringify({
                    number: remoteJid,
                    text: aiResult.response
                })
            })

            const sendResult = await sendResponse.json()
            console.log('Resultado do envio:', JSON.stringify(sendResult))

            // 7. Salvar resposta no banco
            await supabase.from('whatsapp_messages').insert({
                remote_jid: remoteJid,
                from_me: true,
                message_type: 'text',
                content: aiResult.response
            })
        }

        return new Response(JSON.stringify({ status: 'ok', response: aiResult.response }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Erro no webhook:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
