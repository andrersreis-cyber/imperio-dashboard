import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ShoppingBag, Plus, Minus, X, Send, CreditCard, Clock, Gift, MapPin, ChevronRight, Store } from 'lucide-react'
import { Checkout } from '../components/Checkout'

const LOGO_URL = 'https://cxhypcvdijqauaibcgyp.supabase.co/storage/v1/object/public/produtos/logo-imperio.png'
const PORCAO_URL = 'https://cxhypcvdijqauaibcgyp.supabase.co/storage/v1/object/public/produtos/porcao-destaque.jpg'

const LOCALIZACAO = {
    lat: -20.3146389,
    lng: -40.3677222,
    endereco: 'Vitória - ES'
}

const HORARIOS = {
    0: { aberto: true, inicio: '18:20', fim: '22:30' },
    1: { aberto: false },
    2: { aberto: false },
    3: { aberto: true, inicio: '18:30', fim: '23:00' },
    4: { aberto: true, inicio: '18:00', fim: '23:00' },
    5: { aberto: true, inicio: '18:30', fim: '22:40' },
    6: { aberto: true, inicio: '18:40', fim: '22:30' },
}

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

const BAIRROS_ENTREGA = [
    { nome: 'Porto Novo', taxa: 3.00 },
    { nome: 'Presidente Medice', taxa: 3.00 },
    { nome: 'Retiro', taxa: 4.00 },
    { nome: 'Santana', taxa: 6.00 },
    { nome: 'Sotema', taxa: 5.00 },
    { nome: 'Tabajara', taxa: 12.00 },
    { nome: 'Tucum', taxa: 6.00 },
    { nome: 'Vila Oasis', taxa: 4.00 },
    { nome: 'Morro do Meio', taxa: 4.00 },
    { nome: 'Morro do Sesi', taxa: 3.00 },
    { nome: 'Nova Canaã', taxa: 5.00 },
    { nome: 'Porto de Santana', taxa: 3.00 },
    { nome: 'Bairro Aparecida', taxa: 4.00 },
    { nome: 'Boa Vista', taxa: 6.00 },
    { nome: 'Campo Grande', taxa: 12.00 },
    { nome: 'Del Porto', taxa: 3.00 },
    { nome: 'Flexal I', taxa: 6.00 },
    { nome: 'Itacibá', taxa: 7.00 },
    { nome: 'Itaquari', taxa: 6.00 },
    { nome: 'Morada Feliz', taxa: 3.00 },
]

export function Cardapio() {
    const [categorias, setCategorias] = useState([])
    const [produtos, setProdutos] = useState([])
    const [config, setConfig] = useState({})
    const [categoriaAtiva, setCategoriaAtiva] = useState(null)
    const [carrinho, setCarrinho] = useState([])
    const [showCarrinho, setShowCarrinho] = useState(false)
    const [showCheckout, setShowCheckout] = useState(false)
    const [showInfo, setShowInfo] = useState(false)
    const [showFidelidade, setShowFidelidade] = useState(false)
    const [showEndereco, setShowEndereco] = useState(false)
    const [pedidosCliente] = useState(0)
    const [loading, setLoading] = useState(true)
    const [endereco, setEndereco] = useState({ rua: '', numero: '', bairro: '', complemento: '' })
    const [taxaEntrega, setTaxaEntrega] = useState(0)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)

        const { data: configs } = await supabase.from('configuracoes').select('*')
        if (configs) {
            const configObj = {}
            configs.forEach(c => { configObj[c.chave] = c.valor })
            setConfig(configObj)
        }

        const { data: cats } = await supabase.from('categorias').select('*').eq('ativo', true).order('ordem')
        if (cats) {
            setCategorias(cats)
            if (cats.length > 0) setCategoriaAtiva(cats[0].id)
        }

        const { data: prods } = await supabase.from('produtos').select('*').eq('disponivel', true).order('ordem')
        if (prods) setProdutos(prods)

        setLoading(false)
    }

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

    const removerDoCarrinho = (produtoId) => {
        const item = carrinho.find(i => i.id === produtoId)
        if (item.quantidade > 1) {
            setCarrinho(carrinho.map(i => i.id === produtoId ? { ...i, quantidade: i.quantidade - 1 } : i))
        } else {
            setCarrinho(carrinho.filter(i => i.id !== produtoId))
        }
    }

    const calcularTotal = () => carrinho.reduce((total, item) => total + (item.preco * item.quantidade), 0)

    const formatarPreco = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)

    const enviarPedidoWhatsApp = () => {
        const telefone = config.telefone_whatsapp || '5527999999999'
        let mensagem = `🍗 *NOVO PEDIDO - IMPÉRIO DAS PORÇÕES*\n\n`
        carrinho.forEach(item => {
            mensagem += `• ${item.quantidade}x ${item.nome} - ${formatarPreco(item.preco * item.quantidade)}\n`
        })
        mensagem += `\n💰 *Total: ${formatarPreco(calcularTotal())}*`
        window.open(`https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`, '_blank')
    }

    const produtosFiltrados = categoriaAtiva ? produtos.filter(p => p.categoria_id === categoriaAtiva) : produtos
    const categoriaAtual = categorias.find(c => c.id === categoriaAtiva)

    const verificarAberto = () => {
        const agora = new Date()
        const diaSemana = agora.getDay()
        const horario = HORARIOS[diaSemana]

        if (!horario.aberto) return { aberto: false, mensagem: 'Fechado hoje' }

        const horaAtual = agora.getHours() * 60 + agora.getMinutes()
        const [inicioH, inicioM] = horario.inicio.split(':').map(Number)
        const [fimH, fimM] = horario.fim.split(':').map(Number)

        if (horaAtual >= inicioH * 60 + inicioM && horaAtual <= fimH * 60 + fimM) {
            return { aberto: true, mensagem: `Aberto até ${horario.fim}` }
        } else if (horaAtual < inicioH * 60 + inicioM) {
            return { aberto: false, mensagem: `Abre hoje às ${horario.inicio}` }
        }
        return { aberto: false, mensagem: 'Fechado agora' }
    }

    const statusRestaurante = verificarAberto()

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-200 flex justify-center">
            {/* Container App Mobile */}
            <div className="w-full max-w-md bg-white min-h-screen shadow-2xl">
                {/* Banner Hero */}
                <div className="w-full">
                    <img
                        src="https://cxhypcvdijqauaibcgyp.supabase.co/storage/v1/object/public/produtos/banner-hero.png"
                        alt="Império das Porções"
                        className="w-full h-auto"
                    />
                </div>

                {/* Status Bar */}
                <div className="bg-red-100 text-red-600 px-4 py-3 text-center text-sm font-medium flex items-center justify-center gap-2">
                    <Store size={16} />
                    {statusRestaurante.aberto ? 'Loja aberta' : 'Loja fechada'} – {statusRestaurante.mensagem}
                </div>

                {/* Info do Restaurante */}
                <div className="bg-white px-4 py-4 border-b border-gray-100" onClick={() => setShowInfo(true)}>
                    <div className="flex items-center justify-between cursor-pointer">
                        <div>
                            <h1 className="text-lg font-bold text-gray-900">Império das porções</h1>
                            <p className="text-gray-500 text-sm">A melhor porção da região</p>
                            <p className="text-gray-400 text-xs mt-1">50 - 60 min</p>
                        </div>
                        <ChevronRight size={24} className="text-gray-400" />
                    </div>
                </div>

                {/* Fidelidade */}
                <div className="bg-white px-4 py-3 border-b border-gray-100" onClick={() => setShowFidelidade(true)}>
                    <div className="flex items-center gap-3 cursor-pointer">
                        <Gift size={18} className="text-gray-600" />
                        <p className="flex-1 text-sm text-gray-700 truncate">
                            Faça 10 pedidos e ganhe <span className="font-semibold">PORÇÃO GRANDE MIXTA FRANGO COM...</span>
                        </p>
                        <span className="text-gray-400 text-sm">{pedidosCliente}/10</span>
                        <span className="text-red-500 text-sm font-medium">Ver mais</span>
                    </div>
                </div>

                {/* Categorias - Scroll horizontal */}
                <div className="bg-white sticky top-0 z-30 border-b border-gray-100">
                    <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
                        {categorias.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setCategoriaAtiva(cat.id)}
                                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${categoriaAtiva === cat.id
                                    ? 'bg-red-500 text-white'
                                    : 'bg-gray-100 text-gray-700'
                                    }`}
                            >
                                {cat.nome}
                            </button>
                        ))}
                        {/* Espaço extra no final */}
                        <div className="w-8 flex-shrink-0" />
                    </div>
                </div>

                {/* Título da Categoria */}
                <div className="px-4 pt-4 pb-2">
                    <h2 className="text-lg font-bold text-gray-900">{categoriaAtual?.nome || 'Produtos'}</h2>
                </div>

                {/* Lista de Produtos */}
                <div className="px-4 space-y-0">
                    {produtosFiltrados.map(produto => (
                        <div key={produto.id} className="bg-white py-4 border-b border-gray-100 flex gap-4">
                            {/* Textos */}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 text-sm">{produto.nome}</h3>
                                {produto.descricao && (
                                    <p className="text-gray-500 text-xs mt-1 line-clamp-2">{produto.descricao}</p>
                                )}
                                <p className="text-red-500 font-bold text-sm mt-2">
                                    {formatarPreco(produto.preco_promocional || produto.preco)}
                                </p>
                            </div>

                            {/* Imagem */}
                            {produto.imagem && (
                                <div className="relative flex-shrink-0">
                                    <img
                                        src={produto.imagem}
                                        alt={produto.nome}
                                        className="w-24 h-24 object-cover rounded-lg"
                                    />
                                    <button
                                        onClick={() => adicionarAoCarrinho(produto)}
                                        className="absolute -bottom-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Espaço para o botão do carrinho */}
                <div className="h-24" />

                {/* Botão flutuante do carrinho */}
                {carrinho.length > 0 && (
                    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md p-4 bg-white/95 backdrop-blur border-t z-40">
                        <button
                            onClick={() => setShowCarrinho(true)}
                            className="w-full py-3 bg-red-500 text-white rounded-lg font-bold flex items-center justify-center gap-2"
                        >
                            <ShoppingBag size={18} />
                            Ver sacola ({carrinho.reduce((t, i) => t + i.quantidade, 0)}) • {formatarPreco(calcularTotal())}
                        </button>
                    </div>
                )}

                {/* Modal Carrinho */}
                {showCarrinho && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
                        <div className="bg-white w-full max-w-md rounded-t-2xl max-h-[85vh] overflow-hidden">
                            <div className="flex items-center justify-between p-4 border-b">
                                <h2 className="text-lg font-bold text-gray-900">Sacola</h2>
                                <button onClick={() => setShowCarrinho(false)} className="p-2 text-gray-600"><X size={24} /></button>
                            </div>
                            <div className="p-4 overflow-y-auto max-h-[40vh] space-y-4">
                                {carrinho.map(item => (
                                    <div key={item.id} className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <h4 className="font-medium text-gray-900">{item.nome}</h4>
                                            <p className="text-red-500 text-sm font-semibold">{formatarPreco(item.preco)}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => removerDoCarrinho(item.id)} className="w-8 h-8 bg-gray-300 text-gray-700 rounded-full flex items-center justify-center border border-gray-400">
                                                <Minus size={16} />
                                            </button>
                                            <span className="w-6 text-center font-bold text-gray-900">{item.quantidade}</span>
                                            <button onClick={() => adicionarAoCarrinho(item)} className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center">
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {carrinho.length > 0 && (
                                <div className="p-4 border-t space-y-3">
                                    {/* Subtotal */}
                                    <div className="flex justify-between text-gray-600">
                                        <span>Subtotal</span>
                                        <span>{formatarPreco(calcularTotal())}</span>
                                    </div>
                                    {/* Taxa de entrega */}
                                    <div className="flex justify-between text-gray-600">
                                        <span>Taxa de entrega</span>
                                        <span>{taxaEntrega > 0 ? formatarPreco(taxaEntrega) : 'Selecione o bairro'}</span>
                                    </div>
                                    {/* Endereço selecionado */}
                                    {endereco.bairro && (
                                        <div className="bg-gray-50 p-3 rounded-lg text-sm">
                                            <p className="font-medium text-gray-900">{endereco.rua}, {endereco.numero}</p>
                                            <p className="text-gray-600">{endereco.bairro} {endereco.complemento && `- ${endereco.complemento}`}</p>
                                        </div>
                                    )}
                                    {/* Total */}
                                    <div className="flex justify-between font-bold text-lg border-t pt-3">
                                        <span className="text-gray-900">Total</span>
                                        <span className="text-red-500">{formatarPreco(calcularTotal() + taxaEntrega)}</span>
                                    </div>
                                    {/* Botão Voltar ao Cardápio */}
                                    <button onClick={() => setShowCarrinho(false)} className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold border border-gray-300">
                                        ← Adicionar mais itens
                                    </button>
                                    {/* Botão Endereço ou Finalizar */}
                                    {!endereco.bairro ? (
                                        <button onClick={() => { setShowCarrinho(false); setShowEndereco(true); }} className="w-full py-4 bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                                            <MapPin size={20} /> Informar Endereço de Entrega
                                        </button>
                                    ) : (
                                        <>
                                            <button onClick={() => { setShowCarrinho(false); setShowCheckout(true); }} className="w-full py-4 bg-red-500 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                                                <CreditCard size={20} /> Pagar Online (PIX)
                                            </button>
                                            <button onClick={enviarPedidoWhatsApp} className="w-full py-3 bg-green-500 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                                                <Send size={20} /> Pedir via WhatsApp
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Modal Endereço */}
                {showEndereco && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
                        <div className="bg-white w-full max-w-md rounded-t-2xl max-h-[90vh] overflow-hidden">
                            <div className="flex items-center justify-between p-4 border-b">
                                <h2 className="text-lg font-bold text-gray-900">Endereço de Entrega</h2>
                                <button onClick={() => setShowEndereco(false)} className="p-2 text-gray-600"><X size={24} /></button>
                            </div>
                            <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
                                {/* Bairro */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Bairro *</label>
                                    <select
                                        value={endereco.bairro}
                                        onChange={(e) => {
                                            const bairro = BAIRROS_ENTREGA.find(b => b.nome === e.target.value)
                                            setEndereco({ ...endereco, bairro: e.target.value })
                                            setTaxaEntrega(bairro ? bairro.taxa : 0)
                                        }}
                                        className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white"
                                    >
                                        <option value="">Selecione seu bairro</option>
                                        {BAIRROS_ENTREGA.map(b => (
                                            <option key={b.nome} value={b.nome}>{b.nome} - {formatarPreco(b.taxa)}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* Rua */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Rua *</label>
                                    <input
                                        type="text"
                                        value={endereco.rua}
                                        onChange={(e) => setEndereco({ ...endereco, rua: e.target.value })}
                                        placeholder="Ex: Rua das Flores"
                                        className="w-full p-3 border border-gray-300 rounded-lg text-gray-900"
                                    />
                                </div>
                                {/* Número */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Número *</label>
                                    <input
                                        type="text"
                                        value={endereco.numero}
                                        onChange={(e) => setEndereco({ ...endereco, numero: e.target.value })}
                                        placeholder="Ex: 123"
                                        className="w-full p-3 border border-gray-300 rounded-lg text-gray-900"
                                    />
                                </div>
                                {/* Complemento */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
                                    <input
                                        type="text"
                                        value={endereco.complemento}
                                        onChange={(e) => setEndereco({ ...endereco, complemento: e.target.value })}
                                        placeholder="Ex: Apto 101, Bloco A"
                                        className="w-full p-3 border border-gray-300 rounded-lg text-gray-900"
                                    />
                                </div>
                                {/* Taxa */}
                                {taxaEntrega > 0 && (
                                    <div className="bg-blue-50 p-3 rounded-lg">
                                        <p className="text-blue-800 font-medium">Taxa de entrega: {formatarPreco(taxaEntrega)}</p>
                                    </div>
                                )}
                                {/* Botão Confirmar */}
                                <button
                                    onClick={() => {
                                        if (endereco.bairro && endereco.rua && endereco.numero) {
                                            setShowEndereco(false)
                                            setShowCarrinho(true)
                                        } else {
                                            alert('Preencha todos os campos obrigatórios')
                                        }
                                    }}
                                    className="w-full py-4 bg-red-500 text-white rounded-xl font-bold"
                                    disabled={!endereco.bairro || !endereco.rua || !endereco.numero}
                                >
                                    Confirmar Endereço
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Info */}
                {showInfo && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden">
                            <div className="flex items-center justify-between p-4 border-b">
                                <h2 className="text-lg font-bold text-gray-900">Império das Porções</h2>
                                <button onClick={() => setShowInfo(false)} className="p-2 text-gray-600"><X size={24} /></button>
                            </div>
                            <div className="p-4 space-y-4">
                                <p className="text-gray-500">A melhor porção da região</p>
                                <div>
                                    <h3 className="font-bold flex items-center gap-2 mb-2 text-gray-900"><Clock size={16} /> Horário de funcionamento</h3>
                                    <div className="text-sm text-gray-600 space-y-1">
                                        {DIAS_SEMANA.map((dia, i) => (
                                            <div key={dia} className="flex justify-between">
                                                <span>{dia}:</span>
                                                <span className={HORARIOS[i].aberto ? '' : 'text-red-500'}>
                                                    {HORARIOS[i].aberto ? `${HORARIOS[i].inicio} às ${HORARIOS[i].fim}` : 'Fechado'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold mb-2 text-gray-900">Formas de pagamento</h3>
                                    <p className="text-sm text-gray-600">PIX, Dinheiro, Cartão de Crédito, Cartão de Débito</p>
                                </div>
                                <div>
                                    <h3 className="font-bold flex items-center gap-2 mb-2 text-gray-900"><MapPin size={16} /> Endereço</h3>
                                    <p className="text-sm text-gray-600">{LOCALIZACAO.endereco}</p>
                                    <a href={`https://www.google.com/maps?q=${LOCALIZACAO.lat},${LOCALIZACAO.lng}`} target="_blank" rel="noopener noreferrer" className="text-red-500 text-sm">Ver no mapa →</a>
                                </div>
                                {/* Botão Fechar */}
                                <button
                                    onClick={() => setShowInfo(false)}
                                    className="w-full py-3 bg-red-500 text-white rounded-xl font-bold mt-4"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Fidelidade */}
                {showFidelidade && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden">
                            <div className="flex items-center justify-between p-4 border-b">
                                <h2 className="text-lg font-bold text-gray-900">Programa de Fidelidade</h2>
                                <button onClick={() => setShowFidelidade(false)} className="p-2 text-gray-600"><X size={24} /></button>
                            </div>
                            <div className="p-6 text-center">
                                <div className="text-5xl mb-4">🎁</div>
                                <p className="text-gray-700 mb-2">Faça <span className="font-bold text-red-500">10</span> pedidos e ganhe</p>
                                <p className="font-bold text-red-500 text-lg mb-4">PORÇÃO GRANDE MISTA FRANGO COM BATATA</p>
                                <div className="mb-4">
                                    <div className="flex justify-between text-sm text-gray-500 mb-1">
                                        <span>{pedidosCliente} de 10</span>
                                        <span>🎁</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div className="bg-red-500 h-2 rounded-full" style={{ width: `${(pedidosCliente / 10) * 100}%` }} />
                                    </div>
                                </div>
                                <div className="text-left bg-gray-50 rounded-lg p-4 text-sm text-gray-600 mb-4">
                                    <h4 className="font-bold text-gray-900 mb-2">Regras</h4>
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>Contagem máxima de 1 pedido por dia</li>
                                        <li>Válido para pedidos com status concluído</li>
                                        <li>Válido somente para pedidos feitos pelo link</li>
                                        <li>Válido até 31/12/2025</li>
                                    </ul>
                                </div>
                                {/* Botão Fechar */}
                                <button
                                    onClick={() => setShowFidelidade(false)}
                                    className="w-full py-3 bg-red-500 text-white rounded-xl font-bold"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Checkout */}
                {showCheckout && (
                    <Checkout
                        carrinho={carrinho}
                        total={calcularTotal() + taxaEntrega}
                        taxaEntrega={taxaEntrega}
                        enderecoEntrega={endereco}
                        config={config}
                        onVoltar={() => { setShowCheckout(false); setShowCarrinho(true); }}
                        onFinalizado={() => { setShowCheckout(false); setCarrinho([]); setEndereco({ rua: '', numero: '', bairro: '', complemento: '' }); setTaxaEntrega(0); }}
                    />
                )}
            </div>
        </div>
    )
}
