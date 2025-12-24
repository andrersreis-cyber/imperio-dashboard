import { useState, useEffect } from 'react'
import { Header } from '../components/Header'
import { MetricCard } from '../components/MetricCard'
import { StatusBadge } from '../components/StatusBadge'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { supabase } from '../lib/supabase'
import {
    ShoppingBag,
    DollarSign,
    TrendingUp,
    Clock,
    ChevronRight,
    AlertTriangle,
    UserX
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer
} from 'recharts'

export function Dashboard() {
    const [metrics, setMetrics] = useState({
        totalPedidos: 0,
        faturamento: 0,
        ticketMedio: 0,
        pendentes: 0,
    })
    const [metricsDelta, setMetricsDelta] = useState({
        totalPedidos: 0,
        faturamento: 0,
        ticketMedio: 0,
        pendentes: 0,
    })
    const [agentMetrics, setAgentMetrics] = useState({
        pausados: 0,
    })
    const [recentOrders, setRecentOrders] = useState([])
    const [hourlyData, setHourlyData] = useState([])
    const [loading, setLoading] = useState(true)
    const [clientesPausados, setClientesPausados] = useState([])

    const fetchData = async () => {
        setLoading(true)

        // Datas de referência
        const startToday = new Date()
        startToday.setHours(0, 0, 0, 0)

        const startYesterday = new Date(startToday)
        startYesterday.setDate(startYesterday.getDate() - 1)

        const startLast7 = new Date(startToday)
        startLast7.setDate(startLast7.getDate() - 6) // inclui hoje

        // Pedidos de hoje
        const { data: pedidosHoje } = await supabase
            .from('pedidos')
            .select('*')
            .gte('created_at', startToday.toISOString())
            .order('created_at', { ascending: false })

        // Pedidos de ontem (para delta)
        const { data: pedidosOntem } = await supabase
            .from('pedidos')
            .select('*')
            .gte('created_at', startYesterday.toISOString())
            .lt('created_at', startToday.toISOString())

        // Buscar clientes que precisam de atendimento humano
        const { data: clientes } = await supabase
            .from('dados_cliente')
            .select('telefone, nome_completo, nomewpp, updated_at')
            .eq('atendimento_ia', 'pause')
            .order('updated_at', { ascending: false })

        if (clientes) {
            setClientesPausados(clientes)
            setAgentMetrics({ pausados: clientes.length })
        }

        if (pedidosHoje) {
            const totalPedidos = pedidosHoje.length
            const faturamento = pedidosHoje.reduce((sum, p) => sum + (parseFloat(p.valor_total) || 0), 0)
            const ticketMedio = totalPedidos > 0 ? faturamento / totalPedidos : 0
            const pendentes = pedidosHoje.filter(p => p.status === 'pendente').length

            // Deltas vs. ontem
            let deltaPedidos = 0
            let deltaFaturamento = 0
            let deltaTicket = 0
            let deltaPendentes = 0
            if (pedidosOntem && pedidosOntem.length > 0) {
                const totalOntem = pedidosOntem.length
                const faturamentoOntem = pedidosOntem.reduce((sum, p) => sum + (parseFloat(p.valor_total) || 0), 0)
                const ticketOntem = totalOntem > 0 ? faturamentoOntem / totalOntem : 0
                const pendentesOntem = pedidosOntem.filter(p => p.status === 'pendente').length

                const pct = (hoje, ontem) => {
                    if (ontem === 0) return hoje > 0 ? 100 : 0
                    return Math.round(((hoje - ontem) / ontem) * 100)
                }
                deltaPedidos = pct(totalPedidos, totalOntem)
                deltaFaturamento = pct(faturamento, faturamentoOntem)
                deltaTicket = pct(ticketMedio, ticketOntem)
                deltaPendentes = pct(pendentes, pendentesOntem)
            }

            setMetrics({ totalPedidos, faturamento, ticketMedio, pendentes })
            setMetricsDelta({
                totalPedidos: deltaPedidos,
                faturamento: deltaFaturamento,
                ticketMedio: deltaTicket,
                pendentes: deltaPendentes,
            })
            setRecentOrders(pedidosHoje.slice(0, 5))

            // Dados por hora (0-23)
            const hourCounts = {}
            for (let i = 0; i <= 23; i++) {
                hourCounts[i] = 0
            }
            pedidosHoje.forEach(p => {
                const hour = new Date(p.created_at).getHours()
                if (hourCounts[hour] !== undefined) {
                    hourCounts[hour]++
                }
            })
            setHourlyData(
                Object.entries(hourCounts).map(([hora, pedidos]) => ({
                    hora: `${hora}h`,
                    pedidos
                }))
            )
        }

        setLoading(false)
    }

    useEffect(() => {
        fetchData()

        // Realtime subscription
        const channel = supabase
            .channel('pedidos-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
                fetchData()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'dados_cliente' }, () => {
                fetchData()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            maximumFractionDigits: 2
        }).format(value || 0)
    }

    const formatTime = (dateString) => {
        return new Date(dateString).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div className="min-h-screen pb-20">
            <Header title="Dashboard" onRefresh={fetchData} />

            <div className="p-4 lg:p-6 space-y-6">
                {/* Alerta de Atendimento Humano */}
                {clientesPausados.length > 0 && (
                    <Card className="border-red-500 bg-red-500/10">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-red-400">
                                <AlertTriangle size={20} />
                                Clientes Aguardando Atendimento Humano ({clientesPausados.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {clientesPausados.map((cliente) => {
                                    const telefoneFormatado = cliente.telefone.replace('@s.whatsapp.net', '').replace(/\D/g, '')
                                    const nome = cliente.nome_completo || cliente.nomewpp || 'Cliente sem nome'
                                    const tempoAguardando = new Date() - new Date(cliente.updated_at)
                                    const minutosAguardando = Math.floor(tempoAguardando / 60000)
                                    
                                    return (
                                        <div
                                            key={cliente.telefone}
                                            className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-red-500/30 hover:border-red-500/50 transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-red-500/20 rounded-full">
                                                    <UserX size={18} className="text-red-400" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{nome}</p>
                                                    <p className="text-gray-400 text-sm">{telefoneFormatado}</p>
                                                    <p className="text-red-400 text-xs mt-1">
                                                        Aguardando há {minutosAguardando < 1 ? 'menos de 1 minuto' : `${minutosAguardando} minuto${minutosAguardando > 1 ? 's' : ''}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <Link
                                                to={`/whatsapp?conversation=${encodeURIComponent(cliente.telefone)}`}
                                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Atender
                                            </Link>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
                    <MetricCard
                        title="Pedidos Hoje"
                        value={metrics.totalPedidos}
                        trend={metricsDelta.totalPedidos}
                        icon={ShoppingBag}
                        color="red"
                    />
                    <MetricCard
                        title="Faturamento"
                        value={formatCurrency(metrics.faturamento)}
                        trend={metricsDelta.faturamento}
                        icon={DollarSign}
                        color="green"
                    />
                    <MetricCard
                        title="Ticket Médio"
                        value={formatCurrency(metrics.ticketMedio)}
                        trend={metricsDelta.ticketMedio}
                        icon={TrendingUp}
                        color="blue"
                    />
                    <MetricCard
                        title="Pendentes"
                        value={metrics.pendentes}
                        trend={metricsDelta.pendentes}
                        icon={Clock}
                        color={metrics.pendentes > 0 ? 'red' : 'gold'}
                    />
                    <MetricCard
                        title="Atendimentos IA (pausados)"
                        value={agentMetrics.pausados}
                        subtitle="Clientes aguardando humano"
                        icon={TrendingUp}
                        color={agentMetrics.pausados > 0 ? 'red' : 'gold'}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Chart */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Pedidos por Hora</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={hourlyData}>
                                        <defs>
                                            <linearGradient id="colorPedidos" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#E60000" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#E60000" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="hora" stroke="#6b7280" />
                                        <YAxis stroke="#6b7280" />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1a1a1a',
                                                border: '1px solid #333',
                                                borderRadius: '8px',
                                                color: '#fff'
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="pedidos"
                                            stroke="#E60000"
                                            fillOpacity={1}
                                            fill="url(#colorPedidos)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recent Orders */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle>Últimos Pedidos</CardTitle>
                            <Link to="/pedidos" className="text-gold text-sm hover:text-white transition-colors flex items-center gap-1 font-medium">
                                Ver todos <ChevronRight size={16} />
                            </Link>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {recentOrders.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">Nenhum pedido hoje</p>
                                ) : (
                                    recentOrders.map((order) => (
                                        <div
                                            key={order.id}
                                            className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-transparent hover:border-gold/20 transition-all"
                                        >
                                            <div>
                                                <p className="font-display text-lg text-white">#{order.id}</p>
                                                <p className="text-gray-400 text-xs">{formatTime(order.created_at)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-gold">{formatCurrency(order.valor_total || 0)}</p>
                                                <div className="mt-1">
                                                    <StatusBadge status={order.status} />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
