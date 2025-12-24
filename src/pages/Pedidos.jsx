import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
    Clock,
    CheckCircle,
    Truck,
    Phone,
    Printer,
    XCircle,
    Store,
    UtensilsCrossed
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'

export function Pedidos() {
    const [pedidos, setPedidos] = useState([])
    const [loading, setLoading] = useState(true)
    const [filtroStatus, setFiltroStatus] = useState('todos')
    const [filtroModalidade, setFiltroModalidade] = useState('todos')
    const [audioEnabled, setAudioEnabled] = useState(true)

    useEffect(() => {
        fetchPedidos()

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

        const { data: pedidosData } = await supabase
            .from('pedidos')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50)

        const { data: comandasData } = await supabase
            .from('comandas')
            .select(`
                *,
                mesas (numero),
                itens_comanda (*)
            `)
            .eq('status', 'aberta')
            .order('created_at', { ascending: false })

        const comandasComoPedidos = (comandasData || [])
            .filter(c => c.itens_comanda && c.itens_comanda.length > 0)
            .map(comanda => ({
                id: `C${comanda.id}`,
                id_real: comanda.id,
                isComanda: true,
                nome_cliente: `Mesa ${comanda.mesas?.numero || comanda.mesa_id}`,
                phone: '',
                itens: comanda.itens_comanda.map(i => `${i.quantidade}x ${i.nome_produto}`), // Array de strings
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
        setPedidos(prev => prev.map(p =>
            p.id === pedidoId ? { ...p, status: novoStatus } : p
        ))

        const { error } = await supabase
            .from('pedidos')
            .update({ status: novoStatus })
            .eq('id', pedidoId)

        if (error) {
            console.error('Erro ao atualizar:', error)
            fetchPedidos()
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

    // Função BLINDADA para formatar itens
    const formatarItens = (itens) => {
        if (!itens) return []
        
        let lista = []

        // Se já for array (ex: comanda)
        if (Array.isArray(itens)) {
            lista = itens
        } 
        // Se for string JSON
        else if (typeof itens === 'string') {
            try {
                // Tenta parsear JSON
                const parsed = JSON.parse(itens)
                if (Array.isArray(parsed)) {
                    lista = parsed
                } else if (typeof parsed === 'object') {
                    lista = [parsed]
                } else {
                    // String simples dentro de JSON?
                    lista = [String(parsed)]
                }
            } catch (e) {
                // Não é JSON, trata como string CSV (legado)
                lista = itens.replace(/"/g, '').split(',').map(i => i.trim())
            }
        }

        // GARANTIA FINAL: Mapear tudo para string
        return lista.map(item => {
            if (typeof item === 'string') return item
            if (typeof item === 'object' && item !== null) {
                // Se for objeto {nome, quantidade}, formata
                if (item.nome && item.quantidade) {
                    return `${item.quantidade}x ${item.nome}`
                }
                // Se for outro objeto qualquer, tenta extrair algo útil ou stringify
                return item.nome || item.produto || JSON.stringify(item)
            }
            return String(item)
        })
    }

    const pedidosFiltrados = pedidos.filter(p => {
        const passaStatus = filtroStatus === 'todos' || p.status === filtroStatus
        const passaModalidade = filtroModalidade === 'todos' || p.modalidade === filtroModalidade
        return passaStatus && passaModalidade
    })

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
        <div className="min-h-screen p-4 lg:p-8 pb-20 bg-[#0a0a0a]">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-4xl font-display uppercase tracking-wide text-white">
                            Pedidos
                        </h1>
                        <p className="text-gray-400 mt-1 text-sm uppercase tracking-widest font-bold">Gerenciamento em tempo real</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {['todos', 'pendente', 'preparando', 'saiu', 'entregue'].map((status) => (
                            <Button
                                key={status}
                                variant={filtroStatus === status ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setFiltroStatus(status)}
                                className={`${filtroStatus === status ? '!bg-imperio-red !text-white hover:bg-imperio-red/90' : 'bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300'} uppercase font-bold text-xs tracking-wider transition-colors`}
                            >
                                {status}
                                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${filtroStatus === status ? 'bg-black/20 text-white' : 'bg-white/10 text-gray-400'}`}>
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
                            className={`border ${filtroModalidade === key ? '!bg-gold !text-black border-gold font-bold hover:bg-gold/90' : 'border-white/10 text-gray-400 hover:text-white'} text-xs uppercase tracking-wider transition-colors`}
                        >
                            {Icon && <Icon size={14} className="mr-2" />}
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
                        <Card key={pedido.id} className="group relative overflow-hidden bg-[#121212] border-white/5 shadow-lg">
                            {/* Status Bar Top */}
                            <div className={`h-1 w-full ${
                                pedido.status === 'pendente' ? 'bg-yellow-500' :
                                pedido.status === 'preparando' ? 'bg-blue-500' :
                                pedido.status === 'saiu' ? 'bg-purple-500' :
                                pedido.status === 'entregue' ? 'bg-green-500' : 'bg-gray-500'
                            }`} />

                            <CardContent className="p-5">
                                <div className="flex justify-between items-start mb-4 pb-4 border-b border-white/5">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-display text-white text-xl">#{pedido.id}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider font-bold ${getStatusColor(pedido.status)}`}>
                                                {pedido.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                            <Clock size={12} />
                                            {new Date(pedido.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-display text-2xl text-gold">R$ {Number(pedido.valor_total).toFixed(2)}</p>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-4">
                                    <div>
                                        <h3 className="font-bold text-base text-white mb-1 uppercase tracking-wide">{pedido.nome_cliente || 'Cliente não identificado'}</h3>
                                        {pedido.phone && (
                                            <button
                                                onClick={() => abrirWhatsApp(pedido)}
                                                className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 font-medium uppercase tracking-wider transition-colors"
                                            >
                                                <Phone size={12} />
                                                {pedido.phone}
                                            </button>
                                        )}
                                    </div>

                                    <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                                        {pedido.endereco_entrega ? (
                                            <>
                                                <p className="font-bold text-white mb-1 text-xs uppercase tracking-wide flex items-center gap-1">
                                                    <Store size={12} className="text-imperio-red" />
                                                    {pedido.bairro}
                                                </p>
                                                <p className="text-gray-400 text-xs">{pedido.endereco_entrega}</p>
                                            </>
                                        ) : (
                                            <p className="italic text-gray-500 text-xs">Retirada no balcão</p>
                                        )}
                                    </div>

                                    <div>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-bold">Itens do Pedido</p>
                                        <div className="space-y-2">
                                            {formatarItens(pedido.itens).map((item, i) => (
                                                <div key={i} className="flex items-start gap-2 text-sm text-gray-300 border-b border-white/5 last:border-0 pb-1 last:pb-0">
                                                    <span className="text-gold font-bold">•</span>
                                                    {item}
                                                </div>
                                            ))}
                                        </div>
                                        {pedido.observacoes && (
                                            <div className="mt-3 text-xs text-yellow-500 bg-yellow-500/5 p-2 rounded border border-yellow-500/10">
                                                ⚠️ {pedido.observacoes}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-2 pt-2">
                                    <div className="flex gap-2 w-full">
                                        <Button variant="ghost" size="icon" onClick={() => handlePrint(pedido)} className="text-gray-400 hover:text-white hover:bg-white/10">
                                            <Printer size={18} />
                                        </Button>
                                        
                                        {pedido.status === 'pendente' && (
                                            <Button onClick={() => atualizarStatus(pedido.id, 'preparando')} className="flex-1 bg-blue-600 hover:bg-blue-500 font-bold text-xs uppercase tracking-wide">
                                                <CheckCircle size={14} className="mr-2" /> Aceitar
                                            </Button>
                                        )}
                                        {pedido.status === 'preparando' && (
                                            <Button onClick={() => atualizarStatus(pedido.id, 'saiu')} className="flex-1 bg-purple-600 hover:bg-purple-500 font-bold text-xs uppercase tracking-wide">
                                                <Truck size={14} className="mr-2" /> Despachar
                                            </Button>
                                        )}
                                        {pedido.status === 'saiu' && (
                                            <Button onClick={() => atualizarStatus(pedido.id, 'entregue')} className="flex-1 bg-green-600 hover:bg-green-500 font-bold text-xs uppercase tracking-wide">
                                                <CheckCircle size={14} className="mr-2" /> Concluir
                                            </Button>
                                        )}
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => atualizarStatus(pedido.id, 'cancelado')} className="text-red-500 hover:bg-red-500/10">
                                        <XCircle size={18} />
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
