import { NavLink, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    ClipboardList,
    Users,
    BarChart3,
    LogOut,
    ShoppingCart,
    QrCode,
    UtensilsCrossed,
    MessageCircle,
    X
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/pdv', icon: ShoppingCart, label: 'PDV' },
    { path: '/pedidos', icon: ClipboardList, label: 'Pedidos' },
    { path: '/whatsapp', icon: MessageCircle, label: 'WhatsApp' },
    { path: '/comandas', icon: UtensilsCrossed, label: 'Comandas' },
    { path: '/mesas', icon: QrCode, label: 'Mesas' },
    { path: '/clientes', icon: Users, label: 'Clientes' },
    { path: '/relatorios', icon: BarChart3, label: 'Relatórios' },
]

export function Sidebar({ isOpen, onClose }) {
    const location = useLocation()
    
    const handleLogout = async () => {
        await supabase.auth.signOut()
        window.location.reload()
    }

    return (
        <>
            {/* Sidebar */}
            <aside 
                className={`
                    fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-gray-800 flex flex-col transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
            >
                {/* Logo & Close Button */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl filter drop-shadow-md">👑</span>
                        <div>
                            <h1 className="text-2xl font-display text-gold tracking-wide leading-none">IMPÉRIO</h1>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Das Porções</p>
                        </div>
                    </div>
                    {/* Botão fechar (só mobile) */}
                    <button 
                        onClick={onClose}
                        className="lg:hidden text-gray-400 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Menu */}
                <nav className="flex-1 p-4 overflow-y-auto">
                    <ul className="space-y-1">
                        {menuItems.map((item) => {
                            const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '/')
                            return (
                                <li key={item.path}>
                                    <NavLink
                                        to={item.path}
                                        onClick={() => onClose && window.innerWidth < 1024 && onClose()}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-medium ${isActive
                                            ? 'bg-imperio-red text-white shadow-lg shadow-red-900/20'
                                            : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                        }`}
                                    >
                                        <item.icon size={20} className={isActive ? 'text-white' : ''} />
                                        <span>{item.label}</span>
                                    </NavLink>
                                </li>
                            )
                        })}
                    </ul>
                </nav>

                {/* Logout */}
                <div className="p-4 border-t border-gray-800">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    >
                        <LogOut size={20} />
                        <span>Sair</span>
                    </button>
                </div>
            </aside>

            {/* Overlay para fechar ao clicar fora (mobile) */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
                    onClick={onClose}
                />
            )}
        </>
    )
}
