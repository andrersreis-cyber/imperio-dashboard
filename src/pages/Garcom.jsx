import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Html5QrcodeScanner } from 'html5-qrcode'
import {
    QrCode,
    Plus,
    Minus,
    Trash2,
    Send,
    ArrowLeft,
    Search,
    UtensilsCrossed,
    Clock,
    User,
    Camera,
    X,
    Grid3X3
} from 'lucide-react'

export function Garcom() {
    const [searchParams] = useSearchParams()
    const mesaParam = searchParams.get('mesa')

    // Senha de acesso para garçons
    const SENHA_GARCOM = 'imperio123'

    const [mesas, setMesas] = useState([])
    const [mesaSelecionada, setMesaSelecionada] = useState(null)
    const [comanda, setComanda] = useState(null)
    const [itensComanda, setItensComanda] = useState([])
    const [produtos, setProdutos] = useState([])
    const [categorias, setCategorias] = useState([])
    const [categoriaAtiva, setCategoriaAtiva] = useState(null)
    const [busca, setBusca] = useState('')
    const [showProdutos, setShowProdutos] = useState(false)
    const [carrinho, setCarrinho] = useState([])
    const [nomeGarcom, setNomeGarcom] = useState(localStorage.getItem('nomeGarcom') || '')
    const [showNomeGarcom, setShowNomeGarcom] = useState(!nomeGarcom)
    const [loading, setLoading] = useState(true)
    const [showScanner, setShowScanner] = useState(false)
    const [scannerReady, setScannerReady] = useState(false)
    const scannerRef = useRef(null)

    // Estado de autenticação (salvo em sessionStorage para persistir na sessão)
    const [autenticado, setAutenticado] = useState(sessionStorage.getItem('garcomAuth') === 'true')
    const [senhaDigitada, setSenhaDigitada] = useState('')
    const [erroSenha, setErroSenha] = useState(false)

    const verificarSenha = () => {
        if (senhaDigitada === SENHA_GARCOM) {
            sessionStorage.setItem('garcomAuth', 'true')
            setAutenticado(true)
            setErroSenha(false)
        } else {
            setErroSenha(true)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    useEffect(() => {
        if (mesaParam && mesas.length > 0) {
            const mesa = mesas.find(m => m.numero === parseInt(mesaParam))
            if (mesa) selecionarMesa(mesa)
        }
    }, [mesaParam, mesas])

    // Inicializar scanner quando mostrar
    useEffect(() => {
        if (showScanner && !scannerReady) {
            setTimeout(() => {
                const scanner = new Html5QrcodeScanner(
                    "qr-reader",
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0
                    },
                    false
                )

                scanner.render(
                    (decodedText) => {
                        // Extrair número da mesa do URL
                        const match = decodedText.match(/[?&]mesa=(\d+)/)
                        if (match) {
                            const numeroMesa = parseInt(match[1])
                            const mesa = mesas.find(m => m.numero === numeroMesa)
                            if (mesa) {
                                scanner.clear()
                                setShowScanner(false)
                                setScannerReady(false)
                                selecionarMesa(mesa)
                            }
                        }
                    },
                    (error) => {
                        // Ignorar erros de leitura
                    }
                )

                scannerRef.current = scanner
                setScannerReady(true)
            }, 100)
        }

        return () => {
            if (scannerRef.current && scannerReady) {
                try {
                    scannerRef.current.clear()
                } catch (e) { }
            }
        }
    }, [showScanner, mesas])

    const fetchData = async () => {
        setLoading(true)

        const { data: mesasData } = await supabase
            .from('mesas')
            .select('*')
            .order('numero')
        if (mesasData) setMesas(mesasData)

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

        setLoading(false)
    }

    const selecionarMesa = async (mesa) => {
        setMesaSelecionada(mesa)

        const { data: comandaAberta } = await supabase
            .from('comandas')
            .select('*')
            .eq('mesa_id', mesa.id)
            .eq('status', 'aberta')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (comandaAberta) {
            setComanda(comandaAberta)
            const { data: itens } = await supabase
                .from('itens_comanda')
                .select('*')
                .eq('comanda_id', comandaAberta.id)
                .order('created_at', { ascending: false })
            setItensComanda(itens || [])
        } else {
            const { data: novaComanda } = await supabase
                .from('comandas')
                .insert({
                    mesa_id: mesa.id,
                    garcom: nomeGarcom,
                    status: 'aberta'
                })
                .select()
                .single()

            if (novaComanda) {
                setComanda(novaComanda)
                setItensComanda([])

                await supabase
                    .from('mesas')
                    .update({ status: 'ocupada' })
                    .eq('id', mesa.id)
            }
        }
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
            setCarrinho([...carrinho, { ...produto, quantidade: 1, observacao: '' }])
        }
    }

    const alterarQuantidadeCarrinho = (produtoId, delta) => {
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

    const enviarPedido = async () => {
        if (!comanda || carrinho.length === 0) return

        const itensParaInserir = carrinho.map(item => ({
            comanda_id: comanda.id,
            produto_id: item.id,
            nome_produto: item.nome,
            quantidade: item.quantidade,
            preco_unitario: item.preco,
            observacao: item.observacao || null,
            garcom: nomeGarcom
        }))

        const { error } = await supabase
            .from('itens_comanda')
            .insert(itensParaInserir)

        if (!error) {
            // Calcular total dos itens enviados
            const totalItens = carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0)
            const itensTexto = carrinho.map(item => `${item.quantidade}x ${item.nome}`).join(', ')

            // Criar pedido na tabela pedidos para aparecer no filtro de Mesa
            const { data: pedidoData, error: pedidoError } = await supabase
                .from('pedidos')
                .insert({
                    phone: '',
                    nome_cliente: `Mesa ${mesaSelecionada.numero}`,
                    itens: itensTexto,
                    valor_total: totalItens,
                    taxa_entrega: 0,
                    endereco_entrega: `Mesa ${mesaSelecionada.numero}`,
                    bairro: 'No local',
                    forma_pagamento: 'pendente',
                    observacoes: `Comanda #${comanda.id} - Garçom: ${nomeGarcom}`,
                    status: 'pendente',
                    modalidade: 'mesa'
                })
                .select()

            if (pedidoError) {
                console.error('Erro ao criar pedido:', pedidoError)
                alert('Erro ao criar pedido: ' + pedidoError.message)
            } else {
                console.log('Pedido criado:', pedidoData)
            }

            const { data: itensAtualizados } = await supabase
                .from('itens_comanda')
                .select('*')
                .eq('comanda_id', comanda.id)
                .order('created_at', { ascending: false })

            setItensComanda(itensAtualizados || [])

            const { data: comandaAtualizada } = await supabase
                .from('comandas')
                .select('*')
                .eq('id', comanda.id)
                .single()

            if (comandaAtualizada) setComanda(comandaAtualizada)

            setCarrinho([])
            setShowProdutos(false)
        }
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

    const salvarNomeGarcom = () => {
        if (nomeGarcom.trim()) {
            localStorage.setItem('nomeGarcom', nomeGarcom.trim())
            setShowNomeGarcom(false)
        }
    }

    const fecharScanner = () => {
        if (scannerRef.current) {
            try { scannerRef.current.clear() } catch (e) { }
        }
        setShowScanner(false)
        setScannerReady(false)
    }

    // Tela de senha de acesso
    if (!autenticado) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
                <div className="bg-[#1a1a1a] rounded-xl p-8 max-w-md w-full border border-gray-800">
                    <div className="text-center mb-6">
                        <span className="text-5xl">🔐</span>
                        <h1 className="text-2xl font-bold text-[#D4AF37] mt-4">Área do Garçom</h1>
                        <p className="text-gray-400 mt-2">Digite a senha de acesso</p>
                    </div>

                    <div className="mb-6">
                        <input
                            type="password"
                            value={senhaDigitada}
                            onChange={(e) => { setSenhaDigitada(e.target.value); setErroSenha(false) }}
                            placeholder="Senha de acesso"
                            className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-lg text-center focus:outline-none ${erroSenha ? 'border-red-500' : 'border-gray-700 focus:border-[#D4AF37]'
                                }`}
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && verificarSenha()}
                        />
                        {erroSenha && (
                            <p className="text-red-500 text-sm mt-2 text-center">Senha incorreta!</p>
                        )}
                    </div>

                    <button
                        onClick={verificarSenha}
                        disabled={!senhaDigitada.trim()}
                        className="w-full py-4 bg-[#D4AF37] text-black font-bold rounded-lg disabled:opacity-50"
                    >
                        Acessar
                    </button>
                </div>
            </div>
        )
    }

    // Modal para nome do garçom
    if (showNomeGarcom) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
                <div className="bg-[#1a1a1a] rounded-xl p-8 max-w-md w-full border border-gray-800">
                    <div className="text-center mb-6">
                        <span className="text-5xl">🍗👑</span>
                        <h1 className="text-2xl font-bold text-[#D4AF37] mt-4">Império das Porções</h1>
                        <p className="text-gray-400 mt-2">App do Garçom</p>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm text-gray-400 mb-2">Seu nome</label>
                        <input
                            type="text"
                            value={nomeGarcom}
                            onChange={(e) => setNomeGarcom(e.target.value)}
                            placeholder="Digite seu nome"
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-lg focus:outline-none focus:border-[#D4AF37]"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && salvarNomeGarcom()}
                        />
                    </div>

                    <button
                        onClick={salvarNomeGarcom}
                        disabled={!nomeGarcom.trim()}
                        className="w-full py-4 bg-[#D4AF37] text-black font-bold rounded-lg disabled:opacity-50"
                    >
                        Entrar
                    </button>
                </div>
            </div>
        )
    }

    // Tela de seleção de mesa
    if (!mesaSelecionada) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white">
                <header className="bg-[#1a1a1a] border-b border-gray-800 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🍗👑</span>
                            <div>
                                <h1 className="font-bold text-[#D4AF37]">Olá, {nomeGarcom}!</h1>
                                <p className="text-gray-400 text-sm">Selecione uma mesa</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowNomeGarcom(true)}
                            className="p-2 text-gray-400"
                        >
                            <User size={20} />
                        </button>
                    </div>
                </header>

                <div className="p-4">
                    {/* Botões de ação */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <button
                            onClick={() => setShowScanner(true)}
                            className="p-4 bg-[#D4AF37] text-black rounded-xl font-bold flex items-center justify-center gap-2"
                        >
                            <Camera size={24} />
                            Escanear QR
                        </button>
                        <button
                            onClick={fetchData}
                            className="p-4 bg-gray-800 rounded-xl font-bold flex items-center justify-center gap-2"
                        >
                            <Grid3X3 size={24} />
                            Ver Mesas
                        </button>
                    </div>

                    {/* Grid de mesas */}
                    {loading ? (
                        <div className="text-center py-12 text-gray-500">Carregando...</div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {mesas.map(mesa => (
                                <button
                                    key={mesa.id}
                                    onClick={() => selecionarMesa(mesa)}
                                    className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center transition-all ${mesa.status === 'ocupada'
                                        ? 'bg-red-500/20 border-red-500 text-red-400'
                                        : 'bg-green-500/20 border-green-500 text-green-400'
                                        }`}
                                >
                                    <UtensilsCrossed size={24} />
                                    <span className="font-bold text-xl mt-1">{mesa.numero}</span>
                                    <span className="text-xs capitalize">{mesa.status}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Modal Scanner QR */}
                {showScanner && (
                    <div className="fixed inset-0 bg-black z-50 flex flex-col">
                        <div className="flex items-center justify-between p-4 bg-[#1a1a1a]">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Camera size={20} />
                                Escanear QR da Mesa
                            </h2>
                            <button
                                onClick={fecharScanner}
                                className="p-2 text-gray-400"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 flex items-center justify-center p-4">
                            <div id="qr-reader" className="w-full max-w-sm"></div>
                        </div>

                        <div className="p-4 bg-[#1a1a1a] text-center">
                            <p className="text-gray-400">
                                Aponte a câmera para o QR Code da mesa
                            </p>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // Tela de produtos (adicionar itens)
    if (showProdutos) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
                <header className="bg-[#1a1a1a] border-b border-gray-800 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={() => setShowProdutos(false)}
                            className="flex items-center gap-2 text-gray-400"
                        >
                            <ArrowLeft size={20} />
                            Voltar
                        </button>
                        <span className="text-[#D4AF37] font-bold">Mesa {mesaSelecionada.numero}</span>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            placeholder="Buscar produto..."
                            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg"
                        />
                    </div>

                    <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
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

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-2 gap-3">
                        {produtosFiltrados.map(produto => (
                            <button
                                key={produto.id}
                                onClick={() => adicionarAoCarrinho(produto)}
                                className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 text-left hover:border-[#D4AF37] transition-colors"
                            >
                                <h3 className="font-medium text-sm line-clamp-2">{produto.nome}</h3>
                                <p className="text-[#D4AF37] font-bold mt-2">{formatarPreco(produto.preco)}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Carrinho flutuante */}
                {carrinho.length > 0 && (
                    <div className="bg-[#1a1a1a] border-t border-gray-800 p-4">
                        <div className="space-y-2 max-h-32 overflow-y-auto mb-3">
                            {carrinho.map(item => (
                                <div key={item.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{item.nome}</p>
                                        <p className="text-[#D4AF37] text-xs">{formatarPreco(item.preco)}</p>
                                    </div>
                                    <div className="flex items-center gap-1 ml-2">
                                        <button
                                            onClick={() => alterarQuantidadeCarrinho(item.id, -1)}
                                            className="w-7 h-7 bg-gray-700 rounded flex items-center justify-center"
                                        >
                                            <Minus size={14} />
                                        </button>
                                        <span className="w-6 text-center text-sm">{item.quantidade}</span>
                                        <button
                                            onClick={() => alterarQuantidadeCarrinho(item.id, 1)}
                                            className="w-7 h-7 bg-[#D4AF37] text-black rounded flex items-center justify-center"
                                        >
                                            <Plus size={14} />
                                        </button>
                                        <button
                                            onClick={() => removerDoCarrinho(item.id)}
                                            className="w-7 h-7 bg-red-500/20 text-red-400 rounded flex items-center justify-center"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={enviarPedido}
                            className="w-full py-4 bg-green-600 rounded-xl font-bold flex items-center justify-center gap-2"
                        >
                            <Send size={20} />
                            Enviar ({carrinho.reduce((t, i) => t + i.quantidade, 0)} itens)
                        </button>
                    </div>
                )}
            </div>
        )
    }

    // Tela da comanda da mesa
    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
            <header className="bg-[#1a1a1a] border-b border-gray-800 p-4">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setMesaSelecionada(null)}
                        className="flex items-center gap-2 text-gray-400"
                    >
                        <ArrowLeft size={20} />
                        Mesas
                    </button>
                    <div className="text-right">
                        <span className="text-[#D4AF37] font-bold text-lg">Mesa {mesaSelecionada.numero}</span>
                        <p className="text-gray-400 text-xs">Comanda #{comanda?.id}</p>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
                {itensComanda.length === 0 ? (
                    <div className="text-center py-12">
                        <UtensilsCrossed size={48} className="mx-auto text-gray-600 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Comanda vazia</h3>
                        <p className="text-gray-500">Adicione itens ao pedido</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {itensComanda.map(item => (
                            <div key={item.id} className="bg-[#1a1a1a] rounded-lg p-3 border border-gray-800">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-medium">{item.quantidade}x {item.nome_produto}</p>
                                        {item.observacao && (
                                            <p className="text-gray-400 text-xs mt-1">Obs: {item.observacao}</p>
                                        )}
                                        <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                                            <Clock size={10} />
                                            {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            {item.garcom && ` • ${item.garcom}`}
                                        </p>
                                    </div>
                                    <span className="text-[#D4AF37] font-bold">
                                        {formatarPreco(item.quantidade * item.preco_unitario)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-[#1a1a1a] border-t border-gray-800 p-4">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-400">Total</span>
                    <span className="text-2xl font-bold text-[#D4AF37]">
                        {formatarPreco(comanda?.valor_total || 0)}
                    </span>
                </div>

                <button
                    onClick={() => setShowProdutos(true)}
                    className="w-full py-4 bg-[#D4AF37] text-black rounded-xl font-bold flex items-center justify-center gap-2"
                >
                    <Plus size={20} />
                    Adicionar Itens
                </button>
            </div>
        </div>
    )
}
