import { useState, useEffect } from 'react'
import { Header } from '../components/Header'
import { supabase } from '../lib/supabase'
import { Calendar, Download } from 'lucide-react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line
} from 'recharts'

const COLORS = ['#D4AF37', '#22c55e', '#3b82f6', '#ef4444', '#a855f7', '#f59e0b']

export function Reports() {
    const [dateRange, setDateRange] = useState('7')
    const [revenueData, setRevenueData] = useState([])
    const [paymentData, setPaymentData] = useState([])
    const [neighborhoodData, setNeighborhoodData] = useState([])
    const [totals, setTotals] = useState({ pedidos: 0, faturamento: 0 })
    const [loading, setLoading] = useState(true)

    const fetchData = async () => {
        setLoading(true)

        const daysAgo = parseInt(dateRange)
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - daysAgo)

        const { data: pedidos } = await supabase
            .from('pedidos')
            .select('*')
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: true })

        if (pedidos) {
            // Totais
            const totalPedidos = pedidos.length
            const totalFaturamento = pedidos.reduce((sum, p) => sum + (parseFloat(p.valor_total) || 0), 0)
            setTotals({ pedidos: totalPedidos, faturamento: totalFaturamento })

            // Faturamento por dia
            const revenueByDay = {}
            pedidos.forEach(p => {
                const date = new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                revenueByDay[date] = (revenueByDay[date] || 0) + (parseFloat(p.valor_total) || 0)
            })
            setRevenueData(Object.entries(revenueByDay).map(([dia, valor]) => ({ dia, valor })))

            // Formas de pagamento
            const paymentCounts = {}
            pedidos.forEach(p => {
                const forma = p.forma_pagamento || 'Não informado'
                paymentCounts[forma] = (paymentCounts[forma] || 0) + 1
            })
            setPaymentData(Object.entries(paymentCounts).map(([name, value]) => ({ name, value })))

            // Bairros
            const neighborhoodCounts = {}
            pedidos.forEach(p => {
                const bairro = p.bairro || 'Não informado'
                neighborhoodCounts[bairro] = (neighborhoodCounts[bairro] || 0) + 1
            })
            const sortedNeighborhoods = Object.entries(neighborhoodCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([bairro, pedidos]) => ({ bairro, pedidos }))
            setNeighborhoodData(sortedNeighborhoods)
        }

        setLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [dateRange])

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value)
    }

    const exportCSV = () => {
        const headers = ['Data', 'Faturamento']
        const rows = revenueData.map(d => [d.dia, d.valor])
        const csv = [headers, ...rows].map(row => row.join(',')).join('\n')

        const blob = new Blob([csv], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `relatorio_${dateRange}dias.csv`
        a.click()
    }

    return (
        <div className="min-h-screen">
            <Header title="Relatórios" onRefresh={fetchData} />

            <div className="p-6 space-y-6">
                {/* Filters */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Calendar size={20} className="text-gray-400" />
                            <select
                                value={dateRange}
                                onChange={(e) => setDateRange(e.target.value)}
                                className="bg-card border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-gold"
                            >
                                <option value="7">Últimos 7 dias</option>
                                <option value="15">Últimos 15 dias</option>
                                <option value="30">Últimos 30 dias</option>
                                <option value="60">Últimos 60 dias</option>
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-gold/20 text-gold rounded-lg hover:bg-gold/30"
                    >
                        <Download size={18} /> Exportar CSV
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-card rounded-xl p-6 border border-gray-800">
                        <p className="text-gray-400 text-sm">Total de Pedidos</p>
                        <p className="text-3xl font-bold mt-2">{totals.pedidos}</p>
                    </div>
                    <div className="bg-card rounded-xl p-6 border border-gray-800">
                        <p className="text-gray-400 text-sm">Faturamento Total</p>
                        <p className="text-3xl font-bold text-gold mt-2">{formatCurrency(totals.faturamento)}</p>
                    </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Revenue Chart */}
                    <div className="bg-card rounded-xl p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold mb-4">Faturamento por Dia</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={revenueData}>
                                    <XAxis dataKey="dia" stroke="#6b7280" />
                                    <YAxis stroke="#6b7280" />
                                    <Tooltip
                                        formatter={(value) => formatCurrency(value)}
                                        contentStyle={{
                                            backgroundColor: '#1a1a1a',
                                            border: '1px solid #333',
                                            borderRadius: '8px'
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="valor"
                                        stroke="#D4AF37"
                                        strokeWidth={2}
                                        dot={{ fill: '#D4AF37' }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="bg-card rounded-xl p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold mb-4">Formas de Pagamento</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={paymentData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {paymentData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1a1a1a',
                                            border: '1px solid #333',
                                            borderRadius: '8px'
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Top Neighborhoods */}
                    <div className="bg-card rounded-xl p-6 border border-gray-800 lg:col-span-2">
                        <h3 className="text-lg font-semibold mb-4">Top 5 Bairros</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={neighborhoodData} layout="vertical">
                                    <XAxis type="number" stroke="#6b7280" />
                                    <YAxis dataKey="bairro" type="category" stroke="#6b7280" width={100} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1a1a1a',
                                            border: '1px solid #333',
                                            borderRadius: '8px'
                                        }}
                                    />
                                    <Bar dataKey="pedidos" fill="#D4AF37" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
