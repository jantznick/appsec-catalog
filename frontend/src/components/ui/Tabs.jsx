import { useState, Children, cloneElement, isValidElement } from 'react';

export function Tabs({ children, defaultTab = 0, className = '' }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const tabs = [];
  const panels = [];
  let tabIndex = 0;
  let panelIndex = 0;

  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === Tab) {
      const currentTabIndex = tabIndex++;
      tabs.push(cloneElement(child, { 
        key: `tab-${currentTabIndex}`,
        isActive: activeTab === currentTabIndex,
        onClick: () => setActiveTab(currentTabIndex),
        index: currentTabIndex,
        badge: child.props.badge !== undefined ? child.props.badge : undefined // Preserve badge prop
      }));
    } else if (isValidElement(child) && child.type === TabPanel) {
      const currentPanelIndex = panelIndex++;
      panels.push(cloneElement(child, { 
        key: `panel-${currentPanelIndex}`,
        isActive: activeTab === currentPanelIndex,
        index: currentPanelIndex
      }));
    }
  });

  return (
    <div className={className}>
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs}
        </nav>
      </div>
      <div className="mt-6">
        {panels}
      </div>
    </div>
  );
}

export function Tab({ children, isActive, onClick, index, className = '', badge }) {
  // Debug: log badge value for "Application Metadata History" tab
  if (children === 'Application Metadata History') {
    console.log('Tab badge value:', badge, 'type:', typeof badge);
  }
  
  return (
    <button
      onClick={onClick}
      className={`
        whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
        ${isActive
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }
        ${className}
      `}
      aria-selected={isActive}
      role="tab"
    >
      <span className="flex items-center gap-2">
        {children}
        {badge !== undefined && badge !== null && Number(badge) > 0 && (
          <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
    </button>
  );
}

export function TabPanel({ children, isActive, index, className = '' }) {
  if (!isActive) return null;

  return (
    <div
      className={className}
      role="tabpanel"
      aria-labelledby={`tab-${index}`}
    >
      {children}
    </div>
  );
}

