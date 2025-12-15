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

    const atualizarStatus = async (pedidoId, novoStatus) => {
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

    const abrirWhatsApp = (telefone, nome, status) => {
        const mensagens = {
            confirmado: `Olá ${nome}! Seu pedido foi *CONFIRMADO* e já está sendo preparado! 🍗`,
            preparando: `Olá ${nome}! Seu pedido está sendo *PREPARADO* com carinho! ⏳`,
            saiu: `Olá ${nome}! Seu pedido *SAIU PARA ENTREGA*! 🛵 Aguarde em breve!`,
            entregue: `Olá ${nome}! Obrigado por pedir no Império das Porções! 🎉 Bom apetite!`
        }

        const mensagem = mensagens[status] || `Olá ${nome}! Atualização sobre seu pedido.`
        const tel = telefone.replace(/\D/g, '')
        window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(mensagem)}`, '_blank')
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
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
                    <p className="text-gray-500">Gerenciamento em tempo real</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setAudioEnabled(!audioEnabled)}
                        className={`p-2 rounded-lg ${audioEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                        title={audioEnabled ? 'Som ativado' : 'Som desativado'}
                    >
                        <Bell size={20} />
                    </button>
                    <button
                        onClick={fetchPedidos}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Atualizar
                    </button>
                </div>
            </div>

            {/* Filtros por Status */}
            <div className="flex flex-wrap gap-2 mb-6">
                <button
                    onClick={() => setFiltroStatus('todos')}
                    className={`px-4 py-2.5 rounded-lg font-bold border-2 transition-all ${filtroStatus === 'todos'
                        ? 'bg-white text-gray-900 border-white shadow-lg'
                        : 'bg-gray-800 text-white border-gray-600 hover:bg-gray-700'
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
                                            <p className="text-2xl font-bold text-red-600">{formatarPreco(pedido.valor_total)}</p>
                                        </div>
                                        {pedido.taxa_entrega > 0 && (
                                            <div className="text-right">
                                                <p className="text-xs text-gray-400">Taxa entrega</p>
                                                <p className="text-sm text-gray-600">{formatarPreco(pedido.taxa_entrega)}</p>
                                            </div>
                                        )}
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400">Pagamento</p>
                                            <p className="text-sm font-medium text-gray-700 capitalize">{pedido.forma_pagamento}</p>
                                        </div>
                                    </div>

                                    {/* Ações */}
                                    <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                                        {pedido.status === 'pendente' && (
                                            <button
                                                onClick={() => atualizarStatus(pedido.id, 'confirmado')}
                                                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md"
                                            >
                                                ✓ Confirmar
                                            </button>
                                        )}
                                        {pedido.status === 'confirmado' && (
                                            <button
                                                onClick={() => atualizarStatus(pedido.id, 'preparando')}
                                                className="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-600 shadow-md"
                                            >
                                                🍳 Em Preparo
                                            </button>
                                        )}
                                        {pedido.status === 'preparando' && (
                                            <button
                                                onClick={() => atualizarStatus(pedido.id, 'saiu')}
                                                className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 shadow-md"
                                            >
                                                🛵 Saiu Entrega
                                            </button>
                                        )}
                                        {pedido.status === 'saiu' && (
                                            <button
                                                onClick={() => atualizarStatus(pedido.id, 'entregue')}
                                                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 shadow-md"
                                            >
                                                ✓ Entregue
                                            </button>
                                        )}

                                        <button
                                            onClick={() => abrirWhatsApp(pedido.phone, pedido.nome_cliente, pedido.status)}
                                            className="px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 shadow-md"
                                            title="Enviar mensagem WhatsApp"
                                        >
                                            📱
                                        </button>

                                        {pedido.status !== 'cancelado' && pedido.status !== 'entregue' && (
                                            <button
                                                onClick={() => atualizarStatus(pedido.id, 'cancelado')}
                                                className="px-4 py-2.5 bg-red-50 text-red-600 border-2 border-red-200 rounded-lg text-sm font-bold hover:bg-red-100"
                                                title="Cancelar pedido"
                                            >
                                                ✕
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
