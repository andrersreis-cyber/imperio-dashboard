import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { QrCode, Copy, Check, ArrowLeft, Loader2 } from 'lucide-react'

export function Checkout({ carrinho, total, taxaEntrega, enderecoEntrega, onVoltar, onFinalizado, config }) {
    const [step, setStep] = useState('dados') // dados, pagamento, pix, confirmado
    const [loading, setLoading] = useState(false)
    const [copiado, setCopiado] = useState(false)
    const [dados, setDados] = useState({
        nome: '',
        telefone: '',
        endereco: enderecoEntrega ? `${enderecoEntrega.rua}, ${enderecoEntrega.numero}` : '',
        bairro: enderecoEntrega?.bairro || '',
        complemento: enderecoEntrega?.complemento || '',
        formaPagamento: 'pix'
    })
    const [pagamento, setPagamento] = useState(null)

    const formatarPreco = (valor) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor)
    }

    const gerarPixManual = () => {
        // Gerar código PIX estático (simulado)
        // Em produção, usar API do Mercado Pago ou outro gateway
        const chave = config?.pix_chave || '27999999999'
        const nome = config?.nome_restaurante || 'Imperio das Porcoes'
        const cidade = 'Cariacica'
        const valor = total.toFixed(2)

        // Código PIX simplificado para demonstração
        const pixCode = `00020126580014BR.GOV.BCB.PIX0136${chave}5204000053039865406${valor}5802BR5913${nome.substring(0, 13)}6008${cidade}62070503***6304`

        return pixCode
    }

    // Número do restaurante para receber pedidos
    const WHATSAPP_RESTAURANTE = '5527999099854'

    const enviarNotificacaoRestaurante = (pedido, itens, endereco, bairro) => {
        const mensagem = `🍗 *NOVO PEDIDO #${pedido.id}*

👤 *Cliente:* ${dados.nome}
📱 *Telefone:* ${dados.telefone}

📍 *Endereço:*
${endereco}, ${bairro}
${dados.complemento ? `Complemento: ${dados.complemento}` : ''}

🍽️ *Itens:*
${itens}

💰 *Total:* R$ ${total.toFixed(2).replace('.', ',')}
💳 *Pagamento:* ${dados.formaPagamento.toUpperCase()}

⏰ Pedido recebido via Cardápio Digital`

        window.open(`https://wa.me/${WHATSAPP_RESTAURANTE}?text=${encodeURIComponent(mensagem)}`, '_blank')
    }

    const criarPedido = async () => {
        setLoading(true)

        try {
            // Criar pedido no banco
            const itensTexto = carrinho.map(item =>
                `${item.quantidade}x ${item.nome}`
            ).join(', ')

            const { data: pedido, error: pedidoError } = await supabase
                .from('pedidos')
                .insert({
                    phone: dados.telefone,
                    nome_cliente: dados.nome,
                    itens: itensTexto,
                    valor_total: total + (taxaEntrega || 0),
                    taxa_entrega: taxaEntrega || 0,
                    endereco_entrega: dados.endereco,
                    bairro: dados.bairro,
                    forma_pagamento: dados.formaPagamento,
                    observacoes: dados.complemento || '',
                    status: 'pendente',
                    modalidade: 'delivery'
                })
                .select()
                .single()

            if (pedidoError) throw pedidoError

            // Enviar notificação WhatsApp para restaurante
            enviarNotificacaoRestaurante(pedido, itensTexto, dados.endereco, dados.bairro)

            // Se for PIX, criar registro de pagamento
            if (dados.formaPagamento === 'pix') {
                const pixCode = gerarPixManual()

                const { data: pagamentoData } = await supabase
                    .from('pagamentos')
                    .insert({
                        pedido_id: pedido.id,
                        tipo: 'pix',
                        valor: total,
                        status: 'pendente',
                        pix_copia_cola: pixCode
                    })
                    .select()
                    .single()

                setPagamento({
                    ...pagamentoData,
                    pedido_id: pedido.id
                })
                setStep('pix')
            } else {
                // Pagamento na entrega
                setStep('confirmado')
            }
        } catch (error) {
            console.error('Erro ao criar pedido:', error)
            alert('Erro ao criar pedido. Tente novamente.')
        } finally {
            setLoading(false)
        }
    }

    const copiarPix = () => {
        navigator.clipboard.writeText(pagamento.pix_copia_cola)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 3000)
    }

    const confirmarPagamento = async () => {
        setLoading(true)

        // Atualizar status do pagamento
        await supabase
            .from('pagamentos')
            .update({ status: 'pago', paid_at: new Date().toISOString() })
            .eq('id', pagamento.id)

        // Atualizar status do pedido  
        await supabase
            .from('pedidos')
            .update({ status: 'confirmado' })
            .eq('id', pagamento.pedido_id)

        setStep('confirmado')
        setLoading(false)
    }

    // Step: Dados
    if (step === 'dados') {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white">
                <header className="sticky top-0 bg-[#1a1a1a] border-b border-gray-800 p-4">
                    <div className="max-w-lg mx-auto flex items-center gap-4">
                        <button onClick={onVoltar} className="p-2 hover:bg-gray-800 rounded-lg">
                            <ArrowLeft size={24} />
                        </button>
                        <h1 className="text-xl font-bold">Finalizar Pedido</h1>
                    </div>
                </header>

                <main className="max-w-lg mx-auto p-4 space-y-6">
                    {/* Resumo */}
                    <div className="bg-[#1a1a1a] rounded-xl p-4 border border-gray-800">
                        <h3 className="font-bold mb-3">Resumo do Pedido</h3>
                        <div className="space-y-2 text-sm">
                            {carrinho.map(item => (
                                <div key={item.id} className="flex justify-between">
                                    <span>{item.quantidade}x {item.nome}</span>
                                    <span className="text-[#D4AF37]">{formatarPreco(item.preco * item.quantidade)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-gray-700 mt-3 pt-3 flex justify-between font-bold">
                            <span>Total</span>
                            <span className="text-[#D4AF37]">{formatarPreco(total)}</span>
                        </div>
                    </div>

                    {/* Dados de Entrega */}
                    <div className="bg-[#1a1a1a] rounded-xl p-4 border border-gray-800 space-y-4">
                        <h3 className="font-bold">Dados para Entrega</h3>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Nome *</label>
                            <input
                                type="text"
                                value={dados.nome}
                                onChange={(e) => setDados({ ...dados, nome: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                                placeholder="Seu nome"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">WhatsApp *</label>
                            <input
                                type="tel"
                                value={dados.telefone}
                                onChange={(e) => setDados({ ...dados, telefone: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                                placeholder="(27) 99999-9999"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Endereço *</label>
                            <input
                                type="text"
                                value={dados.endereco}
                                onChange={(e) => setDados({ ...dados, endereco: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                                placeholder="Rua, número"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Bairro *</label>
                            <input
                                type="text"
                                value={dados.bairro}
                                onChange={(e) => setDados({ ...dados, bairro: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                                placeholder="Bairro"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Complemento / Ponto de Referência</label>
                            <input
                                type="text"
                                value={dados.complemento}
                                onChange={(e) => setDados({ ...dados, complemento: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#D4AF37]"
                                placeholder="Apto, bloco, referência..."
                            />
                        </div>
                    </div>

                    {/* Forma de Pagamento */}
                    <div className="bg-[#1a1a1a] rounded-xl p-4 border border-gray-800 space-y-4">
                        <h3 className="font-bold">Forma de Pagamento</h3>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setDados({ ...dados, formaPagamento: 'pix' })}
                                className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${dados.formaPagamento === 'pix'
                                    ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                                    : 'border-gray-700'
                                    }`}
                            >
                                <QrCode size={28} className={dados.formaPagamento === 'pix' ? 'text-[#D4AF37]' : 'text-gray-400'} />
                                <span className="text-sm font-medium">PIX</span>
                                <span className="text-xs text-green-400">5% desconto</span>
                            </button>

                            <button
                                onClick={() => setDados({ ...dados, formaPagamento: 'entrega' })}
                                className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${dados.formaPagamento === 'entrega'
                                    ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                                    : 'border-gray-700'
                                    }`}
                            >
                                <span className="text-2xl">💵</span>
                                <span className="text-sm font-medium">Na Entrega</span>
                                <span className="text-xs text-gray-400">Dinheiro/Cartão</span>
                            </button>
                        </div>
                    </div>

                    {/* Botão Finalizar */}
                    <button
                        onClick={criarPedido}
                        disabled={loading || !dados.nome || !dados.telefone || !dados.endereco || !dados.bairro}
                        className="w-full py-4 bg-[#D4AF37] text-black font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <><Loader2 size={20} className="animate-spin" /> Processando...</>
                        ) : (
                            <>Confirmar Pedido - {formatarPreco(total)}</>
                        )}
                    </button>
                </main>
            </div>
        )
    }

    // Step: PIX
    if (step === 'pix') {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-[#1a1a1a] rounded-2xl p-6 border border-gray-800 text-center">
                    <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <QrCode size={32} className="text-cyan-400" />
                    </div>

                    <h2 className="text-2xl font-bold mb-2">Pague com PIX</h2>
                    <p className="text-gray-400 mb-6">Copie o código abaixo e pague no app do seu banco</p>

                    <div className="bg-gray-800 rounded-lg p-4 mb-4">
                        <p className="text-3xl font-bold text-[#D4AF37] mb-2">{formatarPreco(total)}</p>
                        <p className="text-sm text-gray-400">Pedido #{pagamento?.pedido_id}</p>
                    </div>

                    <div className="bg-gray-900 rounded-lg p-3 mb-4">
                        <p className="text-xs text-gray-400 mb-2">PIX Copia e Cola</p>
                        <p className="text-xs break-all text-gray-300 font-mono">
                            {pagamento?.pix_copia_cola?.substring(0, 50)}...
                        </p>
                    </div>

                    <button
                        onClick={copiarPix}
                        className="w-full py-4 bg-cyan-600 rounded-xl font-bold flex items-center justify-center gap-2 mb-4"
                    >
                        {copiado ? (
                            <><Check size={20} /> Copiado!</>
                        ) : (
                            <><Copy size={20} /> Copiar Código PIX</>
                        )}
                    </button>

                    <button
                        onClick={confirmarPagamento}
                        disabled={loading}
                        className="w-full py-4 bg-green-600 rounded-xl font-bold flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <><Loader2 size={20} className="animate-spin" /> Verificando...</>
                        ) : (
                            <>Já Paguei ✓</>
                        )}
                    </button>

                    <p className="text-xs text-gray-500 mt-4">
                        Após o pagamento, clique em "Já Paguei" para confirmar
                    </p>
                </div>
            </div>
        )
    }

    // Step: Confirmado
    if (step === 'confirmado') {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-[#1a1a1a] rounded-2xl p-6 border border-gray-800 text-center">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-4xl">✅</span>
                    </div>

                    <h2 className="text-2xl font-bold mb-2">Pedido Confirmado!</h2>
                    <p className="text-gray-400 mb-6">
                        Seu pedido foi recebido e está sendo preparado.
                    </p>

                    <div className="bg-gray-800 rounded-lg p-4 mb-6">
                        <p className="text-sm text-gray-400">Número do pedido</p>
                        <p className="text-3xl font-bold text-[#D4AF37]">#{pagamento?.pedido_id || '---'}</p>
                    </div>

                    <p className="text-sm text-gray-400 mb-6">
                        Você receberá atualizações pelo WhatsApp
                    </p>

                    <button
                        onClick={onFinalizado}
                        className="w-full py-4 bg-[#D4AF37] text-black font-bold rounded-xl"
                    >
                        Voltar ao Cardápio
                    </button>
                </div>
            </div>
        )
    }

    return null
}
