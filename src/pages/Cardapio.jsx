import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ShoppingBag, Plus, Minus, X, Send, Phone } from 'lucide-react'

export function Cardapio() {
    const [categorias, setCategorias] = useState([])
    const [produtos, setProdutos] = useState([])
    const [config, setConfig] = useState({})
    const [categoriaAtiva, setCategoriaAtiva] = useState(null)
    const [carrinho, setCarrinho] = useState([])
    const [showCarrinho, setShowCarrinho] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)

        // Buscar configurações
        const { data: configs } = await supabase
            .from('configuracoes')
            .select('*')

        if (configs) {
            const configObj = {}
            configs.forEach(c => { configObj[c.chave] = c.valor })
            setConfig(configObj)
        }

        // Buscar categorias
        const { data: cats } = await supabase
            .from('categorias')
            .select('*')
            .eq('ativo', true)
            .order('ordem')

        if (cats) {
            setCategorias(cats)
            if (cats.length > 0) setCategoriaAtiva(cats[0].id)
        }

        // Buscar produtos
        const { data: prods } = await supabase
            .from('produtos')
            .select('*')
            .eq('disponivel', true)
            .order('ordem')

        if (prods) setProdutos(prods)

        setLoading(false)
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

    const removerDoCarrinho = (produtoId) => {
        const item = carrinho.find(i => i.id === produtoId)
        if (item.quantidade > 1) {
            setCarrinho(carrinho.map(i =>
                i.id === produtoId
                    ? { ...i, quantidade: i.quantidade - 1 }
                    : i
            ))
        } else {
            setCarrinho(carrinho.filter(i => i.id !== produtoId))
        }
    }

    const calcularTotal = () => {
        return carrinho.reduce((total, item) => total + (item.preco * item.quantidade), 0)
    }

    const formatarPreco = (valor) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor)
    }

    const enviarPedidoWhatsApp = () => {
        const telefone = config.telefone_whatsapp || '5527999999999'
        let mensagem = `🍗 *NOVO PEDIDO*\n\n`

        carrinho.forEach(item => {
            mensagem += `• ${item.quantidade}x ${item.nome} - ${formatarPreco(item.preco * item.quantidade)}\n`
        })

        mensagem += `\n💰 *Total: ${formatarPreco(calcularTotal())}*`

        const url = `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`
        window.open(url, '_blank')
    }

    const produtosFiltrados = categoriaAtiva
        ? produtos.filter(p => p.categoria_id === categoriaAtiva)
        : produtos

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="text-center">
                    <span className="text-5xl">🍗👑</span>
                    <p className="text-gray-400 mt-4">Carregando cardápio...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-b border-gray-800">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">🍗👑</span>
                            <div>
                                <h1 className="text-xl font-bold text-[#D4AF37]">
                                    {config.nome_restaurante || 'Império das Porções'}
                                </h1>
                                <p className="text-xs text-gray-400">{config.horario_funcionamento}</p>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowCarrinho(true)}
                            className="relative p-3 bg-[#D4AF37] rounded-full"
                        >
                            <ShoppingBag size={20} className="text-black" />
                            {carrinho.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
                                    {carrinho.reduce((t, i) => t + i.quantidade, 0)}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Categorias */}
            <nav className="sticky top-[73px] z-30 bg-[#0a0a0a] border-b border-gray-800">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="flex gap-2 overflow-x-auto py-3 scrollbar-hide">
                        {categorias.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setCategoriaAtiva(cat.id)}
                                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${categoriaAtiva === cat.id
                                        ? 'bg-[#D4AF37] text-black'
                                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                    }`}
                            >
                                {cat.nome}
                            </button>
                        ))}
                    </div>
                </div>
            </nav>

            {/* Produtos */}
            <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
                <div className="grid gap-4">
                    {produtosFiltrados.map(produto => (
                        <div
                            key={produto.id}
                            className="bg-[#1a1a1a] rounded-xl p-4 flex gap-4 border border-gray-800"
                        >
                            {produto.imagem && (
                                <img
                                    src={produto.imagem}
                                    alt={produto.nome}
                                    className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                                />
                            )}

                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h3 className="font-semibold">
                                            {produto.destaque && <span className="text-[#D4AF37]">⭐ </span>}
                                            {produto.nome}
                                        </h3>
                                        {produto.descricao && (
                                            <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                                                {produto.descricao}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-3">
                                    <div>
                                        {produto.preco_promocional ? (
                                            <>
                                                <span className="text-gray-500 line-through text-sm">
                                                    {formatarPreco(produto.preco)}
                                                </span>
                                                <span className="text-[#D4AF37] font-bold ml-2">
                                                    {formatarPreco(produto.preco_promocional)}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-[#D4AF37] font-bold">
                                                {formatarPreco(produto.preco)}
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => adicionarAoCarrinho(produto)}
                                        className="px-4 py-2 bg-[#D4AF37] text-black rounded-lg font-medium text-sm hover:bg-[#D4AF37]/90 flex items-center gap-1"
                                    >
                                        <Plus size={16} /> Adicionar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Botão flutuante do WhatsApp */}
            {carrinho.length > 0 && (
                <div className="fixed bottom-4 left-4 right-4 max-w-4xl mx-auto z-40">
                    <button
                        onClick={() => setShowCarrinho(true)}
                        className="w-full py-4 bg-[#D4AF37] text-black rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
                    >
                        <ShoppingBag size={20} />
                        Ver Carrinho ({carrinho.reduce((t, i) => t + i.quantidade, 0)} itens) - {formatarPreco(calcularTotal())}
                    </button>
                </div>
            )}

            {/* Modal do Carrinho */}
            {showCarrinho && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
                    <div className="bg-[#1a1a1a] w-full max-w-4xl rounded-t-2xl max-h-[85vh] overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-gray-800">
                            <h2 className="text-xl font-bold">Seu Pedido</h2>
                            <button
                                onClick={() => setShowCarrinho(false)}
                                className="p-2 hover:bg-gray-800 rounded-lg"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto max-h-[50vh]">
                            {carrinho.length === 0 ? (
                                <p className="text-center text-gray-400 py-8">
                                    Seu carrinho está vazio
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {carrinho.map(item => (
                                        <div key={item.id} className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <h4 className="font-medium">{item.nome}</h4>
                                                <p className="text-[#D4AF37]">{formatarPreco(item.preco)}</p>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => removerDoCarrinho(item.id)}
                                                    className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center"
                                                >
                                                    <Minus size={16} />
                                                </button>
                                                <span className="w-6 text-center">{item.quantidade}</span>
                                                <button
                                                    onClick={() => adicionarAoCarrinho(item)}
                                                    className="w-8 h-8 bg-[#D4AF37] text-black rounded-full flex items-center justify-center"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {carrinho.length > 0 && (
                            <div className="p-4 border-t border-gray-800 space-y-4">
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Total</span>
                                    <span className="text-[#D4AF37]">{formatarPreco(calcularTotal())}</span>
                                </div>

                                <button
                                    onClick={enviarPedidoWhatsApp}
                                    className="w-full py-4 bg-green-600 rounded-xl font-bold flex items-center justify-center gap-2"
                                >
                                    <Send size={20} /> Enviar Pedido via WhatsApp
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
