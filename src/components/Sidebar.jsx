import { NavLink } from 'react-router-dom'
import {
    LayoutDashboard,
    ClipboardList,
    Users,
    BarChart3,
    LogOut,
    ShoppingCart,
    QrCode,
    UtensilsCrossed
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/pdv', icon: ShoppingCart, label: 'PDV' },
    { path: '/pedidos', icon: ClipboardList, label: 'Pedidos' },
    { path: '/comandas', icon: UtensilsCrossed, label: 'Comandas' },
    { path: '/mesas', icon: QrCode, label: 'Mesas' },
    { path: '/clientes', icon: Users, label: 'Clientes' },
    { path: '/relatorios', icon: BarChart3, label: 'Relatórios' },
]

export function Sidebar() {
    const handleLogout = async () => {
        await supabase.auth.signOut()
        window.location.reload()
    }

    return (
        <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-gray-800 flex flex-col">
            {/* Logo */}
            <div className="p-6 border-b border-gray-800">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">🍗👑</span>
                    <div>
                        <h1 className="text-lg font-bold text-gold">Império</h1>
                        <p className="text-xs text-gray-400">das Porções</p>
                    </div>
                </div>
            </div>

            {/* Menu */}
            <nav className="flex-1 p-4">
                <ul className="space-y-2">
                    {menuItems.map((item) => (
                        <li key={item.path}>
                            <NavLink
                                to={item.path}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                        ? 'bg-gold/20 text-gold'
                                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                    }`
                                }
                            >
                                <item.icon size={20} />
                                <span>{item.label}</span>
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Logout */}
            <div className="p-4 border-t border-gray-800">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                >
                    <LogOut size={20} />
                    <span>Sair</span>
                </button>
            </div>
        </aside>
    )
}
