export function RadioGroup({ label, error, helperText, children, className = '' }) {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="space-y-2">
        {children}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
}

export function Radio({
  label,
  value,
  checked,
  onChange,
  name,
  className = '',
  ...props
}) {
  return (
    <div className="flex items-center">
      <input
        type="radio"
        id={props.id || `${name}-${value}`}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className={`
          h-4 w-4 text-blue-600 border-gray-300
          focus:ring-blue-500 focus:ring-2
          ${className}
        `}
        {...props}
      />
      {label && (
        <label
          htmlFor={props.id || `${name}-${value}`}
          className="ml-2 block text-sm text-gray-700 cursor-pointer"
        >
          {label}
        </label>
      )}
    </div>
  );
}






