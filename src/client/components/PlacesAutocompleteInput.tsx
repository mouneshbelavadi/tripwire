import { useState, useEffect, useRef } from 'react';
import type { VerifiedPlace } from './VenueSearchModal';

interface PlacesAutocompleteInputProps {
  id?: string;
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
  onSelectPlace: (place: VerifiedPlace) => void;
  onBudgetNoticeChange?: (exhausted: boolean, notice?: string | null) => void;
  className?: string;
}

export function PlacesAutocompleteInput({
  id = 'places-autocomplete',
  label,
  placeholder = 'Search places or neighborhoods in Bengaluru...',
  value,
  onChange,
  onSelectPlace,
  onBudgetNoticeChange,
  className = '',
}: PlacesAutocompleteInputProps) {
  const [results, setResults] = useState<VerifiedPlace[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    // 400ms debounce as specified in prompt requirements
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      setIsOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        const found = data.places || data.venues || data.fallback || [];
        setResults(found);
        setIsOpen(found.length > 0);
        setFocusedIndex(-1);
        if (onBudgetNoticeChange) {
          onBudgetNoticeChange(false, null);
        }
      } catch (err) {
        console.warn('Places autocomplete failed:', err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value, onBudgetNoticeChange]);

  // Click outside to dismiss
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      if (focusedIndex >= 0 && focusedIndex < results.length) {
        e.preventDefault();
        handleSelect(results[focusedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (place: VerifiedPlace) => {
    onChange(place.title);
    onSelectPlace(place);
    setIsOpen(false);
    setResults([]);
  };

  return (
    <div className={`places-autocomplete-container ${className}`} ref={containerRef} style={{ position: 'relative' }}>
      {label && (
        <label htmlFor={id} className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
          {label}
        </label>
      )}

      <div className="input-search-wrapper" style={{ position: 'relative' }}>
        <input
          id={id}
          type="text"
          className="form-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          style={{ width: '100%', paddingRight: loading ? '36px' : '12px' }}
        />
        {loading && (
          <span
            className="autocomplete-loading-spinner"
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '12px',
              color: 'var(--ink-secondary)',
            }}
          >
            ⏳
          </span>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul
          className="autocomplete-dropdown-list"
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor: 'var(--paper-raised, #FCFBF8)',
            border: '1px solid var(--rule, #D5D8D0)',
            borderRadius: 'var(--radius-control, 6px)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            marginTop: '4px',
            maxHeight: '260px',
            overflowY: 'auto',
            listStyle: 'none',
            padding: 0,
          }}
        >
          {results.map((place, index) => {
            const isSelected = index === focusedIndex;
            return (
              <li
                key={place.place_id || `${place.title}-${index}`}
                role="option"
                aria-selected={isSelected}
                className={`autocomplete-item ${isSelected ? 'highlighted' : ''}`}
                onClick={() => handleSelect(place)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--rule, #EFEEE8)',
                  backgroundColor: isSelected ? 'var(--pact-green-wash, #E8EFE8)' : 'transparent',
                }}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>
                  📍 {place.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
                  {place.address}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ink-muted)', marginTop: '1px', fontFamily: 'var(--font-mono)' }}>
                  {place.gps_coordinates.latitude.toFixed(4)}, {place.gps_coordinates.longitude.toFixed(4)}
                  {place.open_state ? ` · ${place.open_state}` : ''}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
