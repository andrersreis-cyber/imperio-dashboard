import { Bell, RefreshCw } from 'lucide-react'
import { useState } from 'react'

export function Header({ title, onRefresh }) {
    const [refreshing, setRefreshing] = useState(false)

    const handleRefresh = async () => {
        setRefreshing(true)
        if (onRefresh) await onRefresh()
        setTimeout(() => setRefreshing(false), 500)
    }

    return (
        <header className="h-16 border-b border-gray-800 flex items-center justify-between px-6">
            <h2 className="text-xl font-semibold">{title}</h2>

            <div className="flex items-center gap-4">
                <button
                    onClick={handleRefresh}
                    className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                    title="Atualizar"
                >
                    <RefreshCw
                        size={20}
                        className={`text-gray-400 ${refreshing ? 'animate-spin' : ''}`}
                    />
                </button>

                <button className="p-2 rounded-lg hover:bg-gray-800 transition-colors relative">
                    <Bell size={20} className="text-gray-400" />
                </button>

                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
                        <span className="text-gold text-sm">👑</span>
                    </div>
                    <span className="text-sm text-gray-300">Admin</span>
                </div>
            </div>
        </header>
    )
}
