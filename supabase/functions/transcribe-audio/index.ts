// Supabase Edge Function: transcribe-audio
// Recebe URL de áudio, baixa e transcreve usando OpenAI Whisper

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
        const { audioUrl, messageId } = await req.json()

        if (!audioUrl) {
            throw new Error('URL do áudio não fornecida')
        }

        console.log(`Iniciando transcrição para mensagem ${messageId}`)
        console.log(`URL do áudio: ${audioUrl}`)

        // 1. Baixar o arquivo de áudio da Evolution API
        // Nota: A Evolution API pode exigir autenticação para baixar o arquivo dependendo da configuração
        // Vamos tentar baixar diretamente, mas se falhar, precisaremos adicionar headers
        const evolutionKey = Deno.env.get('EVOLUTION_API_KEY')
        const audioResponse = await fetch(audioUrl, {
            headers: evolutionKey ? { 'apikey': evolutionKey } : {}
        })

        if (!audioResponse.ok) {
            throw new Error(`Erro ao baixar áudio: ${audioResponse.status} ${audioResponse.statusText}`)
        }

        const audioBlob = await audioResponse.blob()
        console.log(`Áudio baixado. Tamanho: ${audioBlob.size} bytes. Tipo: ${audioBlob.type}`)

        // 2. Preparar FormData para OpenAI Whisper
        const formData = new FormData()
        // O Whisper requer um nome de arquivo com extensão válida.
        // Vamos usar 'audio.ogg' ou 'audio.mp3' dependendo do tipo, ou padrão 'audio.ogg' (comum no WhatsApp)
        const filename = audioBlob.type.includes('mp4') ? 'audio.m4a' : 'audio.ogg'
        
        // Criar um arquivo a partir do blob para enviar no FormData
        const file = new File([audioBlob], filename, { type: audioBlob.type || 'audio/ogg' })
        
        formData.append('file', file)
        formData.append('model', 'whisper-1')
        formData.append('language', 'pt') // Forçar português para melhor precisão
        formData.append('response_format', 'text') // Retornar apenas o texto puro

        // 3. Chamar OpenAI Whisper API
        const openaiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openaiKey) {
            throw new Error('OPENAI_API_KEY não configurada')
        }

        console.log('Enviando para OpenAI Whisper...')
        const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`
                // Não definir Content-Type aqui, o FormData define automaticamente com boundary
            },
            body: formData
        })

        if (!transcriptionResponse.ok) {
            const errorText = await transcriptionResponse.text()
            console.error('Erro OpenAI Whisper:', errorText)
            throw new Error(`Erro na transcrição: ${transcriptionResponse.status} ${errorText}`)
        }

        const transcriptionText = await transcriptionResponse.text()
        console.log('Transcrição concluída:', transcriptionText)

        return new Response(JSON.stringify({ 
            text: transcriptionText.trim(),
            status: 'success'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Erro na função transcribe-audio:', error)
        return new Response(JSON.stringify({ 
            error: error.message,
            status: 'error'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
