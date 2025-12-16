import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Header } from '../components/Header'
import {
    QrCode,
    Plus,
    Edit2,
    Trash2,
    Check,
    X,
    Printer,
    Circle
} from 'lucide-react'

export function Mesas() {
    const [mesas, setMesas] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editando, setEditando] = useState(null)
    const [form, setForm] = useState({ numero: '' })
    const [qrModal, setQrModal] = useState(null)

    const BASE_URL = window.location.origin

    useEffect(() => {
        fetchMesas()
    }, [])

    const fetchMesas = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('mesas')
            .select('*')
            .order('numero')
        if (data) setMesas(data)
        setLoading(false)
    }

    const gerarQRCodeUrl = (mesaNumero) => {
        const cardapioUrl = `${BASE_URL}/cardapio?mesa=${mesaNumero}`
        // Usando API gratuita de QR Code
        return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(cardapioUrl)}`
    }

    const salvarMesa = async () => {
        if (!form.numero) {
            alert('O número da mesa é obrigatório')
            return
        }

        const dadosMesa = {
            numero: parseInt(form.numero),
            status: 'livre'
        }

        let error
        if (editando) {
            const result = await supabase
                .from('mesas')
                .update({ numero: dadosMesa.numero })
                .eq('id', editando.id)
            error = result.error
        } else {
            const result = await supabase
                .from('mesas')
                .insert(dadosMesa)
            error = result.error
        }

        if (error) {
            alert('Erro ao salvar mesa: ' + error.message)
            return
        }

        setShowModal(false)
        setEditando(null)
        setForm({ numero: '' })
        fetchMesas()
    }

    const alterarStatus = async (mesa) => {
        const novoStatus = mesa.status === 'livre' ? 'ocupada' : 'livre'
        const { error } = await supabase
            .from('mesas')
            .update({ status: novoStatus })
            .eq('id', mesa.id)

        if (!error) fetchMesas()
    }

    const excluirMesa = async (id) => {
        if (!confirm('Tem certeza que deseja excluir esta mesa?')) return

        const { error } = await supabase
            .from('mesas')
            .delete()
            .eq('id', id)

        if (error) {
            alert('Erro ao excluir: ' + error.message)
            return
        }

        fetchMesas()
    }

    const abrirEdicao = (mesa) => {
        setEditando(mesa)
        setForm({ numero: mesa.numero.toString() })
        setShowModal(true)
    }

    const abrirNovo = () => {
        setEditando(null)
        setForm({ numero: '' })
        setShowModal(true)
    }

    const imprimirQR = (mesa) => {
        const qrUrl = gerarQRCodeUrl(mesa.numero)

        const printWindow = window.open('', '_blank')
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>QR Code - Mesa ${mesa.numero}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        text-align: center;
                        padding: 40px;
                    }
                    .container {
                        max-width: 400px;
                        margin: 0 auto;
                        border: 2px solid #333;
                        padding: 30px;
                        border-radius: 15px;
                    }
                    .logo { font-size: 48px; margin-bottom: 10px; }
                    h1 { margin: 0; font-size: 24px; }
                    h2 { color: #666; margin: 5px 0 20px; font-weight: normal; }
                    .mesa-numero {
                        font-size: 48px;
                        font-weight: bold;
                        color: #D4AF37;
                        margin: 15px 0;
                    }
                    img { margin: 20px 0; }
                    .instrucoes {
                        background: #f5f5f5;
                        padding: 15px;
                        border-radius: 10px;
                        margin-top: 20px;
                        font-size: 14px;
                    }
                    @media print {
                        body { padding: 0; }
                        .container { border: none; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="logo">🍗👑</div>
                    <h1>Império das Porções</h1>
                    <h2>Cardápio Digital</h2>
                    <div class="mesa-numero">Mesa ${mesa.numero}</div>
                    <img src="${qrUrl}" alt="QR Code" width="250" />
                    <div class="instrucoes">
                        <strong>📱 Escaneie o QR Code</strong><br/>
                        para acessar o cardápio e fazer seu pedido!
                    </div>
                </div>
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    }
                </script>
            </body>
            </html>
        `)
        printWindow.document.close()
    }

    const getStatusColor = (status) => {
        return status === 'livre' ? 'text-green-500' : 'text-red-500'
    }

    const getStatusBg = (status) => {
        return status === 'livre' ? 'bg-green-500/20' : 'bg-red-500/20'
    }

    return (
        <div className="min-h-screen">
            <Header title="Gestão de Mesas" onRefresh={fetchMesas} />

            <div className="p-6">
                {/* Header com botão adicionar */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold">Mesas do Restaurante</h2>
                        <p className="text-gray-500 text-sm">Gerencie as mesas e QR Codes</p>
                    </div>
                    <button
                        onClick={abrirNovo}
                        className="flex items-center gap-2 px-4 py-2 bg-gold text-black rounded-lg font-semibold hover:bg-gold/90 transition-colors"
                    >
                        <Plus size={20} />
                        Nova Mesa
                    </button>
                </div>

                {/* Grid de Mesas */}
                {loading ? (
                    <div className="text-center py-12 text-gray-500">Carregando...</div>
                ) : mesas.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-xl border border-gray-800">
                        <QrCode size={48} className="mx-auto text-gray-600 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Nenhuma mesa cadastrada</h3>
                        <p className="text-gray-500 mb-4">Cadastre suas mesas para gerar QR Codes</p>
                        <button
                            onClick={abrirNovo}
                            className="px-4 py-2 bg-gold text-black rounded-lg font-semibold"
                        >
                            Cadastrar Primeira Mesa
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {mesas.map(mesa => (
                            <div
                                key={mesa.id}
                                className="bg-card rounded-xl border border-gray-800 overflow-hidden hover:border-gold/50 transition-colors"
                            >
                                {/* QR Code Preview */}
                                <div
                                    className="bg-white p-4 cursor-pointer"
                                    onClick={() => setQrModal(mesa)}
                                >
                                    <img
                                        src={gerarQRCodeUrl(mesa.numero)}
                                        alt={`QR Code Mesa ${mesa.numero}`}
                                        className="w-full aspect-square object-contain"
                                    />
                                </div>

                                {/* Info */}
                                <div className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-bold text-2xl">
                                            Mesa {mesa.numero}
                                        </h3>
                                        <button
                                            onClick={() => alterarStatus(mesa)}
                                            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${getStatusBg(mesa.status)} ${getStatusColor(mesa.status)}`}
                                        >
                                            <Circle size={8} className="fill-current" />
                                            {mesa.status === 'livre' ? 'Livre' : 'Ocupada'}
                                        </button>
                                    </div>

                                    {/* Ações */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => imprimirQR(mesa)}
                                            className="flex-1 flex items-center justify-center gap-1 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
                                        >
                                            <Printer size={16} />
                                            Imprimir QR
                                        </button>
                                        <button
                                            onClick={() => abrirEdicao(mesa)}
                                            className="p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => excluirMesa(mesa.id)}
                                            className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Cadastro/Edição */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-xl w-full max-w-md border border-gray-800">
                        <div className="flex items-center justify-between p-4 border-b border-gray-800">
                            <h2 className="text-lg font-bold">
                                {editando ? 'Editar Mesa' : 'Nova Mesa'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">
                                    Número da Mesa *
                                </label>
                                <input
                                    type="number"
                                    value={form.numero}
                                    onChange={(e) => setForm({ ...form, numero: e.target.value })}
                                    placeholder="Ex: 1"
                                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-gold outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 p-4 border-t border-gray-800">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={salvarMesa}
                                className="flex-1 py-3 bg-gold text-black rounded-lg font-semibold hover:bg-gold/90 transition-colors flex items-center justify-center gap-2"
                            >
                                <Check size={20} />
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal QR Code Ampliado */}
            {qrModal && (
                <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                    onClick={() => setQrModal(null)}
                >
                    <div
                        className="bg-white rounded-xl p-6 max-w-sm w-full text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-bold text-gray-900 mb-2">
                            Mesa {qrModal.numero}
                        </h2>
                        <img
                            src={gerarQRCodeUrl(qrModal.numero)}
                            alt="QR Code"
                            className="w-full max-w-[280px] mx-auto my-4"
                        />
                        <p className="text-gray-600 text-sm mb-4">
                            Link: {BASE_URL}/cardapio?mesa={qrModal.numero}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => imprimirQR(qrModal)}
                                className="flex-1 py-3 bg-blue-500 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
                            >
                                <Printer size={20} />
                                Imprimir
                            </button>
                            <button
                                onClick={() => setQrModal(null)}
                                className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
