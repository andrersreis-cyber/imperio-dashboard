// Supabase Edge Function: whatsapp-connect
// Gerencia conexão com Evolution API (criar instância, QR Code, status)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const INSTANCE_NAME = 'imperio-dashboard'

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { action } = await req.json()

        const evolutionUrl = Deno.env.get('EVOLUTION_API_URL')
        const evolutionKey = Deno.env.get('EVOLUTION_API_KEY')
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        if (!evolutionUrl || !evolutionKey) {
            throw new Error('Evolution API não configurada')
        }

        let result = {}

        switch (action) {
            case 'create':
                // Criar instância
                const createRes = await fetch(`${evolutionUrl}/instance/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': evolutionKey
                    },
                    body: JSON.stringify({
                        instanceName: INSTANCE_NAME,
                        integration: 'WHATSAPP-BAILEYS',
                        qrcode: true,
                        webhook: {
                            url: `${supabaseUrl}/functions/v1/whatsapp-webhook`,
                            events: ['messages.upsert', 'connection.update']
                        }
                    })
                })
                result = await createRes.json()

                // Salvar no banco
                await supabase.from('whatsapp_instances').upsert({
                    instance_name: INSTANCE_NAME,
                    instance_id: result.instance?.instanceId,
                    status: 'connecting',
                    api_key: evolutionKey
                }, { onConflict: 'instance_name' })
                break

            case 'connect':
                // Obter QR Code
                const connectRes = await fetch(`${evolutionUrl}/instance/connect/${INSTANCE_NAME}`, {
                    headers: { 'apikey': evolutionKey }
                })
                result = await connectRes.json()

                if (result.base64) {
                    await supabase.from('whatsapp_instances')
                        .update({ qr_code_base64: result.base64, status: 'qr_code' })
                        .eq('instance_name', INSTANCE_NAME)
                }
                break

            case 'status':
                // Verificar status
                const statusRes = await fetch(`${evolutionUrl}/instance/connectionState/${INSTANCE_NAME}`, {
                    headers: { 'apikey': evolutionKey }
                })
                result = await statusRes.json()

                const newStatus = result.state === 'open' ? 'connected' : 'disconnected'
                await supabase.from('whatsapp_instances')
                    .update({ status: newStatus, qr_code_base64: null })
                    .eq('instance_name', INSTANCE_NAME)
                break

            case 'logout':
                // Desconectar
                await fetch(`${evolutionUrl}/instance/logout/${INSTANCE_NAME}`, {
                    method: 'DELETE',
                    headers: { 'apikey': evolutionKey }
                })
                await supabase.from('whatsapp_instances')
                    .update({ status: 'disconnected', qr_code_base64: null })
                    .eq('instance_name', INSTANCE_NAME)
                result = { success: true }
                break

            default:
                throw new Error('Ação inválida')
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Erro:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
