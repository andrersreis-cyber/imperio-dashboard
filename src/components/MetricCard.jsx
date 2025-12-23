import { Card, CardContent } from './ui/Card'

export function MetricCard({ title, value, subtitle, icon: Icon, trend, color = 'gold' }) {
    const colorClasses = {
        gold: 'bg-gold/20 text-gold border-gold/20',
        green: 'bg-green-500/20 text-green-400 border-green-500/20',
        blue: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
        red: 'bg-imperio-red/20 text-imperio-red border-imperio-red/20',
    }

    return (
        <Card className="animate-fadeIn p-0 overflow-hidden border-l-4" style={{ borderLeftColor: color === 'red' ? 'var(--color-imperio-red)' : 'var(--color-gold)' }}>
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">{title}</p>
                        <p className="text-4xl font-display mt-2 text-white tracking-wide">{value}</p>
                        {subtitle && (
                            <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
                        )}
                        {trend !== undefined && (
                            <div className="flex items-center gap-1 mt-2">
                                <span className={`text-sm font-bold ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
                                </span>
                                <span className="text-gray-600 text-xs">vs ontem</span>
                            </div>
                        )}
                    </div>
                    {Icon && (
                        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
                            <Icon size={24} />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
