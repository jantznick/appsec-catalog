export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  loading = false,
  onClick,
  className = '',
  ...props
}) {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none active:translate-y-px';

  const variants = {
    primary: 'bg-blue-600 text-white shadow-sm shadow-blue-950/40 hover:bg-blue-500 hover:shadow-md hover:shadow-blue-500/25 focus-visible:ring-blue-500',
    navy: 'bg-navy-700 text-white shadow-sm hover:bg-navy-600 hover:shadow-md focus-visible:ring-navy-500',
    secondary: 'bg-surface text-gray-900 border border-gray-300 shadow-sm hover:bg-gray-100 hover:border-gray-400 focus-visible:ring-gray-400',
    success: 'bg-green-600 text-white shadow-sm hover:bg-green-500 hover:shadow-md hover:shadow-green-500/25 focus-visible:ring-green-500',
    danger: 'bg-red-600 text-white shadow-sm hover:bg-red-500 hover:shadow-md hover:shadow-red-500/25 focus-visible:ring-red-500',
    outline: 'border border-blue-600 text-blue-700 hover:bg-blue-600 hover:text-white focus-visible:ring-blue-500',
    ghost: 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-gray-400',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </span>
      ) : (
        children
      )}
    </button>
  );
}
