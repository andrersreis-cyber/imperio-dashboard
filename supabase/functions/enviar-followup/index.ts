// Supabase Edge Function: enviar-followup
// Envia quiz de satisfação para clientes após 30 minutos da entrega
// Deve ser chamada periodicamente (cron job ou webhook externo)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mensagens do Quiz
const MENSAGENS = {
    pergunta1: `🌟 *Pesquisa rápida do Império das Porções!*

Seu pedido foi entregue e gostaríamos muito de saber sua opinião!

*Como estava a COMIDA?*

Responda com o número:
1️⃣ - 😞 Ruim
2️⃣ - 😐 Regular  
3️⃣ - 😊 Bom
4️⃣ - 😋 Excelente!

(São só 3 perguntinhas rápidas!)`,

    pergunta2: `*E como foi a ENTREGA?*

1️⃣ - 😞 Ruim
2️⃣ - 😐 Regular
3️⃣ - 😊 Bom
4️⃣ - 😋 Excelente!`,

    pergunta3: `*Última pergunta!*

*Você RECOMENDARIA o Império para um amigo?*

1️⃣ - 😞 Não recomendaria
2️⃣ - 😐 Talvez
3️⃣ - 😊 Provavelmente sim
4️⃣ - 😋 Com certeza!`,

    agradecimento: `✨ *Muito obrigado pelo feedback!*

Sua opinião é super importante pra gente melhorar sempre! 

Obrigado por fazer parte da família Império! 👑

Até a próxima! 🍽️`
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const evolutionUrl = Deno.env.get('EVOLUTION_API_URL')!
        const evolutionKey = Deno.env.get('EVOLUTION_API_KEY')!
        
        const supabase = createClient(supabaseUrl, supabaseKey)
        
        // Buscar follow-ups pendentes prontos para envio
        const { data: followups, error: fetchError } = await supabase
            .rpc('buscar_followups_pendentes', { p_limite: 10 })
        
        if (fetchError) {
            console.error('Erro ao buscar followups:', fetchError)
            throw fetchError
        }
        
        if (!followups || followups.length === 0) {
            return new Response(JSON.stringify({
                sucesso: true,
                processados: 0,
                mensagem: 'Nenhum follow-up pendente no momento'
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }
        
        console.log(`Processando ${followups.length} follow-ups`)
        
        const resultados = []
        
        for (const followup of followups) {
            try {
                // Formatar telefone para WhatsApp
                const telefoneWpp = followup.telefone.includes('@') 
                    ? followup.telefone 
                    : `${followup.telefone}@s.whatsapp.net`
                
                // Enviar primeira pergunta
                const sendResponse = await fetch(`${evolutionUrl}/message/sendText/avello`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': evolutionKey
                    },
                    body: JSON.stringify({
                        number: telefoneWpp,
                        text: MENSAGENS.pergunta1
                    })
                })
                
                if (!sendResponse.ok) {
                    const errorText = await sendResponse.text()
                    throw new Error(`Evolution API error: ${errorText}`)
                }
                
                // Marcar como enviado e criar registro de avaliação
                await supabase.rpc('iniciar_avaliacao', {
                    p_followup_id: followup.id,
                    p_pedido_id: followup.pedido_id,
                    p_telefone: followup.telefone
                })
                
                console.log(`Follow-up enviado para ${followup.telefone} (pedido #${followup.pedido_id})`)
                
                resultados.push({
                    pedido_id: followup.pedido_id,
                    telefone: followup.telefone,
                    sucesso: true
                })
                
                // Aguardar 1 segundo entre envios para não sobrecarregar
                await new Promise(resolve => setTimeout(resolve, 1000))
                
            } catch (e) {
                console.error(`Erro ao enviar follow-up ${followup.id}:`, e)
                
                // Atualizar follow-up com erro
                await supabase
                    .from('followups_agendados')
                    .update({
                        tentativas: (followup.tentativas || 0) + 1,
                        erro_mensagem: e.message,
                        status: (followup.tentativas || 0) >= 2 ? 'erro' : 'pendente',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', followup.id)
                
                resultados.push({
                    pedido_id: followup.pedido_id,
                    telefone: followup.telefone,
                    sucesso: false,
                    erro: e.message
                })
            }
        }
        
        return new Response(JSON.stringify({
            sucesso: true,
            processados: followups.length,
            resultados
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
        
    } catch (error) {
        console.error('Erro no enviar-followup:', error)
        return new Response(JSON.stringify({
            sucesso: false,
            erro: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})

// Exportar mensagens para uso no ai-agent
export { MENSAGENS }

