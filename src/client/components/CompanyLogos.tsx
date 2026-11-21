import React from 'react';

export interface CompanyLogoProps {
  code: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function CompanyLogo({ code, size = 20, className = '', style }: CompanyLogoProps) {
  const norm = (code || '').toUpperCase().trim();

  switch (norm) {
    case 'GOOG':
    case 'GOOGLE':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style}>
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.9c2.28-2.1 3.64-5.2 3.64-9.15z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.74-2.1-6.68-4.92H1.28v3.15C3.26 21.36 7.34 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.32 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.57H1.28C.46 8.2 0 10.05 0 12s.46 3.8 1.28 5.43l4.04-3.15z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.28 6.57l4.04 3.15c.94-2.82 3.58-4.97 6.68-4.97z"
          />
        </svg>
      );

    case 'PAYTM':
    case 'ONE97':
      return (
        <svg width={size * 1.5} height={size} viewBox="0 0 48 24" className={className} style={style}>
          <rect width="48" height="24" rx="4" fill="#002E6E" />
          <text
            x="6"
            y="17"
            fontFamily="Arial, sans-serif"
            fontWeight="900"
            fontSize="14"
            fill="#00BAF2"
            letterSpacing="-0.5"
          >
            pay
          </text>
          <text
            x="29"
            y="17"
            fontFamily="Arial, sans-serif"
            fontWeight="900"
            fontSize="14"
            fill="#FFFFFF"
            letterSpacing="-0.5"
          >
            tm
          </text>
        </svg>
      );

    case 'MSFT':
    case 'MICROSOFT':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style}>
          <rect x="1" y="1" width="10" height="10" fill="#F25022" />
          <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
          <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
          <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
        </svg>
      );

    case 'AMZN':
    case 'AMAZON':
      return (
        <svg width={size * 1.3} height={size} viewBox="0 0 36 24" className={className} style={style}>
          <rect width="36" height="24" rx="4" fill="#232F3E" />
          <text x="6" y="14" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="12" fill="#FFFFFF">
            a
          </text>
          <path
            d="M 8 18 Q 18 24 28 17"
            fill="none"
            stroke="#FF9900"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <polygon points="26,16 29,17 27,20" fill="#FF9900" />
        </svg>
      );

    case 'INFY':
    case 'INFOSYS':
      return (
        <svg width={size * 1.5} height={size} viewBox="0 0 44 24" className={className} style={style}>
          <rect width="44" height="24" rx="4" fill="#007CC3" />
          <text
            x="5"
            y="16"
            fontFamily="Arial, sans-serif"
            fontWeight="bold"
            fontSize="11"
            fill="#FFFFFF"
            letterSpacing="-0.3"
          >
            Infosys
          </text>
        </svg>
      );

    case 'FLPK':
    case 'FLIPKART':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style}>
          <circle cx="12" cy="12" r="11" fill="#2874F0" />
          <path
            d="M8 7h8l-1.5 10h-5z"
            fill="#FFE11B"
          />
          <path
            d="M10 7c0-1.5 1-2.5 2-2.5s2 1 2 2.5"
            fill="none"
            stroke="#FFE11B"
            strokeWidth="1.8"
          />
        </svg>
      );

    case 'SWIG':
    case 'SWIGGY':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style}>
          <rect width="24" height="24" rx="5" fill="#FC8019" />
          <path
            d="M12 4C8.7 4 6 6.7 6 10c0 4.2 6 10 6 10s6-5.8 6-10c0-3.3-2.7-6-6-6zm0 8.5c-1.4 0-2.5-1.1-2.5-2.5S10.6 7.5 12 7.5s2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case 'UBER':
      return (
        <svg width={size * 1.4} height={size} viewBox="0 0 36 24" className={className} style={style}>
          <rect width="36" height="24" rx="4" fill="#000000" />
          <text
            x="4"
            y="16"
            fontFamily="Arial, sans-serif"
            fontWeight="bold"
            fontSize="11"
            fill="#FFFFFF"
            letterSpacing="0.2"
          >
            Uber
          </text>
        </svg>
      );

    case 'ACME':
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style}>
          <rect width="24" height="24" rx="4" fill="#1B4D3E" />
          <path d="M12 4L4 18h16z" fill="#E8F0EC" />
          <circle cx="12" cy="14" r="2" fill="#1B4D3E" />
        </svg>
      );
  }
}
