import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function Layout() {
    return (
        <div className="min-h-screen bg-[#0a0a0a]">
            <Sidebar />
            <main className="ml-64">
                <Outlet />
            </main>
        </div>
    )
}
