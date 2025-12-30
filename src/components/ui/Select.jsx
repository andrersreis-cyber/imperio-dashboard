import React from 'react'

export const Select = React.forwardRef(({ className = '', error, children, ...props }, ref) => {
    return (
        <div className="w-full">
            <select
                ref={ref}
                className={`
                    flex h-10 w-full rounded-lg border border-gray-800 bg-black/50 px-3 py-2
                    text-sm text-white
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imperio-red focus-visible:border-transparent
                    disabled:cursor-not-allowed disabled:opacity-50
                    transition-all duration-200
                    ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    ${className}
                `}
                {...props}
            >
                {children}
            </select>
            {error && (
                <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>
            )}
        </div>
    )
})

Select.displayName = "Select"

