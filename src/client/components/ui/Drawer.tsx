import React, { useEffect, useRef, useId } from 'react';

export interface DrawerProps {
  /** Controlled open state */
  isOpen: boolean;
  /** Callback fired when drawer requests closing (via Esc, backdrop, or close button) */
  onClose: () => void;
  /** Which side the drawer appears from (default: right) */
  side?: 'right' | 'left';
  /** Width of the drawer (defaults to 336px to match Team Chat & details slot) */
  width?: string;
  /** Drawer header title */
  title?: React.ReactNode;
  /** Drawer header subtitle or description */
  description?: React.ReactNode;
  /** Drawer footer actions */
  footer?: React.ReactNode;
  /** Drawer main body contents */
  children: React.ReactNode;
  /** Custom class for drawer container */
  className?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  side = 'right',
  width = '336px',
  title,
  description,
  footer,
  children,
  className = '',
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElement.current = document.activeElement as HTMLElement;

    // Focus trap inside drawer
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && drawerRef.current) {
        const focusableElements = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the first focusable element or the drawer itself
    const timer = setTimeout(() => {
      if (drawerRef.current) {
        const firstFocusable = drawerRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          drawerRef.current.focus();
        }
      }
    }, 50);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      clearTimeout(timer);
      if (previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="ui-drawer-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      aria-hidden="true"
    >
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`ui-drawer ui-drawer--${side} ${className}`}
        style={{ width }}
      >
        <div className="ui-drawer-header">
          <div>
            {title && (
              <h2 id={titleId} className="ui-drawer-title">
                {title}
              </h2>
            )}
            {description && <div className="ui-drawer-description">{description}</div>}
          </div>
          <button
            type="button"
            className="ui-button ui-button--ghost ui-button--sm"
            onClick={onClose}
            aria-label="Close drawer"
            style={{ padding: '4px 8px', minWidth: '28px' }}
          >
            ✕
          </button>
        </div>

        <div className="ui-drawer-body">{children}</div>

        {footer && <div className="ui-drawer-footer">{footer}</div>}
      </div>
    </div>
  );
};
