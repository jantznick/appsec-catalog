export function Checkbox({
  label,
  error,
  helperText,
  className = '',
  ...props
}) {
  return (
    <div className="w-full">
      <div className="flex items-start">
        <input
          type="checkbox"
          className={`
            mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded
            focus:ring-blue-500 focus:ring-2
            ${error ? 'border-red-300' : ''}
            ${className}
          `}
          {...props}
        />
        {label && (
          <label htmlFor={props.id} className="ml-2 block text-sm text-gray-700">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600 ml-6">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500 ml-6">{helperText}</p>
      )}
    </div>
  );
}








