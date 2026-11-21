import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  variant?: 'rect' | 'circle' | 'text';
  rounded?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  variant = 'rect',
  rounded = false,
  className = '',
  style,
  ...props
}) => {
  const isCircle = variant === 'circle';
  const isText = variant === 'text';

  const computedHeight = height ?? (isText ? '14px' : undefined);
  const computedWidth = width ?? (isText ? '100%' : undefined);

  return (
    <div
      className={`ui-skeleton ${isCircle ? 'ui-skeleton--circle' : ''} ${className}`}
      style={{
        width: computedWidth,
        height: computedHeight,
        borderRadius: isCircle ? '50%' : rounded ? 'var(--radius-control)' : undefined,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
};

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = '',
}) => {
  const widths = ['100%', '88%', '65%', '92%', '78%'];
  return (
    <div className={`ui-skeleton-text-group ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          height="14px"
          width={widths[i % widths.length]}
        />
      ))}
    </div>
  );
};

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`ui-skeleton-card ${className}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="45%" height="20px" rounded />
        <Skeleton width="70px" height="22px" rounded />
      </div>
      <SkeletonText lines={2} />
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <Skeleton width="90px" height="32px" rounded />
        <Skeleton width="80px" height="32px" rounded />
      </div>
    </div>
  );
};

export const SkeletonStat: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`ui-skeleton-stat ${className}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Skeleton width="40%" height="12px" />
        <Skeleton width="40px" height="14px" rounded />
      </div>
      <Skeleton width="60%" height="32px" style={{ margin: '8px 0' }} />
      <Skeleton width="100%" height="6px" rounded />
    </div>
  );
};

export const SkeletonTable: React.FC<{ rows?: number; columns?: number; className?: string }> = ({
  rows = 4,
  columns = 4,
  className = '',
}) => {
  return (
    <div className={`ui-skeleton-table ${className}`}>
      <div className="ui-skeleton-table-header">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width={`${100 / columns}%`} height="16px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="ui-skeleton-table-row">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} width={`${100 / columns}%`} height="14px" />
          ))}
        </div>
      ))}
    </div>
  );
};
