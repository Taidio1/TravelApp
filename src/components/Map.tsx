import React, { useEffect, useRef, useState } from 'react';
import { LocateFixed, Search, X, Loader2 } from 'lucide-react';
import { importLibrary, mapOptions, searchNearby } from '../lib/google-maps';
import type { NearbyPlace } from '../lib/google-maps';

const CATEGORY_COLORS: Record<string, string> = {
  food: '#E74C3C',
  sightseeing: '#3498DB',
  activity: '#2ECC71',
  scenery: '#9B59B6',
  default: '#FF8C00',
};

const CATEGORY_EMOJI: Record<string, string> = {
  food: '🍽️',
  sightseeing: '🏛️',
  activity: '🎢',
  scenery: '🌅',
  default: '📍',
};

const STAGGER_MS = 45; // delay between each pin's pop-in

// haversine distance (km) for distance-based ordering
const distanceKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
};

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

// normalized render model for both DB places and discovery places
interface PinModel {
  key: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  photoUrl: string | null;
  approved: boolean;
  source: 'db' | 'discovery';
  raw: any;
}

interface MapProps {
  onMapClick?: (lat: number, lng: number) => void;
  places?: any[];
  onMarkerClick?: (place: any) => void;
  onDiscoveryClick?: (place: { lat: number; lng: number; name: string; category: string; placeId: string; photoUrl: string | null; rating?: number | null; userRatingsTotal?: number | null }) => void;
  onLocate?: (lat: number, lng: number) => void;
  categoryFilter?: string;
  focus?: { lat: number; lng: number; nonce: number } | null;
}

const Map: React.FC<MapProps> = ({
  onMapClick,
  places = [],
  onMarkerClick,
  onDiscoveryClick,
  onLocate,
  categoryFilter = 'all',
  focus,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const overlayClassRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const userPosRef = useRef<{ lat: number; lng: number }>({
    lat: mapOptions.center.lat,
    lng: mapOptions.center.lng,
  });
  const onMapClickRef = useRef(onMapClick);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onDiscoveryClickRef = useRef(onDiscoveryClick);
  const onLocateRef = useRef(onLocate);
  onMapClickRef.current = onMapClick;
  onMarkerClickRef.current = onMarkerClick;
  onDiscoveryClickRef.current = onDiscoveryClick;
  onLocateRef.current = onLocate;

  // discovery (auto-fetched nearby) places + the location they were fetched for
  const [discovery, setDiscovery] = useState<NearbyPlace[]>([]);
  const [searchCenter, setSearchCenter] = useState(mapOptions.center);

  // location button / search fallback state
  const [locating, setLocating] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const sessionTokenRef = useRef<any>(null);
  const debounceRef = useRef<number | undefined>(undefined);

  // OverlayView subclass that renders an HTML pin at a LatLng (cached once google is loaded)
  const getPinOverlayClass = (g: any) => {
    if (overlayClassRef.current) return overlayClassRef.current;
    class PinOverlay extends g.OverlayView {
      position: any;
      el: HTMLElement;
      onClick: () => void;
      constructor(position: any, el: HTMLElement, onClick: () => void) {
        super();
        this.position = position;
        this.el = el;
        this.onClick = onClick;
      }
      onAdd() {
        this.el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.onClick();
        });
        this.getPanes().overlayMouseTarget.appendChild(this.el);
      }
      draw() {
        const p = this.getProjection().fromLatLngToDivPixel(this.position);
        if (!p) return;
        this.el.style.left = `${p.x}px`;
        this.el.style.top = `${p.y}px`;
      }
      onRemove() {
        this.el.remove();
      }
    }
    overlayClassRef.current = PinOverlay;
    return PinOverlay;
  };

  // drop / move the "you are here" marker and recenter
  const goTo = async (lat: number, lng: number, zoom = 14) => {
    userPosRef.current = { lat, lng };
    setSearchCenter({ lat, lng });
    onLocateRef.current?.(lat, lng);
    if (!map) return;
    const markerLib: any = await importLibrary('marker');
    const pos = { lat, lng };
    if (userMarkerRef.current) {
      userMarkerRef.current.position = pos;
    } else {
      const dot = document.createElement('div');
      dot.style.cssText =
        'width:16px;height:16px;border-radius:50%;background:#1A73E8;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)';
      userMarkerRef.current = new markerLib.AdvancedMarkerElement({
        position: pos,
        map,
        title: 'Twoja lokalizacja',
        zIndex: 9999,
        content: dot,
      });
    }
    map.panTo(pos);
    map.setZoom(zoom);
  };

  const locateMe = () => {
    if (!navigator.geolocation) {
      setShowSearch(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        goTo(p.coords.latitude, p.coords.longitude);
      },
      () => {
        // permission denied / unavailable → fall back to manual search
        setLocating(false);
        setShowSearch(true);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // fetch type-ahead suggestions as the user types
  useEffect(() => {
    if (!showSearch) return;
    const q = query.trim();
    window.clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      const placesLib: any = await importLibrary('places');
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
      }
      try {
        const { suggestions } =
          await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: q,
            sessionToken: sessionTokenRef.current,
          });
        setSuggestions(suggestions ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => window.clearTimeout(debounceRef.current);
  }, [query, showSearch]);

  const pickSuggestion = async (s: any) => {
    try {
      const place = s.placePrediction.toPlace();
      await place.fetchFields({ fields: ['location'] });
      const loc = place.location;
      if (loc) goTo(loc.lat(), loc.lng());
    } catch {
      /* ignore resolution errors */
    }
    setShowSearch(false);
    setQuery('');
    setSuggestions([]);
    sessionTokenRef.current = null; // end the billing session
  };

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userPosRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setSearchCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        onLocateRef.current?.(pos.coords.latitude, pos.coords.longitude);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    // 'marker' must be imported before AdvancedMarkerElement can be used.
    Promise.all([importLibrary('maps'), importLibrary('marker')]).then(([mapsLib]: any[]) => {
      if (mapRef.current && !map) {
        const newMap = new mapsLib.Map(mapRef.current, mapOptions);
        newMap.addListener('click', (e: any) => {
          if (e.latLng) onMapClickRef.current?.(e.latLng.lat(), e.latLng.lng());
        });
        setMap(newMap);
      }
    });
  }, [map]);

  // pan/zoom to a candidate when its name is clicked in the voting banner
  useEffect(() => {
    if (!map || !focus) return;
    map.panTo({ lat: focus.lat, lng: focus.lng });
    map.setZoom(16);
  }, [map, focus]);

  // auto-fetch ≥15 nearby restaurants + cultural spots around the search center
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    searchNearby(searchCenter.lat, searchCenter.lng).then((results) => {
      if (!cancelled) setDiscovery(results);
    });
    return () => {
      cancelled = true;
    };
  }, [map, searchCenter]);

  // render all pins (DB places + discovery) as HTML photo bubbles
  useEffect(() => {
    if (!map) return;

    overlaysRef.current.forEach((o: any) => o.setMap(null));
    overlaysRef.current = [];

    const g = (window as any).google.maps;
    const PinOverlay = getPinOverlayClass(g);
    const { lat: uLat, lng: uLng } = userPosRef.current;

    // DB places already filtered by the parent; discovery filtered here
    const dbModels: PinModel[] = places.map((p: any) => ({
      key: `db-${p.id}`,
      name: p.name,
      lat: Number(p.lat),
      lng: Number(p.lng),
      category: p.category,
      photoUrl: p.photo_url,
      approved: p.status === 'approved',
      source: 'db',
      raw: p,
    }));

    const showDiscovery =
      categoryFilter === 'all' || categoryFilter === 'food' || categoryFilter === 'sightseeing';
    const discModels: PinModel[] = (showDiscovery ? discovery : [])
      .filter((p) => categoryFilter === 'all' || p.category === categoryFilter)
      .map((p) => ({
        key: `disc-${p.id}`,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        category: p.category,
        photoUrl: p.photoUrl,
        approved: false,
        source: 'discovery',
        raw: p,
      }));

    // nearest first so the pop-in radiates out from the user
    const ordered = [...dbModels, ...discModels].sort(
      (a, b) => distanceKm(uLat, uLng, a.lat, a.lng) - distanceKm(uLat, uLng, b.lat, b.lng)
    );

    ordered.forEach((m, i) => {
      const color = m.approved
        ? '#F39C12'
        : CATEGORY_COLORS[m.category] ?? CATEGORY_COLORS.default;
      const emoji = CATEGORY_EMOJI[m.category] ?? CATEGORY_EMOJI.default;

      const wrap = document.createElement('div');
      wrap.className = 'map-pin' + (m.approved ? ' map-pin--approved' : '');
      wrap.style.setProperty('--pin-color', color);
      wrap.style.animationDelay = `${i * STAGGER_MS}ms`;

      const media = m.photoUrl
        ? `<img class="map-pin-photo" src="${m.photoUrl}" alt="" />`
        : `<span class="map-pin-emoji">${emoji}</span>`;
      wrap.innerHTML =
        `<div class="map-pin-bubble">${media}<span class="map-pin-title">${esc(m.name)}</span></div>` +
        `<span class="map-pin-stem"></span>`;

      const overlay = new PinOverlay(
        new g.LatLng(m.lat, m.lng),
        wrap,
        () => {
          if (m.source === 'db') {
            onMarkerClickRef.current?.(m.raw);
          } else {
            onDiscoveryClickRef.current?.({
              lat: m.lat,
              lng: m.lng,
              name: m.name,
              category: m.category,
              placeId: m.raw.id,
              photoUrl: m.photoUrl,
              rating: m.raw.rating ?? null,
              userRatingsTotal: m.raw.userRatingsTotal ?? null,
            });
          }
        }
      );
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    });

    return () => {
      overlaysRef.current.forEach((o: any) => o.setMap(null));
      overlaysRef.current = [];
    };
  }, [map, places, discovery, categoryFilter]);

  return (
    <div className="relative w-full h-full rounded-[24px] overflow-hidden shadow-neu-flat">
      <div ref={mapRef} className="w-full h-full" />

      {/* Locate-me button */}
      <button
        onClick={locateMe}
        title="Znajdź mnie"
        className="absolute top-16 right-4 z-20 w-12 h-12 rounded-full bg-white/95 dark:bg-gray-800/95 backdrop-blur shadow-neu-flat flex items-center justify-center text-spanish-orange active:shadow-neu-pressed transition-all"
      >
        {locating ? (
          <Loader2 size={22} className="animate-spin" />
        ) : (
          <LocateFixed size={22} />
        )}
      </button>

      {/* Manual-search fallback */}
      {showSearch && (
        <div className="absolute top-16 left-4 right-20 z-30">
          <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur rounded-2xl shadow-neu-flat overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <Search size={18} className="text-gray-400 shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Wpisz miasto, ulicę..."
                className="flex-1 bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none"
              />
              <button
                onClick={() => {
                  setShowSearch(false);
                  setQuery('');
                  setSuggestions([]);
                }}
                className="shrink-0 text-gray-400"
              >
                <X size={18} />
              </button>
            </div>

            {suggestions.length > 0 && (
              <ul className="border-t border-gray-100 dark:border-gray-700 max-h-60 overflow-y-auto">
                {suggestions.map((s, i) => {
                  const pred = s.placePrediction;
                  return (
                    <li key={pred?.placeId ?? i}>
                      <button
                        onClick={() => pickSuggestion(s)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-spanish-bg active:bg-spanish-bg transition-colors"
                      >
                        {pred?.text?.text ?? ''}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Map;
