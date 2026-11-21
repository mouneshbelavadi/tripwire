import { useState } from 'react';

export interface CommuteDataPoint {
  timeIst: string;
  timestamp?: number | string;
  mayaMinutes: number;
  arjunMinutes: number;
  limitMinutes: number;
  note?: string;
}

interface CommuteSparklineProps {
  data?: CommuteDataPoint[];
  limitMinutes?: number;
  height?: number;
  className?: string;
}

export function CommuteSparkline({
  data,
  limitMinutes = 60,
  height = 180,
  className = '',
}: CommuteSparklineProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    point: CommuteDataPoint;
    x: number;
    yMaya: number;
    yArjun: number;
  } | null>(null);

  // Default illustrative sequence reflecting normal -> breach 1 (68m) -> breach 2 (72m)
  const resolvedData: CommuteDataPoint[] =
    data && data.length >= 2
      ? data
      : [
          { timeIst: '08:30 IST', mayaMinutes: 42, arjunMinutes: 34, limitMinutes: 60, note: 'Baseline check' },
          { timeIst: '08:35 IST', mayaMinutes: 44, arjunMinutes: 35, limitMinutes: 60, note: 'Normal traffic' },
          { timeIst: '08:40 IST', mayaMinutes: 52, arjunMinutes: 34, limitMinutes: 60, note: 'Congestion builds' },
          { timeIst: '08:45 IST', mayaMinutes: 68, arjunMinutes: 36, limitMinutes: 60, note: 'Breach 1/2 (Confirming)' },
          { timeIst: '08:50 IST', mayaMinutes: 72, arjunMinutes: 34, limitMinutes: 60, note: 'Breach 2/2 (Alert Active)' },
        ];

  const padding = { top: 24, right: 36, bottom: 32, left: 44 };
  const width = 640; // SVG viewBox coordinate width
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Compute min/max for scale
  const allValues = resolvedData.flatMap((d) => [d.mayaMinutes, d.arjunMinutes, d.limitMinutes]);
  const minVal = Math.max(0, Math.min(...allValues) - 10);
  const maxVal = Math.max(80, Math.max(...allValues) + 10);
  const valRange = maxVal - minVal || 1;

  const getX = (index: number) => {
    if (resolvedData.length <= 1) return padding.left + plotWidth / 2;
    return padding.left + (index / (resolvedData.length - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    return padding.top + plotHeight - ((val - minVal) / valRange) * plotHeight;
  };

  // Limit line & 5-minute recovery band coordinates
  const limitY = getY(limitMinutes);
  const recoveryMinY = getY(limitMinutes - 5); // 5 min below limit
  const recoveryBandHeight = recoveryMinY - limitY; // positive in SVG space

  // Generate SVG path for participant
  const makePath = (key: 'mayaMinutes' | 'arjunMinutes') => {
    return resolvedData
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d[key])}`)
      .join(' ');
  };

  const mayaPath = makePath('mayaMinutes');
  const arjunPath = makePath('arjunMinutes');

  return (
    <div className={`commute-sparkline-card ${className}`}>
      <div className="sparkline-header-row">
        <div>
          <span className="sparkline-title">Commute Duration Progression</span>
          <span className="sparkline-subtitle">
            Timeline of Google Maps driving estimates vs. 60m threshold &amp; 5m recovery band
          </span>
        </div>
        <div className="sparkline-legend">
          <span className="legend-chip maya">
            <span className="chip-dot maya" /> Maya (Indiranagar)
          </span>
          <span className="legend-chip arjun">
            <span className="chip-dot arjun" /> Arjun (HSR Layout)
          </span>
          <span className="legend-chip threshold">
            <span className="chip-line threshold" /> Limit ({limitMinutes}m)
          </span>
          <span className="legend-chip recovery">
            <span className="chip-box recovery" /> 5m Recovery Band
          </span>
        </div>
      </div>

      <div className="sparkline-svg-container" style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="sparkline-svg"
          preserveAspectRatio="none"
          style={{ width: '100%', height: `${height}px`, overflow: 'visible' }}
          role="img"
          aria-label="Commute duration timeline graph showing Maya and Arjun durations relative to the 60 minute threshold"
        >
          <defs>
            {/* Diagonal hatch pattern for 5-minute recovery band */}
            <pattern
              id="recoveryHatch"
              width="8"
              height="8"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <line x1="0" y1="0" x2="0" y2="8" stroke="#FCD34D" strokeWidth="2" opacity="0.6" />
            </pattern>

            {/* Maya gradient */}
            <linearGradient id="mayaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B91C1C" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#B91C1C" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines (horizontal) */}
          {[30, 45, 60, 75].map((gridVal) => {
            const gy = getY(gridVal);
            return (
              <g key={gridVal}>
                <line
                  x1={padding.left}
                  y1={gy}
                  x2={width - padding.right}
                  y2={gy}
                  stroke="#E8E8E2"
                  strokeWidth="1"
                  strokeDasharray="3, 3"
                />
                <text
                  x={padding.left - 8}
                  y={gy + 4}
                  fill="#7A7A72"
                  fontSize="11"
                  fontFamily="IBM Plex Mono, monospace"
                  textAnchor="end"
                >
                  {gridVal}m
                </text>
              </g>
            );
          })}

          {/* 5-minute Recovery Band (e.g. 55m - 60m) */}
          <rect
            x={padding.left}
            y={limitY}
            width={plotWidth}
            height={recoveryBandHeight}
            fill="#FEF3C7"
            opacity="0.45"
          />
          <rect
            x={padding.left}
            y={limitY}
            width={plotWidth}
            height={recoveryBandHeight}
            fill="url(#recoveryHatch)"
            opacity="0.3"
          />
          <text
            x={width - padding.right - 4}
            y={limitY + recoveryBandHeight / 2 + 3}
            fill="#B45309"
            fontSize="10"
            fontFamily="IBM Plex Mono, monospace"
            textAnchor="end"
            fontWeight="600"
          >
            5m Recovery Hysteresis Band (55m–60m)
          </text>

          {/* Horizontal Limit Reference Line */}
          <line
            x1={padding.left}
            y1={limitY}
            x2={width - padding.right}
            y2={limitY}
            stroke="#B91C1C"
            strokeWidth="1.8"
            strokeDasharray="5, 4"
          />
          <text
            x={padding.left + 6}
            y={limitY - 6}
            fill="#B91C1C"
            fontSize="11"
            fontFamily="IBM Plex Mono, monospace"
            fontWeight="600"
          >
            Threshold Limit: {limitMinutes} min
          </text>

          {/* Maya Line & Area */}
          <path
            d={mayaPath}
            fill="none"
            stroke="#B91C1C"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Arjun Line */}
          <path
            d={arjunPath}
            fill="none"
            stroke="#1B4D3E"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {resolvedData.map((d, i) => {
            const x = getX(i);
            const ym = getY(d.mayaMinutes);
            const ya = getY(d.arjunMinutes);

            return (
              <g
                key={i}
                onMouseEnter={() =>
                  setHoveredPoint({ point: d, x, yMaya: ym, yArjun: ya })
                }
                onMouseLeave={() => setHoveredPoint(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Maya point */}
                <circle
                  cx={x}
                  cy={ym}
                  r={d.mayaMinutes > limitMinutes ? 5.5 : 4}
                  fill={d.mayaMinutes > limitMinutes ? '#B91C1C' : '#FFFFFF'}
                  stroke="#B91C1C"
                  strokeWidth="2.5"
                />

                {/* Arjun point */}
                <circle
                  cx={x}
                  cy={ya}
                  r="4"
                  fill="#FFFFFF"
                  stroke="#1B4D3E"
                  strokeWidth="2.5"
                />

                {/* X-axis time label */}
                <text
                  x={x}
                  y={height - 10}
                  fill="#666666"
                  fontSize="10"
                  fontFamily="IBM Plex Mono, monospace"
                  textAnchor="middle"
                >
                  {d.timeIst.replace(' IST', '')}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div
            className="sparkline-tooltip"
            style={{
              position: 'absolute',
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: '12px',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              background: '#1A1A1A',
              color: '#FFFFFF',
              padding: '6px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              zIndex: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ fontWeight: 600, color: '#FCD34D', marginBottom: '2px' }}>
              {hoveredPoint.point.timeIst} {hoveredPoint.point.note ? `· ${hoveredPoint.point.note}` : ''}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span style={{ color: '#FCA5A5' }}>
                Maya: <strong>{hoveredPoint.point.mayaMinutes}m</strong>{' '}
                {hoveredPoint.point.mayaMinutes > limitMinutes ? '⚠️ Breach' : '✓ OK'}
              </span>
              <span style={{ color: '#9FC4B3' }}>
                Arjun: <strong>{hoveredPoint.point.arjunMinutes}m</strong> ✓ OK
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="sparkline-footer-note">
        <span>
          <strong>Double Confirmation Rule:</strong> Maya breached at 08:45 (68m &gt; 60m), then confirmed at 08:50 (72m &gt; 60m) → Alert triggered.
        </span>
        <span style={{ color: '#B45309', fontWeight: 600 }}>
          Recovery requires estimate &le; 55 min (60m limit &minus; 5m hysteresis).
        </span>
      </div>
    </div>
  );
}
