// Supabase Edge Function: whatsapp-send
// Envia mensagens via Evolution API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { number, text, instanceName } = await req.json()

        const evolutionUrl = Deno.env.get('EVOLUTION_API_URL')
        const evolutionKey = Deno.env.get('EVOLUTION_API_KEY')

        if (!evolutionUrl || !evolutionKey) {
            throw new Error('Evolution API não configurada')
        }

        // Enviar mensagem
        const response = await fetch(`${evolutionUrl}/message/sendText/${instanceName || 'imperio-dashboard'}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionKey
            },
            body: JSON.stringify({
                number: number,
                text: text,
                delay: 1000
            })
        })

        const result = await response.json()

        // Salvar no banco
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        await supabase.from('whatsapp_messages').insert({
            remote_jid: number,
            from_me: true,
            message_type: 'text',
            content: text,
            message_id: result.key?.id
        })

        return new Response(JSON.stringify({ success: true, result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Erro ao enviar:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
