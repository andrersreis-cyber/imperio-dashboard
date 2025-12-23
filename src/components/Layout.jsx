import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Menu } from 'lucide-react'

export function Layout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    return (
        <div className="min-h-screen bg-bg-dark text-white flex">
            {/* Sidebar Controlado */}
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            {/* Conteúdo Principal */}
            <div className="flex-1 flex flex-col min-w-0 lg:ml-64 transition-all duration-300">
                
                {/* Header Mobile (só aparece em telas pequenas) */}
                <header className="lg:hidden h-16 bg-card border-b border-gray-800 flex items-center justify-between px-4 sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 text-gold hover:bg-white/5 rounded-lg active:scale-95 transition-transform"
                        >
                            <Menu size={24} />
                        </button>
                        <h1 className="font-display text-xl text-white">IMPÉRIO</h1>
                    </div>
                </header>

                <main className="flex-1 p-4 lg:p-0">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
