import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Select } from '../ui/Select'

export function InstanceSelector({ selectedInstance, onInstanceChange }) {
    const [instances, setInstances] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadInstances()
    }, [])

    const loadInstances = async () => {
        try {
            const { data, error } = await supabase
                .from('whatsapp_instances')
                .select('instance_name, status, phone_number')
                .order('created_at', { ascending: true })

            if (error) throw error

            setInstances(data || [])
            
            // Auto-selecionar se não tiver nenhuma selecionada e houver instâncias
            if (!selectedInstance && data?.length > 0) {
                // Tenta recuperar do localStorage
                const saved = localStorage.getItem('selected_instance')
                const found = data.find(i => i.instance_name === saved) || data[0]
                onInstanceChange(found.instance_name)
            }
        } catch (error) {
            console.error('Erro ao carregar instâncias:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (e) => {
        const newValue = e.target.value
        localStorage.setItem('selected_instance', newValue)
        onInstanceChange(newValue)
    }

    if (loading) return <div className="text-gray-400 text-sm">Carregando instâncias...</div>
    if (instances.length === 0) return null

    return (
        <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm whitespace-nowrap">Instância:</span>
            <Select 
                value={selectedInstance || ''} 
                onChange={handleChange}
                className="w-[200px]"
            >
                {instances.map(inst => (
                    <option key={inst.instance_name} value={inst.instance_name}>
                        {inst.instance_name} ({inst.status === 'connected' ? 'Online' : 'Offline'})
                    </option>
                ))}
            </Select>
        </div>
    )
}









