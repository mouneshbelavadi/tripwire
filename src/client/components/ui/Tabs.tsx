import React, { createContext, useContext, useId } from 'react';

interface TabsContextValue {
  value: string;
  onValueChange: (val: string) => void;
  orientation: 'horizontal' | 'vertical';
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabsProps {
  value: string;
  onValueChange: (val: string) => void;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  children: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({
  value,
  onValueChange,
  orientation = 'horizontal',
  className = '',
  children,
}) => {
  const baseId = useId();

  return (
    <TabsContext.Provider value={{ value, onValueChange, orientation, baseId }}>
      <div className={`ui-tabs ui-tabs--${orientation} ${className}`}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export interface TabListProps extends React.HTMLAttributes<HTMLDivElement> {
  'aria-label'?: string;
}

export const TabList: React.FC<TabListProps> = ({
  children,
  className = '',
  'aria-label': ariaLabel,
  ...props
}) => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('TabList must be used inside Tabs');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const currentIndex = tabs.findIndex((tab) => tab === document.activeElement);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    const isHorizontal = ctx.orientation === 'horizontal';

    if ((isHorizontal && e.key === 'ArrowRight') || (!isHorizontal && e.key === 'ArrowDown')) {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if ((isHorizontal && e.key === 'ArrowLeft') || (!isHorizontal && e.key === 'ArrowUp')) {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = tabs.length - 1;
    }

    if (nextIndex !== currentIndex) {
      tabs[nextIndex].focus();
      const val = tabs[nextIndex].getAttribute('data-value');
      if (val) ctx.onValueChange(val);
    }
  };

  return (
    <div
      role="tablist"
      aria-orientation={ctx.orientation}
      aria-label={ariaLabel}
      className={`ui-tab-list ${className}`}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </div>
  );
};

export interface TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  icon?: React.ReactNode;
}

export const Tab: React.FC<TabProps> = ({
  value,
  children,
  icon,
  className = '',
  ...props
}) => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tab must be used inside Tabs');

  const isSelected = ctx.value === value;
  const tabId = `${ctx.baseId}-tab-${value}`;
  const panelId = `${ctx.baseId}-panel-${value}`;

  return (
    <button
      type="button"
      role="tab"
      id={tabId}
      aria-selected={isSelected}
      aria-controls={panelId}
      tabIndex={isSelected ? 0 : -1}
      data-value={value}
      className={`ui-tab ${className}`}
      onClick={() => ctx.onValueChange(value)}
      {...props}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({
  value,
  children,
  className = '',
  ...props
}) => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('TabPanel must be used inside Tabs');

  const isSelected = ctx.value === value;
  const tabId = `${ctx.baseId}-tab-${value}`;
  const panelId = `${ctx.baseId}-panel-${value}`;

  if (!isSelected) return null;

  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      tabIndex={0}
      className={`ui-tab-panel ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
