import React from 'react';

interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ 
  defaultValue, 
  value, 
  onValueChange, 
  children 
}) => {
  const [activeTab, setActiveTab] = React.useState(value || defaultValue);
  
  React.useEffect(() => {
    if (value !== undefined) {
      setActiveTab(value);
    }
  }, [value]);
  
  const handleValueChange = (newValue: string) => {
    if (onValueChange) {
      onValueChange(newValue);
    } else {
      setActiveTab(newValue);
    }
  };
  
  const contextValue = {
    activeTab,
    onValueChange: handleValueChange
  };
  
  return (
    <TabsContext.Provider value={contextValue}>
      <div className="w-full">{children}</div>
    </TabsContext.Provider>
  );
};

const TabsContext = React.createContext<{
  activeTab: string;
  onValueChange: (value: string) => void;
}>({
  activeTab: '',
  onValueChange: () => {}
});

const useTabsContext = () => {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs component');
  }
  return context;
};

export const TabsList: React.FC<TabsListProps> = ({ children, className }) => {
  return (
    <div className={`${className} overflow-x-auto`}>
      <div className="flex min-w-max">
        {children}
      </div>
    </div>
  );
};

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ 
  value, 
  children,
  className
}) => {
  const { activeTab, onValueChange } = useTabsContext();
  const isActive = activeTab === value;
  
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={`px-4 py-3 font-medium text-sm transition-colors focus:outline-none whitespace-nowrap min-h-[48px] flex items-center justify-center ${
        isActive 
          ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50' 
          : 'text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
      } ${className || ''}`}
      onClick={() => onValueChange(value)}
    >
      {children}
    </button>
  );
};

export const TabsContent: React.FC<TabsContentProps> = ({ 
  value, 
  children,
  className
}) => {
  const { activeTab } = useTabsContext();
  
  if (activeTab !== value) {
    return null;
  }
  
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
};