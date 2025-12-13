export function StatusBadge({ status }) {
    const statusConfig = {
        pendente: { label: 'Pendente', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
        'em preparo': { label: 'Em Preparo', bg: 'bg-blue-500/20', text: 'text-blue-400' },
        'saiu para entrega': { label: 'Saiu para Entrega', bg: 'bg-purple-500/20', text: 'text-purple-400' },
        entregue: { label: 'Entregue', bg: 'bg-green-500/20', text: 'text-green-400' },
        cancelado: { label: 'Cancelado', bg: 'bg-red-500/20', text: 'text-red-400' },
    }

    const config = statusConfig[status?.toLowerCase()] || statusConfig.pendente

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
            {config.label}
        </span>
    )
}
