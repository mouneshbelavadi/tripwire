import { useState, useEffect, useRef } from 'react';

export interface VerifiedPlace {
  title: string;
  place_id: string;
  data_id?: string;
  address: string;
  gps_coordinates: {
    latitude: number;
    longitude: number;
  };
  open_state?: string;
}

interface VenueSearchModalProps {
  onClose: () => void;
  onSelect: (place: VerifiedPlace) => void;
}

export function VenueSearchModal({ onClose, onSelect }: VenueSearchModalProps) {
  const [query, setQuery] = useState('coworking Bellandur');
  const [results, setResults] = useState<VerifiedPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previousActiveElement = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const fetchVenues = (q: string) => {
    setLoading(true);
    setError(null);
    fetch(`/api/venues/search?q=${encodeURIComponent(q)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Search failed');
        return res.json();
      })
      .then((data) => {
        setResults(data.venues || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to search places');
        setLoading(false);
      });
  };

  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;
    searchInputRef.current?.focus();
    fetchVenues(query);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [onClose]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchVenues(query);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="venue-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="venue-dialog-title">Select Destination Workplace</h3>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <div className="venue-modal-body">
          <form onSubmit={handleSearch} className="venue-search-form">
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search coworking / office in Bengaluru..."
              aria-label="Search places in Bengaluru"
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>

          <div className="venue-notice">
            Places resolved via SerpApi Maps API. Coordinates are validated. Desk availability or Wi-Fi status is never claimed.
          </div>

          {error && <div className="error-banner" role="alert">{error}</div>}

          <div className="venue-results-list">
            {results.map((place) => (
              <div key={place.place_id} className="venue-result-item">
                <div className="venue-info">
                  <div className="venue-title">{place.title}</div>
                  <div className="venue-address">{place.address}</div>
                  <div className="venue-coords">
                    {place.gps_coordinates.latitude.toFixed(4)}, {place.gps_coordinates.longitude.toFixed(4)}
                    {place.open_state ? ` · ${place.open_state}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary-sm"
                  onClick={() => {
                    onSelect(place);
                    onClose();
                  }}
                >
                  Select Place
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
