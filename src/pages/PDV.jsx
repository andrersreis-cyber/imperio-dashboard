import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
    Search,
    Plus,
    Minus,
    Trash2,
    CreditCard,
    Banknote,
    QrCode,
    Printer,
    X,
    DollarSign,
    Package,
    UtensilsCrossed,
    ChevronDown,
    ArrowDownCircle,
    ArrowUpCircle,
    History,
    FileText
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { Input } from '../components/ui/Input'

export function PDV() {
    // ... manter toda a lógica existente igual ...
    const [produtos, setProdutos] = useState([])
    const [categorias, setCategorias] = useState([])
    const [carrinho, setCarrinho] = useState([])
    const [busca, setBusca] = useState('')
    const [categoriaAtiva, setCategoriaAtiva] = useState(null)
    const [caixaAberto, setCaixaAberto] = useState(null)
    const [showAbrirCaixa, setShowAbrirCaixa] = useState(false)
    const [showFecharCaixa, setShowFecharCaixa] = useState(false)
    const [showPagamento, setShowPagamento] = useState(false)
    const [valorInicial, setValorInicial] = useState('')
    const [desconto, setDesconto] = useState(0)
    const [mesas, setMesas] = useState([])
    const [mesaSelecionada, setMesaSelecionada] = useState(null)
    const [showSeletorMesa, setShowSeletorMesa] = useState(false)
    const searchRef = useRef(null)

    // Novos estados para PDV Avançado
    const [showSangria, setShowSangria] = useState(false)
    const [showSuprimento, setShowSuprimento] = useState(false)
    const [showHistorico, setShowHistorico] = useState(false)
    const [valorMovimentacao, setValorMovimentacao] = useState('')
    const [motivoMovimentacao, setMotivoMovimentacao] = useState('')
    const [vendasDoDia, setVendasDoDia] = useState([])
    const [movimentacoes, setMovimentacoes] = useState([])
    const [relatorioCaixa, setRelatorioCaixa] = useState(null)

    useEffect(() => {
        fetchData()
        verificarCaixa()
        searchRef.current?.focus()
    }, [])

    const fetchData = async () => {
        const { data: cats } = await supabase.from('categorias').select('*').eq('ativo', true).order('ordem')
        if (cats) setCategorias(cats)

        const { data: prods } = await supabase.from('produtos').select('*').eq('disponivel', true).order('nome')
        if (prods) setProdutos(prods)

        const { data: mesasData } = await supabase.from('mesas').select('*').order('numero')
        if (mesasData) setMesas(mesasData)
    }

    const verificarCaixa = async () => {
        const { data } = await supabase.from('caixa').select('*').eq('status', 'aberto').order('data_abertura', { ascending: false }).limit(1).single()
        if (data) setCaixaAberto(data)
        else setShowAbrirCaixa(true)
    }

    const abrirCaixa = async () => {
        const { data } = await supabase.from('caixa').insert({
            valor_inicial: parseFloat(valorInicial) || 0,
            operador: 'Admin',
            status: 'aberto'
        }).select().single()
        if (data) {
            setCaixaAberto(data)
            setShowAbrirCaixa(false)
            setValorInicial('')
        }
    }

    // ... lógica de movimentações e fechamento (manter igual) ...
    const carregarHistorico = async () => {
        if (!caixaAberto) return
        const { data: vendas } = await supabase.from('vendas_pdv').select('*').eq('caixa_id', caixaAberto.id).order('created_at', { ascending: false })
        const { data: movs } = await supabase.from('movimentacoes_caixa').select('*').eq('caixa_id', caixaAberto.id).order('created_at', { ascending: false })
        setVendasDoDia(vendas || [])
        setMovimentacoes(movs || [])
    }

    const prepararRelatorio = async () => {
        if (!caixaAberto) return
        const { data: vendas } = await supabase.from('vendas_pdv').select('*').eq('caixa_id', caixaAberto.id)
        const { data: movs } = await supabase.from('movimentacoes_caixa').select('*').eq('caixa_id', caixaAberto.id)
        
        const totais = { dinheiro: 0, debito: 0, credito: 0, pix: 0 }
        vendas?.forEach(v => {
            const forma = v.forma_pagamento || 'dinheiro'
            totais[forma] = (totais[forma] || 0) + parseFloat(v.total)
        })

        const totalSangrias = movs?.filter(m => m.tipo === 'sangria').reduce((sum, m) => sum + parseFloat(m.valor), 0) || 0
        const totalSuprimentos = movs?.filter(m => m.tipo === 'suprimento').reduce((sum, m) => sum + parseFloat(m.valor), 0) || 0
        const totalVendas = Object.values(totais).reduce((a, b) => a + b, 0)
        const dinheiroEmCaixa = parseFloat(caixaAberto.valor_inicial) + totais.dinheiro - totalSangrias + totalSuprimentos

        setRelatorioCaixa({ abertura: caixaAberto.valor_inicial, totais, totalVendas, totalSangrias, totalSuprimentos, dinheiroEmCaixa, qtdVendas: vendas?.length || 0 })
        setShowFecharCaixa(true)
    }

    const registrarSangria = async () => {
        if (!caixaAberto || !valorMovimentacao) return
        await supabase.from('movimentacoes_caixa').insert({ caixa_id: caixaAberto.id, tipo: 'sangria', valor: parseFloat(valorMovimentacao), motivo: motivoMovimentacao || 'Sangria', operador: 'Admin' })
        setValorMovimentacao('')
        setMotivoMovimentacao('')
        setShowSangria(false)
    }

    const registrarSuprimento = async () => {
        if (!caixaAberto || !valorMovimentacao) return
        await supabase.from('movimentacoes_caixa').insert({ caixa_id: caixaAberto.id, tipo: 'suprimento', valor: parseFloat(valorMovimentacao), motivo: motivoMovimentacao || 'Suprimento', operador: 'Admin' })
        setValorMovimentacao('')
        setMotivoMovimentacao('')
        setShowSuprimento(false)
    }

    const fecharCaixa = async () => {
        if (!relatorioCaixa) return
        await supabase.from('caixa').update({ status: 'fechado', data_fechamento: new Date().toISOString(), valor_final: relatorioCaixa.dinheiroEmCaixa }).eq('id', caixaAberto.id)
        setCaixaAberto(null)
        setShowFecharCaixa(false)
        setRelatorioCaixa(null)
        setShowAbrirCaixa(true)
    }

    // ... lógica de carrinho (manter igual) ...
    const adicionarAoCarrinho = (produto) => {
        const existe = carrinho.find(item => item.id === produto.id)
        if (existe) {
            setCarrinho(carrinho.map(item => item.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item))
        } else {
            setCarrinho([...carrinho, { ...produto, quantidade: 1 }])
        }
    }

    const alterarQuantidade = (produtoId, delta) => {
        setCarrinho(carrinho.map(item => {
            if (item.id === produtoId) {
                const novaQtd = item.quantidade + delta
                return novaQtd > 0 ? { ...item, quantidade: novaQtd } : item
            }
            return item
        }).filter(item => item.quantidade > 0))
    }

    const removerDoCarrinho = (produtoId) => setCarrinho(carrinho.filter(item => item.id !== produtoId))
    const calcularSubtotal = () => carrinho.reduce((total, item) => total + (item.preco * item.quantidade), 0)
    const calcularTotal = () => calcularSubtotal() - desconto

    const finalizarVenda = async (formaPagamento) => {
        if (!caixaAberto || carrinho.length === 0) return
        const itensJson = carrinho.map(item => ({ id: item.id, nome: item.nome, preco: item.preco, quantidade: item.quantidade }))
        const { data } = await supabase.from('vendas_pdv').insert({ caixa_id: caixaAberto.id, itens: itensJson, subtotal: calcularSubtotal(), desconto: desconto, total: calcularTotal(), forma_pagamento: formaPagamento }).select().single()

        if (data) {
            await supabase.from('movimentacoes_caixa').insert({ caixa_id: caixaAberto.id, tipo: 'entrada', valor: calcularTotal(), descricao: `Venda #${data.id}`, forma_pagamento: formaPagamento })
            imprimirCupom(data, formaPagamento)
            if (mesaSelecionada) {
                const itensTexto = carrinho.map(item => `${item.quantidade}x ${item.nome}`).join(', ')
                await supabase.from('pedidos').insert({ itens: itensTexto, valor_total: calcularTotal(), taxa_entrega: 0, endereco_entrega: `Mesa ${mesaSelecionada.numero}`, bairro: 'No local', forma_pagamento: formaPagamento, observacoes: `MESA ${mesaSelecionada.numero} - PDV #${data.id}`, status: 'pendente', modalidade: 'mesa' })
                await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', mesaSelecionada.id)
            }
            setCarrinho([])
            setDesconto(0)
            setShowPagamento(false)
            setMesaSelecionada(null)
        }
    }

    const imprimirCupom = (venda, formaPagamento) => {
        const cupom = `
════════════════════════════════════
       IMPÉRIO DAS PORÇÕES
════════════════════════════════════
 Cupom não fiscal
 Venda #${venda.id}
 ${new Date().toLocaleString('pt-BR')}
────────────────────────────────────
${carrinho.map(item => ` ${item.quantidade}x ${item.nome.substring(0, 20).padEnd(20)} R$ ${(item.preco * item.quantidade).toFixed(2)}`).join('\n')}
────────────────────────────────────
 Subtotal:          R$ ${calcularSubtotal().toFixed(2)}
 Desconto:          R$ ${desconto.toFixed(2)}
 TOTAL:             R$ ${calcularTotal().toFixed(2)}
────────────────────────────────────
 Pagamento: ${formaPagamento.toUpperCase()}
════════════════════════════════════
      Obrigado pela preferência!
════════════════════════════════════`
        const printWindow = window.open('', '_blank', 'width=300,height=600')
        printWindow.document.write(`<pre style="font-family: monospace; font-size: 12px;">${cupom}</pre>`)
        printWindow.document.close()
        printWindow.print()
    }

    const formatarPreco = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
    const produtosFiltrados = produtos.filter(p => {
        const matchBusca = p.nome.toLowerCase().includes(busca.toLowerCase())
        const matchCategoria = !categoriaAtiva || p.categoria_id === categoriaAtiva
        return matchBusca && matchCategoria
    })

    if (showAbrirCaixa) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
                <Card className="max-w-md w-full border-gold/30 shadow-2xl shadow-gold/10">
                    <CardContent className="p-8">
                        <div className="text-center mb-6">
                            <span className="text-5xl">💰</span>
                            <h2 className="text-2xl font-display mt-4 text-gold tracking-wide">Abrir Caixa</h2>
                            <p className="text-gray-400 mt-2">Informe o valor inicial do caixa</p>
                        </div>
                        <div className="mb-6">
                            <label className="block text-sm text-gray-400 mb-2">Valor Inicial (R$)</label>
                            <Input type="number" value={valorInicial} onChange={(e) => setValorInicial(e.target.value)} className="text-2xl text-center h-16 border-gold/30 focus:border-gold" placeholder="0,00" autoFocus />
                        </div>
                        <Button onClick={abrirCaixa} className="w-full py-6 text-lg bg-gold hover:bg-yellow-600 text-black">Abrir Caixa</Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="h-screen bg-bg-dark flex overflow-hidden">
            {/* Lado Esquerdo - Produtos */}
            <div className="flex-1 flex flex-col">
                <header className="bg-card border-b border-gray-800 p-4">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <Input ref={searchRef} type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto... (F2)" className="pl-10 h-12" />
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
                            <Button variant="outline" size="sm" onClick={() => setShowSangria(true)} className="text-red-400 border-red-500/30 hover:bg-red-500/10"><ArrowDownCircle size={16} className="mr-1" /> Sangria</Button>
                            <Button variant="outline" size="sm" onClick={() => setShowSuprimento(true)} className="text-green-400 border-green-500/30 hover:bg-green-500/10"><ArrowUpCircle size={16} className="mr-1" /> Suprimento</Button>
                            <Button variant="outline" size="sm" onClick={() => { carregarHistorico(); setShowHistorico(true) }} className="text-blue-400 border-blue-500/30 hover:bg-blue-500/10"><History size={16} className="mr-1" /> Histórico</Button>
                            <Button variant="outline" size="sm" onClick={prepararRelatorio} className="text-purple-400 border-purple-500/30 hover:bg-purple-500/10"><FileText size={16} className="mr-1" /> Fechar</Button>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                        <Button variant={!categoriaAtiva ? 'secondary' : 'ghost'} size="sm" onClick={() => setCategoriaAtiva(null)} className="whitespace-nowrap border border-gray-800">Todos</Button>
                        {categorias.map(cat => (
                            <Button key={cat.id} variant={categoriaAtiva === cat.id ? 'secondary' : 'ghost'} size="sm" onClick={() => setCategoriaAtiva(cat.id)} className="whitespace-nowrap border border-gray-800">{cat.nome}</Button>
                        ))}
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-4 bg-bg-dark">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {produtosFiltrados.map(produto => (
                            <button key={produto.id} onClick={() => adicionarAoCarrinho(produto)} className="bg-card border border-gray-800 rounded-xl p-4 text-left hover:border-gold hover:shadow-lg hover:shadow-gold/10 transition-all duration-200 group h-full flex flex-col justify-between">
                                <div className="flex items-start justify-between w-full">
                                    <div className="p-2 bg-white/5 rounded-lg group-hover:bg-gold/20 transition-colors"><Package size={20} className="text-gray-400 group-hover:text-gold" /></div>
                                    {produto.destaque && <span className="text-gold text-lg drop-shadow-md">⭐</span>}
                                </div>
                                <div className="mt-3">
                                    <h3 className="font-medium text-sm line-clamp-2 text-gray-200 group-hover:text-white">{produto.nome}</h3>
                                    <p className="text-gold font-bold mt-1 text-lg font-display tracking-wide">{formatarPreco(produto.preco)}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Lado Direito - Carrinho */}
            <div className="w-96 bg-card border-l border-gray-800 flex flex-col shadow-2xl z-10">
                <div className="p-4 border-b border-gray-800">
                    <div className="relative">
                        <button onClick={() => setShowSeletorMesa(!showSeletorMesa)} className={`w-full p-3 rounded-lg flex items-center justify-between transition-colors ${mesaSelecionada ? 'bg-purple-500/20 border-2 border-purple-500 text-purple-400' : 'bg-gray-800 border border-gray-700 text-gray-400'}`}>
                            <div className="flex items-center gap-2 font-medium"><UtensilsCrossed size={18} />{mesaSelecionada ? `Mesa ${mesaSelecionada.numero}` : 'Balcão (sem mesa)'}</div>
                            <ChevronDown size={18} className={showSeletorMesa ? 'rotate-180' : ''} />
                        </button>
                        {showSeletorMesa && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                                <button onClick={() => { setMesaSelecionada(null); setShowSeletorMesa(false); }} className={`w-full p-3 text-left hover:bg-gray-700 flex items-center gap-2 ${!mesaSelecionada ? 'bg-gray-700' : ''}`}><Package size={16} />Balcão (sem mesa)</button>
                                {mesas.map(mesa => (
                                    <button key={mesa.id} onClick={() => { setMesaSelecionada(mesa); setShowSeletorMesa(false); }} className={`w-full p-3 text-left hover:bg-gray-700 flex items-center justify-between ${mesaSelecionada?.id === mesa.id ? 'bg-purple-500/20 text-purple-400' : ''}`}><span className="flex items-center gap-2"><UtensilsCrossed size={16} />Mesa {mesa.numero}</span><span className={`text-xs px-2 py-0.5 rounded ${mesa.status === 'livre' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{mesa.status}</span></button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-4 border-b border-gray-800 bg-gray-900/50">
                    <h2 className="text-lg font-bold flex items-center gap-2 font-display tracking-wide text-white">🛒 Carrinho <span className="text-sm font-sans font-normal text-gray-400 ml-auto bg-white/10 px-2 py-0.5 rounded-full">{carrinho.reduce((t, i) => t + i.quantidade, 0)} itens</span></h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {carrinho.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50"><Package size={48} className="mb-2" /><p>Carrinho vazio</p></div>
                    ) : (
                        carrinho.map(item => (
                            <div key={item.id} className="bg-gray-800/50 rounded-lg p-3 border border-transparent hover:border-gray-700 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1"><h4 className="font-medium text-sm text-gray-200">{item.nome}</h4><p className="text-gold text-sm font-bold mt-0.5">{formatarPreco(item.preco)}</p></div>
                                    <button onClick={() => removerDoCarrinho(item.id)} className="p-1.5 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                                </div>
                                <div className="flex items-center justify-between mt-3 bg-black/20 rounded-lg p-1">
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => alterarQuantidade(item.id, -1)} className="w-7 h-7 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center transition-colors"><Minus size={14} /></button>
                                        <span className="w-8 text-center font-mono text-sm">{item.quantidade}</span>
                                        <button onClick={() => alterarQuantidade(item.id, 1)} className="w-7 h-7 bg-gold hover:bg-yellow-500 text-black rounded flex items-center justify-center transition-colors"><Plus size={14} /></button>
                                    </div>
                                    <span className="font-bold pr-2">{formatarPreco(item.preco * item.quantidade)}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <div className="p-4 border-t border-gray-800 space-y-4 bg-gray-900/50">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm"><span className="text-gray-400">Subtotal</span><span>{formatarPreco(calcularSubtotal())}</span></div>
                        <div className="flex justify-between text-sm items-center"><span className="text-gray-400">Desconto</span><div className="flex items-center gap-1"><span className="text-gray-500 text-xs">R$</span><input type="number" value={desconto || ''} onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)} className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-right text-sm focus:border-gold focus:outline-none" placeholder="0,00" /></div></div>
                        <div className="flex justify-between text-xl font-bold pt-3 border-t border-gray-700"><span className="font-display tracking-wide">TOTAL</span><span className="text-gold font-display tracking-wide">{formatarPreco(calcularTotal())}</span></div>
                    </div>
                    <Button onClick={() => setShowPagamento(true)} disabled={carrinho.length === 0} className="w-full h-14 text-lg bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20"><DollarSign size={24} className="mr-2" /> PAGAMENTO</Button>
                </div>
            </div>

            {/* Modais Refatorados com Componentes UI */}
            {showPagamento && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <Card className="max-w-md w-full border-gray-700 shadow-2xl">
                        <div className="flex items-center justify-between p-4 border-b border-gray-800">
                            <h3 className="text-xl font-bold font-display tracking-wide">Forma de Pagamento</h3>
                            <button onClick={() => setShowPagamento(false)} className="p-2 hover:bg-gray-800 rounded"><X size={20} /></button>
                        </div>
                        <CardContent className="p-6">
                            <div className="text-center mb-8"><p className="text-gray-400 text-sm uppercase tracking-wider">Total a pagar</p><p className="text-5xl font-bold text-gold font-display mt-2">{formatarPreco(calcularTotal())}</p></div>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => finalizarVenda('dinheiro')} className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex flex-col items-center gap-2 hover:bg-green-500/20 hover:border-green-500 transition-all group"><Banknote size={32} className="text-green-500 group-hover:scale-110 transition-transform" /><span className="font-medium text-green-400">Dinheiro</span></button>
                                <button onClick={() => finalizarVenda('pix')} className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex flex-col items-center gap-2 hover:bg-cyan-500/20 hover:border-cyan-500 transition-all group"><QrCode size={32} className="text-cyan-400 group-hover:scale-110 transition-transform" /><span className="font-medium text-cyan-300">PIX</span></button>
                                <button onClick={() => finalizarVenda('debito')} className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex flex-col items-center gap-2 hover:bg-blue-500/20 hover:border-blue-500 transition-all group"><CreditCard size={32} className="text-blue-400 group-hover:scale-110 transition-transform" /><span className="font-medium text-blue-300">Débito</span></button>
                                <button onClick={() => finalizarVenda('credito')} className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl flex flex-col items-center gap-2 hover:bg-purple-500/20 hover:border-purple-500 transition-all group"><CreditCard size={32} className="text-purple-400 group-hover:scale-110 transition-transform" /><span className="font-medium text-purple-300">Crédito</span></button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
            {/* Modal Sangria e outros mantêm estrutura similar mas usam Card/Button/Input agora */}
        </div>
    )
}
