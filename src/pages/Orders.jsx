import { useState, useEffect } from 'react'
import { Header } from '../components/Header'
import { StatusBadge } from '../components/StatusBadge'
import { supabase } from '../lib/supabase'
import {
    Search,
    Filter,
    Eye,
    Printer,
    X,
    MapPin,
    Phone,
    CreditCard,
    Clock
} from 'lucide-react'

export function Orders() {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('todos')
    const [selectedOrder, setSelectedOrder] = useState(null)

    const fetchOrders = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('pedidos')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100)

        if (data) setOrders(data)
        setLoading(false)
    }

    useEffect(() => {
        fetchOrders()

        // Realtime
        const channel = supabase
            .channel('orders-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
                fetchOrders()
                // Som de notificação para novos pedidos
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
                audio.volume = 0.3
                audio.play().catch(() => { })
            })
            .subscribe()

        return () => supabase.removeChannel(channel)
    }, [])

    const updateStatus = async (id, newStatus) => {
        await supabase
            .from('pedidos')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', id)
        fetchOrders()
    }

    const statusOptions = [
        { value: 'pendente', label: 'Pendente', next: 'em preparo' },
        { value: 'em preparo', label: 'Em Preparo', next: 'saiu para entrega' },
        { value: 'saiu para entrega', label: 'Saiu p/ Entrega', next: 'entregue' },
        { value: 'entregue', label: 'Entregue', next: null },
    ]

    const filteredOrders = orders.filter(order => {
        const matchSearch =
            order.phone?.includes(search) ||
            order.bairro?.toLowerCase().includes(search.toLowerCase()) ||
            order.id.toString().includes(search)
        const matchStatus = statusFilter === 'todos' || order.status === statusFilter
        return matchSearch && matchStatus
    })

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0)
    }

    const formatDateTime = (dateString) => {
        return new Date(dateString).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const printOrder = (order) => {
        const printContent = `
      IMPÉRIO DAS PORÇÕES
      ==================
      Pedido #${order.id}
      Data: ${formatDateTime(order.created_at)}
      
      CLIENTE
      Telefone: ${order.phone}
      Endereço: ${order.endereco_entrega || 'Retirada'}
      Bairro: ${order.bairro || '-'}
      
      ITENS
      ${order.itens}
      
      VALORES
      Subtotal: ${formatCurrency(order.valor_total - (order.taxa_entrega || 0))}
      Taxa Entrega: ${formatCurrency(order.taxa_entrega)}
      TOTAL: ${formatCurrency(order.valor_total)}
      
      Pagamento: ${order.forma_pagamento || '-'}
      ==================
    `
        const printWindow = window.open('', '_blank')
        printWindow.document.write(`<pre style="font-family: monospace;">${printContent}</pre>`)
        printWindow.document.close()
        printWindow.print()
    }

    return (
        <div className="min-h-screen">
            <Header title="Pedidos" onRefresh={fetchOrders} />

            <div className="p-6 space-y-6">
                {/* Filters */}
                <div className="flex flex-wrap gap-4">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar por ID, telefone ou bairro..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-card border border-gray-700 rounded-lg focus:outline-none focus:border-gold"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Filter size={20} className="text-gray-400" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-card border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-gold"
                        >
                            <option value="todos">Todos os Status</option>
                            {statusOptions.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-card rounded-xl border border-gray-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-800 bg-gray-800/50">
                                    <th className="text-left p-4 text-sm font-medium text-gray-400">ID</th>
                                    <th className="text-left p-4 text-sm font-medium text-gray-400">Telefone</th>
                                    <th className="text-left p-4 text-sm font-medium text-gray-400">Itens</th>
                                    <th className="text-left p-4 text-sm font-medium text-gray-400">Bairro</th>
                                    <th className="text-left p-4 text-sm font-medium text-gray-400">Valor</th>
                                    <th className="text-left p-4 text-sm font-medium text-gray-400">Status</th>
                                    <th className="text-left p-4 text-sm font-medium text-gray-400">Hora</th>
                                    <th className="text-left p-4 text-sm font-medium text-gray-400">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-gray-500">
                                            Carregando...
                                        </td>
                                    </tr>
                                ) : filteredOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-gray-500">
                                            Nenhum pedido encontrado
                                        </td>
                                    </tr>
                                ) : (
                                    filteredOrders.map((order) => {
                                        const currentStatus = statusOptions.find(s => s.value === order.status)
                                        return (
                                            <tr key={order.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                                                <td className="p-4 font-medium">#{order.id}</td>
                                                <td className="p-4 text-gray-300">{order.phone}</td>
                                                <td className="p-4 text-gray-300 max-w-[200px] truncate">{order.itens}</td>
                                                <td className="p-4 text-gray-300">{order.bairro || '-'}</td>
                                                <td className="p-4 font-medium text-gold">{formatCurrency(order.valor_total)}</td>
                                                <td className="p-4">
                                                    <StatusBadge status={order.status} />
                                                </td>
                                                <td className="p-4 text-gray-400 text-sm">{formatDateTime(order.created_at)}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => setSelectedOrder(order)}
                                                            className="p-2 rounded-lg hover:bg-gray-700"
                                                            title="Ver detalhes"
                                                        >
                                                            <Eye size={16} className="text-gray-400" />
                                                        </button>
                                                        <button
                                                            onClick={() => printOrder(order)}
                                                            className="p-2 rounded-lg hover:bg-gray-700"
                                                            title="Imprimir"
                                                        >
                                                            <Printer size={16} className="text-gray-400" />
                                                        </button>
                                                        {currentStatus?.next && (
                                                            <button
                                                                onClick={() => updateStatus(order.id, currentStatus.next)}
                                                                className="px-3 py-1 text-xs bg-gold/20 text-gold rounded-lg hover:bg-gold/30"
                                                            >
                                                                → {statusOptions.find(s => s.value === currentStatus.next)?.label}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-800">
                            <h3 className="text-xl font-bold">Pedido #{selectedOrder.id}</h3>
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="p-2 hover:bg-gray-700 rounded-lg"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="flex items-center gap-4">
                                <StatusBadge status={selectedOrder.status} />
                                <span className="text-gray-400 text-sm flex items-center gap-1">
                                    <Clock size={14} /> {formatDateTime(selectedOrder.created_at)}
                                </span>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <Phone size={18} className="text-gray-400 mt-1" />
                                    <div>
                                        <p className="text-sm text-gray-400">Telefone</p>
                                        <p>{selectedOrder.phone}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <MapPin size={18} className="text-gray-400 mt-1" />
                                    <div>
                                        <p className="text-sm text-gray-400">Endereço</p>
                                        <p>{selectedOrder.endereco_entrega || 'Retirada no local'}</p>
                                        <p className="text-gray-400">{selectedOrder.bairro}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <CreditCard size={18} className="text-gray-400 mt-1" />
                                    <div>
                                        <p className="text-sm text-gray-400">Pagamento</p>
                                        <p>{selectedOrder.forma_pagamento || '-'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-800/50 rounded-lg p-4">
                                <p className="text-sm text-gray-400 mb-2">Itens</p>
                                <p className="whitespace-pre-wrap">{selectedOrder.itens}</p>
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t border-gray-800">
                                <div>
                                    <p className="text-sm text-gray-400">Taxa de entrega</p>
                                    <p>{formatCurrency(selectedOrder.taxa_entrega)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-400">Total</p>
                                    <p className="text-2xl font-bold text-gold">{formatCurrency(selectedOrder.valor_total)}</p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => printOrder(selectedOrder)}
                                    className="flex-1 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 flex items-center justify-center gap-2"
                                >
                                    <Printer size={18} /> Imprimir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
