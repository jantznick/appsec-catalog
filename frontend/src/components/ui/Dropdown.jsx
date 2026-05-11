import { useState, useRef, useEffect, cloneElement, Children } from 'react';

export function Dropdown({ trigger, children, align = 'right' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const alignClasses = {
    right: 'right-0',
    left: 'left-0',
  };

  const handleItemClick = (originalOnClick) => {
    setIsOpen(false);
    if (originalOnClick) {
      originalOnClick();
    }
  };

  // Recursively clone children and pass close handler to DropdownItem components
  const cloneChildren = (childrenToClone) => {
    // Use toArray to flatten fragments and arrays
    const flatChildren = Children.toArray(childrenToClone);
    
    return flatChildren.map((child) => {
      if (!child || typeof child !== 'object' || !('type' in child)) {
        return child;
      }

      // Handle DropdownItem components
      if (child.type === DropdownItem) {
        return cloneElement(child, {
          onClick: () => handleItemClick(child.props.onClick),
        });
      }

      // For other components with children, recursively process their children
      if (child.props?.children) {
        return cloneElement(child, {
          children: cloneChildren(child.props.children),
        });
      }

      return child;
    });
  };

  const childrenWithProps = cloneChildren(children);

  return (
    <div className="relative" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      {isOpen && (
        <div
          className={`absolute ${alignClasses[align]} mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50`}
        >
          <div className="py-1" role="menu">
            {childrenWithProps}
          </div>
        </div>
      )}
    </div>
  );
}

export function DropdownItem({ children, onClick, className = '', divider = false }) {
  // If it's just a divider, render only the divider line without a button
  if (divider && !children) {
    return <div className="border-t border-gray-100 my-1" />;
  }

  return (
    <>
      <button
        onClick={onClick}
        className={`block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${className}`}
        role="menuitem"
      >
        {children}
      </button>
      {divider && <div className="border-t border-gray-100 my-1" />}
    </>
  );
}

