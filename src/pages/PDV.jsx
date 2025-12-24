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
    // Estados principais
    const [produtos, setProdutos] = useState([])
    const [categorias, setCategorias] = useState([])
    const [carrinho, setCarrinho] = useState([])
    const [busca, setBusca] = useState('')
    const [categoriaAtiva, setCategoriaAtiva] = useState(null)
    const [desconto, setDesconto] = useState(0)
    const [mesas, setMesas] = useState([])
    const [mesaSelecionada, setMesaSelecionada] = useState(null)
    const [showSeletorMesa, setShowSeletorMesa] = useState(false)
    const searchRef = useRef(null)

    // Estados do caixa - CRÍTICOS
    const [caixaAberto, setCaixaAberto] = useState(null)
    const [loading, setLoading] = useState(true)
    const [valorInicial, setValorInicial] = useState('')

    // Estados dos modais
    const [showPagamento, setShowPagamento] = useState(false)
    const [showSangria, setShowSangria] = useState(false)
    const [showSuprimento, setShowSuprimento] = useState(false)
    const [showHistorico, setShowHistorico] = useState(false)
    const [showFecharCaixa, setShowFecharCaixa] = useState(false)

    // Estados para movimentações
    const [valorMovimentacao, setValorMovimentacao] = useState('')
    const [motivoMovimentacao, setMotivoMovimentacao] = useState('')
    const [vendasDoDia, setVendasDoDia] = useState([])
    const [movimentacoes, setMovimentacoes] = useState([])
    const [relatorioCaixa, setRelatorioCaixa] = useState(null)

    // ========== INICIALIZAÇÃO ==========
    useEffect(() => {
        const init = async () => {
            console.log('[PDV] Iniciando componente...')
            await fetchData()
            await verificarCaixa()
            setLoading(false)
            searchRef.current?.focus()
        }
        init()
    }, [])

    // Debug: monitorar estado do caixa
    useEffect(() => {
        console.log('[PDV] Estado atualizado:', { 
            caixaAberto: caixaAberto ? `ID ${caixaAberto.id}` : 'null',
            loading
        })
    }, [caixaAberto, loading])

    // ========== FUNÇÕES DE DADOS ==========
    const fetchData = async () => {
        try {
            const [catsRes, prodsRes, mesasRes] = await Promise.all([
                supabase.from('categorias').select('*').eq('ativo', true).order('ordem'),
                supabase.from('produtos').select('*').eq('disponivel', true).order('nome'),
                supabase.from('mesas').select('*').order('numero')
            ])
            if (catsRes.data) setCategorias(catsRes.data)
            if (prodsRes.data) setProdutos(prodsRes.data)
            if (mesasRes.data) setMesas(mesasRes.data)
        } catch (err) {
            console.error('[PDV] Erro ao carregar dados:', err)
        }
    }

    const verificarCaixa = async () => {
        console.log('[PDV] Verificando caixa no banco...')
        try {
            const { data, error } = await supabase
                .from('caixa')
                .select('*')
                .eq('status', 'aberto')
                .order('data_abertura', { ascending: false })
                .limit(1)
                .single()
            
            if (error && error.code !== 'PGRST116') {
                // PGRST116 = "No rows found" - isso é esperado se não houver caixa aberto
                console.error('[PDV] Erro na query:', error)
                throw error
            }
            
            if (data) {
                console.log('[PDV] ✅ Caixa aberto encontrado:', data.id)
                setCaixaAberto(data)
            } else {
                console.log('[PDV] ⚠️ Nenhum caixa aberto')
                setCaixaAberto(null)
            }
        } catch (error) {
            console.error('[PDV] Erro ao verificar caixa:', error)
            setCaixaAberto(null)
        }
    }

    // ========== FUNÇÕES DO CAIXA ==========
    const abrirCaixa = async () => {
        if (!valorInicial || parseFloat(valorInicial) < 0) {
            alert('Por favor, informe um valor inicial válido.')
            return
        }
        try {
            console.log('[PDV] Abrindo caixa...')
            const { data, error } = await supabase.from('caixa').insert({
                valor_inicial: parseFloat(valorInicial) || 0,
                operador: 'Admin',
                status: 'aberto',
                data_abertura: new Date().toISOString()
            }).select().single()
            
            if (error) throw error
            
            console.log('[PDV] ✅ Caixa aberto com sucesso:', data.id)
            setCaixaAberto(data)
            setValorInicial('')
            alert('Caixa aberto com sucesso!')
        } catch (error) {
            console.error('[PDV] Erro ao abrir caixa:', error)
            alert(`Erro ao abrir caixa: ${error.message}`)
        }
    }

    const registrarSangria = async () => {
        if (!caixaAberto) {
            alert('Erro: Caixa não está aberto.')
            return
        }
        if (!valorMovimentacao || parseFloat(valorMovimentacao) <= 0) {
            alert('Por favor, informe um valor válido.')
            return
        }
        try {
            const { error } = await supabase.from('movimentacoes_caixa').insert({ 
                caixa_id: caixaAberto.id, 
                tipo: 'sangria', 
                valor: parseFloat(valorMovimentacao), 
                descricao: motivoMovimentacao || 'Sangria'
            })
            if (error) throw error
            alert('Sangria registrada com sucesso!')
            setValorMovimentacao('')
            setMotivoMovimentacao('')
            setShowSangria(false)
        } catch (error) {
            console.error('[PDV] Erro ao registrar sangria:', error)
            alert(`Erro: ${error.message}`)
        }
    }

    const registrarSuprimento = async () => {
        if (!caixaAberto) {
            alert('Erro: Caixa não está aberto.')
            return
        }
        if (!valorMovimentacao || parseFloat(valorMovimentacao) <= 0) {
            alert('Por favor, informe um valor válido.')
            return
        }
        try {
            const { error } = await supabase.from('movimentacoes_caixa').insert({ 
                caixa_id: caixaAberto.id, 
                tipo: 'suprimento', 
                valor: parseFloat(valorMovimentacao), 
                descricao: motivoMovimentacao || 'Suprimento'
            })
            if (error) throw error
            alert('Suprimento registrado com sucesso!')
            setValorMovimentacao('')
            setMotivoMovimentacao('')
            setShowSuprimento(false)
        } catch (error) {
            console.error('[PDV] Erro ao registrar suprimento:', error)
            alert(`Erro: ${error.message}`)
        }
    }

    const carregarHistorico = async () => {
        if (!caixaAberto) return
        try {
            const [vendasRes, movsRes] = await Promise.all([
                supabase.from('vendas_pdv').select('*').eq('caixa_id', caixaAberto.id).order('created_at', { ascending: false }),
                supabase.from('movimentacoes_caixa').select('*').eq('caixa_id', caixaAberto.id).order('created_at', { ascending: false })
            ])
            setVendasDoDia(vendasRes.data || [])
            setMovimentacoes(movsRes.data || [])
        } catch (error) {
            console.error('[PDV] Erro ao carregar histórico:', error)
        }
    }

    const prepararRelatorio = async () => {
        if (!caixaAberto) return
        try {
            const [vendasRes, movsRes] = await Promise.all([
                supabase.from('vendas_pdv').select('*').eq('caixa_id', caixaAberto.id),
                supabase.from('movimentacoes_caixa').select('*').eq('caixa_id', caixaAberto.id)
            ])
            
            const vendas = vendasRes.data || []
            const movs = movsRes.data || []
            
            const totais = { dinheiro: 0, debito: 0, credito: 0, pix: 0 }
            vendas.forEach(v => {
                const forma = v.forma_pagamento || 'dinheiro'
                totais[forma] = (totais[forma] || 0) + parseFloat(v.total || 0)
            })

            const totalSangrias = movs.filter(m => m.tipo === 'sangria').reduce((sum, m) => sum + parseFloat(m.valor || 0), 0)
            const totalSuprimentos = movs.filter(m => m.tipo === 'suprimento').reduce((sum, m) => sum + parseFloat(m.valor || 0), 0)
            const totalVendas = Object.values(totais).reduce((a, b) => a + b, 0)
            const dinheiroEmCaixa = parseFloat(caixaAberto.valor_inicial || 0) + totais.dinheiro - totalSangrias + totalSuprimentos

            setRelatorioCaixa({ 
                abertura: caixaAberto.valor_inicial, 
                totais, 
                totalVendas, 
                totalSangrias, 
                totalSuprimentos, 
                dinheiroEmCaixa, 
                qtdVendas: vendas.length 
            })
            setShowFecharCaixa(true)
        } catch (error) {
            console.error('[PDV] Erro ao preparar relatório:', error)
            alert(`Erro: ${error.message}`)
        }
    }

    const fecharCaixa = async () => {
        if (!relatorioCaixa || !caixaAberto) return
        try {
            const { error } = await supabase
                .from('caixa')
                .update({ 
                    status: 'fechado', 
                    data_fechamento: new Date().toISOString(), 
                    valor_final: relatorioCaixa.dinheiroEmCaixa 
                })
                .eq('id', caixaAberto.id)
            
            if (error) throw error
            
            alert('Caixa fechado com sucesso!')
            setCaixaAberto(null)
            setShowFecharCaixa(false)
            setRelatorioCaixa(null)
        } catch (error) {
            console.error('[PDV] Erro ao fechar caixa:', error)
            alert(`Erro: ${error.message}`)
        }
    }

    // ========== FUNÇÕES DO CARRINHO ==========
    const adicionarAoCarrinho = (produto) => {
        const existe = carrinho.find(item => item.id === produto.id)
        if (existe) {
            setCarrinho(carrinho.map(item => 
                item.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item
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

    const removerDoCarrinho = (produtoId) => setCarrinho(carrinho.filter(item => item.id !== produtoId))
    const calcularSubtotal = () => carrinho.reduce((total, item) => total + (item.preco * item.quantidade), 0)
    const calcularTotal = () => calcularSubtotal() - desconto

    const finalizarVenda = async (formaPagamento) => {
        if (!caixaAberto) {
            alert('Erro: Caixa não está aberto.')
            return
        }
        if (carrinho.length === 0) {
            alert('Carrinho vazio.')
            return
        }
        
        try {
            const itensJson = carrinho.map(item => ({ 
                id: item.id, 
                nome: item.nome, 
                preco: item.preco, 
                quantidade: item.quantidade 
            }))
            
            const { data, error } = await supabase.from('vendas_pdv').insert({ 
                caixa_id: caixaAberto.id, 
                itens: itensJson, 
                subtotal: calcularSubtotal(), 
                desconto: desconto, 
                total: calcularTotal(), 
                forma_pagamento: formaPagamento 
            }).select().single()

            if (error) throw error

            await supabase.from('movimentacoes_caixa').insert({ 
                caixa_id: caixaAberto.id, 
                tipo: 'entrada', 
                valor: calcularTotal(), 
                descricao: `Venda #${data.id}`, 
                forma_pagamento: formaPagamento 
            })

            imprimirCupom(data, formaPagamento)
            
            if (mesaSelecionada) {
                const itensTexto = carrinho.map(item => `${item.quantidade}x ${item.nome}`).join(', ')
                await supabase.from('pedidos').insert({ 
                    itens: itensTexto, 
                    valor_total: calcularTotal(), 
                    taxa_entrega: 0, 
                    endereco_entrega: `Mesa ${mesaSelecionada.numero}`, 
                    bairro: 'No local', 
                    forma_pagamento: formaPagamento, 
                    observacoes: `MESA ${mesaSelecionada.numero} - PDV #${data.id}`, 
                    status: 'pendente', 
                    modalidade: 'mesa' 
                })
                await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', mesaSelecionada.id)
            }
            
            setCarrinho([])
            setDesconto(0)
            setShowPagamento(false)
            setMesaSelecionada(null)
        } catch (error) {
            console.error('[PDV] Erro ao finalizar venda:', error)
            alert(`Erro: ${error.message}`)
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
        if (printWindow) {
            printWindow.document.write(`<pre style="font-family: monospace; font-size: 12px;">${cupom}</pre>`)
            printWindow.document.close()
            printWindow.print()
        }
    }

    // ========== UTILITÁRIOS ==========
    const formatarPreco = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
    
    const produtosFiltrados = produtos.filter(p => {
        const matchBusca = p.nome.toLowerCase().includes(busca.toLowerCase())
        const matchCategoria = !categoriaAtiva || p.categoria_id === categoriaAtiva
        return matchBusca && matchCategoria
    })

    // ========== RENDERIZAÇÃO ==========
    
    // 1. Loading
    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold mx-auto"></div>
                    <p className="text-gray-400 mt-4">Carregando PDV...</p>
                </div>
            </div>
        )
    }

    // 2. Caixa não aberto
    if (!caixaAberto) {
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
                            <Input 
                                type="number" 
                                value={valorInicial} 
                                onChange={(e) => setValorInicial(e.target.value)} 
                                className="text-2xl text-center h-16 border-gold/30 focus:border-gold" 
                                placeholder="0,00" 
                                autoFocus 
                            />
                        </div>
                        <Button 
                            onClick={abrirCaixa} 
                            className="w-full py-6 text-lg bg-gold hover:bg-yellow-600 text-black"
                        >
                            Abrir Caixa
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // 3. Tela principal do PDV (caixa aberto)
    return (
        <div className="h-screen bg-bg-dark flex overflow-hidden">
            {/* Lado Esquerdo - Produtos */}
            <div className="flex-1 flex flex-col">
                <header className="bg-card border-b border-gray-800 p-4">
                    {/* DEBUG HEADER - REMOVER DEPOIS */}
                    <div className="bg-red-600 text-white text-center font-bold p-1 mb-2">
                        VERSÃO ATUALIZADA - {new Date().toLocaleTimeString()}
                    </div>

                    {/* Banner de status do caixa */}
                    <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-green-400 font-bold">✅ CAIXA ABERTO</span>
                            <span className="text-gray-400 text-sm">
                                #{caixaAberto.id} | Abertura: {formatarPreco(caixaAberto.valor_inicial)} | {caixaAberto.operador}
                            </span>
                        </div>
                    </div>

                    {/* Busca e botões de ação */}
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <Input 
                                ref={searchRef} 
                                type="text" 
                                value={busca} 
                                onChange={(e) => setBusca(e.target.value)} 
                                placeholder="Buscar produto..." 
                                className="pl-10 h-12" 
                            />
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
                            <button 
                                type="button"
                                onClick={() => {
                                    console.log('[PDV] Click Sangria')
                                    setShowSangria(true)
                                }} 
                                className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border text-red-400 border-red-500/30 hover:bg-red-500/10"
                            >
                                <ArrowDownCircle size={16} /> Sangria
                            </button>
                            <button 
                                type="button"
                                onClick={() => {
                                    console.log('[PDV] Click Suprimento')
                                    setShowSuprimento(true)
                                }} 
                                className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border text-green-400 border-green-500/30 hover:bg-green-500/10"
                            >
                                <ArrowUpCircle size={16} /> Suprimento
                            </button>
                            <button 
                                type="button"
                                onClick={async () => {
                                    console.log('[PDV] Click Histórico')
                                    await carregarHistorico()
                                    setShowHistorico(true)
                                }} 
                                className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                            >
                                <History size={16} /> Histórico
                            </button>
                            <button 
                                type="button"
                                onClick={async () => {
                                    console.log('[PDV] Click Fechar')
                                    await prepararRelatorio()
                                }} 
                                className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
                            >
                                <FileText size={16} /> Fechar
                            </button>
                        </div>
                    </div>

                    {/* Categorias */}
                    <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                        <Button 
                            variant={!categoriaAtiva ? 'secondary' : 'ghost'} 
                            size="sm" 
                            onClick={() => setCategoriaAtiva(null)} 
                            className="whitespace-nowrap border border-gray-800"
                        >
                            Todos
                        </Button>
                        {categorias.map(cat => (
                            <Button 
                                key={cat.id} 
                                variant={categoriaAtiva === cat.id ? 'secondary' : 'ghost'} 
                                size="sm" 
                                onClick={() => setCategoriaAtiva(cat.id)} 
                                className="whitespace-nowrap border border-gray-800"
                            >
                                {cat.nome}
                            </Button>
                        ))}
                    </div>
                </header>

                {/* Grade de produtos */}
                <div className="flex-1 overflow-y-auto p-4 bg-bg-dark">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {produtosFiltrados.map(produto => (
                            <button 
                                key={produto.id} 
                                onClick={() => adicionarAoCarrinho(produto)} 
                                className="bg-card border border-gray-800 rounded-xl p-4 text-left hover:border-gold hover:shadow-lg hover:shadow-gold/10 transition-all duration-200 group h-full flex flex-col justify-between"
                            >
                                <div className="flex items-start justify-between w-full">
                                    <div className="p-2 bg-white/5 rounded-lg group-hover:bg-gold/20 transition-colors">
                                        <Package size={20} className="text-gray-400 group-hover:text-gold" />
                                    </div>
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
                {/* Seletor de mesa */}
                <div className="p-4 border-b border-gray-800">
                    <div className="relative">
                        <button 
                            onClick={() => setShowSeletorMesa(!showSeletorMesa)} 
                            className={`w-full p-3 rounded-lg flex items-center justify-between transition-colors ${mesaSelecionada ? 'bg-purple-500/20 border-2 border-purple-500 text-purple-400' : 'bg-gray-800 border border-gray-700 text-gray-400'}`}
                        >
                            <div className="flex items-center gap-2 font-medium">
                                <UtensilsCrossed size={18} />
                                {mesaSelecionada ? `Mesa ${mesaSelecionada.numero}` : 'Balcão (sem mesa)'}
                            </div>
                            <ChevronDown size={18} className={showSeletorMesa ? 'rotate-180' : ''} />
                        </button>
                        {showSeletorMesa && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                                <button 
                                    onClick={() => { setMesaSelecionada(null); setShowSeletorMesa(false); }} 
                                    className={`w-full p-3 text-left hover:bg-gray-700 flex items-center gap-2 ${!mesaSelecionada ? 'bg-gray-700' : ''}`}
                                >
                                    <Package size={16} />Balcão (sem mesa)
                                </button>
                                {mesas.map(mesa => (
                                    <button 
                                        key={mesa.id} 
                                        onClick={() => { setMesaSelecionada(mesa); setShowSeletorMesa(false); }} 
                                        className={`w-full p-3 text-left hover:bg-gray-700 flex items-center justify-between ${mesaSelecionada?.id === mesa.id ? 'bg-purple-500/20 text-purple-400' : ''}`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <UtensilsCrossed size={16} />Mesa {mesa.numero}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${mesa.status === 'livre' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {mesa.status}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Header do carrinho */}
                <div className="p-4 border-b border-gray-800 bg-gray-900/50">
                    <h2 className="text-lg font-bold flex items-center gap-2 font-display tracking-wide text-white">
                        🛒 Carrinho 
                        <span className="text-sm font-sans font-normal text-gray-400 ml-auto bg-white/10 px-2 py-0.5 rounded-full">
                            {carrinho.reduce((t, i) => t + i.quantidade, 0)} itens
                        </span>
                    </h2>
                </div>

                {/* Itens do carrinho */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {carrinho.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
                            <Package size={48} className="mb-2" />
                            <p>Carrinho vazio</p>
                        </div>
                    ) : (
                        carrinho.map(item => (
                            <div key={item.id} className="bg-gray-800/50 rounded-lg p-3 border border-transparent hover:border-gray-700 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h4 className="font-medium text-sm text-gray-200">{item.nome}</h4>
                                        <p className="text-gold text-sm font-bold mt-0.5">{formatarPreco(item.preco)}</p>
                                    </div>
                                    <button onClick={() => removerDoCarrinho(item.id)} className="p-1.5 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-400 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between mt-3 bg-black/20 rounded-lg p-1">
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => alterarQuantidade(item.id, -1)} className="w-7 h-7 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center transition-colors">
                                            <Minus size={14} />
                                        </button>
                                        <span className="w-8 text-center font-mono text-sm">{item.quantidade}</span>
                                        <button onClick={() => alterarQuantidade(item.id, 1)} className="w-7 h-7 bg-gold hover:bg-yellow-500 text-black rounded flex items-center justify-center transition-colors">
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                    <span className="font-bold pr-2">{formatarPreco(item.preco * item.quantidade)}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Totais e botão de pagamento */}
                <div className="p-4 border-t border-gray-800 space-y-4 bg-gray-900/50">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Subtotal</span>
                            <span>{formatarPreco(calcularSubtotal())}</span>
                        </div>
                        <div className="flex justify-between text-sm items-center">
                            <span className="text-gray-400">Desconto</span>
                            <div className="flex items-center gap-1">
                                <span className="text-gray-500 text-xs">R$</span>
                                <input 
                                    type="number" 
                                    value={desconto || ''} 
                                    onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)} 
                                    className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-right text-sm focus:border-gold focus:outline-none" 
                                    placeholder="0,00" 
                                />
                            </div>
                        </div>
                        <div className="flex justify-between text-xl font-bold pt-3 border-t border-gray-700">
                            <span className="font-display tracking-wide">TOTAL</span>
                            <span className="text-gold font-display tracking-wide">{formatarPreco(calcularTotal())}</span>
                        </div>
                    </div>
                    <Button 
                        onClick={() => setShowPagamento(true)} 
                        disabled={carrinho.length === 0} 
                        className="w-full h-14 text-lg bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20"
                    >
                        <DollarSign size={24} className="mr-2" /> PAGAMENTO
                    </Button>
                </div>
            </div>

            {/* ========== MODAIS ========== */}

            {/* Modal Pagamento */}
            {showPagamento && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" style={{ zIndex: 9999 }}>
                    <Card className="max-w-md w-full border-gray-700 shadow-2xl">
                        <div className="flex items-center justify-between p-4 border-b border-gray-800">
                            <h3 className="text-xl font-bold font-display tracking-wide">Forma de Pagamento</h3>
                            <button onClick={() => setShowPagamento(false)} className="p-2 hover:bg-gray-800 rounded">
                                <X size={20} />
                            </button>
                        </div>
                        <CardContent className="p-6">
                            <div className="text-center mb-8">
                                <p className="text-gray-400 text-sm uppercase tracking-wider">Total a pagar</p>
                                <p className="text-5xl font-bold text-gold font-display mt-2">{formatarPreco(calcularTotal())}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => finalizarVenda('dinheiro')} className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex flex-col items-center gap-2 hover:bg-green-500/20 hover:border-green-500 transition-all group">
                                    <Banknote size={32} className="text-green-500 group-hover:scale-110 transition-transform" />
                                    <span className="font-medium text-green-400">Dinheiro</span>
                                </button>
                                <button onClick={() => finalizarVenda('pix')} className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex flex-col items-center gap-2 hover:bg-cyan-500/20 hover:border-cyan-500 transition-all group">
                                    <QrCode size={32} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                                    <span className="font-medium text-cyan-300">PIX</span>
                                </button>
                                <button onClick={() => finalizarVenda('debito')} className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex flex-col items-center gap-2 hover:bg-blue-500/20 hover:border-blue-500 transition-all group">
                                    <CreditCard size={32} className="text-blue-400 group-hover:scale-110 transition-transform" />
                                    <span className="font-medium text-blue-300">Débito</span>
                                </button>
                                <button onClick={() => finalizarVenda('credito')} className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl flex flex-col items-center gap-2 hover:bg-purple-500/20 hover:border-purple-500 transition-all group">
                                    <CreditCard size={32} className="text-purple-400 group-hover:scale-110 transition-transform" />
                                    <span className="font-medium text-purple-300">Crédito</span>
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Modal Sangria */}
            {showSangria && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" style={{ zIndex: 9999 }}>
                    <Card className="max-w-sm w-full border-gray-700 shadow-2xl bg-gray-900">
                        <div className="flex items-center justify-between p-4 border-b border-gray-800">
                            <h3 className="text-xl font-bold font-display tracking-wide text-white">Sangria de Caixa</h3>
                            <button onClick={() => setShowSangria(false)} className="p-2 hover:bg-gray-800 rounded text-gray-400">
                                <X size={20} />
                            </button>
                        </div>
                        <CardContent className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Valor (R$)</label>
                                <Input type="number" value={valorMovimentacao} onChange={(e) => setValorMovimentacao(e.target.value)} autoFocus className="text-white" />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Motivo/Descrição</label>
                                <Input type="text" value={motivoMovimentacao} onChange={(e) => setMotivoMovimentacao(e.target.value)} className="text-white" />
                            </div>
                            <Button onClick={registrarSangria} className="w-full py-3 bg-red-600 hover:bg-red-700">
                                Confirmar Sangria
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Modal Suprimento */}
            {showSuprimento && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" style={{ zIndex: 9999 }}>
                    <Card className="max-w-sm w-full border-gray-700 shadow-2xl bg-gray-900">
                        <div className="flex items-center justify-between p-4 border-b border-gray-800">
                            <h3 className="text-xl font-bold font-display tracking-wide text-white">Suprimento de Caixa</h3>
                            <button onClick={() => setShowSuprimento(false)} className="p-2 hover:bg-gray-800 rounded text-gray-400">
                                <X size={20} />
                            </button>
                        </div>
                        <CardContent className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Valor (R$)</label>
                                <Input type="number" value={valorMovimentacao} onChange={(e) => setValorMovimentacao(e.target.value)} autoFocus className="text-white" />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Motivo/Descrição</label>
                                <Input type="text" value={motivoMovimentacao} onChange={(e) => setMotivoMovimentacao(e.target.value)} className="text-white" />
                            </div>
                            <Button onClick={registrarSuprimento} className="w-full py-3 bg-green-600 hover:bg-green-700">
                                Confirmar Suprimento
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Modal Histórico */}
            {showHistorico && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" style={{ zIndex: 9999 }}>
                    <Card className="max-w-2xl w-full border-gray-700 shadow-2xl h-[80vh] flex flex-col bg-gray-900">
                        <div className="flex items-center justify-between p-4 border-b border-gray-800">
                            <h3 className="text-xl font-bold font-display tracking-wide text-white">Histórico do Caixa</h3>
                            <button onClick={() => setShowHistorico(false)} className="p-2 hover:bg-gray-800 rounded text-gray-400">
                                <X size={20} />
                            </button>
                        </div>
                        <CardContent className="p-0 overflow-hidden flex flex-col flex-1">
                            <div className="flex border-b border-gray-800">
                                <div className="flex-1 p-3 text-center border-r border-gray-800 font-bold bg-gray-900 text-gray-300">Vendas</div>
                                <div className="flex-1 p-3 text-center font-bold bg-gray-900 text-gray-300">Movimentações</div>
                            </div>
                            <div className="flex flex-1 overflow-hidden">
                                <div className="flex-1 overflow-y-auto border-r border-gray-800 p-2 space-y-2">
                                    {vendasDoDia.length === 0 ? (
                                        <p className="text-center text-gray-500 py-4">Nenhuma venda</p>
                                    ) : (
                                        vendasDoDia.map(v => (
                                            <div key={v.id} className="p-3 bg-gray-800/50 rounded flex justify-between items-center">
                                                <div>
                                                    <p className="font-bold text-white">Venda #{v.id}</p>
                                                    <p className="text-xs text-gray-400">{new Date(v.created_at).toLocaleTimeString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-gold font-bold">{formatarPreco(v.total)}</p>
                                                    <p className="text-xs uppercase text-gray-400">{v.forma_pagamento}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                    {movimentacoes.length === 0 ? (
                                        <p className="text-center text-gray-500 py-4">Nenhuma movimentação</p>
                                    ) : (
                                        movimentacoes.map(m => (
                                            <div key={m.id} className="p-3 bg-gray-800/50 rounded flex justify-between items-center">
                                                <div>
                                                    <p className={`font-bold ${m.tipo === 'sangria' ? 'text-red-400' : m.tipo === 'suprimento' ? 'text-green-400' : 'text-blue-400'}`}>
                                                        {m.tipo.toUpperCase()}
                                                    </p>
                                                    <p className="text-xs text-gray-300">{m.descricao || 'Sem descrição'}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-white font-bold">{formatarPreco(m.valor)}</p>
                                                    <p className="text-xs text-gray-400">{new Date(m.created_at).toLocaleTimeString()}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Modal Fechar Caixa */}
            {showFecharCaixa && relatorioCaixa && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" style={{ zIndex: 9999 }}>
                    <Card className="max-w-lg w-full border-gray-700 shadow-2xl bg-gray-900">
                        <div className="flex items-center justify-between p-4 border-b border-gray-800">
                            <h3 className="text-xl font-bold font-display tracking-wide text-white">Fechar Caixa</h3>
                            <button onClick={() => setShowFecharCaixa(false)} className="p-2 hover:bg-gray-800 rounded text-gray-400">
                                <X size={20} />
                            </button>
                        </div>
                        <CardContent className="p-6 space-y-4">
                            <div className="bg-black/40 rounded-lg p-4 space-y-2">
                                <div className="flex justify-between text-gray-400">
                                    <span>Fundo de Troco</span>
                                    <span>{formatarPreco(relatorioCaixa.abertura)}</span>
                                </div>
                                <div className="flex justify-between text-green-400">
                                    <span>Vendas (Dinheiro)</span>
                                    <span>+ {formatarPreco(relatorioCaixa.totais.dinheiro)}</span>
                                </div>
                                <div className="flex justify-between text-green-400">
                                    <span>Suprimentos</span>
                                    <span>+ {formatarPreco(relatorioCaixa.totalSuprimentos)}</span>
                                </div>
                                <div className="flex justify-between text-red-400">
                                    <span>Sangrias</span>
                                    <span>- {formatarPreco(relatorioCaixa.totalSangrias)}</span>
                                </div>
                                <div className="flex justify-between text-xl font-bold text-white pt-2 border-t border-gray-700">
                                    <span>Dinheiro em Caixa</span>
                                    <span>{formatarPreco(relatorioCaixa.dinheiroEmCaixa)}</span>
                                </div>
                            </div>
                            <div className="bg-gray-800/50 rounded-lg p-4 space-y-2 text-sm">
                                <p className="text-gray-400 font-bold mb-2 uppercase text-xs tracking-wider">Outros Pagamentos</p>
                                <div className="flex justify-between text-gray-300">
                                    <span>PIX</span>
                                    <span>{formatarPreco(relatorioCaixa.totais.pix)}</span>
                                </div>
                                <div className="flex justify-between text-gray-300">
                                    <span>Débito</span>
                                    <span>{formatarPreco(relatorioCaixa.totais.debito)}</span>
                                </div>
                                <div className="flex justify-between text-gray-300">
                                    <span>Crédito</span>
                                    <span>{formatarPreco(relatorioCaixa.totais.credito)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-gold pt-1 border-t border-gray-700 mt-1">
                                    <span>Total Geral Vendas</span>
                                    <span>{formatarPreco(relatorioCaixa.totalVendas)}</span>
                                </div>
                            </div>
                            <Button onClick={fecharCaixa} className="w-full py-4 text-lg bg-red-600 hover:bg-red-700">
                                Confirmar Fechamento
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
