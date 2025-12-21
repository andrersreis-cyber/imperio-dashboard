// Supabase Edge Function: whatsapp-notify
// Envia notificações automáticas quando pedido muda de status

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
        const { pedidoId, novoStatus } = await req.json()

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const evolutionUrl = Deno.env.get('EVOLUTION_API_URL')
        const evolutionKey = Deno.env.get('EVOLUTION_API_KEY')
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Buscar pedido
        const { data: pedido } = await supabase
            .from('pedidos')
            .select('*')
            .eq('id', pedidoId)
            .single()

        if (!pedido) {
            throw new Error('Pedido não encontrado')
        }

        // Mapear status para tipo de template
        const statusToTemplate: Record<string, string> = {
            'confirmado': 'pedido_confirmado',
            'preparo': 'pedido_preparo',
            'saiu_entrega': 'pedido_saiu',
            'entregue': 'pedido_entregue'
        }

        const templateTipo = statusToTemplate[novoStatus]
        if (!templateTipo) {
            return new Response(JSON.stringify({
                success: false,
                reason: 'Status não requer notificação'
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Buscar template
        const { data: template } = await supabase
            .from('whatsapp_templates')
            .select('mensagem')
            .eq('tipo', templateTipo)
            .eq('ativo', true)
            .single()

        if (!template) {
            throw new Error('Template não encontrado')
        }

        // Substituir variáveis no template
        let mensagem = template.mensagem
            .replace('{pedido_id}', pedido.id)
            .replace('{valor_total}', `R$ ${pedido.valor_total?.toFixed(2)}`)

        // Buscar instância
        const { data: instance } = await supabase
            .from('whatsapp_instances')
            .select('instance_name, status')
            .eq('status', 'connected')
            .single()

        if (!instance) {
            throw new Error('WhatsApp não conectado')
        }

        // Formatar número
        let phone = pedido.phone
        if (!phone.includes('@')) {
            phone = phone.replace(/\D/g, '')
            if (!phone.startsWith('55')) phone = '55' + phone
            phone = phone + '@s.whatsapp.net'
        }

        // Enviar mensagem
        const response = await fetch(`${evolutionUrl}/message/sendText/${instance.instance_name}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionKey!
            },
            body: JSON.stringify({
                number: phone,
                text: mensagem
            })
        })

        const result = await response.json()

        // Salvar mensagem
        await supabase.from('whatsapp_messages').insert({
            remote_jid: phone,
            from_me: true,
            message_type: 'text',
            content: mensagem,
            pedido_id: pedido.id
        })

        return new Response(JSON.stringify({ success: true, result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Erro ao notificar:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
