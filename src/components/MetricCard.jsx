import { Card, CardContent } from './ui/Card'

export function MetricCard({ title, value, subtitle, icon: Icon, trend, color = 'gold' }) {
    const colorClasses = {
        gold: 'text-gold',
        green: 'text-green-400',
        blue: 'text-blue-400',
        red: 'text-imperio-red',
    }

    const bgClasses = {
        gold: 'from-gold/10 to-transparent',
        green: 'from-green-500/10 to-transparent',
        blue: 'from-blue-500/10 to-transparent',
        red: 'from-imperio-red/10 to-transparent',
    }

    return (
        <Card className="animate-fadeIn p-0 overflow-hidden border border-white/5 bg-[#121212] shadow-xl relative group">
            {/* Gradiente de fundo sutil */}
            <div className={`absolute inset-0 bg-gradient-to-br ${bgClasses[color]} opacity-30 group-hover:opacity-50 transition-opacity duration-500`} />
            
            <CardContent className="p-5 relative z-10 flex flex-col justify-between h-full min-h-[140px]">
                {/* Header: Título e Ícone */}
                <div className="flex justify-between items-start mb-2">
                    <p className="text-gray-400 text-[10px] uppercase tracking-[0.2em] font-bold">{title}</p>
                    {Icon && (
                        <div className={`p-2 rounded-lg bg-white/5 border border-white/5 ${colorClasses[color]}`}>
                            <Icon size={18} />
                        </div>
                    )}
                </div>

                {/* Valor Principal */}
                <div className="mt-auto">
                    <p className="text-3xl font-display text-white tracking-tight leading-none break-words" title={String(value)}>
                        {value}
                    </p>
                    
                    {/* Trend e Subtítulo */}
                    <div className="flex items-center gap-3 mt-3">
                        {trend !== undefined && (
                            <div className={`flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded ${trend >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                <span>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%</span>
                            </div>
                        )}
                        <span className="text-gray-600 text-[10px] font-medium uppercase tracking-wide">
                            {subtitle || (trend !== undefined ? 'vs ontem' : '')}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
