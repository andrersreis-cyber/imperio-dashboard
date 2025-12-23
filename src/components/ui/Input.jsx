import React from 'react'

export const Input = React.forwardRef(({ className = '', error, ...props }, ref) => {
    return (
        <div className="w-full">
            <input
                ref={ref}
                className={`
                    flex h-10 w-full rounded-lg border border-gray-800 bg-black/50 px-3 py-2 
                    text-sm text-white file:border-0 file:bg-transparent file:text-sm file:font-medium 
                    placeholder:text-gray-500 
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imperio-red focus-visible:border-transparent
                    disabled:cursor-not-allowed disabled:opacity-50
                    transition-all duration-200
                    ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    ${className}
                `}
                {...props}
            />
            {error && (
                <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>
            )}
        </div>
    )
})

Input.displayName = "Input"

