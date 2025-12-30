// Supabase Edge Function: transcribe-audio
// Recebe URL ou Objeto de Mensagem, obtém áudio descritografado e transcreve com OpenAI Whisper

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
        const { audioUrl, messageId, message, fullData, instanceName } = await req.json()

        console.log(`[transcribe-audio] Iniciando processamento para mensagem ${messageId}`)
        
        const evolutionKey = Deno.env.get('EVOLUTION_API_KEY')
        const evolutionUrl = Deno.env.get('EVOLUTION_API_URL')
        const openaiKey = Deno.env.get('OPENAI_API_KEY')
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        if (!openaiKey) {
            throw new Error('OPENAI_API_KEY não configurada')
        }

        if (!evolutionUrl || !evolutionKey) {
            throw new Error('EVOLUTION_API_URL ou EVOLUTION_API_KEY não configuradas')
        }

        // Salvar log inicial no banco
        const { error: logError } = await supabase.from('error_logs').insert({
            error_type: 'audio_transcription_debug',
            error_message: `Iniciando transcrição. Tem message: ${!!message}, Tem fullData: ${!!fullData}, instanceName: ${instanceName}`,
            context: JSON.stringify({ messageId, audioUrl: audioUrl?.substring(0, 100) })
        })
        if (logError) console.error('[transcribe-audio] Erro ao salvar log inicial:', logError)

        let audioBlob: Blob | null = null;
        let lastError = '';

        // ESTRATÉGIA 1: Tentar TODOS os endpoints possíveis da Evolution API
        if ((message || fullData) && instanceName) {
            const messagePayload = fullData || message // Preferir fullData se disponível
            
            // Lista de endpoints para tentar - OTIMIZADA PARA EVITAR TIMEOUT
            // Prioriza getBase64FromMediaMessage que já retorna o binário pronto
            const endpoints = [
                { path: `/chat/getBase64FromMediaMessage/${instanceName}`, name: 'getBase64FromMediaMessage' },
                // { path: `/message/downloadMedia/${instanceName}`, name: 'downloadMedia' }, // Redundante e as vezes lento
            ]

            for (const endpoint of endpoints) {
                if (audioBlob) break // Se já conseguiu, para

                try {
                    console.log(`[transcribe-audio] Tentando endpoint: ${endpoint.name}`)
                    
                    const body = endpoint.name === 'getBase64FromMediaMessage' 
                        ? JSON.stringify({ message: messagePayload, convertToMp4: false })
                        : JSON.stringify({ message: messagePayload })

                    // REDUZIDO TIMEOUT PARA 7 SEGUNDOS para não estourar tempo da Edge Function
                    const controller = new AbortController()
                    const timeoutId = setTimeout(() => controller.abort(), 7000)

                    try {
                        const start = Date.now()
                        const response = await fetch(`${evolutionUrl}${endpoint.path}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'apikey': evolutionKey
                            },
                            body,
                            signal: controller.signal
                        })
                        clearTimeout(timeoutId)
                        const duration = Date.now() - start
                        console.log(`[transcribe-audio] ${endpoint.name} levou ${duration}ms. Status: ${response.status}`)

                        if (response.ok) {
                            const contentType = response.headers.get('content-type') || ''
                            
                            if (contentType.startsWith('audio/') || contentType.startsWith('application/octet-stream')) {
                                audioBlob = await response.blob()
                                console.log(`[transcribe-audio] ✅ SUCESSO via ${endpoint.name}! Tamanho: ${audioBlob.size}`)
                                
                                // Logar sucesso
                                await supabase.from('error_logs').insert({
                                    error_type: 'audio_debug',
                                    error_message: `Sucesso via ${endpoint.name}`,
                                    context: JSON.stringify({ size: audioBlob.size, type: audioBlob.type })
                                })
                                break
                            } else {
                                // Tentar como JSON
                                const jsonData = await response.json()
                                if (jsonData.base64) {
                                    const binaryString = atob(jsonData.base64)
                                    const bytes = new Uint8Array(binaryString.length)
                                    for (let i = 0; i < binaryString.length; i++) {
                                        bytes[i] = binaryString.charCodeAt(i)
                                    }
                                    const mimeType = audioUrl?.includes('.mp4') ? 'audio/mp4' : 'audio/ogg'
                                    // Converter Uint8Array para Blob
                                    audioBlob = new Blob([bytes.buffer], { type: mimeType })
                                    console.log(`[transcribe-audio] ✅ SUCESSO via ${endpoint.name} (Base64)! Tamanho: ${audioBlob.size}`)
                                    
                                    // Logar sucesso
                                    await supabase.from('error_logs').insert({
                                        error_type: 'audio_debug',
                                        error_message: `Sucesso via ${endpoint.name} (Base64)`,
                                        context: JSON.stringify({ size: audioBlob.size, type: audioBlob.type })
                                    })
                                    break
                                } else {
                                    lastError = `${endpoint.name} retornou JSON sem base64: ${JSON.stringify(jsonData).substring(0, 200)}`
                                    console.warn(`[transcribe-audio] ${lastError}`)
                                }
                            }
                        } else {
                            const errorText = await response.text()
                            lastError = `${endpoint.name} falhou (${response.status}): ${errorText.substring(0, 300)}`
                            console.error(`[transcribe-audio] ${lastError}`)
                            
                            // Logar erro específico deste endpoint
                            await supabase.from('error_logs').insert({
                                error_type: 'audio_endpoint_failed',
                                error_message: lastError,
                                context: JSON.stringify({ endpoint: endpoint.name, status: response.status })
                            })
                        }
                    } catch (fetchError) {
                        clearTimeout(timeoutId)
                        throw fetchError
                    }
                } catch (err) {
                    lastError = `${endpoint.name} exception: ${err.message}`
                    console.error(`[transcribe-audio] ${lastError}`)
                    
                    // Logar exception deste endpoint
                    await supabase.from('error_logs').insert({
                        error_type: 'audio_endpoint_exception',
                        error_message: lastError,
                        context: JSON.stringify({ endpoint: endpoint.name })
                    })
                }
            }
        }

        // ESTRATÉGIA 2: Download direto (só se TODOS os endpoints falharam)
        if (!audioBlob && audioUrl) {
            console.log(`[transcribe-audio] ⚠️ Todos endpoints falharam. Tentando download direto...`)
            
            try {
                const downloadHeaders = evolutionKey ? { 'apikey': evolutionKey } : {}
                const audioResponse = await fetch(audioUrl, { headers: downloadHeaders })

                if (audioResponse.ok) {
                    audioBlob = await audioResponse.blob()
                    console.log(`[transcribe-audio] ⚠️ Download direto OK, mas arquivo pode estar criptografado. Tamanho: ${audioBlob.size}`)
                    
                    // Verificar se o arquivo parece criptografado (tamanho muito pequeno ou tipo estranho)
                    if (audioBlob.size < 1000 || !audioBlob.type.includes('audio')) {
                        console.warn(`[transcribe-audio] Arquivo suspeito - pode estar criptografado`)
                    }
                } else {
                    lastError = `Download direto falhou: ${audioResponse.status}`
                }
            } catch (err) {
                lastError = `Download direto exception: ${err.message}`
            }
        }

        if (!audioBlob) {
            const finalError = `Não foi possível obter áudio. Último erro: ${lastError}`
            console.error(`[transcribe-audio] ❌ ${finalError}`)
            
            // Salvar erro no banco
            const { error: dbError } = await supabase.from('error_logs').insert({
                error_type: 'audio_transcription_failed',
                error_message: finalError,
                context: JSON.stringify({ messageId, audioUrl, lastError })
            })
            if (dbError) console.error('[transcribe-audio] Erro ao salvar log de erro:', dbError)
            
            throw new Error(finalError)
        }

        // 3. Enviar para OpenAI Whisper
        const formData = new FormData()
        const filename = (audioBlob.type.includes('mp4') || audioBlob.type.includes('m4a')) ? 'audio.m4a' : 'audio.ogg'
        const file = new File([audioBlob], filename, { type: audioBlob.type || 'audio/ogg' })
        
        formData.append('file', file)
        formData.append('model', 'whisper-1')
        formData.append('language', 'pt')
        formData.append('response_format', 'text')

        console.log(`[transcribe-audio] Enviando para Whisper (${audioBlob.size} bytes)...`)
        const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`
            },
            body: formData
        })

        if (!transcriptionResponse.ok) {
            const errorText = await transcriptionResponse.text()
            console.error(`[transcribe-audio] Whisper erro:`, errorText)
            
            // Salvar erro do Whisper
            const { error: whisperLogError } = await supabase.from('error_logs').insert({
                error_type: 'whisper_api_error',
                error_message: errorText,
                context: JSON.stringify({ messageId, audioBlobSize: audioBlob.size, audioBlobType: audioBlob.type })
            })
            if (whisperLogError) console.error('[transcribe-audio] Erro ao salvar log Whisper:', whisperLogError)
            
            throw new Error(`Erro na transcrição: ${transcriptionResponse.status} ${errorText}`)
        }

        const transcriptionText = await transcriptionResponse.text()
        console.log(`[transcribe-audio] ✅ Transcrição concluída:`, transcriptionText.substring(0, 100))

        return new Response(JSON.stringify({ 
            text: transcriptionText.trim(),
            status: 'success'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error(`[transcribe-audio] ❌ ERRO GERAL:`, error)
        return new Response(JSON.stringify({ 
            error: error.message,
            status: 'error'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
