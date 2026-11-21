import React, { useState, useId, useRef } from 'react';

export interface TooltipProps {
  /** Tooltip text or node */
  content: React.ReactNode;
  /** Positioning relative to trigger */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Target interactive element */
  children: React.ReactElement;
  /** Optional delay before showing in ms */
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  children,
  delay = 200,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const tooltipId = useId();

  const showTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isVisible) {
      e.stopPropagation();
      hideTooltip();
    }
  };

  const trigger = React.cloneElement(children, {
    'aria-describedby': isVisible ? tooltipId : undefined,
    onMouseEnter: (e: React.MouseEvent) => {
      showTooltip();
      children.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hideTooltip();
      children.props.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      showTooltip();
      children.props.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      hideTooltip();
      children.props.onBlur?.(e);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      handleKeyDown(e);
      children.props.onKeyDown?.(e);
    },
  });

  return (
    <div className="ui-tooltip-wrapper">
      {trigger}
      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`ui-tooltip-content ui-tooltip--${position} ui-tooltip-content--visible`}
        >
          {content}
        </div>
      )}
    </div>
  );
};
