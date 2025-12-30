import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ShoppingBag, Plus, Minus, X, Send, CreditCard, Clock, Gift, MapPin, ChevronRight, Store, User, Check, FileText } from 'lucide-react'

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
    // App de Delivery - Cliente pede pelo app
    // Opções: Delivery (entrega em casa) ou Retirada (cliente busca)
    // Para pedidos presenciais no restaurante, usar o app do garçom (/garcom)

    const [categorias, setCategorias] = useState([])
    const [produtos, setProdutos] = useState([])
    const [config, setConfig] = useState({})
    const [categoriaAtiva, setCategoriaAtiva] = useState(null)
    const [carrinho, setCarrinho] = useState([])
    const [showCarrinho, setShowCarrinho] = useState(false)
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
    // Modalidade: 'delivery' (entrega) ou 'retirada' (cliente busca)
    const [modalidade, setModalidade] = useState('')
    // Estados dinâmicos para horários e bairros (carregados do banco)
    const [horarios, setHorarios] = useState(HORARIOS_DEFAULT)
    const [bairrosEntrega, setBairrosEntrega] = useState(BAIRROS_DEFAULT)

    const [cartAnimation, setCartAnimation] = useState(false)

    useEffect(() => {
        if (carrinho.length > 0) {
            setCartAnimation(true)
            const timer = setTimeout(() => setCartAnimation(false), 300)
            return () => clearTimeout(timer)
        }
    }, [carrinho])

    const [showSuccess, setShowSuccess] = useState(false)
    const [lastOrderId, setLastOrderId] = useState(null)

    useEffect(() => {
        fetchData()
        
        // Haptic Feedback check
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(0) // Warm up
        }
    }, [])

    // Scroll Spy Effect - DESABILITADO TEMPORARIAMENTE PARA EVITAR LOOPS
    // useEffect(() => {
    //     if (categorias.length === 0) return
        
    //     const handleScroll = () => {
    //         const headerOffset = 180
            
    //         for (const cat of categorias) {
    //             const element = document.getElementById(`cat-${cat.id}`)
    //             if (element) {
    //                 const rect = element.getBoundingClientRect()
    //                 if (rect.top >= headerOffset && rect.top < window.innerHeight / 2) {
    //                     setCategoriaAtiva(cat.id)
    //                     break
    //                 }
    //             }
    //         }
    //     }

    //     window.addEventListener('scroll', handleScroll, { passive: true })
    //     return () => window.removeEventListener('scroll', handleScroll)
    // }, [categorias])

    const scrollToCategory = (catId) => {
        setCategoriaAtiva(catId)
        // Scroll suave para a categoria (sem usar getBoundingClientRect que pode causar problemas)
        setTimeout(() => {
            const element = document.getElementById(`cat-${catId}`)
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
        }, 100)
    }

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
        // Haptic Feedback
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(50)
        }

        // Preço efetivo (promoção > preço normal)
        const precoEfetivo = Number(produto.preco_promocional || produto.preco || 0)

        const existe = carrinho.find(item => item.id === produto.id)
        if (existe) {
            setCarrinho(carrinho.map(item =>
                item.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item
            ))
        } else {
            // Salvar o preço efetivo no item do carrinho para evitar divergência no total
            setCarrinho([...carrinho, { ...produto, preco: precoEfetivo, quantidade: 1 }])
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

    const calcularDescontoPix = (subtotal) => {
        if (formaPagamento === 'pix') {
            return subtotal * 0.05 // 5% de desconto
        }
        return 0
    }

    const calcularTotalFinal = () => {
        const subtotal = calcularTotal()
        const desconto = calcularDescontoPix(subtotal)
        const taxa = (modalidade === 'delivery' && endereco.bairro) ? taxaEntrega : 0
        return subtotal - desconto + taxa
    }

    const formatarPreco = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)

    const formatarTelefone = (valor) => {
        const apenasNumeros = valor.replace(/\D/g, '')
        if (apenasNumeros.length <= 2) return apenasNumeros
        if (apenasNumeros.length <= 7) return `(${apenasNumeros.slice(0, 2)}) ${apenasNumeros.slice(2)}`
        return `(${apenasNumeros.slice(0, 2)}) ${apenasNumeros.slice(2, 7)}-${apenasNumeros.slice(7, 11)}`
    }

    const validarTelefone = (telefone) => {
        const apenasNumeros = telefone.replace(/\D/g, '')
        return apenasNumeros.length >= 10 && apenasNumeros.length <= 11
    }

    const normalizarTelefoneDigits = (telefone) => {
        const digits = String(telefone || '').replace(/\D/g, '')
        if (!digits) return ''
        if (digits.startsWith('55')) return digits
        if (digits.length === 10 || digits.length === 11) return `55${digits}`
        return digits
    }

    const VALOR_MINIMO_PEDIDO = 20.00 // Valor mínimo de pedido

    const validarValorMinimo = () => {
        return calcularTotal() >= VALOR_MINIMO_PEDIDO
    }

    const validarBairroAtendido = () => {
        if (modalidade === 'retirada') return true // Retirada não precisa validar bairro
        if (!endereco.bairro) return false
        return bairrosEntrega.some(b => b.nome === endereco.bairro)
    }

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
            // Validações
            if (!validarValorMinimo()) {
                alert(`⚠️ Valor mínimo de pedido é ${formatarPreco(VALOR_MINIMO_PEDIDO)}.\n\nSeu pedido atual: ${formatarPreco(calcularTotal())}`)
                return
            }

            if (modalidade === 'delivery' && !validarBairroAtendido()) {
                alert('⚠️ Não atendemos este bairro. Por favor, selecione um bairro da lista ou escolha a opção "Retirada".')
                return
            }

            if (!validarTelefone(telefoneCliente)) {
                alert('⚠️ Por favor, informe um telefone válido.\n\nExemplo: (27) 99999-9999')
                return
            }

            // Criar pedido no banco
            const subtotal = calcularTotal()
            const descontoPix = calcularDescontoPix(subtotal)
            const taxa = (modalidade === 'delivery' && endereco.bairro) ? taxaEntrega : 0
            const totalFinal = subtotal - descontoPix + taxa

            // Observações com troco
            let observacoes = endereco.complemento || ''
            if (formaPagamento === 'dinheiro' && precisaTroco && trocoParaValor) {
                observacoes += ` | Troco para R$ ${trocoParaValor}`
            }

            // Preparar observações com desconto PIX se aplicável
            if (descontoPix > 0) {
                observacoes = `Desconto PIX: ${formatarPreco(descontoPix)}${observacoes ? ' | ' + observacoes : ''}`
            }

            const { data: pedido, error } = await supabase
                .from('pedidos')
                .insert({
                    phone: normalizarTelefoneDigits(telefoneCliente), // Salvar apenas números (com 55)
                    nome_cliente: nomeCliente,
                    // Padronizar itens como JSON (array de objetos) para ficar igual ao agente IA
                    itens: carrinho.map(item => ({
                        nome: item.nome,
                        quantidade: item.quantidade,
                        preco_unitario: Number(item.preco || 0)
                    })),
                    valor_total: totalFinal,
                    taxa_entrega: taxa,
                    endereco_entrega: modalidade === 'delivery' ? `${endereco.rua}, ${endereco.numero}` : 'Retirada no local',
                    bairro: modalidade === 'delivery' ? endereco.bairro : 'Retirada',
                    forma_pagamento: formaPagamento,
                    observacoes: observacoes,
                    status: 'pendente',
                    modalidade: modalidade || 'delivery',
                    ponto_referencia: modalidade === 'delivery' ? (endereco.complemento || null) : null
                })
                .select()
                .single()

            if (error) throw error

            // Sucesso Personalizado
            setLastOrderId(pedido.id)
            setShowSuccess(true)
            
            // Limpar estados
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

    // Componente Skeleton Loading
    const SkeletonCard = () => (
        <div className="bg-bg-card rounded-2xl border border-white/5 overflow-hidden flex shadow-lg animate-pulse">
            <div className="w-32 h-32 bg-white/5 flex-shrink-0" />
            <div className="flex-1 p-4 flex flex-col justify-between">
                <div className="space-y-2">
                    <div className="h-4 bg-white/10 rounded w-3/4" />
                    <div className="h-3 bg-white/5 rounded w-full" />
                </div>
                <div className="flex items-end justify-between mt-3">
                    <div className="h-5 bg-white/10 rounded w-20" />
                    <div className="w-10 h-10 bg-white/10 rounded-full" />
                </div>
            </div>
        </div>
    )

    if (loading) {
        return (
            <div className="min-h-screen bg-bg-dark flex justify-center overflow-hidden">
                <div className="w-full max-w-md bg-bg-dark min-h-screen shadow-2xl shadow-black relative">
                    {/* Skeleton Header */}
                    <div className="w-full h-[200px] bg-white/5 animate-pulse" />
                    <div className="px-4 -mt-6 relative z-10">
                        <div className="h-12 bg-bg-card border border-white/5 rounded-xl animate-pulse" />
                    </div>
                    {/* Skeleton Categories */}
                    <div className="flex gap-3 px-4 py-4 overflow-hidden">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-8 w-24 bg-white/5 rounded-full animate-pulse flex-shrink-0" />
                        ))}
                    </div>
                    {/* Skeleton List */}
                    <div className="px-4 space-y-4">
                        {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-bg-dark flex justify-center font-sans text-gray-100">
            {/* Container App Mobile */}
            <div className="w-full max-w-md bg-bg-dark min-h-screen shadow-2xl shadow-black relative">
                {/* Banner Hero */}
                <div className="w-full relative group overflow-hidden rounded-b-3xl shadow-inner shadow-black/40">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/85 via-transparent to-transparent z-10 h-full pointer-events-none" />
                    <img
                        src="https://cxhypcvdijqauaibcgyp.supabase.co/storage/v1/object/public/produtos/banner-hero.png"
                        alt="Império das Porções"
                        className="w-full object-cover max-h-[200px]"
                        loading="lazy"
                    />
                </div>

                {/* Status Bar */}
                <div className="mx-4 mt-2 relative z-20 bg-bg-card/85 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 shadow-lg flex items-center justify-between gap-3 max-w-[95%]">
                     <div className="flex items-center gap-2">
                        <span className={`relative flex h-3 w-3`}>
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusRestaurante.aberto ? 'bg-green-400' : 'bg-red-400'}`}></span>
                          <span className={`relative inline-flex rounded-full h-3 w-3 ${statusRestaurante.aberto ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        </span>
                        <span className="text-sm font-medium text-white">{statusRestaurante.aberto ? 'Aberto Agora' : 'Fechado'}</span>
                     </div>
                     <span className="text-xs text-gray-400 font-medium">{statusRestaurante.mensagem}</span>
                </div>

                {/* Info do Restaurante (Expandable) */}
                <div className="px-4 py-4" onClick={() => setShowInfo(true)}>
                    <div className="flex items-center justify-between cursor-pointer bg-bg-card p-4 rounded-xl border border-white/5 hover:border-imperio-red/30 transition-colors">
                        <div className="flex items-center gap-3">
                             <div className="bg-imperio-red/10 p-2 rounded-lg text-imperio-red">
                                <Clock size={20} />
                             </div>
                             <div>
                                <p className="text-sm font-bold text-white">Tempo de Entrega</p>
                                <p className="text-gray-400 text-xs">50 - 60 min • Entrega Própria</p>
                             </div>
                        </div>
                        <ChevronRight size={20} className="text-gray-500" />
                    </div>
                </div>

                {/* Fidelidade */}
                <div className="px-4 pb-4" onClick={() => setShowFidelidade(true)}>
                    <div className="bg-gradient-to-r from-bg-card to-bg-light p-4 rounded-xl border border-gold/20 relative overflow-hidden cursor-pointer group">
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Gift size={64} className="text-gold" />
                        </div>
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="bg-gold/10 p-2 rounded-lg text-gold border border-gold/20">
                                <Gift size={20} />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-white mb-1">Programa Fidelidade</p>
                                <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1">
                                    <div className="bg-gold h-1.5 rounded-full" style={{ width: `${(pedidosCliente / 10) * 100}%` }} />
                                </div>
                                <p className="text-[10px] text-gray-400">
                                    {pedidosCliente}/10 pedidos para ganhar <span className="text-gold font-bold">BRINDE EXCLUSIVO</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Categorias - Scroll horizontal */}
                <div className="sticky top-0 z-30 bg-bg-dark/95 backdrop-blur-md border-b border-white/5 py-2 shadow-sm">
                    <div className="flex gap-3 overflow-x-auto px-4 pb-2 pt-1 scrollbar-hide">
                        {categorias.map(cat => (
                            <button
                                key={cat.id}
                                id={`menu-cat-${cat.id}`}
                                onClick={() => scrollToCategory(cat.id)}
                                className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 flex-shrink-0 border ${categoriaAtiva === cat.id
                                    ? 'bg-imperio-red text-white border-imperio-red shadow-lg shadow-imperio-red/25 scale-105'
                                    : 'bg-bg-card text-gray-400 border-white/10 hover:border-white/20 hover:text-white'
                                    }`}
                            >
                                {cat.nome}
                            </button>
                        ))}
                        {/* Espaço extra no final */}
                        <div className="w-4 flex-shrink-0" />
                    </div>
                </div>

                {/* Lista de Produtos Organizada por Categoria para Scroll Spy */}
                <div className="pb-32">
                    {categorias.map(cat => {
                        const produtosDaCategoria = produtos.filter(p => p.categoria_id === cat.id)
                        if (produtosDaCategoria.length === 0) return null

                        return (
                            <div key={cat.id} id={`cat-${cat.id}`} className="scroll-mt-40">
                                {/* Título da Categoria */}
                                <div className="px-4 pt-6 pb-4">
                                    <h2 className="text-xl font-display text-white tracking-wider border-l-4 border-imperio-red pl-3">
                                        {cat.nome}
                                    </h2>
                                </div>

                                {/* Produtos */}
                                <div className="px-4 space-y-4">
                                    {produtosDaCategoria.map((produto, index) => (
                                        <div 
                                            key={produto.id} 
                                            className="bg-bg-card rounded-2xl border border-white/5 overflow-hidden flex shadow-lg hover:border-white/10 transition-colors group animate-slideUp"
                                            style={{ animationDelay: `${index * 50}ms` }}
                                        >
                                            {/* Imagem */}
                                            {produto.imagem && (
                                                <div className="w-32 h-auto relative flex-shrink-0">
                                                    <img
                                                        src={produto.imagem}
                                                        alt={produto.nome}
                                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                        loading="lazy"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-50" />
                                                    {/* Badge Promocional */}
                                                    {produto.preco_promocional && (
                                                        <div className="absolute top-2 left-2 bg-imperio-red text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg animate-pulse-red">
                                                            OFERTA
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Conteúdo */}
                                            <div className="flex-1 p-4 flex flex-col justify-between relative">
                                                <div>
                                                    <h3 className="font-bold text-white text-base leading-tight mb-1">{produto.nome}</h3>
                                                    {produto.descricao && (
                                                        <p className="text-gray-400 text-xs line-clamp-2 leading-relaxed">{produto.descricao}</p>
                                                    )}
                                                </div>
                                                
                                                <div className="flex items-end justify-between mt-3">
                                                    <div className="flex flex-col">
                                                        {produto.preco_promocional && (
                                                            <span className="text-gray-500 text-xs line-through">{formatarPreco(produto.preco)}</span>
                                                        )}
                                                        <p className="text-gold font-bold text-lg leading-none">
                                                            {formatarPreco(produto.preco_promocional || produto.preco)}
                                                        </p>
                                                    </div>
                                                    
                                                    <button
                                                        onClick={() => adicionarAoCarrinho(produto)}
                                                        className="w-10 h-10 bg-imperio-red text-white rounded-full flex items-center justify-center shadow-lg shadow-imperio-red/30 active:scale-90 transition-transform hover:bg-red-600 active:bg-red-700"
                                                    >
                                                        <Plus size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Espaço para o botão do carrinho (removido pois agora é fixed bottom com padding no container pai) */}
                
                {/* Botão flutuante do carrinho - Estilo Barra Inferior Premium */}
                {carrinho.length > 0 && (
                    <div className="fixed bottom-0 left-0 w-full z-40 px-4 pb-6 pt-2 bg-gradient-to-t from-bg-dark via-bg-dark to-transparent pointer-events-none flex justify-center">
                        <button
                            onClick={() => setShowCarrinho(true)}
                            className={`w-full max-w-md pointer-events-auto bg-imperio-red text-white rounded-2xl p-4 shadow-xl shadow-imperio-red/20 flex items-center justify-between group active:scale-[0.98] transition-all border border-red-500/50 ${cartAnimation ? 'animate-scaleIn' : ''}`}
                        >
                             <div className="flex items-center gap-3">
                                <div className={`bg-white/20 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm transition-transform ${cartAnimation ? 'scale-110' : ''}`}>
                                    <span className="font-bold text-sm">{carrinho.reduce((t, i) => t + i.quantidade, 0)}</span>
                                </div>
                                <div className="text-left">
                                    <p className="text-xs text-white/80 font-medium uppercase tracking-wide">Ver sua sacola</p>
                                    <p className="font-bold text-lg leading-none">R$ {formatarPreco(calcularTotal()).replace('R$', '')}</p>
                                </div>
                             </div>
                             <div className="flex items-center gap-2 text-sm font-bold opacity-90 group-hover:opacity-100 transition-opacity">
                                <span>Finalizar</span>
                                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                             </div>
                        </button>
                    </div>
                )}

                {/* Modal Carrinho */}
                {showCarrinho && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center animate-fadeIn">
                        <div className="bg-bg-dark w-full max-w-md rounded-t-3xl max-h-[95vh] flex flex-col border-t border-white/10 shadow-2xl">
                            {/* Header Fixo */}
                            <div className="flex items-center justify-between p-5 border-b border-white/10 flex-shrink-0">
                                <h2 className="text-xl font-display text-white tracking-wide">Sacola ({carrinho.reduce((t, i) => t + i.quantidade, 0)})</h2>
                                <button onClick={() => setShowCarrinho(false)} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
                            </div>

                            {/* Conteúdo com Scroll */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-5 pb-32">
                                {/* Lista de Itens */}
                                {carrinho.map(item => (
                                    <div key={item.id} className="flex items-center justify-between border-b border-white/5 pb-4 last:border-0">
                                        <div className="flex-1 pr-4">
                                            <h4 className="font-bold text-white text-base mb-1">{item.nome}</h4>
                                            <p className="text-gold font-bold text-sm">{formatarPreco(item.preco)}</p>
                                        </div>
                                        <div className="flex items-center gap-3 bg-bg-card border border-white/10 rounded-xl p-1.5 shadow-sm">
                                            <button onClick={() => removerDoCarrinho(item.id)} className="w-8 h-8 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg flex items-center justify-center transition-colors">
                                                <Minus size={18} />
                                            </button>
                                            <span className="w-6 text-center font-bold text-white text-base">{item.quantidade}</span>
                                            <button onClick={() => adicionarAoCarrinho(item)} className="w-8 h-8 bg-imperio-red text-white rounded-lg flex items-center justify-center shadow-lg shadow-imperio-red/20 active:scale-90 transition-transform">
                                                <Plus size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Resumo e Formulário */}
                                {carrinho.length > 0 && (
                                    <div className="space-y-6 pt-2">
                                        {/* Valores */}
                                        <div className="bg-bg-card p-5 rounded-2xl border border-white/5 space-y-3">
                                            <div className="flex justify-between text-gray-400 text-sm">
                                                <span>Subtotal</span>
                                                <span className="text-white font-medium">{formatarPreco(calcularTotal())}</span>
                                            </div>
                                            {formaPagamento === 'pix' && calcularDescontoPix(calcularTotal()) > 0 && (
                                                <div className="flex justify-between text-green-400 text-sm font-semibold">
                                                    <span>Desconto PIX (5%)</span>
                                                    <span>-{formatarPreco(calcularDescontoPix(calcularTotal()))}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between text-gray-400 text-sm">
                                                <span>
                                                    {modalidade === 'retirada' ? 'Retirada' : 'Taxa de entrega'}
                                                </span>
                                                <span className={modalidade === 'retirada' ? 'text-green-400 font-semibold' : 'text-white font-medium'}>
                                                    {modalidade === 'retirada' ? 'Grátis' :
                                                        taxaEntrega > 0 ? formatarPreco(taxaEntrega) : 'Selecione o bairro'}
                                                </span>
                                            </div>
                                            {!validarValorMinimo() && (
                                                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 mt-2 flex gap-2 items-start">
                                                    <div className="text-yellow-500 mt-0.5">⚠️</div>
                                                    <p className="text-yellow-200 text-xs leading-relaxed">
                                                        <span className="font-bold text-yellow-500">Valor mínimo: {formatarPreco(VALOR_MINIMO_PEDIDO)}</span><br/>
                                                        Faltam {formatarPreco(VALOR_MINIMO_PEDIDO - calcularTotal())} para fechar o pedido.
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Escolha de Modalidade: Delivery ou Retirada */}
                                        {!modalidade ? (
                                            <div className="text-center py-8 px-5 bg-bg-card rounded-2xl border border-white/10 border-dashed">
                                                <h3 className="font-bold text-white text-lg mb-6">Como deseja receber?</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <button
                                                        onClick={() => { setModalidade('delivery'); setShowCarrinho(false); setShowEndereco(true); }}
                                                        className="p-5 bg-blue-500/10 border border-blue-500/30 rounded-2xl hover:bg-blue-500/20 transition-all group"
                                                    >
                                                        <div className="bg-blue-500/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-400 group-hover:scale-110 transition-transform">
                                                           <MapPin size={24} />
                                                        </div>
                                                        <span className="font-bold text-blue-100 block mb-1">Delivery</span>
                                                        <span className="text-blue-300/70 text-xs">Receba em casa</span>
                                                    </button>
                                                    <button
                                                        onClick={() => { setModalidade('retirada'); setTaxaEntrega(0); }}
                                                        className="p-5 bg-green-500/10 border border-green-500/30 rounded-2xl hover:bg-green-500/20 transition-all group"
                                                    >
                                                        <div className="bg-green-500/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-green-400 group-hover:scale-110 transition-transform">
                                                           <Store size={24} />
                                                        </div>
                                                        <span className="font-bold text-green-100 block mb-1">Retirada</span>
                                                        <span className="text-green-300/70 text-xs">Retire no local</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : modalidade === 'delivery' && !endereco.bairro ? (
                                            <div className="text-center py-8 px-5 bg-bg-card rounded-2xl border border-white/10 border-dashed">
                                                <div className="bg-blue-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
                                                    <MapPin className="h-8 w-8 text-blue-400" />
                                                </div>
                                                <h3 className="font-bold text-white mb-2 text-lg">Onde vamos entregar?</h3>
                                                <p className="text-gray-400 mb-6 text-sm">Informe seu endereço para calcular a taxa de entrega.</p>
                                                <button
                                                    onClick={() => { setShowCarrinho(false); setShowEndereco(true); }}
                                                    className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
                                                >
                                                    <MapPin size={20} /> Informar Endereço
                                                </button>
                                                <button
                                                    onClick={() => { setModalidade(''); }}
                                                    className="w-full py-3 mt-2 text-gray-500 text-sm hover:text-white transition-colors"
                                                >
                                                    Trocar para Retirada
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                {/* Card Endereço ou Retirada */}
                                                {modalidade === 'delivery' && endereco.bairro ? (
                                                    <div className="bg-bg-card p-4 rounded-xl border border-blue-500/20 shadow-sm relative overflow-hidden group">
                                                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full -mr-10 -mt-10 blur-xl"></div>
                                                        <div className="flex items-start gap-3 relative z-10">
                                                            <div className="bg-blue-500/10 p-2.5 rounded-lg text-blue-400 border border-blue-500/20">
                                                                <MapPin size={20} />
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="font-bold text-white text-sm">{endereco.rua}, {endereco.numero}</p>
                                                                <p className="text-gray-400 text-xs mt-0.5">{endereco.bairro}</p>
                                                                {endereco.complemento && <p className="text-gray-500 text-xs mt-0.5">{endereco.complemento}</p>}
                                                            </div>
                                                            <button
                                                                onClick={() => { setShowCarrinho(false); setShowEndereco(true); }}
                                                                className="text-blue-400 text-xs font-bold hover:text-blue-300 self-start mt-1 px-2 py-1 rounded hover:bg-blue-500/10 transition-colors"
                                                            >
                                                                ALTERAR
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : modalidade === 'retirada' ? (
                                                    <div className="bg-bg-card p-4 rounded-xl border border-green-500/20 shadow-sm relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-bl-full -mr-10 -mt-10 blur-xl"></div>
                                                        <div className="flex items-start gap-3 relative z-10">
                                                            <div className="bg-green-500/10 p-2.5 rounded-lg text-green-400 border border-green-500/20">
                                                                <Store size={20} />
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="font-bold text-white text-sm">Retirada no Local</p>
                                                                <p className="text-gray-400 text-xs mt-0.5">Você retirará seu pedido no restaurante</p>
                                                            </div>
                                                            <button
                                                                onClick={() => { setModalidade(''); }}
                                                                className="text-green-400 text-xs font-bold hover:text-green-300 self-start mt-1 px-2 py-1 rounded hover:bg-green-500/10 transition-colors"
                                                            >
                                                                ALTERAR
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : null}

                                                {/* Dados Pessoais */}
                                                <div className="space-y-4">
                                                    <h4 className="font-bold text-gray-400 flex items-center gap-2 text-xs uppercase tracking-widest border-b border-white/5 pb-2">
                                                        <User size={14} /> Seus Dados
                                                    </h4>
                                                    <div className="space-y-3">
                                                        <input
                                                            type="text"
                                                            placeholder="Seu nome completo"
                                                            value={nomeCliente}
                                                            onChange={(e) => setNomeCliente(e.target.value)}
                                                            className="w-full p-4 bg-bg-card border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-imperio-red focus:ring-1 focus:ring-imperio-red outline-none transition-all"
                                                        />
                                                        <input
                                                            type="tel"
                                                            placeholder="WhatsApp com DDD"
                                                            value={telefoneCliente}
                                                            onChange={(e) => {
                                                                const formatado = formatarTelefone(e.target.value)
                                                                setTelefoneCliente(formatado)
                                                            }}
                                                            maxLength={15}
                                                            className="w-full p-4 bg-bg-card border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-imperio-red focus:ring-1 focus:ring-imperio-red outline-none transition-all"
                                                        />
                                                        {telefoneCliente && !validarTelefone(telefoneCliente) && (
                                                            <p className="text-red-500 text-xs mt-1 ml-1">Telefone inválido. Ex: (27) 99999-9999</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Forma de Pagamento */}
                                                <div className="space-y-4">
                                                    <h4 className="font-bold text-gray-400 flex items-center gap-2 text-xs uppercase tracking-widest border-b border-white/5 pb-2">
                                                        <CreditCard size={14} /> Pagamento
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
                                                                className={`p-4 rounded-xl border transition-all relative overflow-hidden group ${formaPagamento === op.id
                                                                    ? 'border-imperio-red bg-imperio-red/10'
                                                                    : 'border-white/10 bg-bg-card hover:border-white/20'
                                                                    }`}
                                                            >
                                                                <div className="flex justify-between items-center mb-2 relative z-10">
                                                                    <span className="text-2xl grayscale group-hover:grayscale-0 transition-all">{op.icon}</span>
                                                                    {op.id === 'pix' && <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-1 rounded-full border border-green-500/30">OFF</span>}
                                                                </div>
                                                                <span className={`block font-bold text-sm relative z-10 ${formaPagamento === op.id ? 'text-white' : 'text-gray-400'}`}>{op.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {/* Troco */}
                                                    {formaPagamento === 'dinheiro' && (
                                                        <div className="bg-bg-card p-4 rounded-xl space-y-3 border border-white/10 animate-in zoom-in-95 duration-200">
                                                            <label className="flex items-center gap-3 text-white font-medium cursor-pointer select-none">
                                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${precisaTroco ? 'bg-imperio-red border-imperio-red' : 'bg-transparent border-gray-500'}`}>
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
                                                                    className="w-full p-3 bg-bg-dark border border-white/10 rounded-lg text-white focus:border-yellow-500 outline-none"
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
                            <div className="p-5 bg-bg-card border-t border-white/10 z-20 sticky bottom-0 safe-area-bottom shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                                <div className="flex justify-between items-end mb-4">
                                    <span className="text-gray-400 text-sm font-medium">Total a pagar</span>
                                    <div className="text-right">
                                        <span className="text-2xl font-bold text-white block leading-none mb-1">{formatarPreco(calcularTotalFinal())}</span>
                                        {modalidade === 'delivery' && taxaEntrega > 0 && <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Taxa de entrega inclusa</p>}
                                        {modalidade === 'retirada' && <p className="text-[10px] text-green-400 uppercase tracking-wider font-bold">Retirada no local</p>}
                                        {formaPagamento === 'pix' && calcularDescontoPix(calcularTotal()) > 0 && (
                                            <p className="text-[10px] text-green-400 uppercase tracking-wider font-bold">Desconto PIX aplicado</p>
                                        )}
                                    </div>
                                </div>

                                {carrinho.length > 0 ? (
                                    modalidade && (modalidade === 'retirada' || endereco.bairro) ? (
                                        <button
                                            onClick={finalizarPedido}
                                            disabled={
                                                !nomeCliente || 
                                                !telefoneCliente || 
                                                !validarTelefone(telefoneCliente) ||
                                                !formaPagamento || 
                                                (formaPagamento === 'dinheiro' && precisaTroco && !trocoParaValor) ||
                                                !validarValorMinimo() ||
                                                (modalidade === 'delivery' && !validarBairroAtendido())
                                            }
                                            className="w-full py-4 bg-imperio-red text-white rounded-xl font-bold text-lg shadow-lg shadow-imperio-red/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all"
                                        >
                                            <span>Enviar Pedido</span>
                                            <Send size={20} />
                                        </button>
                                    ) : modalidade === 'delivery' && !endereco.bairro ? (
                                        <div className="grid grid-cols-2 gap-3">
                                            <button onClick={() => setShowCarrinho(false)} className="py-3 px-4 bg-white/5 text-white rounded-xl font-bold text-sm hover:bg-white/10 transition-colors">
                                                Voltar
                                            </button>
                                            <button onClick={() => { setShowCarrinho(false); setShowEndereco(true); }} className="py-3 px-4 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-colors">
                                                Endereço <MapPin size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={() => setShowCarrinho(false)} className="w-full py-4 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-colors">
                                            Voltar ao Cardápio
                                        </button>
                                    )
                                ) : (
                                    <button onClick={() => setShowCarrinho(false)} className="w-full py-4 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-colors">
                                        Voltar ao Cardápio
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Endereço */}
                {showEndereco && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center animate-fadeIn">
                        <div className="bg-bg-dark w-full max-w-md rounded-t-3xl max-h-[90vh] overflow-hidden border-t border-white/10 shadow-2xl">
                            <div className="flex items-center justify-between p-5 border-b border-white/10">
                                <h2 className="text-xl font-display text-white tracking-wide">Endereço de Entrega</h2>
                                <button onClick={() => setShowEndereco(false)} className="p-2 text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
                            </div>
                            <div className="p-5 space-y-5 overflow-y-auto max-h-[70vh]">
                                {/* Bairro */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Bairro *</label>
                                    <select
                                        value={endereco.bairro}
                                        onChange={(e) => {
                                            const bairro = bairrosEntrega.find(b => b.nome === e.target.value)
                                            setEndereco({ ...endereco, bairro: e.target.value })
                                            setTaxaEntrega(bairro ? bairro.taxa : 0)
                                        }}
                                        className="w-full p-4 border border-white/10 rounded-xl text-white bg-bg-card focus:border-imperio-red focus:ring-1 focus:ring-imperio-red outline-none appearance-none"
                                    >
                                        <option value="" className="bg-bg-dark">Selecione seu bairro</option>
                                        {bairrosEntrega.map(b => (
                                            <option key={b.nome} value={b.nome} className="bg-bg-dark">{b.nome} - {formatarPreco(b.taxa)}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* Rua */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Rua *</label>
                                    <input
                                        type="text"
                                        value={endereco.rua}
                                        onChange={(e) => setEndereco({ ...endereco, rua: e.target.value })}
                                        placeholder="Ex: Rua das Flores"
                                        className="w-full p-4 border border-white/10 rounded-xl text-white bg-bg-card focus:border-imperio-red focus:ring-1 focus:ring-imperio-red outline-none placeholder-gray-600"
                                    />
                                </div>
                                {/* Número */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Número *</label>
                                    <input
                                        type="text"
                                        value={endereco.numero}
                                        onChange={(e) => setEndereco({ ...endereco, numero: e.target.value })}
                                        placeholder="Ex: 123"
                                        className="w-full p-4 border border-white/10 rounded-xl text-white bg-bg-card focus:border-imperio-red focus:ring-1 focus:ring-imperio-red outline-none placeholder-gray-600"
                                    />
                                </div>
                                {/* Complemento / Ponto de Referência */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Ponto de Referência / Complemento</label>
                                    <input
                                        type="text"
                                        value={endereco.complemento}
                                        onChange={(e) => setEndereco({ ...endereco, complemento: e.target.value })}
                                        placeholder="Ex: Apto 101, Bloco A, próximo ao mercado..."
                                        className="w-full p-4 border border-white/10 rounded-xl text-white bg-bg-card focus:border-imperio-red focus:ring-1 focus:ring-imperio-red outline-none placeholder-gray-600"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">Opcional: ajude o entregador a encontrar seu endereço</p>
                                </div>
                                {/* Taxa */}
                                {taxaEntrega > 0 && (
                                    <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-500/20">
                                        <p className="text-blue-400 font-bold flex items-center gap-2">
                                            <MapPin size={16} />
                                            Taxa de entrega: {formatarPreco(taxaEntrega)}
                                        </p>
                                    </div>
                                )}
                                {/* Validação de bairro atendido */}
                                {endereco.bairro && !bairrosEntrega.some(b => b.nome === endereco.bairro) && (
                                    <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                                        <p className="text-red-400 text-sm font-bold flex items-center gap-2">
                                            ⚠️ Não atendemos este bairro.
                                        </p>
                                        <p className="text-red-300/70 text-xs mt-1 pl-6">
                                            Por favor, selecione um bairro da lista acima ou escolha a opção "Retirada".
                                        </p>
                                    </div>
                                )}

                                {/* Botão Confirmar */}
                                <button
                                    onClick={() => {
                                        if (!endereco.bairro || !endereco.rua || !endereco.numero) {
                                            alert('Preencha todos os campos obrigatórios')
                                            return
                                        }
                                        if (!bairrosEntrega.some(b => b.nome === endereco.bairro)) {
                                            alert('⚠️ Não atendemos este bairro. Por favor, selecione um bairro da lista ou escolha a opção "Retirada".')
                                            return
                                        }
                                        setShowEndereco(false)
                                        setShowCarrinho(true)
                                    }}
                                    className="w-full py-4 bg-imperio-red text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-imperio-red/20 hover:bg-red-600 transition-colors"
                                    disabled={!endereco.bairro || !endereco.rua || !endereco.numero || !bairrosEntrega.some(b => b.nome === endereco.bairro)}
                                >
                                    Confirmar Endereço
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Info */}
                {showInfo && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
                        <div className="bg-bg-dark w-full max-w-md rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                            <div className="flex items-center justify-between p-5 border-b border-white/10">
                                <h2 className="text-xl font-display text-white tracking-wide">Império das Porções</h2>
                                <button onClick={() => setShowInfo(false)} className="p-2 text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
                            </div>
                            <div className="p-5 space-y-6">
                                <p className="text-gray-300">A melhor porção da região, preparada com ingredientes frescos e muito sabor.</p>
                                <div>
                                    <h3 className="font-bold flex items-center gap-2 mb-3 text-white uppercase tracking-wider text-sm"><Clock size={16} className="text-imperio-red" /> Horário de funcionamento</h3>
                                    <div className="text-sm text-gray-400 space-y-2 bg-bg-card p-4 rounded-xl border border-white/5">
                                        {DIAS_SEMANA.map((dia, i) => (
                                            <div key={dia} className="flex justify-between border-b border-white/5 last:border-0 pb-1 last:pb-0">
                                                <span>{dia}:</span>
                                                <span className={horarios[i]?.aberto ? 'text-white font-medium' : 'text-imperio-red'}>
                                                    {horarios[i]?.aberto ? `${horarios[i].inicio} às ${horarios[i].fim}` : 'Fechado'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold flex items-center gap-2 mb-3 text-white uppercase tracking-wider text-sm"><CreditCard size={16} className="text-imperio-red" /> Formas de pagamento</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {['PIX', 'Dinheiro', 'Crédito', 'Débito'].map(p => (
                                            <span key={p} className="bg-bg-card border border-white/10 text-gray-300 px-3 py-1 rounded-full text-xs font-medium">{p}</span>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold flex items-center gap-2 mb-2 text-white uppercase tracking-wider text-sm"><MapPin size={16} className="text-imperio-red" /> Endereço</h3>
                                    <p className="text-sm text-gray-400 mb-2">{LOCALIZACAO.endereco}</p>
                                    <a href={`https://www.google.com/maps?q=${LOCALIZACAO.lat},${LOCALIZACAO.lng}`} target="_blank" rel="noopener noreferrer" className="text-imperio-red text-sm font-bold hover:underline flex items-center gap-1">Ver no mapa <ChevronRight size={14} /></a>
                                </div>
                                {/* Botão Fechar */}
                                <button
                                    onClick={() => setShowInfo(false)}
                                    className="w-full py-3.5 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-colors border border-white/5"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Fidelidade */}
                {showFidelidade && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
                        <div className="bg-bg-dark w-full max-w-md rounded-2xl overflow-hidden border border-gold/20 shadow-[0_0_50px_rgba(212,175,55,0.1)]">
                            <div className="flex items-center justify-between p-5 border-b border-white/10">
                                <h2 className="text-xl font-display text-white tracking-wide">Programa de Fidelidade</h2>
                                <button onClick={() => setShowFidelidade(false)} className="p-2 text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
                            </div>
                            <div className="p-8 text-center bg-gradient-to-b from-bg-dark to-bg-card">
                                <div className="text-6xl mb-6 drop-shadow-[0_0_15px_rgba(212,175,55,0.5)] animate-bounce">🎁</div>
                                <p className="text-gray-300 mb-2 font-light">Faça <span className="font-bold text-imperio-red text-xl">10</span> pedidos e ganhe</p>
                                <p className="font-bold text-gold text-xl mb-8 uppercase tracking-wide border-y border-gold/20 py-4">PORÇÃO GRANDE MISTA FRANGO COM BATATA</p>
                                <div className="mb-8">
                                    <div className="flex justify-between text-sm text-gray-400 mb-2 font-medium">
                                        <span>Progresso</span>
                                        <span className="text-white">{pedidosCliente} de 10</span>
                                    </div>
                                    <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                                        <div className="bg-gradient-to-r from-imperio-red to-red-500 h-3 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(230,0,0,0.5)]" style={{ width: `${(pedidosCliente / 10) * 100}%` }} />
                                    </div>
                                </div>
                                <div className="text-left bg-bg-card border border-white/5 rounded-xl p-5 text-sm text-gray-400 mb-6 shadow-inner">
                                    <h4 className="font-bold text-white mb-3 uppercase tracking-wider text-xs flex items-center gap-2"><FileText size={14} /> Regras</h4>
                                    <ul className="space-y-2 list-none">
                                        <li className="flex items-start gap-2"><span className="text-gold">•</span> Contagem máxima de 1 pedido por dia</li>
                                        <li className="flex items-start gap-2"><span className="text-gold">•</span> Válido para pedidos com status concluído</li>
                                        <li className="flex items-start gap-2"><span className="text-gold">•</span> Válido somente para pedidos feitos pelo link</li>
                                        <li className="flex items-start gap-2"><span className="text-gold">•</span> Válido até 31/12/2025</li>
                                    </ul>
                                </div>
                                {/* Botão Fechar */}
                                <button
                                    onClick={() => setShowFidelidade(false)}
                                    className="w-full py-3.5 bg-imperio-red text-white rounded-xl font-bold hover:bg-red-600 transition-colors shadow-lg shadow-imperio-red/20"
                                >
                                    Entendi
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Sucesso */}
                {showSuccess && (
                    <div className="fixed inset-0 bg-imperio-red z-50 flex items-center justify-center animate-fadeIn">
                        <div className="text-center p-8 text-white relative w-full max-w-md">
                            {/* Confetes CSS simples */}
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                {[...Array(20)].map((_, i) => (
                                    <div 
                                        key={i}
                                        className="absolute w-3 h-3 bg-white/30 rounded-full animate-pulse"
                                        style={{
                                            left: `${Math.random() * 100}%`,
                                            top: `${Math.random() * 100}%`,
                                            animationDuration: `${0.5 + Math.random()}s`,
                                            animationDelay: `${Math.random()}s`
                                        }}
                                    />
                                ))}
                            </div>
                            
                            <div className="bg-white/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-lg animate-scaleIn shadow-2xl shadow-black/20">
                                <Check size={48} strokeWidth={4} />
                            </div>
                            
                            <h2 className="text-4xl font-display mb-2 animate-slideUp drop-shadow-md">Pedido Enviado!</h2>
                            <p className="text-white/90 text-lg mb-8 animate-slideUp delay-100 font-medium">
                                Obrigado pela preferência.<br/>
                                Acompanhe no WhatsApp.
                            </p>
                            
                            <div className="bg-black/20 rounded-xl p-4 mb-8 backdrop-blur-md animate-slideUp delay-200 border border-white/10">
                                <p className="text-xs uppercase tracking-widest text-white/60 mb-1 font-bold">Número do Pedido</p>
                                <p className="text-4xl font-bold font-mono text-white tracking-wider">#{lastOrderId}</p>
                            </div>

                            <button
                                onClick={() => setShowSuccess(false)}
                                className="bg-white text-imperio-red px-8 py-4 rounded-xl font-bold text-lg shadow-xl active:scale-95 transition-transform animate-slideUp delay-300 w-full hover:bg-gray-100"
                            >
                                Voltar ao Cardápio
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
