import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ShoppingBag, Plus, Minus, X, Send, CreditCard, Clock, Gift, MapPin, ChevronRight, Store, User, Check } from 'lucide-react'
import { Checkout } from '../components/Checkout'

const LOGO_URL = 'https://cxhypcvdijqauaibcgyp.supabase.co/storage/v1/object/public/produtos/logo-imperio.png'
const PORCAO_URL = 'https://cxhypcvdijqauaibcgyp.supabase.co/storage/v1/object/public/produtos/porcao-destaque.jpg'

const LOCALIZACAO = {
    lat: -20.3146389,
    lng: -40.3677222,
    endereco: 'Vitória - ES'
}

// Fallback de horários (caso tabela não exista no banco)
const HORARIOS_DEFAULT = {
    0: { aberto: true, inicio: '18:20', fim: '22:30' },
    1: { aberto: false },
    2: { aberto: false },
    3: { aberto: true, inicio: '18:30', fim: '23:00' },
    4: { aberto: true, inicio: '18:00', fim: '23:00' },
    5: { aberto: true, inicio: '18:30', fim: '22:40' },
    6: { aberto: true, inicio: '18:40', fim: '22:30' },
}

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

// Fallback de bairros (caso tabela não exista no banco)
const BAIRROS_DEFAULT = [
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
    const [searchParams] = useSearchParams()
    const mesaNumero = searchParams.get('mesa') // Lê ?mesa=X da URL

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
    const [formaPagamento, setFormaPagamento] = useState('')
    const [precisaTroco, setPrecisaTroco] = useState(false)
    const [trocoParaValor, setTrocoParaValor] = useState('')
    const [nomeCliente, setNomeCliente] = useState('')
    const [telefoneCliente, setTelefoneCliente] = useState('')
    // Se tem mesa na URL, modalidade é 'mesa' automaticamente
    const [modalidade, setModalidade] = useState(mesaNumero ? 'mesa' : '')
    // Estados dinâmicos para horários e bairros (carregados do banco)
    const [horarios, setHorarios] = useState(HORARIOS_DEFAULT)
    const [bairrosEntrega, setBairrosEntrega] = useState(BAIRROS_DEFAULT)

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

        // Carregar horários do banco (se tabela existir)
        try {
            const { data: horariosDB } = await supabase.from('horarios_funcionamento').select('*')
            if (horariosDB && horariosDB.length > 0) {
                const horariosObj = {}
                horariosDB.forEach(h => {
                    horariosObj[h.dia_semana] = {
                        aberto: h.aberto,
                        inicio: h.hora_inicio?.substring(0, 5),
                        fim: h.hora_fim?.substring(0, 5)
                    }
                })
                setHorarios(horariosObj)
            }
        } catch (e) {
            console.log('Tabela horarios_funcionamento não existe, usando fallback')
        }

        // Carregar bairros do banco (se tabela existir)
        try {
            const { data: bairrosDB } = await supabase.from('bairros_entrega').select('*').eq('ativo', true).order('nome')
            if (bairrosDB && bairrosDB.length > 0) {
                setBairrosEntrega(bairrosDB.map(b => ({ nome: b.nome, taxa: parseFloat(b.taxa_entrega) })))
            }
        } catch (e) {
            console.log('Tabela bairros_entrega não existe, usando fallback')
        }

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

    const finalizarPedido = async () => {
        try {
            // Criar pedido no banco
            const itensTexto = carrinho.map(item => `${item.quantidade}x ${item.nome}`).join(', ')
            const totalFinal = calcularTotal() + taxaEntrega

            // Observações com troco e/ou mesa
            let observacoes = endereco.complemento || ''
            if (formaPagamento === 'dinheiro' && precisaTroco && trocoParaValor) {
                observacoes += ` | Troco para R$ ${trocoParaValor}`
            }
            if (mesaNumero) {
                observacoes = `MESA ${mesaNumero}${observacoes ? ' | ' + observacoes : ''}`
            }

            const { data: pedido, error } = await supabase
                .from('pedidos')
                .insert({
                    phone: telefoneCliente,
                    nome_cliente: nomeCliente,
                    itens: itensTexto,
                    valor_total: totalFinal,
                    taxa_entrega: modalidade === 'mesa' ? 0 : taxaEntrega,
                    endereco_entrega: mesaNumero ? `Mesa ${mesaNumero}` : `${endereco.rua}, ${endereco.numero}`,
                    bairro: mesaNumero ? 'No local' : endereco.bairro,
                    forma_pagamento: formaPagamento,
                    observacoes: observacoes,
                    status: 'pendente',
                    modalidade: mesaNumero ? 'mesa' : (modalidade || 'delivery')
                })
                .select()
                .single()

            if (error) throw error

            // Limpar carrinho e mostrar confirmação
            alert(`✅ Pedido #${pedido.id} enviado com sucesso!\n\nAguarde a confirmação pelo WhatsApp.`)
            setCarrinho([])
            setShowCarrinho(false)
            setFormaPagamento('')
            setNomeCliente('')
            setTelefoneCliente('')
            setPrecisaTroco(false)
            setTrocoParaValor('')
            setEndereco({ rua: '', numero: '', bairro: '', complemento: '' })
            setTaxaEntrega(0)
            setModalidade('')

        } catch (error) {
            console.error('Erro ao criar pedido:', error)
            alert('Erro ao enviar pedido. Tente novamente.')
        }
    }

    const produtosFiltrados = categoriaAtiva ? produtos.filter(p => p.categoria_id === categoriaAtiva) : produtos
    const categoriaAtual = categorias.find(c => c.id === categoriaAtiva)

    const verificarAberto = () => {
        const agora = new Date()
        const diaSemana = agora.getDay()
        const horario = horarios[diaSemana]

        if (!horario || !horario.aberto) return { aberto: false, mensagem: 'Fechado hoje' }

        const horaAtual = agora.getHours() * 60 + agora.getMinutes()
        const [inicioH, inicioM] = (horario.inicio || '00:00').split(':').map(Number)
        const [fimH, fimM] = (horario.fim || '23:59').split(':').map(Number)

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
                        <div className="bg-white w-full max-w-md rounded-t-2xl max-h-[95vh] flex flex-col">
                            {/* Header Fixo */}
                            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
                                <h2 className="text-lg font-bold text-gray-900">Sacola ({carrinho.reduce((t, i) => t + i.quantidade, 0)})</h2>
                                <button onClick={() => setShowCarrinho(false)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"><X size={24} /></button>
                            </div>

                            {/* Conteúdo com Scroll */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
                                {/* Lista de Itens */}
                                {carrinho.map(item => (
                                    <div key={item.id} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 mb-3">
                                        <div className="flex-1 pr-4">
                                            <h4 className="font-medium text-gray-900">{item.nome}</h4>
                                            <p className="text-red-500 text-sm font-semibold">{formatarPreco(item.preco)}</p>
                                        </div>
                                        <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1">
                                            <button onClick={() => removerDoCarrinho(item.id)} className="w-8 h-8 hover:bg-white text-gray-700 rounded-md flex items-center justify-center transition-colors">
                                                <Minus size={16} />
                                            </button>
                                            <span className="w-6 text-center font-bold text-gray-900 text-sm">{item.quantidade}</span>
                                            <button onClick={() => adicionarAoCarrinho(item)} className="w-8 h-8 bg-red-500 text-white rounded-md flex items-center justify-center shadow-lg shadow-red-200">
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Resumo e Formulário */}
                                {carrinho.length > 0 && (
                                    <div className="space-y-6 pt-2">
                                        {/* Valores */}
                                        <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                                            <div className="flex justify-between text-gray-600 text-sm">
                                                <span>Subtotal</span>
                                                <span>{formatarPreco(calcularTotal())}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-600 text-sm">
                                                <span>
                                                    {mesaNumero ? `Mesa ${mesaNumero}` :
                                                        modalidade === 'retirada' ? 'Retirada' :
                                                            'Taxa de entrega'}
                                                </span>
                                                <span className={(mesaNumero || modalidade === 'retirada') ? 'text-green-600 font-semibold' : ''}>
                                                    {mesaNumero ? 'No local' :
                                                        modalidade === 'retirada' ? 'Grátis' :
                                                            taxaEntrega > 0 ? formatarPreco(taxaEntrega) : 'Selecione'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Escolha de Modalidade: Delivery ou Retirada */}
                                        {!modalidade ? (
                                            <div className="text-center py-6 px-4 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                                                <h3 className="font-bold text-gray-900 mb-4">Como deseja receber?</h3>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={() => { setModalidade('delivery'); setShowCarrinho(false); setShowEndereco(true); }}
                                                        className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
                                                    >
                                                        <MapPin className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                                                        <span className="font-bold text-gray-900 block">Delivery</span>
                                                        <span className="text-gray-500 text-xs">Receba em casa</span>
                                                    </button>
                                                    <button
                                                        onClick={() => { setModalidade('retirada'); setTaxaEntrega(0); }}
                                                        className="p-4 bg-green-50 border-2 border-green-200 rounded-xl hover:bg-green-100 transition-colors"
                                                    >
                                                        <Store className="h-8 w-8 text-green-500 mx-auto mb-2" />
                                                        <span className="font-bold text-gray-900 block">Retirada</span>
                                                        <span className="text-gray-500 text-xs">Retire no local</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : modalidade === 'delivery' && !endereco.bairro ? (
                                            <div className="text-center py-8 px-4 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                                                <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <MapPin className="h-8 w-8 text-blue-500" />
                                                </div>
                                                <h3 className="font-bold text-gray-900 mb-2">Onde vamos entregar?</h3>
                                                <p className="text-gray-500 mb-6 text-sm">Informe seu endereço para calcular a taxa de entrega.</p>
                                                <button
                                                    onClick={() => { setShowCarrinho(false); setShowEndereco(true); }}
                                                    className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-200"
                                                >
                                                    <MapPin size={20} /> Informar Endereço
                                                </button>
                                                <button
                                                    onClick={() => { setModalidade(''); }}
                                                    className="w-full py-2 mt-2 text-gray-500 text-sm"
                                                >
                                                    ← Voltar
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                {/* Card Endereço */}
                                                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-full -mr-10 -mt-10 opacity-50"></div>
                                                    <div className="flex items-start gap-3 relative z-10">
                                                        <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                                                            <MapPin size={20} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="font-bold text-gray-900 text-sm">{endereco.rua}, {endereco.numero}</p>
                                                            <p className="text-gray-600 text-xs">{endereco.bairro}</p>
                                                            {endereco.complemento && <p className="text-gray-500 text-xs">{endereco.complemento}</p>}
                                                        </div>
                                                        <button
                                                            onClick={() => { setShowCarrinho(false); setShowEndereco(true); }}
                                                            className="text-blue-600 text-xs font-bold hover:underline self-start mt-1"
                                                        >
                                                            ALTERAR
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Dados Pessoais */}
                                                <div className="space-y-3">
                                                    <h4 className="font-bold text-gray-900 flex items-center gap-2 text-sm uppercase tracking-wide text-gray-500">
                                                        <User size={16} /> Seus Dados
                                                    </h4>
                                                    <div className="space-y-3">
                                                        <input
                                                            type="text"
                                                            placeholder="Nome completo *"
                                                            value={nomeCliente}
                                                            onChange={(e) => setNomeCliente(e.target.value)}
                                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                                        />
                                                        <input
                                                            type="tel"
                                                            placeholder="WhatsApp (27) 99999-9999 *"
                                                            value={telefoneCliente}
                                                            onChange={(e) => setTelefoneCliente(e.target.value)}
                                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Forma de Pagamento */}
                                                <div className="space-y-3">
                                                    <h4 className="font-bold text-gray-900 flex items-center gap-2 text-sm uppercase tracking-wide text-gray-500">
                                                        <CreditCard size={16} /> Pagamento
                                                    </h4>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {[
                                                            { id: 'pix', label: 'PIX', icon: '💠', desc: '-5%' },
                                                            { id: 'dinheiro', label: 'Dinheiro', icon: '💵', desc: '' },
                                                            { id: 'credito', label: 'Crédito', icon: '💳', desc: '' },
                                                            { id: 'debito', label: 'Débito', icon: '💳', desc: '' }
                                                        ].map(op => (
                                                            <button
                                                                key={op.id}
                                                                onClick={() => { setFormaPagamento(op.id); if (op.id !== 'dinheiro') setPrecisaTroco(false); }}
                                                                className={`p-3 rounded-xl border-2 text-left transition-all relative overflow-hidden ${formaPagamento === op.id
                                                                    ? 'border-red-500 bg-red-50 shadow-sm'
                                                                    : 'border-gray-100 bg-white hover:border-gray-300'
                                                                    }`}
                                                            >
                                                                <div className="flex justify-between items-center mb-1 relative z-10">
                                                                    <span className="text-xl">{op.icon}</span>
                                                                    {op.id === 'pix' && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded">OFF</span>}
                                                                </div>
                                                                <span className={`block font-bold text-sm relative z-10 ${formaPagamento === op.id ? 'text-red-700' : 'text-gray-700'}`}>{op.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {/* Troco */}
                                                    {formaPagamento === 'dinheiro' && (
                                                        <div className="bg-yellow-50 p-4 rounded-xl space-y-3 border border-yellow-200 animate-in zoom-in-95 duration-200">
                                                            <label className="flex items-center gap-3 text-gray-800 font-medium cursor-pointer select-none">
                                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${precisaTroco ? 'bg-red-500 border-red-500' : 'bg-white border-gray-400'}`}>
                                                                    {precisaTroco && <Check size={12} className="text-white" />}
                                                                </div>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={precisaTroco}
                                                                    onChange={(e) => setPrecisaTroco(e.target.checked)}
                                                                    className="hidden"
                                                                />
                                                                Precisa de troco?
                                                            </label>
                                                            {precisaTroco && (
                                                                <input
                                                                    type="text"
                                                                    placeholder="Troco para quanto? (ex: 50,00)"
                                                                    value={trocoParaValor}
                                                                    onChange={(e) => setTrocoParaValor(e.target.value)}
                                                                    className="w-full p-3 bg-white border border-yellow-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-yellow-500 outline-none shadow-sm"
                                                                    autoFocus
                                                                    inputMode="decimal"
                                                                />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer Fixo (Sempre visível) */}
                            <div className="p-4 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20 sticky bottom-0 safe-area-bottom">
                                <div className="flex justify-between items-end mb-3">
                                    <span className="text-gray-500 text-sm font-medium">Total a pagar</span>
                                    <div className="text-right">
                                        <span className="text-2xl font-bold text-gray-900">{formatarPreco(calcularTotal() + (endereco.bairro ? taxaEntrega : 0))}</span>
                                        {taxaEntrega > 0 && <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Entrega inclusa</p>}
                                    </div>
                                </div>

                                {carrinho.length > 0 ? (
                                    endereco.bairro ? (
                                        <button
                                            onClick={finalizarPedido}
                                            disabled={!nomeCliente || !telefoneCliente || !formaPagamento || (formaPagamento === 'dinheiro' && precisaTroco && !trocoParaValor)}
                                            className="w-full py-4 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-red-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all"
                                        >
                                            <span>Finalizar Pedido</span>
                                            <Send size={20} />
                                        </button>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            <button onClick={() => setShowCarrinho(false)} className="py-3 px-4 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm">
                                                Voltar
                                            </button>
                                            <button onClick={() => { setShowCarrinho(false); setShowEndereco(true); }} className="py-3 px-4 bg-blue-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
                                                Endereço <MapPin size={16} />
                                            </button>
                                        </div>
                                    )
                                ) : (
                                    <button onClick={() => setShowCarrinho(false)} className="w-full py-4 bg-gray-100 text-gray-600 rounded-xl font-bold">
                                        Voltar ao Cardápio
                                    </button>
                                )}
                            </div>
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
                                            const bairro = bairrosEntrega.find(b => b.nome === e.target.value)
                                            setEndereco({ ...endereco, bairro: e.target.value })
                                            setTaxaEntrega(bairro ? bairro.taxa : 0)
                                        }}
                                        className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white"
                                    >
                                        <option value="">Selecione seu bairro</option>
                                        {bairrosEntrega.map(b => (
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
                        total={calcularTotal()}
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
