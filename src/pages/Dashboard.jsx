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
        <div className="min-h-screen pb-20">
            <Header title="Dashboard" onRefresh={fetchData} />

            <div className="p-4 lg:p-6 space-y-6">
                {/* Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                    <MetricCard
                        title="Pedidos Hoje"
                        value={metrics.totalPedidos}
                        icon={ShoppingBag}
                        color="red"
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
