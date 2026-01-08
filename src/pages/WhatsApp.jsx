import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { supabase } from '../lib/supabase'
import {
    MessageCircle,
    Wifi,
    WifiOff,
    QrCode,
    Send,
    Bot,
    FileText,
    Loader2,
    RefreshCw,
    Power,
    PowerOff,
    User,
    Clock
} from 'lucide-react'

// Tabs
const TABS = {
    CONEXAO: 'conexao',
    CONVERSAS: 'conversas',
    AGENTE: 'agente',
    TEMPLATES: 'templates'
}

import { InstanceSelector } from '../components/whatsapp/InstanceSelector'

export function WhatsApp() {
    const [searchParams, setSearchParams] = useSearchParams()
    const [activeTab, setActiveTab] = useState(TABS.CONEXAO)
    const [loading, setLoading] = useState(true)
    const [conversationsError, setConversationsError] = useState(null)
    const [messagesError, setMessagesError] = useState(null)
    
    // Estado da instância selecionada
    const [instanceName, setInstanceName] = useState(() => localStorage.getItem('selected_instance') || 'avello')
    
    const [instance, setInstance] = useState(null)
    const [conversations, setConversations] = useState([])
    const [selectedConversation, setSelectedConversation] = useState(null)
    const [messages, setMessages] = useState([])
    const [newMessage, setNewMessage] = useState('')
    const [agentConfig, setAgentConfig] = useState(null)
    const [templates, setTemplates] = useState([])

    const statusPollRef = useRef(null)

    // Carregar dados iniciais quando instanceName mudar
    useEffect(() => {
        if (instanceName) {
            loadData()
        }
    }, [instanceName])

    // Realtime subscription para mensagens
    useEffect(() => {
        if (!instanceName) return

        const messagesChannel = supabase
            .channel(`whatsapp_messages_realtime_${instanceName}`)
            .on('postgres_changes',
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'whatsapp_messages',
                    filter: `instance_name=eq.${instanceName}`
                },
                (payload) => {
                    console.log('Nova mensagem recebida:', payload)
                    // Adicionar mensagem se for da conversa selecionada
                    if (selectedConversation && payload.new.remote_jid === selectedConversation) {
                        setMessages(prev => [...prev, payload.new])
                    }
                    // Recarregar lista de conversas
                    loadConversations()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(messagesChannel)
        }
    }, [instanceName, selectedConversation])

    // Poll de status (para refletir conexão mesmo sem webhook connection.update)
    useEffect(() => {
        const shouldPoll =
            activeTab === TABS.CONEXAO &&
            !!instance &&
            instance?.status !== 'connected' &&
            (instance?.status === 'qr_code' || !!instance?.qr_code_base64)

        const clearPoll = () => {
            if (statusPollRef.current) {
                clearInterval(statusPollRef.current)
                statusPollRef.current = null
            }
        }

        if (!shouldPoll) {
            clearPoll()
            return () => clearPoll()
        }

        // Evitar duplicar intervalos
        if (statusPollRef.current) return () => clearPoll()

        // Checar rápido ao entrar no estado "aguardando QR"
        checkStatus()

        statusPollRef.current = setInterval(() => {
            checkStatus()
        }, 3500)

        return () => clearPoll()
    }, [activeTab, instance?.status, instance?.qr_code_base64])

    // Verificar parâmetro de URL para abrir conversa específica
    useEffect(() => {
        const conversationParam = searchParams.get('conversation')
        if (conversationParam && conversations.length > 0) {
            // Verificar se a conversa existe
            const conversationExists = conversations.some(c => c.remote_jid === conversationParam)
            if (conversationExists) {
                setActiveTab(TABS.CONVERSAS)
                loadMessages(conversationParam)
                // Limpar parâmetro da URL após abrir
                setSearchParams({})
            }
        }
    }, [conversations, searchParams])

    const loadData = async () => {
        setLoading(true)
        await Promise.all([
            loadInstance(),
            loadConversations(),
            loadAgentConfig(),
            loadTemplates()
        ])
        setLoading(false)
    }

    // Carregar instância
    const loadInstance = async () => {
        const res = await supabase.functions.invoke('whatsapp-connect', {
            body: { action: 'get', instanceName }
        })
        if (res.error) {
            console.log('Erro ao carregar instância (Edge):', res.error)
            setInstance(null)
            return
        }

        const row = res.data?.instance || null
        setInstance(row)
    }

    // Carregar conversas
    const loadConversations = async () => {
        const { data, error } = await supabase
            .from('whatsapp_messages')
            .select('remote_jid, content, from_me, created_at')
            .eq('instance_name', instanceName)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Erro ao carregar conversas:', error)
            setConversationsError(error.message || 'Erro ao carregar conversas')
            setConversations([])
            return
        }

        setConversationsError(null)
        // Agrupar por remote_jid

        const grouped = {}
        data?.forEach(msg => {
            if (!grouped[msg.remote_jid]) {
                grouped[msg.remote_jid] = {
                    remote_jid: msg.remote_jid,
                    last_message: msg.content,
                    last_time: msg.created_at,
                    from_me: msg.from_me
                }
            }
        })
        setConversations(Object.values(grouped))
    }

    // Carregar config do agente
    const loadAgentConfig = async () => {
        const { data } = await supabase
            .from('agent_config')
            .select('*')
            .limit(1)
            .single()
        setAgentConfig(data)
    }

    // Carregar templates
    const loadTemplates = async () => {
        const { data } = await supabase
            .from('whatsapp_templates')
            .select('*')
            .order('tipo')
        setTemplates(data || [])
    }

    // Carregar mensagens de uma conversa
    const loadMessages = async (remoteJid) => {
        setSelectedConversation(remoteJid)
        const { data, error } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('instance_name', instanceName)
            .eq('remote_jid', remoteJid)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Erro ao carregar mensagens:', error)
            setMessagesError(error.message || 'Erro ao carregar mensagens')
            setMessages([])
            return
        }

        setMessagesError(null)
        setMessages(data || [])
    }

    // Conectar WhatsApp
    const conectar = async () => {
        setLoading(true)
        try {
            // 0) Garantir webhook/instância (best-effort). Em alguns setups, "create" é idempotente e reconfigura webhook.
            const createRes = await supabase.functions.invoke('whatsapp-connect', {
                body: { action: 'create', instanceName }
            })
            if (createRes.error) {
                console.warn('Create (Edge) falhou (pode ser normal se já existir):', createRes.error)
            }

            // 1) Verificar status via Edge Function (server-side)
            const statusRes = await supabase.functions.invoke('whatsapp-connect', {
                body: { action: 'status', instanceName }
            })

            if (statusRes.error) {
                console.error('Erro status (Edge):', statusRes.error)
            } else if (statusRes.data?.connected) {
                await loadInstance()
                alert('WhatsApp já está conectado!')
                setLoading(false)
                return
            }

            // 2) Tentar obter QR Code via Edge Function
            let connectRes = await supabase.functions.invoke('whatsapp-connect', {
                body: { action: 'connect', instanceName }
            })

            if (connectRes.error) {
                console.error('Erro connect (Edge):', connectRes.error)
                // Tentar criar a instância (para garantir webhook) e tentar novamente
                const createRes = await supabase.functions.invoke('whatsapp-connect', {
                    body: { action: 'create', instanceName }
                })
                if (createRes.error) {
                    console.error('Erro create (Edge):', createRes.error)
                    alert('Erro ao conectar. Verifique a Evolution API (URL/API KEY) no servidor.')
                    setLoading(false)
                    return
                }
                connectRes = await supabase.functions.invoke('whatsapp-connect', {
                    body: { action: 'connect', instanceName }
                })
                if (connectRes.error) {
                    console.error('Erro connect após create (Edge):', connectRes.error)
                    alert('Não consegui gerar o QR. Verifique se a instância existe na Evolution e se a API Key está correta.')
                }
            }

            // Se a função devolveu o QR, refletir imediatamente na UI
            const qr = connectRes?.data?.qr_code_base64
            if (qr) {
                setInstance(prev => ({ ...(prev || {}), instance_name: instanceName, status: 'qr_code', qr_code_base64: qr }))
            } else {
                // Caso não devolva, mostrar erro com debug básico (sem expor chaves)
                if (connectRes?.data?.error) {
                    console.warn('Falha ao obter QR (Edge):', connectRes.data)
                    alert(connectRes.data.error)
                } else {
                    console.log('QR não retornou no payload; tentando recarregar do banco...')
                }
            }

            await loadInstance()
        } catch (error) {
            console.error('Erro ao conectar:', error)
            alert('Erro ao conectar: ' + error.message)
        }
        setLoading(false)
    }

    // Verificar status
    const checkStatus = async () => {
        try {
            const res = await supabase.functions.invoke('whatsapp-connect', {
                body: { action: 'status', instanceName }
            })
            if (res.error) {
                console.error('Erro ao verificar status (Edge):', res.error)
                return
            }

            // Debug útil no console (sem PII)
            console.log('Status Evolution (Edge):', res.data)

            // Aplicar status na UI imediatamente (evita piscar / depender do banco)
            if (res.data?.status) {
                setInstance(prev => ({ ...(prev || {}), instance_name: instanceName, status: res.data.status }))
            }

            await loadInstance()
        } catch (error) {
            console.error('Erro ao verificar status:', error)
        }
    }

    // Desconectar
    const desconectar = async () => {
        try {
            const { error } = await supabase.functions.invoke('whatsapp-connect', {
                body: { action: 'logout', instanceName }
            })
            if (error) console.error('Erro ao desconectar (Edge):', error)
            await loadInstance()
        } catch (error) {
            console.error('Erro ao desconectar:', error)
        }
    }

    // Enviar mensagem
    const enviarMensagem = async () => {
        if (!newMessage.trim() || !selectedConversation) return

        try {
            const { error } = await supabase.functions.invoke('whatsapp-send', {
                body: {
                    number: selectedConversation,
                    text: newMessage,
                    instanceName
                }
            })
            if (error) throw error

            setNewMessage('')
            await loadMessages(selectedConversation)
        } catch (error) {
            console.error('Erro ao enviar:', error)
        }
    }

    // Toggle Agente
    const toggleAgente = async () => {
        await supabase
            .from('agent_config')
            .update({ ativo: !agentConfig?.ativo })
            .eq('id', agentConfig?.id)
        await loadAgentConfig()
    }

    // Formatar telefone
    const formatPhone = (jid) => {
        if (!jid) return ''
        return jid.replace('@s.whatsapp.net', '').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    }

    // Formatar hora
    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo'
        })
    }

    // ==================== RENDER ====================

    const renderTab = (id, icon, label) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-colors ${activeTab === id
                ? 'bg-gold/20 text-gold'
                : 'text-gray-400 hover:bg-gray-800'
                }`}
        >
            {icon}
            <span>{label}</span>
        </button>
    )

    // Tab Conexão
    const renderConexao = () => (
        <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-card rounded-xl p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Status da Conexão</h3>
                    <button onClick={checkStatus} className="p-2 hover:bg-gray-800 rounded-lg">
                        <RefreshCw size={18} className="text-gray-400" />
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    {instance?.status === 'connected' ? (
                        <>
                            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                                <Wifi className="text-green-500" size={24} />
                            </div>
                            <div>
                                <p className="font-medium text-green-500">Conectado</p>
                                <p className="text-sm text-gray-400">{instance?.phone_number || 'WhatsApp ativo'}</p>
                            </div>
                        </>
                    ) : (instance?.status === 'qr_code' || instance?.qr_code_base64) ? (
                        <>
                            <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                <QrCode className="text-yellow-400" size={24} />
                            </div>
                            <div>
                                <p className="font-medium text-yellow-400">Aguardando leitura do QR</p>
                                <p className="text-sm text-gray-400">Depois de escanear, o painel atualiza automaticamente.</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                                <WifiOff className="text-red-500" size={24} />
                            </div>
                            <div>
                                <p className="font-medium text-red-500">Desconectado</p>
                                <p className="text-sm text-gray-400">Escaneie o QR Code para conectar</p>
                            </div>
                        </>
                    )}
                </div>

                <div className="mt-6 flex gap-3">
                    {instance?.status === 'connected' ? (
                        <button
                            onClick={desconectar}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                        >
                            <PowerOff size={18} />
                            Desconectar
                        </button>
                    ) : (
                        <button
                            onClick={conectar}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-gold text-black rounded-lg hover:opacity-90 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <Power size={18} />}
                            Conectar WhatsApp
                        </button>
                    )}
                </div>
            </div>

            {/* QR Code */}
            {instance?.qr_code_base64 && instance?.status !== 'connected' && (
                <div className="bg-card rounded-xl p-6 border border-gray-800">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <QrCode size={20} className="text-gold" />
                        Escaneie o QR Code
                    </h3>
                    <div className="flex justify-center">
                        <img
                            src={instance.qr_code_base64}
                            alt="QR Code"
                            className="w-64 h-64 rounded-lg"
                        />
                    </div>
                    <p className="text-center text-sm text-gray-400 mt-4">
                        Abra o WhatsApp no celular → Menu → Dispositivos conectados → Conectar dispositivo
                    </p>
                </div>
            )}

            {/* API Key */}
            <div className="bg-card rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-semibold mb-2">Configuração da API</h3>
                <p className="text-sm text-gray-400">
                    A conexão com a Evolution API é feita no servidor (Edge Functions) para não expor chaves no navegador.
                </p>
            </div>
        </div>
    )

    // Tab Conversas
    const renderConversas = () => (
        <div className="grid grid-cols-3 gap-6 h-[calc(100vh-200px)]">
            {/* Lista de Conversas */}
            <div className="bg-card rounded-xl border border-gray-800 overflow-hidden">
                <div className="p-4 border-b border-gray-800">
                    <h3 className="font-semibold">Conversas</h3>
                </div>
                <div className="overflow-y-auto h-full">
                    {conversationsError ? (
                        <p className="text-center text-red-400 py-8 px-4">
                            Erro ao carregar conversas: {conversationsError}
                        </p>
                    ) : conversations.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">Nenhuma conversa</p>
                    ) : (
                        conversations.map((conv) => (
                            <div
                                key={conv.remote_jid}
                                onClick={() => loadMessages(conv.remote_jid)}
                                className={`p-4 border-b border-gray-800 cursor-pointer hover:bg-gray-800/50 ${selectedConversation === conv.remote_jid ? 'bg-gray-800' : ''
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
                                        <User size={18} className="text-gold" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{formatPhone(conv.remote_jid)}</p>
                                        <p className="text-sm text-gray-400 truncate">{conv.last_message}</p>
                                    </div>
                                    <span className="text-xs text-gray-500">{formatTime(conv.last_time)}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Chat */}
            <div className="col-span-2 bg-card rounded-xl border border-gray-800 flex flex-col">
                {selectedConversation ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-gray-800">
                            <p className="font-semibold">{formatPhone(selectedConversation)}</p>
                        </div>

                        {/* Mensagens */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {messagesError && (
                                <div className="text-center text-red-400 py-2 px-3">
                                    Erro ao carregar mensagens: {messagesError}
                                </div>
                            )}
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.from_me ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[70%] px-4 py-2 rounded-lg ${msg.from_me
                                            ? 'bg-gold text-black'
                                            : 'bg-gray-800 text-white'
                                            }`}
                                    >
                                        <p>{msg.content}</p>
                                        <span className="text-xs opacity-70">{formatTime(msg.created_at)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-gray-800">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && enviarMensagem()}
                                    placeholder="Digite sua mensagem..."
                                    className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg"
                                />
                                <button
                                    onClick={enviarMensagem}
                                    className="px-4 py-3 bg-gold text-black rounded-lg hover:opacity-90"
                                >
                                    <Send size={20} />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                        <div className="text-center">
                            <MessageCircle size={48} className="mx-auto mb-2 opacity-50" />
                            <p>Selecione uma conversa</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )

    // Tab Agente
    const renderAgente = () => (
        <div className="space-y-6">
            {/* Status do Agente */}
            <div className="bg-card rounded-xl p-6 border border-gray-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${agentConfig?.ativo ? 'bg-green-500/20' : 'bg-gray-700'
                            }`}>
                            <Bot size={24} className={agentConfig?.ativo ? 'text-green-500' : 'text-gray-400'} />
                        </div>
                        <div>
                            <p className="font-semibold">{agentConfig?.nome_agente || 'Imperatriz'}</p>
                            <p className={`text-sm ${agentConfig?.ativo ? 'text-green-500' : 'text-gray-400'}`}>
                                {agentConfig?.ativo ? 'Agente ativo' : 'Agente desativado'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={toggleAgente}
                        className={`px-4 py-2 rounded-lg ${agentConfig?.ativo
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            }`}
                    >
                        {agentConfig?.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                </div>
            </div>

            {/* Horário de Funcionamento */}
            <div className="bg-card rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Clock size={20} className="text-gold" />
                    Horário de Funcionamento
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Início</label>
                        <input
                            type="time"
                            value={agentConfig?.horario_inicio || '19:30'}
                            onChange={async (e) => {
                                await supabase
                                    .from('agent_config')
                                    .update({ horario_inicio: e.target.value })
                                    .eq('id', agentConfig?.id)
                                await loadAgentConfig()
                            }}
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Fim</label>
                        <input
                            type="time"
                            value={agentConfig?.horario_fim || '23:00'}
                            onChange={async (e) => {
                                await supabase
                                    .from('agent_config')
                                    .update({ horario_fim: e.target.value })
                                    .eq('id', agentConfig?.id)
                                await loadAgentConfig()
                            }}
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg"
                        />
                    </div>
                </div>
            </div>

            {/* Mensagem Fora do Horário */}
            <div className="bg-card rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-semibold mb-4">Mensagem Fora do Horário</h3>
                <textarea
                    value={agentConfig?.mensagem_fora_horario || ''}
                    onChange={async (e) => {
                        await supabase
                            .from('agent_config')
                            .update({ mensagem_fora_horario: e.target.value })
                            .eq('id', agentConfig?.id)
                        await loadAgentConfig()
                    }}
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg resize-none"
                />
            </div>
        </div>
    )

    // Tab Templates
    const renderTemplates = () => (
        <div className="space-y-4">
            <div className="bg-card rounded-xl p-6 border border-gray-800">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FileText size={20} className="text-gold" />
                    Templates de Mensagens
                </h3>
                <div className="space-y-4">
                    {templates.map((template) => (
                        <div key={template.id} className="p-4 bg-gray-800/50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">{template.nome}</span>
                                <span className="text-xs px-2 py-1 bg-gold/20 text-gold rounded">
                                    {template.tipo}
                                </span>
                            </div>
                            <textarea
                                value={template.mensagem}
                                onChange={async (e) => {
                                    await supabase
                                        .from('whatsapp_templates')
                                        .update({ mensagem: e.target.value })
                                        .eq('id', template.id)
                                    await loadTemplates()
                                }}
                                rows={2}
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg resize-none text-sm"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen">
            <Header title="WhatsApp" onRefresh={loadData} />

            <div className="p-6">
                {/* Seletor de Instância */}
                <div className="mb-6 flex justify-end">
                    <InstanceSelector 
                        selectedInstance={instanceName} 
                        onInstanceChange={(name) => {
                            setInstanceName(name)
                            // Limpar estados ao trocar de instância
                            setInstance(null)
                            setConversations([])
                            setSelectedConversation(null)
                            setMessages([])
                        }} 
                    />
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    {renderTab(TABS.CONEXAO, <Wifi size={18} />, 'Conexão')}
                    {renderTab(TABS.CONVERSAS, <MessageCircle size={18} />, 'Conversas')}
                    {renderTab(TABS.AGENTE, <Bot size={18} />, 'Agente IA')}
                    {renderTab(TABS.TEMPLATES, <FileText size={18} />, 'Templates')}
                </div>

                {/* Conteúdo */}
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="animate-spin text-gold" size={40} />
                    </div>
                ) : (
                    <>
                        {activeTab === TABS.CONEXAO && renderConexao()}
                        {activeTab === TABS.CONVERSAS && renderConversas()}
                        {activeTab === TABS.AGENTE && renderAgente()}
                        {activeTab === TABS.TEMPLATES && renderTemplates()}
                    </>
                )}
            </div>
        </div>
    )
}
