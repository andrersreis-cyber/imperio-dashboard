import { useState, useEffect } from 'react'
import { Header } from '../components/Header'
import { MetricCard } from '../components/MetricCard'
import { StatusBadge } from '../components/StatusBadge'
import { supabase } from '../lib/supabase'
import {
    ShoppingBag,
    DollarSign,
    TrendingUp,
    Clock,
    ChevronRight
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
    const [recentOrders, setRecentOrders] = useState([])
    const [hourlyData, setHourlyData] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchData = async () => {
        setLoading(true)

        // Buscar pedidos de hoje
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const { data: pedidos } = await supabase
            .from('pedidos')
            .select('*')
            .gte('created_at', today.toISOString())
            .order('created_at', { ascending: false })

        if (pedidos) {
            const totalPedidos = pedidos.length
            const faturamento = pedidos.reduce((sum, p) => sum + (parseFloat(p.valor_total) || 0), 0)
            const ticketMedio = totalPedidos > 0 ? faturamento / totalPedidos : 0
            const pendentes = pedidos.filter(p => p.status === 'pendente').length

            setMetrics({ totalPedidos, faturamento, ticketMedio, pendentes })
            setRecentOrders(pedidos.slice(0, 5))

            // Dados por hora
            const hourCounts = {}
            for (let i = 19; i <= 23; i++) {
                hourCounts[i] = 0
            }
            pedidos.forEach(p => {
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
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value)
    }

    const formatTime = (dateString) => {
        return new Date(dateString).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div className="min-h-screen">
            <Header title="Dashboard" onRefresh={fetchData} />

            <div className="p-6 space-y-6">
                {/* Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <MetricCard
                        title="Pedidos Hoje"
                        value={metrics.totalPedidos}
                        icon={ShoppingBag}
                        color="gold"
                    />
                    <MetricCard
                        title="Faturamento"
                        value={formatCurrency(metrics.faturamento)}
                        icon={DollarSign}
                        color="green"
                    />
                    <MetricCard
                        title="Ticket Médio"
                        value={formatCurrency(metrics.ticketMedio)}
                        icon={TrendingUp}
                        color="blue"
                    />
                    <MetricCard
                        title="Pendentes"
                        value={metrics.pendentes}
                        icon={Clock}
                        color={metrics.pendentes > 0 ? 'red' : 'gold'}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Chart */}
                    <div className="lg:col-span-2 bg-card rounded-xl p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold mb-4">Pedidos por Hora</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={hourlyData}>
                                    <defs>
                                        <linearGradient id="colorPedidos" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="hora" stroke="#6b7280" />
                                    <YAxis stroke="#6b7280" />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1a1a1a',
                                            border: '1px solid #333',
                                            borderRadius: '8px'
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="pedidos"
                                        stroke="#D4AF37"
                                        fillOpacity={1}
                                        fill="url(#colorPedidos)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Recent Orders */}
                    <div className="bg-card rounded-xl p-6 border border-gray-800">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Últimos Pedidos</h3>
                            <Link to="/pedidos" className="text-gold text-sm hover:underline flex items-center gap-1">
                                Ver todos <ChevronRight size={16} />
                            </Link>
                        </div>

                        <div className="space-y-3">
                            {recentOrders.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">Nenhum pedido hoje</p>
                            ) : (
                                recentOrders.map((order) => (
                                    <div
                                        key={order.id}
                                        className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                                    >
                                        <div>
                                            <p className="font-medium text-sm">#{order.id}</p>
                                            <p className="text-gray-400 text-xs">{formatTime(order.created_at)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-medium text-sm">{formatCurrency(order.valor_total || 0)}</p>
                                            <StatusBadge status={order.status} />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
