import React from 'react'

export function Card({ children, className = '', hover = false }) {
    return (
        <div 
            className={`
                bg-card border border-gray-800 rounded-xl p-6 
                ${hover ? 'hover:border-gold/50 transition-colors duration-300' : ''}
                ${className}
            `}
        >
            {children}
        </div>
    )
}

export function CardHeader({ children, className = '' }) {
    return (
        <div className={`flex flex-col space-y-1.5 mb-4 ${className}`}>
            {children}
        </div>
    )
}

export function CardTitle({ children, className = '' }) {
    return (
        <h3 className={`text-xl font-display uppercase tracking-wide text-white ${className}`}>
            {children}
        </h3>
    )
}

export function CardContent({ children, className = '' }) {
    return (
        <div className={`${className}`}>
            {children}
        </div>
    )
}

