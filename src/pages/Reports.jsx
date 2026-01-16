import { useState, useEffect } from 'react'
import { Header } from '../components/Header'
import { supabase } from '../lib/supabase'
import { Calendar, Download, Star, ThumbsUp, Truck, Utensils } from 'lucide-react'
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
const SATISFACTION_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#D4AF37'] // Ruim, Regular, Bom, Excelente

export function Reports() {
    const [dateRange, setDateRange] = useState('7')
    const [revenueData, setRevenueData] = useState([])
    const [paymentData, setPaymentData] = useState([])
    const [neighborhoodData, setNeighborhoodData] = useState([])
    const [totals, setTotals] = useState({ pedidos: 0, faturamento: 0 })
    const [satisfactionData, setSatisfactionData] = useState(null)
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

        // Buscar métricas de satisfação
        try {
            const { data: metricas, error: metricasError } = await supabase
                .rpc('metricas_satisfacao', {
                    p_data_inicio: startDate.toISOString().split('T')[0],
                    p_data_fim: new Date().toISOString().split('T')[0]
                })
            
            if (!metricasError && metricas) {
                setSatisfactionData(metricas)
            }
        } catch (e) {
            console.log('Métricas de satisfação ainda não disponíveis:', e)
            setSatisfactionData(null)
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

                {/* Satisfaction Metrics Section */}
                {satisfactionData && satisfactionData.total_avaliacoes > 0 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Star className="text-gold" size={24} />
                            Satisfação dos Clientes
                        </h2>
                        
                        {/* Satisfaction Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-card rounded-xl p-6 border border-gray-800">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-gold/20 rounded-lg">
                                        <Star className="text-gold" size={20} />
                                    </div>
                                    <p className="text-gray-400 text-sm">Média Geral</p>
                                </div>
                                <p className="text-3xl font-bold text-gold">
                                    {satisfactionData.media_geral?.toFixed(1) || '0'}/4
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {satisfactionData.total_avaliacoes} avaliações
                                </p>
                            </div>
                            
                            <div className="bg-card rounded-xl p-6 border border-gray-800">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-orange-500/20 rounded-lg">
                                        <Utensils className="text-orange-500" size={20} />
                                    </div>
                                    <p className="text-gray-400 text-sm">Comida</p>
                                </div>
                                <p className="text-3xl font-bold">
                                    {satisfactionData.media_comida?.toFixed(1) || '0'}/4
                                </p>
                                <div className="mt-2 bg-gray-700 rounded-full h-2">
                                    <div 
                                        className="bg-orange-500 h-2 rounded-full transition-all"
                                        style={{ width: `${(satisfactionData.media_comida / 4) * 100}%` }}
                                    />
                                </div>
                            </div>
                            
                            <div className="bg-card rounded-xl p-6 border border-gray-800">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-blue-500/20 rounded-lg">
                                        <Truck className="text-blue-500" size={20} />
                                    </div>
                                    <p className="text-gray-400 text-sm">Entrega</p>
                                </div>
                                <p className="text-3xl font-bold">
                                    {satisfactionData.media_entrega?.toFixed(1) || '0'}/4
                                </p>
                                <div className="mt-2 bg-gray-700 rounded-full h-2">
                                    <div 
                                        className="bg-blue-500 h-2 rounded-full transition-all"
                                        style={{ width: `${(satisfactionData.media_entrega / 4) * 100}%` }}
                                    />
                                </div>
                            </div>
                            
                            <div className="bg-card rounded-xl p-6 border border-gray-800">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-green-500/20 rounded-lg">
                                        <ThumbsUp className="text-green-500" size={20} />
                                    </div>
                                    <p className="text-gray-400 text-sm">Recomendação</p>
                                </div>
                                <p className="text-3xl font-bold">
                                    {satisfactionData.media_recomendacao?.toFixed(1) || '0'}/4
                                </p>
                                <div className="mt-2 bg-gray-700 rounded-full h-2">
                                    <div 
                                        className="bg-green-500 h-2 rounded-full transition-all"
                                        style={{ width: `${(satisfactionData.media_recomendacao / 4) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Distribution Charts */}
                        {satisfactionData.distribuicao && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Comida Distribution */}
                                <div className="bg-card rounded-xl p-6 border border-gray-800">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Utensils className="text-orange-500" size={18} />
                                        Notas - Comida
                                    </h3>
                                    <div className="space-y-3">
                                        {['4', '3', '2', '1'].map((nota, idx) => {
                                            const count = satisfactionData.distribuicao?.comida?.[nota] || 0
                                            const total = satisfactionData.total_avaliacoes || 1
                                            const percent = (count / total) * 100
                                            const labels = ['😞 Ruim', '😐 Regular', '😊 Bom', '😋 Excelente']
                                            return (
                                                <div key={nota} className="flex items-center gap-3">
                                                    <span className="text-sm w-24">{labels[3 - idx]}</span>
                                                    <div className="flex-1 bg-gray-700 rounded-full h-4">
                                                        <div 
                                                            className="h-4 rounded-full transition-all"
                                                            style={{ 
                                                                width: `${percent}%`,
                                                                backgroundColor: SATISFACTION_COLORS[3 - idx]
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-sm w-8 text-right">{count}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Entrega Distribution */}
                                <div className="bg-card rounded-xl p-6 border border-gray-800">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Truck className="text-blue-500" size={18} />
                                        Notas - Entrega
                                    </h3>
                                    <div className="space-y-3">
                                        {['4', '3', '2', '1'].map((nota, idx) => {
                                            const count = satisfactionData.distribuicao?.entrega?.[nota] || 0
                                            const total = satisfactionData.total_avaliacoes || 1
                                            const percent = (count / total) * 100
                                            const labels = ['😞 Ruim', '😐 Regular', '😊 Bom', '😋 Excelente']
                                            return (
                                                <div key={nota} className="flex items-center gap-3">
                                                    <span className="text-sm w-24">{labels[3 - idx]}</span>
                                                    <div className="flex-1 bg-gray-700 rounded-full h-4">
                                                        <div 
                                                            className="h-4 rounded-full transition-all"
                                                            style={{ 
                                                                width: `${percent}%`,
                                                                backgroundColor: SATISFACTION_COLORS[3 - idx]
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-sm w-8 text-right">{count}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Recomendação Distribution */}
                                <div className="bg-card rounded-xl p-6 border border-gray-800">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <ThumbsUp className="text-green-500" size={18} />
                                        Notas - Recomendação
                                    </h3>
                                    <div className="space-y-3">
                                        {['4', '3', '2', '1'].map((nota, idx) => {
                                            const count = satisfactionData.distribuicao?.recomendacao?.[nota] || 0
                                            const total = satisfactionData.total_avaliacoes || 1
                                            const percent = (count / total) * 100
                                            const labels = ['Não', 'Talvez', 'Provável', 'Certeza!']
                                            return (
                                                <div key={nota} className="flex items-center gap-3">
                                                    <span className="text-sm w-24">{labels[3 - idx]}</span>
                                                    <div className="flex-1 bg-gray-700 rounded-full h-4">
                                                        <div 
                                                            className="h-4 rounded-full transition-all"
                                                            style={{ 
                                                                width: `${percent}%`,
                                                                backgroundColor: SATISFACTION_COLORS[3 - idx]
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-sm w-8 text-right">{count}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Message when no satisfaction data */}
                {(!satisfactionData || satisfactionData.total_avaliacoes === 0) && (
                    <div className="bg-card rounded-xl p-6 border border-gray-800 text-center">
                        <Star className="text-gray-600 mx-auto mb-3" size={40} />
                        <h3 className="text-lg font-semibold text-gray-400">Avaliações de Satisfação</h3>
                        <p className="text-gray-500 mt-2">
                            Ainda não há avaliações no período selecionado.
                        </p>
                        <p className="text-gray-600 text-sm mt-1">
                            Os clientes recebem um quiz de satisfação 30 minutos após a entrega.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
