import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Pedidos } from './pages/Pedidos'
import { Clients } from './pages/Clients'
import { Reports } from './pages/Reports'
import { Login } from './pages/Login'
import { Cardapio } from './pages/Cardapio'
import { PDV } from './pages/PDV'
import { Mesas } from './pages/Mesas'
import { Garcom } from './pages/Garcom'
import { Comandas } from './pages/Comandas'
import { supabase } from './lib/supabase'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <span className="text-5xl">🍗👑</span>
          <p className="text-gray-400 mt-4">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Rota pública do Cardápio Digital */}
        <Route path="/cardapio" element={<Cardapio />} />

        {/* Rota pública do App do Garçom */}
        <Route path="/garcom" element={<Garcom />} />

        {/* Rotas protegidas do Dashboard */}
        {user ? (
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="pedidos" element={<Pedidos />} />
            <Route path="clientes" element={<Clients />} />
            <Route path="relatorios" element={<Reports />} />
            <Route path="pdv" element={<PDV />} />
            <Route path="mesas" element={<Mesas />} />
            <Route path="comandas" element={<Comandas />} />
          </Route>
        ) : (
          <Route path="*" element={<Login onLogin={setUser} />} />
        )}
      </Routes>
    </BrowserRouter>
  )
}

export default App
