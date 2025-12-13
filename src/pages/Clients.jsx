import { useState, useEffect } from 'react'
import { Header } from '../components/Header'
import { supabase } from '../lib/supabase'
import { Search, User, MapPin, Phone, ShoppingBag } from 'lucide-react'

export function Clients() {
    const [clients, setClients] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    const fetchClients = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('dados_cliente')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(100)

        if (data) setClients(data)
        setLoading(false)
    }

    useEffect(() => {
        fetchClients()
    }, [])

    const filteredClients = clients.filter(client =>
        client.nome_completo?.toLowerCase().includes(search.toLowerCase()) ||
        client.telefone?.includes(search) ||
        client.bairro?.toLowerCase().includes(search.toLowerCase())
    )

    const formatDate = (dateString) => {
        if (!dateString) return '-'
        return new Date(dateString).toLocaleDateString('pt-BR')
    }

    const parseUltimoPedido = (ultimoPedido) => {
        if (!ultimoPedido) return null
        try {
            return typeof ultimoPedido === 'string' ? JSON.parse(ultimoPedido) : ultimoPedido
        } catch {
            return null
        }
    }

    return (
        <div className="min-h-screen">
            <Header title="Clientes" onRefresh={fetchClients} />

            <div className="p-6 space-y-6">
                {/* Search */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nome, telefone ou bairro..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-card border border-gray-700 rounded-lg focus:outline-none focus:border-gold"
                    />
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {loading ? (
                        <p className="col-span-full text-center text-gray-500 py-8">Carregando...</p>
                    ) : filteredClients.length === 0 ? (
                        <p className="col-span-full text-center text-gray-500 py-8">Nenhum cliente encontrado</p>
                    ) : (
                        filteredClients.map((client) => {
                            const ultimoPedido = parseUltimoPedido(client.ultimo_pedido)

                            return (
                                <div
                                    key={client.id}
                                    className="bg-card rounded-xl p-5 border border-gray-800 hover:border-gray-700 transition-colors"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
                                            <User size={24} className="text-gold" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold truncate">
                                                {client.nome_completo || client.nomewpp || 'Sem nome'}
                                            </h3>

                                            <div className="mt-3 space-y-2">
                                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                                    <Phone size={14} />
                                                    <span className="truncate">{client.telefone}</span>
                                                </div>

                                                {client.bairro && (
                                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                                        <MapPin size={14} />
                                                        <span className="truncate">{client.bairro}</span>
                                                    </div>
                                                )}

                                                {ultimoPedido && (
                                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                                        <ShoppingBag size={14} />
                                                        <span>Último: {formatDate(ultimoPedido.data)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {client.endereco && (
                                        <div className="mt-4 pt-4 border-t border-gray-800">
                                            <p className="text-sm text-gray-400 truncate" title={client.endereco}>
                                                {client.endereco}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}
