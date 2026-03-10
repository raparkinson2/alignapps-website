'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LocationSuggestion {
  id: string;
  name: string;
  address: string;
}

interface LocationSearchProps {
  value: string;
  onChange: (name: string, address: string) => void;
  placeholder?: string;
  className?: string;
}

async function searchPlaces(query: string): Promise<LocationSuggestion[]> {
  if (query.length < 2) return [];

  try {
    // Try to get user location for better nearby results
    let viewbox = '';
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 })
      );
      const { latitude: lat, longitude: lon } = pos.coords;
      viewbox = `&bounded=1&viewbox=${lon - 1.5},${lat + 1.0},${lon + 1.5},${lat - 1.0}`;
    } catch {
      // no location, do a general search
    }

    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: '8',
      countrycodes: 'us,ca',
    });

    const url = `https://nominatim.openstreetmap.org/search?${params}${viewbox}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'AlignSports/1.0' } });
    if (!res.ok) return [];

    const data = await res.json() as Array<{
      place_id: number;
      display_name: string;
      name?: string;
      address?: {
        amenity?: string;
        building?: string;
        leisure?: string;
        house_number?: string;
        road?: string;
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        postcode?: string;
      };
    }>;

    return data.map((item) => {
      const addr = item.address ?? {};
      const venueName = item.name ?? addr.amenity ?? addr.building ?? addr.leisure ?? '';
      const streetParts = [addr.house_number, addr.road].filter(Boolean).join(' ');
      const cityPart = addr.city ?? addr.town ?? addr.village ?? '';
      const statePart = addr.state ?? '';
      const addressStr = [streetParts, cityPart, statePart].filter(Boolean).join(', ');

      return {
        id: String(item.place_id),
        name: venueName || cityPart || item.display_name.split(',')[0],
        address: addressStr || item.display_name,
      };
    }).filter((s) => s.name);
  } catch {
    return [];
  }
}

export default function LocationSearch({ value, onChange, placeholder = 'Search for a place...', className }: LocationSearchProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync when external value changes (e.g. editing existing)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      const results = await searchPlaces(query);
      setSuggestions(results);
      setIsLoading(false);
      setShowDropdown(true);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (s: LocationSuggestion) => {
    setQuery(s.name);
    setSuggestions([]);
    setShowDropdown(false);
    onChange(s.name, s.address);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    onChange('', '');
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value, ''); }}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full bg-white/[0.05] border border-white/10 rounded-xl pl-8 pr-8 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 focus:border-[#67e8f9]/40 text-sm"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (suggestions.length > 0 || isLoading) && (
        <div className="absolute z-50 top-full mt-1 w-full bg-[#0d1526] border border-white/10 rounded-xl shadow-xl overflow-hidden">
          {isLoading && (
            <div className="px-3 py-2.5 text-xs text-slate-500">Searching...</div>
          )}
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelect(s)}
              className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-white/[0.05] transition-colors text-left"
            >
              <MapPin size={13} className="text-[#67e8f9] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm text-slate-200 truncate">{s.name}</p>
                <p className="text-xs text-slate-500 truncate">{s.address}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
