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
    Clock,
    Package
} from 'lucide-react'

export function PDV() {
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
    const searchRef = useRef(null)

    useEffect(() => {
        fetchData()
        verificarCaixa()
        // Focus na busca
        searchRef.current?.focus()
    }, [])

    const fetchData = async () => {
        const { data: cats } = await supabase
            .from('categorias')
            .select('*')
            .eq('ativo', true)
            .order('ordem')

        if (cats) setCategorias(cats)

        const { data: prods } = await supabase
            .from('produtos')
            .select('*')
            .eq('disponivel', true)
            .order('nome')

        if (prods) setProdutos(prods)
    }

    const verificarCaixa = async () => {
        const { data } = await supabase
            .from('caixa')
            .select('*')
            .eq('status', 'aberto')
            .order('data_abertura', { ascending: false })
            .limit(1)
            .single()

        if (data) {
            setCaixaAberto(data)
        } else {
            setShowAbrirCaixa(true)
        }
    }

    const abrirCaixa = async () => {
        const { data, error } = await supabase
            .from('caixa')
            .insert({
                valor_inicial: parseFloat(valorInicial) || 0,
                operador: 'Admin',
                status: 'aberto'
            })
            .select()
            .single()

        if (data) {
            setCaixaAberto(data)
            setShowAbrirCaixa(false)
            setValorInicial('')
        }
    }

    const fecharCaixa = async () => {
        // Calcular total de vendas
        const { data: vendas } = await supabase
            .from('vendas_pdv')
            .select('total')
            .eq('caixa_id', caixaAberto.id)

        const totalVendas = vendas?.reduce((sum, v) => sum + parseFloat(v.total), 0) || 0
        const valorFinal = parseFloat(caixaAberto.valor_inicial) + totalVendas

        await supabase
            .from('caixa')
            .update({
                status: 'fechado',
                data_fechamento: new Date().toISOString(),
                valor_final: valorFinal
            })
            .eq('id', caixaAberto.id)

        setCaixaAberto(null)
        setShowFecharCaixa(false)
        setShowAbrirCaixa(true)
    }

    const adicionarAoCarrinho = (produto) => {
        const existe = carrinho.find(item => item.id === produto.id)
        if (existe) {
            setCarrinho(carrinho.map(item =>
                item.id === produto.id
                    ? { ...item, quantidade: item.quantidade + 1 }
                    : item
            ))
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

    const removerDoCarrinho = (produtoId) => {
        setCarrinho(carrinho.filter(item => item.id !== produtoId))
    }

    const calcularSubtotal = () => {
        return carrinho.reduce((total, item) => total + (item.preco * item.quantidade), 0)
    }

    const calcularTotal = () => {
        return calcularSubtotal() - desconto
    }

    const finalizarVenda = async (formaPagamento) => {
        if (!caixaAberto || carrinho.length === 0) return

        const itensJson = carrinho.map(item => ({
            id: item.id,
            nome: item.nome,
            preco: item.preco,
            quantidade: item.quantidade
        }))

        const { data, error } = await supabase
            .from('vendas_pdv')
            .insert({
                caixa_id: caixaAberto.id,
                itens: itensJson,
                subtotal: calcularSubtotal(),
                desconto: desconto,
                total: calcularTotal(),
                forma_pagamento: formaPagamento
            })
            .select()
            .single()

        if (data) {
            // Registrar movimentação
            await supabase
                .from('movimentacoes_caixa')
                .insert({
                    caixa_id: caixaAberto.id,
                    tipo: 'entrada',
                    valor: calcularTotal(),
                    descricao: `Venda #${data.id}`,
                    forma_pagamento: formaPagamento
                })

            // Imprimir cupom
            imprimirCupom(data, formaPagamento)

            // Limpar carrinho
            setCarrinho([])
            setDesconto(0)
            setShowPagamento(false)
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
${carrinho.map(item =>
            ` ${item.quantidade}x ${item.nome.substring(0, 20).padEnd(20)} R$ ${(item.preco * item.quantidade).toFixed(2)}`
        ).join('\n')}
────────────────────────────────────
 Subtotal:          R$ ${calcularSubtotal().toFixed(2)}
 Desconto:          R$ ${desconto.toFixed(2)}
 TOTAL:             R$ ${calcularTotal().toFixed(2)}
────────────────────────────────────
 Pagamento: ${formaPagamento.toUpperCase()}
════════════════════════════════════
      Obrigado pela preferência!
════════════════════════════════════
    `

        const printWindow = window.open('', '_blank', 'width=300,height=600')
        printWindow.document.write(`<pre style="font-family: monospace; font-size: 12px;">${cupom}</pre>`)
        printWindow.document.close()
        printWindow.print()
    }

    const formatarPreco = (valor) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor)
    }

    const produtosFiltrados = produtos.filter(p => {
        const matchBusca = p.nome.toLowerCase().includes(busca.toLowerCase())
        const matchCategoria = !categoriaAtiva || p.categoria_id === categoriaAtiva
        return matchBusca && matchCategoria
    })

    // Se caixa não está aberto, mostrar modal
    if (showAbrirCaixa) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
                <div className="bg-[#1a1a1a] rounded-xl p-8 max-w-md w-full border border-gray-800">
                    <div className="text-center mb-6">
                        <span className="text-5xl">💰</span>
                        <h2 className="text-2xl font-bold mt-4">Abrir Caixa</h2>
                        <p className="text-gray-400 mt-2">Informe o valor inicial do caixa</p>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm text-gray-400 mb-2">Valor Inicial (R$)</label>
                        <input
                            type="number"
                            value={valorInicial}
                            onChange={(e) => setValorInicial(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-2xl text-center focus:outline-none focus:border-[#D4AF37]"
                            placeholder="0,00"
                            autoFocus
                        />
                    </div>

                    <button
                        onClick={abrirCaixa}
                        className="w-full py-4 bg-[#D4AF37] text-black font-bold rounded-lg text-lg"
                    >
                        Abrir Caixa
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen bg-[#0a0a0a] flex overflow-hidden">
            {/* Lado Esquerdo - Produtos */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="bg-[#1a1a1a] border-b border-gray-800 p-4">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                ref={searchRef}
                                type="text"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                placeholder="Buscar produto... (F2)"
                                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                            />
                        </div>

                        <button
                            onClick={() => setShowFecharCaixa(true)}
                            className="px-4 py-3 bg-red-500/20 text-red-400 rounded-lg flex items-center gap-2"
                        >
                            <Clock size={18} /> Fechar Caixa
                        </button>
                    </div>

                    {/* Categorias */}
                    <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                        <button
                            onClick={() => setCategoriaAtiva(null)}
                            className={`px-4 py-2 rounded-lg whitespace-nowrap ${!categoriaAtiva ? 'bg-[#D4AF37] text-black' : 'bg-gray-800 text-gray-300'
                                }`}
                        >
                            Todos
                        </button>
                        {categorias.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setCategoriaAtiva(cat.id)}
                                className={`px-4 py-2 rounded-lg whitespace-nowrap ${categoriaAtiva === cat.id ? 'bg-[#D4AF37] text-black' : 'bg-gray-800 text-gray-300'
                                    }`}
                            >
                                {cat.nome}
                            </button>
                        ))}
                    </div>
                </header>

                {/* Grid de Produtos */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {produtosFiltrados.map(produto => (
                            <button
                                key={produto.id}
                                onClick={() => adicionarAoCarrinho(produto)}
                                className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 text-left hover:border-[#D4AF37] transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <Package size={24} className="text-gray-500" />
                                    {produto.destaque && <span className="text-[#D4AF37]">⭐</span>}
                                </div>
                                <h3 className="font-medium mt-2 line-clamp-2">{produto.nome}</h3>
                                <p className="text-[#D4AF37] font-bold mt-2">{formatarPreco(produto.preco)}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Lado Direito - Carrinho */}
            <div className="w-96 bg-[#1a1a1a] border-l border-gray-800 flex flex-col">
                <div className="p-4 border-b border-gray-800">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        🛒 Carrinho
                        <span className="text-sm text-gray-400">
                            ({carrinho.reduce((t, i) => t + i.quantidade, 0)} itens)
                        </span>
                    </h2>
                </div>

                {/* Itens do Carrinho */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {carrinho.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">Carrinho vazio</p>
                    ) : (
                        carrinho.map(item => (
                            <div key={item.id} className="bg-gray-800/50 rounded-lg p-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h4 className="font-medium text-sm">{item.nome}</h4>
                                        <p className="text-[#D4AF37] text-sm">{formatarPreco(item.preco)}</p>
                                    </div>
                                    <button
                                        onClick={() => removerDoCarrinho(item.id)}
                                        className="p-1 hover:bg-red-500/20 rounded"
                                    >
                                        <Trash2 size={16} className="text-red-400" />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between mt-2">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => alterarQuantidade(item.id, -1)}
                                            className="w-7 h-7 bg-gray-700 rounded flex items-center justify-center"
                                        >
                                            <Minus size={14} />
                                        </button>
                                        <span className="w-8 text-center">{item.quantidade}</span>
                                        <button
                                            onClick={() => alterarQuantidade(item.id, 1)}
                                            className="w-7 h-7 bg-[#D4AF37] text-black rounded flex items-center justify-center"
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                    <span className="font-bold">{formatarPreco(item.preco * item.quantidade)}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Totais e Pagamento */}
                <div className="p-4 border-t border-gray-800 space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Subtotal</span>
                            <span>{formatarPreco(calcularSubtotal())}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Desconto</span>
                            <input
                                type="number"
                                value={desconto || ''}
                                onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)}
                                className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-right text-sm"
                                placeholder="0,00"
                            />
                        </div>
                        <div className="flex justify-between text-xl font-bold pt-2 border-t border-gray-700">
                            <span>Total</span>
                            <span className="text-[#D4AF37]">{formatarPreco(calcularTotal())}</span>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowPagamento(true)}
                        disabled={carrinho.length === 0}
                        className="w-full py-4 bg-green-600 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <DollarSign size={20} /> Pagamento
                    </button>
                </div>
            </div>

            {/* Modal de Pagamento */}
            {showPagamento && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1a1a1a] rounded-xl max-w-md w-full border border-gray-800">
                        <div className="flex items-center justify-between p-4 border-b border-gray-800">
                            <h3 className="text-xl font-bold">Forma de Pagamento</h3>
                            <button onClick={() => setShowPagamento(false)} className="p-2 hover:bg-gray-800 rounded">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4">
                            <div className="text-center mb-6">
                                <p className="text-gray-400">Total a pagar</p>
                                <p className="text-4xl font-bold text-[#D4AF37]">{formatarPreco(calcularTotal())}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => finalizarVenda('dinheiro')}
                                    className="p-6 bg-green-600/20 border border-green-600 rounded-xl flex flex-col items-center gap-2 hover:bg-green-600/30"
                                >
                                    <Banknote size={32} className="text-green-400" />
                                    <span className="font-medium">Dinheiro</span>
                                </button>

                                <button
                                    onClick={() => finalizarVenda('pix')}
                                    className="p-6 bg-cyan-600/20 border border-cyan-600 rounded-xl flex flex-col items-center gap-2 hover:bg-cyan-600/30"
                                >
                                    <QrCode size={32} className="text-cyan-400" />
                                    <span className="font-medium">PIX</span>
                                </button>

                                <button
                                    onClick={() => finalizarVenda('debito')}
                                    className="p-6 bg-blue-600/20 border border-blue-600 rounded-xl flex flex-col items-center gap-2 hover:bg-blue-600/30"
                                >
                                    <CreditCard size={32} className="text-blue-400" />
                                    <span className="font-medium">Débito</span>
                                </button>

                                <button
                                    onClick={() => finalizarVenda('credito')}
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

            {/* Modal Fechar Caixa */}
            {showFecharCaixa && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1a1a1a] rounded-xl max-w-md w-full border border-gray-800">
                        <div className="flex items-center justify-between p-4 border-b border-gray-800">
                            <h3 className="text-xl font-bold">Fechar Caixa</h3>
                            <button onClick={() => setShowFecharCaixa(false)} className="p-2 hover:bg-gray-800 rounded">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 text-center">
                            <span className="text-5xl">⚠️</span>
                            <h4 className="text-xl font-bold mt-4">Confirma o fechamento?</h4>
                            <p className="text-gray-400 mt-2">
                                Caixa aberto desde {new Date(caixaAberto?.data_abertura).toLocaleString('pt-BR')}
                            </p>
                            <p className="text-gray-400 mt-1">
                                Valor inicial: {formatarPreco(caixaAberto?.valor_inicial || 0)}
                            </p>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowFecharCaixa(false)}
                                    className="flex-1 py-3 bg-gray-700 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={fecharCaixa}
                                    className="flex-1 py-3 bg-red-600 rounded-lg font-bold"
                                >
                                    Fechar Caixa
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
