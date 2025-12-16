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
    Bell,
    Printer,
    XCircle,
    Store,
    UtensilsCrossed
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
    const [filtroModalidade, setFiltroModalidade] = useState('todos')
    const [audioEnabled, setAudioEnabled] = useState(true)

    useEffect(() => {
        fetchPedidos()

        // Realtime subscription para pedidos
        const channel = supabase
            .channel('pedidos-changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'pedidos' },
                (payload) => {
                    console.log('Mudança detectada em pedidos:', payload)

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
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'comandas' },
                () => {
                    console.log('Mudança detectada em comandas')
                    fetchPedidos() // Recarrega tudo para incluir comandas atualizadas
                }
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'itens_comanda' },
                () => {
                    console.log('Mudança detectada em itens_comanda')
                    fetchPedidos() // Recarrega tudo para incluir novos itens
                    if (audioEnabled) playNotification()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [audioEnabled])

    const fetchPedidos = async () => {
        setLoading(true)

        // Buscar pedidos normais
        const { data: pedidosData, error: pedidosError } = await supabase
            .from('pedidos')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50)

        // Buscar comandas abertas com itens
        const { data: comandasData } = await supabase
            .from('comandas')
            .select(`
                *,
                mesas (numero),
                itens_comanda (*)
            `)
            .eq('status', 'aberta')
            .order('created_at', { ascending: false })

        // Transformar comandas em formato de "pedido" para exibição
        const comandasComoPedidos = (comandasData || [])
            .filter(c => c.itens_comanda && c.itens_comanda.length > 0)
            .map(comanda => ({
                id: `C${comanda.id}`,
                id_real: comanda.id,
                isComanda: true,
                nome_cliente: `Mesa ${comanda.mesas?.numero || comanda.mesa_id}`,
                phone: '',
                itens: comanda.itens_comanda.map(i => `${i.quantidade}x ${i.nome_produto}`).join(', '),
                valor_total: comanda.valor_total || 0,
                taxa_entrega: 0,
                endereco_entrega: `Mesa ${comanda.mesas?.numero || comanda.mesa_id}`,
                bairro: 'No local',
                forma_pagamento: 'pendente',
                observacoes: `Garçom: ${comanda.garcom || 'N/A'}`,
                status: 'pendente',
                modalidade: 'mesa',
                created_at: comanda.created_at,
                mesa_numero: comanda.mesas?.numero || comanda.mesa_id
            }))

        // Combinar pedidos + comandas, ordenar por data
        const todosOsPedidos = [...(pedidosData || []), ...comandasComoPedidos]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        if (!pedidosError) {
            setPedidos(todosOsPedidos)
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
                        telefone: (() => {
                            let tel = pedido.phone.replace(/\D/g, '')
                            // Se já começa com 55 e tem 13 dígitos, não adiciona prefixo
                            if (tel.startsWith('55') && tel.length >= 12) return tel
                            // Se tem 11 dígitos (DDD + número), adiciona 55
                            if (tel.length === 11) return `55${tel}`
                            // Caso contrário, retorna como está
                            return tel
                        })(),
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

    const getStatusColor = (status) => {
        const colors = {
            pendente: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50',
            preparando: 'bg-blue-500/20 text-blue-500 border-blue-500/50',
            saiu: 'bg-purple-500/20 text-purple-500 border-purple-500/50',
            entregue: 'bg-green-500/20 text-green-500 border-green-500/50',
            cancelado: 'bg-red-500/20 text-red-500 border-red-500/50'
        }
        return colors[status] || 'bg-gray-500/20 text-gray-500 border-gray-500/50'
    }

    const abrirWhatsApp = (pedido) => {
        if (!pedido.phone) return
        const phone = pedido.phone.replace(/\D/g, '')
        const url = `https://wa.me/55${phone}`
        window.open(url, '_blank')
    }

    const pedidosFiltrados = pedidos.filter(p => {
        const passaStatus = filtroStatus === 'todos' || p.status === filtroStatus
        const passaModalidade = filtroModalidade === 'todos' || p.modalidade === filtroModalidade
        return passaStatus && passaModalidade
    })

    const getModalidadeIcon = (modalidade) => {
        if (modalidade === 'mesa') return UtensilsCrossed
        if (modalidade === 'retirada') return Store
        return Truck
    }

    const getModalidadeColor = (modalidade) => {
        if (modalidade === 'mesa') return 'bg-purple-500/20 text-purple-400 border-purple-500/50'
        if (modalidade === 'retirada') return 'bg-green-500/20 text-green-400 border-green-500/50'
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
    }

    const getModalidadeLabel = (modalidade) => {
        if (modalidade === 'mesa') return 'Mesa'
        if (modalidade === 'retirada') return 'Retirada'
        return 'Delivery'
    }

    const handlePrint = (pedido) => {
        const printWindow = window.open('', '', 'width=300,height=600')

        const html = `
            <html>
                <head>
                    <title>Pedido #${pedido.id}</title>
                    <style>
                        body { font-family: 'Courier New', monospace; padding: 10px; font-size: 12px; max-width: 300px; margin: 0 auto; }
                        .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
                        .title { font-size: 16px; font-weight: bold; margin: 0; }
                        .info { margin-bottom: 5px; }
                        .items { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 10px; }
                        .items th { border-bottom: 1px solid #000; text-align: left; }
                        .items td { padding-top: 5px; vertical-align: top; }
                        .total { font-size: 14px; font-weight: bold; text-align: right; margin-top: 10px; border-top: 2px dashed #000; padding-top: 10px; }
                        .footer { text-align: center; margin-top: 20px; font-size: 10px; }
                        @media print {
                            body { margin: 0; padding: 5px; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <p class="title">IMPÉRIO DAS PORÇÕES</p>
                        <p>Pedido #${pedido.id}</p>
                        <p>${new Date(pedido.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                    
                    <div class="info">
                        <strong>Cliente:</strong> ${pedido.nome_cliente || 'Não informado'}<br>
                        <strong>Tel:</strong> ${pedido.phone || '-'}<br>
                        <strong>Endereço:</strong> ${pedido.endereco_entrega || '-'}<br>
                        <strong>Bairro:</strong> ${pedido.bairro || '-'}<br>
                        <strong>Pagamento:</strong> ${pedido.forma_pagamento?.toUpperCase() || '-'}
                    </div>

                    <table class="items">
                        <thead>
                            <tr>
                                <th>Qtd</th>
                                <th>Item</th>
                                <th>R$</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(pedido.itens || '').toString().replace(/"/g, '').split(', ').map(item => {
            // Tenta extrair quantidade e nome (ex: "1x Frango")
            const match = item.match(/^(\d+)x\s(.+)$/)
            if (match) {
                return `
                                        <tr>
                                            <td>${match[1]}</td>
                                            <td>${match[2]}</td>
                                            <td>-</td>
                                        </tr>
                                    `
            }
            return `<tr><td colspan="3">${item}</td></tr>`
        }).join('')}
                        </tbody>
                    </table>

                     ${pedido.observacoes ? `
                    <div style="border: 1px solid #000; padding: 5px; margin: 10px 0; font-weight: bold;">
                        OBS: ${pedido.observacoes}
                    </div>` : ''}

                    <div class="total">
                        Taxa Entrega: R$ ${Number(pedido.taxa_entrega || 0).toFixed(2)}<br>
                        TOTAL: R$ ${Number(pedido.valor_total).toFixed(2)}
                    </div>

                    <div class="footer">
                        <p>www.imperiodasporcoes.com.br</p>
                    </div>

                    <script>
                        window.onload = function() { window.print(); window.close(); }
                    </script>
                </body>
            </html>
        `

        printWindow.document.write(html)
        printWindow.document.close()
    }

    const contarPorStatus = (status) => pedidos.filter(p => p.status === status).length
    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#0a0a0a] text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37]"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 ml-64">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#F2C94C] bg-clip-text text-transparent">
                            Pedidos
                        </h1>
                        <p className="text-gray-400 mt-1">Gerencie os pedidos em tempo real</p>
                    </div>
                    <div className="flex gap-2">
                        {['todos', 'pendente', 'preparando', 'saiu', 'entregue'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFiltroStatus(status)}
                                className={`px-4 py-2 rounded-lg capitalize transition-all ${filtroStatus === status
                                    ? 'bg-[#D4AF37] text-black font-bold'
                                    : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#2a2a2a]'
                                    }`}
                            >
                                {status}
                                <span className="ml-2 bg-black/20 px-2 py-0.5 rounded text-xs">
                                    {status === 'todos'
                                        ? pedidos.length
                                        : pedidos.filter(p => p.status === status).length}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Filtros por Modalidade */}
                <div className="flex gap-2 mb-6">
                    {[
                        { key: 'todos', label: 'Todos', icon: null },
                        { key: 'delivery', label: 'Delivery', icon: Truck },
                        { key: 'retirada', label: 'Retirada', icon: Store },
                        { key: 'mesa', label: 'Mesa', icon: UtensilsCrossed }
                    ].map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setFiltroModalidade(key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${filtroModalidade === key
                                ? key === 'delivery' ? 'bg-blue-500/30 text-blue-400 border border-blue-500'
                                    : key === 'retirada' ? 'bg-green-500/30 text-green-400 border border-green-500'
                                        : key === 'mesa' ? 'bg-purple-500/30 text-purple-400 border border-purple-500'
                                            : 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]'
                                : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#2a2a2a] border border-transparent'
                                }`}
                        >
                            {Icon && <Icon size={16} />}
                            {label}
                            <span className="bg-black/20 px-2 py-0.5 rounded text-xs">
                                {key === 'todos'
                                    ? pedidos.length
                                    : pedidos.filter(p => p.modalidade === key).length}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pedidosFiltrados.map((pedido) => (
                        <div
                            key={pedido.id}
                            className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-4 hover:border-[#D4AF37]/50 transition-all group"
                        >
                            <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-800">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-[#D4AF37]">#{pedido.id}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(pedido.status)} capitalize`}>
                                            {pedido.status}
                                        </span>
                                        {pedido.modalidade && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${getModalidadeColor(pedido.modalidade)}`}>
                                                {(() => { const Icon = getModalidadeIcon(pedido.modalidade); return <Icon size={10} /> })()}
                                                {getModalidadeLabel(pedido.modalidade)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <Clock size={12} />
                                        {new Date(pedido.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-lg">R$ {Number(pedido.valor_total).toFixed(2)}</p>
                                    <p className="text-xs text-gray-500 capitalize">{pedido.forma_pagamento}</p>
                                </div>
                            </div>

                            <div className="space-y-4 mb-4">
                                <div>
                                    <h3 className="font-bold text-lg mb-1">{pedido.nome_cliente || 'Cliente não identificado'}</h3>
                                    {pedido.phone && (
                                        <button
                                            onClick={() => abrirWhatsApp(pedido)}
                                            className="flex items-center gap-1 text-sm text-green-500 hover:text-green-400"
                                        >
                                            <Phone size={14} />
                                            {pedido.phone}
                                        </button>
                                    )}
                                </div>

                                <div className="bg-black/30 p-3 rounded-lg text-sm text-gray-300">
                                    {pedido.endereco_entrega ? (
                                        <>
                                            <p className="font-medium text-white mb-1">📍 {pedido.bairro}</p>
                                            <p>{pedido.endereco_entrega}</p>
                                        </>
                                    ) : (
                                        <p className="italic text-gray-500">Retirada no balcão</p>
                                    )}
                                </div>

                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Itens do Pedido</p>
                                    <div className="space-y-1 text-sm">
                                        {(pedido.itens || '').toString().replace(/"/g, '').split(',').map((item, i) => (
                                            <p key={i} className="flex items-start gap-2">
                                                <span className="text-[#D4AF37]">•</span>
                                                {item.trim()}
                                            </p>
                                        ))}
                                    </div>
                                    {pedido.observacoes && (
                                        <div className="mt-2 text-xs text-yellow-500 bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
                                            ⚠️ {pedido.observacoes}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-4 border-t border-gray-800">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handlePrint(pedido)}
                                        className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                                        title="Imprimir Cupom"
                                    >
                                        <Printer size={20} />
                                    </button>
                                    {pedido.status === 'pendente' && (
                                        <button
                                            onClick={() => atualizarStatus(pedido.id, 'preparando')}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle size={16} /> Aceitar
                                        </button>
                                    )}
                                    {pedido.status === 'preparando' && (
                                        <button
                                            onClick={() => atualizarStatus(pedido.id, 'saiu')}
                                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Truck size={16} /> Despachar
                                        </button>
                                    )}
                                    {pedido.status === 'saiu' && (
                                        <button
                                            onClick={() => atualizarStatus(pedido.id, 'entregue')}
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle size={16} /> Concluir
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={() => atualizarStatus(pedido.id, 'cancelado')}
                                    className="p-2 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-500 transition-colors"
                                    title="Cancelar Pedido"
                                >
                                    <XCircle size={20} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
