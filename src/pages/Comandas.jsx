import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Header } from '../components/Header'
import {
    UtensilsCrossed,
    Clock,
    CreditCard,
    Banknote,
    QrCode,
    X,
    Printer,
    Check,
    DollarSign,
    RefreshCw
} from 'lucide-react'

export function Comandas() {
    const [comandas, setComandas] = useState([])
    const [loading, setLoading] = useState(true)
    const [comandaSelecionada, setComandaSelecionada] = useState(null)
    const [itensComanda, setItensComanda] = useState([])
    const [showPagamento, setShowPagamento] = useState(false)

    useEffect(() => {
        fetchComandas()

        // Realtime updates
        const channel = supabase
            .channel('comandas-changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'comandas' },
                () => fetchComandas()
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'itens_comanda' },
                () => {
                    fetchComandas()
                    if (comandaSelecionada) {
                        fetchItensComanda(comandaSelecionada.id)
                    }
                }
            )
            .subscribe()

        return () => supabase.removeChannel(channel)
    }, [comandaSelecionada])

    const fetchComandas = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('comandas')
            .select(`
                *,
                mesas (numero)
            `)
            .eq('status', 'aberta')
            .order('created_at', { ascending: true })

        if (data) setComandas(data)
        setLoading(false)
    }

    const fetchItensComanda = async (comandaId) => {
        const { data } = await supabase
            .from('itens_comanda')
            .select('*')
            .eq('comanda_id', comandaId)
            .order('created_at', { ascending: true })

        setItensComanda(data || [])
    }

    const abrirComanda = async (comanda) => {
        setComandaSelecionada(comanda)
        fetchItensComanda(comanda.id)
    }

    const fecharComanda = async (formaPagamento) => {
        if (!comandaSelecionada) return

        // Atualizar comanda
        await supabase
            .from('comandas')
            .update({
                status: 'fechada',
                forma_pagamento: formaPagamento,
                closed_at: new Date().toISOString()
            })
            .eq('id', comandaSelecionada.id)

        // Liberar mesa
        await supabase
            .from('mesas')
            .update({ status: 'livre' })
            .eq('id', comandaSelecionada.mesa_id)

        // Fechar modal
        setShowPagamento(false)
        setComandaSelecionada(null)
        setItensComanda([])
        fetchComandas()
    }

    const formatarPreco = (valor) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor || 0)
    }

    const formatarHora = (data) => {
        return new Date(data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }

    const calcularTempoAberto = (dataAbertura) => {
        const agora = new Date()
        const abertura = new Date(dataAbertura)
        const diffMs = agora - abertura
        const diffMins = Math.floor(diffMs / 60000)
        const horas = Math.floor(diffMins / 60)
        const mins = diffMins % 60
        return horas > 0 ? `${horas}h ${mins}min` : `${mins}min`
    }

    const imprimirConta = () => {
        if (!comandaSelecionada) return

        const printWindow = window.open('', '_blank', 'width=300,height=600')
        printWindow.document.write(`
            <html>
                <head>
                    <title>Conta Mesa ${comandaSelecionada.mesas?.numero || comandaSelecionada.mesa_id}</title>
                    <style>
                        body { font-family: 'Courier New', monospace; padding: 10px; font-size: 12px; max-width: 300px; margin: 0 auto; }
                        .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
                        .title { font-size: 16px; font-weight: bold; margin: 0; }
                        .items { width: 100%; margin: 10px 0; }
                        .item { display: flex; justify-content: space-between; padding: 3px 0; }
                        .total { font-size: 16px; font-weight: bold; text-align: right; border-top: 2px dashed #000; padding-top: 10px; margin-top: 10px; }
                        .footer { text-align: center; margin-top: 20px; font-size: 10px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <p class="title">IMPÉRIO DAS PORÇÕES</p>
                        <p>Mesa ${comandaSelecionada.mesas?.numero || comandaSelecionada.mesa_id}</p>
                        <p>Comanda #${comandaSelecionada.id}</p>
                        <p>${new Date().toLocaleString('pt-BR')}</p>
                    </div>
                    
                    <div class="items">
                        ${itensComanda.map(item => `
                            <div class="item">
                                <span>${item.quantidade}x ${item.nome_produto}</span>
                                <span>${formatarPreco(item.quantidade * item.preco_unitario)}</span>
                            </div>
                        `).join('')}
                    </div>

                    <div class="total">
                        TOTAL: ${formatarPreco(comandaSelecionada.valor_total)}
                    </div>

                    <div class="footer">
                        <p>Obrigado pela preferência!</p>
                        <p>www.imperiodasporcoes.com.br</p>
                    </div>

                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
            </html>
        `)
        printWindow.document.close()
    }

    return (
        <div className="min-h-screen">
            <Header title="Comandas Abertas" onRefresh={fetchComandas} />

            <div className="p-6">
                {/* Grid de Comandas */}
                {loading ? (
                    <div className="text-center py-12 text-gray-500">Carregando...</div>
                ) : comandas.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-xl border border-gray-800">
                        <UtensilsCrossed size={48} className="mx-auto text-gray-600 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Nenhuma comanda aberta</h3>
                        <p className="text-gray-500">As comandas aparecerão aqui quando o garçom abrir</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {comandas.map(comanda => (
                            <button
                                key={comanda.id}
                                onClick={() => abrirComanda(comanda)}
                                className="bg-card rounded-xl border border-gray-800 p-4 text-left hover:border-gold/50 transition-colors"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                            <UtensilsCrossed size={20} className="text-purple-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">Mesa {comanda.mesas?.numero || comanda.mesa_id}</h3>
                                            <p className="text-gray-500 text-xs">Comanda #{comanda.id}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400 flex items-center gap-1">
                                            <Clock size={14} />
                                            Aberta há
                                        </span>
                                        <span>{calcularTempoAberto(comanda.created_at)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Total</span>
                                        <span className="text-gold font-bold text-lg">
                                            {formatarPreco(comanda.valor_total)}
                                        </span>
                                    </div>
                                </div>

                                {comanda.garcom && (
                                    <p className="text-gray-500 text-xs mt-3">
                                        Garçom: {comanda.garcom}
                                    </p>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal de Detalhes da Comanda */}
            {comandaSelecionada && !showPagamento && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-xl w-full max-w-lg border border-gray-800 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-gray-800">
                            <div>
                                <h2 className="text-lg font-bold">
                                    Mesa {comandaSelecionada.mesas?.numero || comandaSelecionada.mesa_id}
                                </h2>
                                <p className="text-gray-500 text-sm">
                                    Comanda #{comandaSelecionada.id} • Aberta às {formatarHora(comandaSelecionada.created_at)}
                                </p>
                            </div>
                            <button
                                onClick={() => setComandaSelecionada(null)}
                                className="p-2 text-gray-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {itensComanda.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">Comanda vazia</p>
                            ) : (
                                <div className="space-y-3">
                                    {itensComanda.map(item => (
                                        <div
                                            key={item.id}
                                            className="flex justify-between items-start bg-gray-800/50 rounded-lg p-3"
                                        >
                                            <div>
                                                <p className="font-medium">
                                                    {item.quantidade}x {item.nome_produto}
                                                </p>
                                                <p className="text-gray-500 text-xs">
                                                    {formatarHora(item.created_at)}
                                                    {item.garcom && ` • ${item.garcom}`}
                                                </p>
                                                {item.observacao && (
                                                    <p className="text-gray-400 text-xs mt-1">
                                                        Obs: {item.observacao}
                                                    </p>
                                                )}
                                            </div>
                                            <span className="text-gold font-bold">
                                                {formatarPreco(item.quantidade * item.preco_unitario)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-800">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-xl">Total</span>
                                <span className="text-2xl font-bold text-gold">
                                    {formatarPreco(comandaSelecionada.valor_total)}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={imprimirConta}
                                    className="py-3 bg-gray-700 rounded-lg flex items-center justify-center gap-2"
                                >
                                    <Printer size={18} />
                                    Imprimir
                                </button>
                                <button
                                    onClick={() => setShowPagamento(true)}
                                    className="py-3 bg-green-600 rounded-lg font-bold flex items-center justify-center gap-2"
                                >
                                    <DollarSign size={18} />
                                    Fechar Conta
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Pagamento */}
            {showPagamento && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-xl w-full max-w-md border border-gray-800">
                        <div className="flex items-center justify-between p-4 border-b border-gray-800">
                            <h3 className="text-xl font-bold">Forma de Pagamento</h3>
                            <button
                                onClick={() => setShowPagamento(false)}
                                className="p-2 text-gray-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4">
                            <div className="text-center mb-6">
                                <p className="text-gray-400">
                                    Mesa {comandaSelecionada?.mesas?.numero || comandaSelecionada?.mesa_id}
                                </p>
                                <p className="text-4xl font-bold text-gold">
                                    {formatarPreco(comandaSelecionada?.valor_total)}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => fecharComanda('dinheiro')}
                                    className="p-6 bg-green-600/20 border border-green-600 rounded-xl flex flex-col items-center gap-2 hover:bg-green-600/30"
                                >
                                    <Banknote size={32} className="text-green-400" />
                                    <span className="font-medium">Dinheiro</span>
                                </button>

                                <button
                                    onClick={() => fecharComanda('pix')}
                                    className="p-6 bg-cyan-600/20 border border-cyan-600 rounded-xl flex flex-col items-center gap-2 hover:bg-cyan-600/30"
                                >
                                    <QrCode size={32} className="text-cyan-400" />
                                    <span className="font-medium">PIX</span>
                                </button>

                                <button
                                    onClick={() => fecharComanda('debito')}
                                    className="p-6 bg-blue-600/20 border border-blue-600 rounded-xl flex flex-col items-center gap-2 hover:bg-blue-600/30"
                                >
                                    <CreditCard size={32} className="text-blue-400" />
                                    <span className="font-medium">Débito</span>
                                </button>

                                <button
                                    onClick={() => fecharComanda('credito')}
                                    className="p-6 bg-purple-600/20 border border-purple-600 rounded-xl flex flex-col items-center gap-2 hover:bg-purple-600/30"
                                >
                                    <CreditCard size={32} className="text-purple-400" />
                                    <span className="font-medium">Crédito</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
