import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Mail, Lock, LogIn } from 'lucide-react'

export function Login({ onLogin }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError('Email ou senha incorretos')
            setLoading(false)
            return
        }

        onLogin(data.user)
    }

    const handleSignUp = async () => {
        setLoading(true)
        setError('')

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        })

        if (error) {
            setError(error.message)
            setLoading(false)
            return
        }

        setError('Verifique seu email para confirmar o cadastro!')
        setLoading(false)
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <span className="text-6xl">🍗👑</span>
                    <h1 className="text-2xl font-bold text-gold mt-4">Império das Porções</h1>
                    <p className="text-gray-400 mt-2">Painel Administrativo</p>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin} className="bg-card rounded-xl p-8 border border-gray-800">
                    <h2 className="text-xl font-semibold mb-6 text-center">Entrar</h2>

                    {error && (
                        <div className={`mb-4 p-3 rounded-lg text-sm ${error.includes('Verifique')
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-gold"
                                    placeholder="seu@email.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-gold"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-6 py-3 bg-gold text-black font-semibold rounded-lg hover:bg-gold/90 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            'Carregando...'
                        ) : (
                            <>
                                <LogIn size={20} /> Entrar
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={handleSignUp}
                        disabled={loading}
                        className="w-full mt-3 py-3 border border-gray-700 rounded-lg hover:bg-gray-800 text-gray-400"
                    >
                        Criar conta
                    </button>
                </form>

                <p className="text-center text-gray-500 text-sm mt-6">
                    © 2024 Império das Porções
                </p>
            </div>
        </div>
    )
}
