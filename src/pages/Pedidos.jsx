import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
    Clock,
    CheckCircle,
    ChefHat,
    Truck,
    Package,
    Phone,
    MapPin,
    RefreshCw,
    Bell
} from 'lucide-react'

const N8N_WEBHOOK_URL = 'https://n8nwebhook.agenteflowia.com/webhook/status-pedido'

const STATUS_CONFIG = {
    pendente: { label: 'Pendente', color: 'bg-yellow-500', icon: Clock },
    confirmado: { label: 'Confirmado', color: 'bg-blue-500', icon: CheckCircle },
    preparando: { label: 'Preparando', color: 'bg-orange-500', icon: ChefHat },
    saiu: { label: 'Saiu p/ Entrega', color: 'bg-purple-500', icon: Truck },
    entregue: { label: 'Entregue', color: 'bg-green-500', icon: Package },
    cancelado: { label: 'Cancelado', color: 'bg-red-500', icon: Clock }
}

export function Pedidos() {
    const [pedidos, setPedidos] = useState([])
    const [loading, setLoading] = useState(true)
    const [filtroStatus, setFiltroStatus] = useState('todos')
    const [audioEnabled, setAudioEnabled] = useState(true)

    useEffect(() => {
        fetchPedidos()

        // Realtime subscription
        const channel = supabase
            .channel('pedidos-changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'pedidos' },
                (payload) => {
                    console.log('Mudança detectada:', payload)

                    if (payload.eventType === 'INSERT') {
                        setPedidos(prev => [payload.new, ...prev])
                        if (audioEnabled) playNotification()
                    } else if (payload.eventType === 'UPDATE') {
                        setPedidos(prev => prev.map(p =>
                            p.id === payload.new.id ? payload.new : p
                        ))
                    } else if (payload.eventType === 'DELETE') {
                        setPedidos(prev => prev.filter(p => p.id !== payload.old.id))
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [audioEnabled])

    const fetchPedidos = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('pedidos')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50)

        if (!error && data) {
            setPedidos(data)
        }
        setLoading(false)
    }

    const playNotification = () => {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQAHEpy37fKjaAAECYGpveekhloAAwl3fJOkkYBkAAEHZ21+gYV5cAABC1lhai8oMC0AAQVRS1c+OT05AAEFRkRQODU4OAAAA0FCTT80NzgAAAA/QUw8NDc3AAAAPkBKOjQ2NgAAAD1ASTo0NTYAAAA8P0g5MzU1AAAAOz9HODMzNAAAADo+Rjc0MzQAAAA5PUU2NDMzAAAAODxENTQzMwAAADc8RDQ0NDMAAAA2O0M0NDQzAAAANTpCNDQ0MwAAADQ6QTQ0NDMAAAA0OUA0NDQzAAAAMzlAMzQ1MwAAADI4PzM0NTMAAAAyOD8zNDUzAAAAMTc+MzQ1MgAAADE3PjM0NTIAAAAwNz0zNDUyAAAAMDY9MzQ1MgAAAC82PDM0NTIAAAAvNTszNTUxAAAALjU7MzU1MQAAAC40OjM1NTEAAAAtNDoztTUwAAAALTM5NLU1MAAAACw0OTS1NTAAAAAsMjk0tjUwAAAAKzI4NLY1LwAAACs0')
            audio.volume = 0.5
            audio.play()
        } catch (e) {
            console.log('Audio não suportado')
        }
    }

    const enviarNotificacaoN8N = async (pedido, novoStatus) => {
        if (!pedido.phone) return

        const mensagens = {
            confirmado: `Olá ${pedido.nome_cliente || 'Cliente'}! Seu pedido foi *CONFIRMADO* e já está sendo preparado! 🍗`,
            preparando: `Olá ${pedido.nome_cliente || 'Cliente'}! Seu pedido está sendo *PREPARADO* com carinho! ⏳`,
            saiu: `Olá ${pedido.nome_cliente || 'Cliente'}! Seu pedido *SAIU PARA ENTREGA*! 🛵 Aguarde em breve!`,
            entregue: `Olá ${pedido.nome_cliente || 'Cliente'}! Obrigado por pedir no Império das Porções! 🎉 Bom apetite!`
        }

        const mensagem = mensagens[novoStatus]

        if (mensagem && N8N_WEBHOOK_URL.includes('webhook')) {
            try {
                // Envia dados para o N8N processar e enviar o WhatsApp
                await fetch(N8N_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telefone: `55${pedido.phone.replace(/\D/g, '')}`, // Adiciona 55 do Brasil
                        nome: pedido.nome_cliente,
                        status: novoStatus,
                        mensagem: mensagem,
                        pedidoId: pedido.id
                    })
                })
                console.log('Notificação enviada para N8N:', novoStatus)
            } catch (error) {
                console.error('Erro ao enviar para N8N:', error)
            }
        }
    }

    const atualizarStatus = async (pedidoId, novoStatus) => {
        // Encontra o pedido atual para pegar dados do cliente
        const pedido = pedidos.find(p => p.id === pedidoId)

        // Notifica o cliente via N8N se tiver telefone
        if (pedido && pedido.phone) {
            enviarNotificacaoN8N(pedido, novoStatus)
        }

        // Optimistic update - atualiza imediatamente na tela
        setPedidos(prev => prev.map(p =>
            p.id === pedidoId ? { ...p, status: novoStatus } : p
        ))

        // Envia para o banco em background
        const { error } = await supabase
            .from('pedidos')
            .update({ status: novoStatus })
            .eq('id', pedidoId)

        if (error) {
            console.error('Erro ao atualizar:', error)
            // Reverte em caso de erro
            fetchPedidos()
            alert('Erro ao atualizar status. Tente novamente.')
        }
    }

    const formatarData = (dataString) => {
        const data = new Date(dataString)
        return data.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const formatarPreco = (valor) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor || 0)
    }

    const pedidosFiltrados = filtroStatus === 'todos'
        ? pedidos
        : pedidos.filter(p => p.status === filtroStatus)

    const contarPorStatus = (status) => pedidos.filter(p => p.status === status).length

    return (
        <div className="container mx-auto p-4 max-w-7xl">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Gerenciador de Pedidos</h1>
                    <p className="text-gray-500">Acompanhe seus pedidos em tempo real</p>
                </div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-lg shadow-sm border">
                    <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="text-sm font-medium text-gray-600">Sistema Online</span>
                    <button
                        onClick={() => setAudioEnabled(!audioEnabled)}
                        className={`ml-2 p-2 rounded-full ${audioEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                        title="Som de notificação"
                    >
                        <Bell size={18} />
                    </button>
                </div>
            </div>

            {/* Filtros de Status */}
            <div className="flex flex-wrap gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                <button
                    onClick={() => setFiltroStatus('todos')}
                    className={`px-4 py-2 rounded-lg font-bold transition-all ${filtroStatus === 'todos'
                        ? 'bg-gray-900 text-white shadow-lg scale-105'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border'
                        }`}
                >
                    Todos ({pedidos.length})
                </button>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <button
                        key={key}
                        onClick={() => setFiltroStatus(key)}
                        className={`px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 border-2 transition-all ${filtroStatus === key
                            ? config.color + ' text-white border-white shadow-lg'
                            : 'bg-gray-800 text-white border-gray-600 hover:bg-gray-700'
                            }`}
                    >
                        <config.icon size={16} />
                        {config.label} ({contarPorStatus(key)})
                    </button>
                ))}
            </div>

            {/* Lista de Pedidos - Grid CRM Style */}
            {loading ? (
                <div className="text-center py-10">
                    <RefreshCw size={32} className="animate-spin mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-500">Carregando pedidos...</p>
                </div>
            ) : pedidosFiltrados.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-xl">
                    <Package size={48} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500">Nenhum pedido encontrado</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {pedidosFiltrados.map(pedido => {
                        const statusConfig = STATUS_CONFIG[pedido.status] || STATUS_CONFIG.pendente
                        const StatusIcon = statusConfig.icon

                        return (
                            <div key={pedido.id} className="bg-white rounded-2xl border-2 border-gray-100 shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
                                {/* Header do Card com cor do status */}
                                <div className={`${statusConfig.color} px-4 py-3 flex items-center justify-between`}>
                                    <div className="flex items-center gap-2 text-white">
                                        <span className="text-xl font-bold">#{pedido.id}</span>
                                        <span className="bg-white/20 px-2 py-0.5 rounded text-sm flex items-center gap-1">
                                            <StatusIcon size={14} />
                                            {statusConfig.label}
                                        </span>
                                    </div>
                                    <span className="text-white/80 text-sm font-medium">{formatarData(pedido.created_at)}</span>
                                </div>

                                {/* Corpo do Card */}
                                <div className="p-4">
                                    {/* Cliente */}
                                    <div className="mb-4">
                                        <h3 className="text-lg font-bold text-gray-900 mb-1">{pedido.nome_cliente || 'Cliente'}</h3>
                                        <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                                            <Phone size={14} className="text-green-600" />
                                            <span className="font-medium">{pedido.phone}</span>
                                        </div>
                                        <div className="flex items-start gap-2 text-gray-600 text-sm">
                                            <MapPin size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                                            <span>{pedido.endereco_entrega}, {pedido.bairro}</span>
                                        </div>
                                        {pedido.observacoes && (
                                            <p className="text-gray-400 text-xs mt-2 italic">📝 {pedido.observacoes}</p>
                                        )}
                                    </div>

                                    {/* Itens */}
                                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Itens do Pedido</p>
                                        <p className="text-gray-900 font-medium text-sm">{pedido.itens}</p>
                                    </div>

                                    {/* Valor */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-semibold">Total</p>
                                            <p className="text-xl font-bold text-gray-900">{formatarPreco(pedido.valor_total)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500 uppercase font-semibold">Pagamento</p>
                                            <p className="font-medium text-gray-700 capitalize">{pedido.forma_pagamento}</p>
                                        </div>
                                    </div>

                                    {/* Botões de Ação */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {pedido.status === 'pendente' && (
                                            <>
                                                <button
                                                    onClick={() => atualizarStatus(pedido.id, 'cancelado')}
                                                    className="px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-bold text-sm transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={() => atualizarStatus(pedido.id, 'confirmado')}
                                                    className="px-3 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 font-bold text-sm shadow-md transition-colors"
                                                >
                                                    Confirmar
                                                </button>
                                            </>
                                        )}

                                        {pedido.status === 'confirmado' && (
                                            <button
                                                onClick={() => atualizarStatus(pedido.id, 'preparando')}
                                                className="col-span-2 px-3 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2"
                                            >
                                                <ChefHat size={16} /> Iniciar Preparo
                                            </button>
                                        )}

                                        {pedido.status === 'preparando' && (
                                            <button
                                                onClick={() => atualizarStatus(pedido.id, 'saiu')}
                                                className="col-span-2 px-3 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Truck size={16} /> Saiu para Entrega
                                            </button>
                                        )}

                                        {pedido.status === 'saiu' && (
                                            <button
                                                onClick={() => atualizarStatus(pedido.id, 'entregue')}
                                                className="col-span-2 px-3 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle size={16} /> Confirmar Entrega
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
