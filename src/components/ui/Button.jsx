import React from 'react'

export function Button({ 
    children, 
    variant = 'default', 
    size = 'default', 
    className = '', 
    disabled = false,
    ...props 
}) {
    const baseStyles = "inline-flex items-center justify-center font-display uppercase tracking-wider transition-all duration-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
    
    const variants = {
        default: "bg-imperio-red hover:bg-red-700 text-white shadow-lg hover:shadow-red-900/20 active:scale-95",
        outline: "border-2 border-gold text-gold hover:bg-gold/10 active:scale-95",
        ghost: "text-gray-400 hover:text-white hover:bg-white/5",
        secondary: "bg-gold hover:bg-yellow-600 text-black font-bold active:scale-95"
    }

    const sizes = {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-4 py-2 text-sm",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10 p-0"
    }

    return (
        <button 
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled}
            {...props}
        >
            {children}
        </button>
    )
}

