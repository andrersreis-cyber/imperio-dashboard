// Supabase Edge Function: whatsapp-connect
// Gerencia conexão com Evolution API (criar instância, QR Code, status)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_INSTANCE_NAME = 'avello'

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { action, instanceName: instanceNameRaw, debug } = await req.json()
        const instanceName = (instanceNameRaw || DEFAULT_INSTANCE_NAME).toString()

        const evolutionUrl = Deno.env.get('EVOLUTION_API_URL')
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Buscar linha da instância (usamos também para manter/decidir status/QR)
        const { data: instanceRow } = await supabase
            .from('whatsapp_instances')
            .select('api_key, qr_code_base64, status')
            .eq('instance_name', instanceName)
            .single()

        // Preferir key armazenada no banco (não expõe no frontend) e usar env como fallback
        const evolutionKey = instanceRow?.api_key || Deno.env.get('EVOLUTION_API_KEY')

        if (!evolutionUrl || !evolutionKey) {
            throw new Error('Evolution API não configurada')
        }

        let result: any = {}

        const extractQr = (payload: any): { qr: string | null, source?: string } => {
            if (!payload) return { qr: null }

            // Alguns builds retornam dentro de "data"
            const p = payload?.data ? [payload, payload.data] : [payload]

            for (const obj of p) {
                const candidates: Array<[any, string]> = [
                    [obj?.qr_code_base64, 'qr_code_base64'],
                    [obj?.qrcode_base64, 'qrcode_base64'],
                    [obj?.base64, 'base64'],
                    [obj?.qrcode, 'qrcode'],
                    [obj?.qr, 'qr'],
                    [obj?.qrCode, 'qrCode'],
                    [obj?.qrcode?.base64, 'qrcode.base64'],
                    [obj?.qrcode?.code, 'qrcode.code'],
                    [obj?.qr?.base64, 'qr.base64'],
                    [obj?.qr?.code, 'qr.code'],
                    [obj?.qrCode?.base64, 'qrCode.base64'],
                    [obj?.qrCode?.code, 'qrCode.code'],
                    [obj?.code, 'code'],
                ]

                for (const [val, source] of candidates) {
                    if (typeof val !== 'string' || !val.trim()) continue
                    const s = val.trim()
                    if (s.startsWith('data:image')) return { qr: s, source }
                    // Se vier base64 puro (sem prefix)
                    if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length > 100) {
                        return { qr: `data:image/png;base64,${s}`, source }
                    }
                }
            }
            return { qr: null }
        }

        const safeKeys = (obj: any) => {
            if (!obj || typeof obj !== 'object') return []
            try {
                return Object.keys(obj).slice(0, 50)
            } catch {
                return []
            }
        }

        const fetchJsonSafe = async (url: string) => {
            const res = await fetch(url, { headers: { 'apikey': evolutionKey } })
            const text = await res.text()
            let json: any = null
            try {
                json = text ? JSON.parse(text) : null
            } catch {
                json = { _rawText: text }
            }
            return { ok: res.ok, status: res.status, json }
        }

        const extractState = (payload: any): string | null => {
            if (!payload) return null
            const candidates = [
                payload?.state,
                payload?.instance?.state,
                payload?.instance?.connectionState,
                payload?.connectionState,
                payload?.data?.state,
                payload?.data?.instance?.state,
                payload?.status,
            ]
            for (const c of candidates) {
                if (typeof c === 'string' && c.trim()) return c.trim()
            }
            return null
        }

        const isConnectedState = (state: string | null): boolean => {
            const s = String(state ?? '').toLowerCase()
            // Evolution geralmente usa "open", mas já vi variações em forks.
            return s === 'open' || s === 'connected' || s === 'online'
        }

        switch (action) {
            case 'get': {
                // Retorna status/QR pelo servidor (evita depender de SELECT no frontend)
                const { data: row, error } = await supabase
                    .from('whatsapp_instances')
                    .select('instance_name, instance_id, status, qr_code_base64, phone_number, profile_name, webhook_url, created_at, updated_at')
                    .eq('instance_name', instanceName)
                    .single()

                if (error) {
                    result = { ok: false, error: error.message }
                    break
                }
                result = { ok: true, instance: row }
                break
            }

            case 'create':
                // Criar instância
                const createRes = await fetch(`${evolutionUrl}/instance/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': evolutionKey
                    },
                    body: JSON.stringify({
                        instanceName,
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
                    instance_name: instanceName,
                    instance_id: result.instance?.instanceId,
                    status: 'connecting',
                    api_key: evolutionKey,
                    webhook_url: `${supabaseUrl}/functions/v1/whatsapp-webhook`,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'instance_name' })
                break

            case 'connect':
                // Obter QR Code (diferentes builds da Evolution expõem rotas/formatos diferentes)
                {
                    const candidates = [
                        `${evolutionUrl}/instance/connect/${instanceName}`,
                        `${evolutionUrl}/instance/qrcode/${instanceName}`,
                        `${evolutionUrl}/instance/qr/${instanceName}`,
                        `${evolutionUrl}/instance/getQrCode/${instanceName}`,
                    ]

                    let found: { qr: string | null, source?: string } = { qr: null }
                    let tried: any[] = []
                    let lastJson: any = null
                    let authError: { status: number, url: string } | null = null

                    for (const url of candidates) {
                        const r = await fetchJsonSafe(url)
                        lastJson = r.json
                        const ex = extractQr(r.json)
                        tried.push({
                            url: url.replace(evolutionUrl || '', ''),
                            status: r.status,
                            keys: safeKeys(r.json),
                            dataKeys: safeKeys(r.json?.data),
                            qrFound: !!ex.qr,
                            qrSource: ex.source || null
                        })
                        if (r.status === 401 || r.status === 403) {
                            authError = { status: r.status, url: url.replace(evolutionUrl || '', '') }
                            break
                        }
                        if (ex.qr) {
                            found = ex
                            break
                        }
                    }

                    if (found.qr) {
                        await supabase.from('whatsapp_instances')
                            .update({ qr_code_base64: found.qr, status: 'qr_code', updated_at: new Date().toISOString() })
                            .eq('instance_name', instanceName)

                        // também devolve para o frontend
                        result = { ok: true, qr_code_base64: found.qr }
                    } else if (authError) {
                        // Auth inválida na Evolution (ex.: api key errada para esta instância)
                        result = {
                            ok: false,
                            error: `Evolution rejeitou a autenticação (${authError.status}). Verifique a API KEY/token usado na instância.`,
                            tried
                        }
                    } else {
                        // Não vazar QR no log, só shape
                        console.log('QR não encontrado no payload da Evolution', {
                            instanceName,
                            tried,
                            lastKeys: safeKeys(lastJson),
                            lastDataKeys: safeKeys(lastJson?.data)
                        })
                        result = { ok: false, error: 'QR não retornou pela Evolution (formato/rota diferente)', tried }
                    }
                }
                break

            case 'status':
                // Verificar status
                const statusRes = await fetch(`${evolutionUrl}/instance/connectionState/${instanceName}`, {
                    headers: { 'apikey': evolutionKey }
                })
                result = await statusRes.json()

                const state = extractState(result)
                const connected = isConnectedState(state)

                // Se não está conectado, mas há QR salvo, manter status "qr_code" (evita UI ficar "desconectado" com QR)
                const hasQr = !!instanceRow?.qr_code_base64
                const newStatus = connected ? 'connected' : (hasQr ? 'qr_code' : 'disconnected')
                await supabase.from('whatsapp_instances')
                    // Importante: não limpar o QR ao checar status se ainda não conectou.
                    // Se limpar cedo demais, a UI perde o QR e o usuário não consegue escanear.
                    .update({
                        status: newStatus,
                        ...(connected ? { qr_code_base64: null } : {}),
                        updated_at: new Date().toISOString()
                    })
                    .eq('instance_name', instanceName)

                // Normalizar resposta para o frontend (sem vazar dados sensíveis)
                result = {
                    ok: true,
                    instanceName,
                    state,
                    connected,
                    status: newStatus,
                    ...(debug ? { raw: result } : {})
                }
                break

            case 'logout':
                // Desconectar
                await fetch(`${evolutionUrl}/instance/logout/${instanceName}`, {
                    method: 'DELETE',
                    headers: { 'apikey': evolutionKey }
                })
                await supabase.from('whatsapp_instances')
                    .update({ status: 'disconnected', qr_code_base64: null, updated_at: new Date().toISOString() })
                    .eq('instance_name', instanceName)
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
