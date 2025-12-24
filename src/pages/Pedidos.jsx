import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
    Clock,
    CheckCircle,
    ChefHat,
    Truck,
    Package,
    Phone,
    Printer,
    XCircle,
    Store,
    UtensilsCrossed
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'

const N8N_WEBHOOK_URL = 'https://n8nwebhook.agenteflowia.com/webhook/status-pedido'

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

        // Buscar pedidos normais
        const { data: pedidosData } = await supabase
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

        // Transformar comandas em formato de "pedido"
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

        const todosOsPedidos = [...(pedidosData || []), ...comandasComoPedidos]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        setPedidos(todosOsPedidos)
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
        // Encontra o pedido atual
        const pedido = pedidos.find(p => p.id === pedidoId)
        
        // Optimistic update
        setPedidos(prev => prev.map(p =>
            p.id === pedidoId ? { ...p, status: novoStatus } : p
        ))

        // Update no banco
        const { error } = await supabase
            .from('pedidos')
            .update({ status: novoStatus })
            .eq('id', pedidoId)

        if (error) {
            console.error('Erro ao atualizar:', error)
            fetchPedidos() // Reverte
        } else {
            // Se tiver telefone, envia notificação (opcional)
            if (pedido && pedido.phone) {
                // enviarNotificacaoN8N(pedido, novoStatus) - removi para simplificar, mas pode manter
            }
        }
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

    const formatarItens = (itens) => {
        if (!itens) return []
        
        // Se já for array (formato JSONB do banco)
        if (Array.isArray(itens)) {
            return itens.map(item => {
                if (typeof item === 'string') return item
                // Formato objeto: { nome: 'X', quantidade: 1 }
                if (item.nome && item.quantidade) {
                    return `${item.quantidade}x ${item.nome}`
                }
                return JSON.stringify(item)
            })
        }

        // Se for string
        if (typeof itens === 'string') {
            // Verifica se é JSON string
            if (itens.startsWith('[') || itens.startsWith('{')) {
                try {
                    const parsed = JSON.parse(itens)
                    return formatarItens(parsed) // Recursivo para tratar o resultado
                } catch (e) {
                    // Falha no parse, trata como string normal
                }
            }
            // Remove aspas extras e separa por vírgula
            return itens.replace(/"/g, '').split(',').map(i => i.trim())
        }
        
        return [String(itens)]
    }

    const handlePrint = (pedido) => {
        const itensFormatados = formatarItens(pedido.itens)
        const printWindow = window.open('', '', 'width=300,height=600')
        const html = `
            <html>
                <head>
                    <title>Pedido #${pedido.id}</title>
                    <style>
                        body { font-family: 'Courier New', monospace; padding: 10px; font-size: 12px; max-width: 300px; margin: 0 auto; }
                        .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
                        .title { font-size: 16px; font-weight: bold; margin: 0; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <p class="title">IMPÉRIO DAS PORÇÕES</p>
                        <p>Pedido #${pedido.id}</p>
                    </div>
                    <div>
                        ${itensFormatados.map(i => `<p>${i}</p>`).join('')}
                    </div>
                    <p style="text-align: right; font-weight: bold; margin-top: 10px;">TOTAL: R$ ${Number(pedido.valor_total).toFixed(2)}</p>
                    <script>window.onload = function() { window.print(); window.close(); }</script>
                </body>
            </html>
        `
        printWindow.document.write(html)
        printWindow.document.close()
    }

    return (
        <div className="min-h-screen p-4 lg:p-8 pb-20">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-4xl font-display uppercase tracking-wide bg-gradient-to-r from-imperio-red to-gold bg-clip-text text-transparent">
                            Pedidos
                        </h1>
                        <p className="text-gray-400 mt-1">Gerenciamento em tempo real</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {['todos', 'pendente', 'preparando', 'saiu', 'entregue'].map((status) => (
                            <Button
                                key={status}
                                variant={filtroStatus === status ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setFiltroStatus(status)}
                                className={filtroStatus === status ? '' : 'bg-card border border-gray-800'}
                            >
                                {status}
                                <span className="ml-2 bg-black/20 px-2 py-0.5 rounded text-xs">
                                    {status === 'todos' ? pedidos.length : pedidos.filter(p => p.status === status).length}
                                </span>
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Filtros Modalidade */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {[
                        { key: 'todos', label: 'Todos', icon: null },
                        { key: 'delivery', label: 'Delivery', icon: Truck },
                        { key: 'retirada', label: 'Retirada', icon: Store },
                        { key: 'mesa', label: 'Mesa', icon: UtensilsCrossed }
                    ].map(({ key, label, icon: Icon }) => (
                        <Button
                            key={key}
                            variant={filtroModalidade === key ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setFiltroModalidade(key)}
                            className="border border-gray-800"
                        >
                            {Icon && <Icon size={16} className="mr-2" />}
                            {label}
                            <span className="ml-2 bg-black/20 px-2 py-0.5 rounded text-xs">
                                {key === 'todos' ? pedidos.length : pedidos.filter(p => p.modalidade === key).length}
                            </span>
                        </Button>
                    ))}
                </div>

                {/* Grid de Pedidos */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pedidosFiltrados.map((pedido) => (
                        <Card key={pedido.id} hover className="group relative overflow-hidden">
                            {/* Borda lateral colorida */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                pedido.status === 'pendente' ? 'bg-yellow-500' :
                                pedido.status === 'preparando' ? 'bg-blue-500' :
                                pedido.status === 'saiu' ? 'bg-purple-500' :
                                pedido.status === 'entregue' ? 'bg-green-500' : 'bg-gray-500'
                            }`} />

                            <CardContent className="p-0">
                                <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-800">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-display text-gold text-lg">#{pedido.id}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider ${getStatusColor(pedido.status)}`}>
                                                {pedido.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <Clock size={12} />
                                            {new Date(pedido.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-display text-xl">R$ {Number(pedido.valor_total).toFixed(2)}</p>
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

                                    <div className="bg-black/30 p-3 rounded-lg text-sm text-gray-300 border border-gray-800">
                                        {pedido.endereco_entrega ? (
                                            <>
                                                <p className="font-display text-white mb-1 text-sm tracking-wide">📍 {pedido.bairro}</p>
                                                <p>{pedido.endereco_entrega}</p>
                                            </>
                                        ) : (
                                            <p className="italic text-gray-500">Retirada no balcão</p>
                                        )}
                                    </div>

                                    <div>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-display">Itens do Pedido</p>
                                        <div className="space-y-1 text-sm">
                                            {formatarItens(pedido.itens).map((item, i) => (
                                                <p key={i} className="flex items-start gap-2">
                                                    <span className="text-gold">•</span>
                                                    {item}
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
                                    <div className="flex gap-2 w-full">
                                        <Button variant="ghost" size="icon" onClick={() => handlePrint(pedido)}>
                                            <Printer size={20} />
                                        </Button>
                                        
                                        {pedido.status === 'pendente' && (
                                            <Button onClick={() => atualizarStatus(pedido.id, 'preparando')} className="flex-1 bg-blue-600 hover:bg-blue-700">
                                                <CheckCircle size={16} className="mr-2" /> Aceitar
                                            </Button>
                                        )}
                                        {pedido.status === 'preparando' && (
                                            <Button onClick={() => atualizarStatus(pedido.id, 'saiu')} className="flex-1 bg-purple-600 hover:bg-purple-700">
                                                <Truck size={16} className="mr-2" /> Despachar
                                            </Button>
                                        )}
                                        {pedido.status === 'saiu' && (
                                            <Button onClick={() => atualizarStatus(pedido.id, 'entregue')} className="flex-1 bg-green-600 hover:bg-green-700">
                                                <CheckCircle size={16} className="mr-2" /> Concluir
                                            </Button>
                                        )}
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => atualizarStatus(pedido.id, 'cancelado')} className="text-red-500 hover:bg-red-500/20">
                                        <XCircle size={20} />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    )
}
