import React, { useEffect, useRef, useState } from 'react';
import { LocateFixed, Search, X, Loader2, Layers } from 'lucide-react';
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
  planningMode?: boolean;
  planningPlaces?: Array<{ name: string; lat: number; lng: number; category?: string }>;
  previewPlaces?: Array<{ name: string; lat: number; lng: number; category?: string }>;
  suggestionPlaces?: Array<{ name: string; lat: number; lng: number; category?: string }>;
  suggestionFitRequest?: number;
}

const Map: React.FC<MapProps> = ({
  onMapClick,
  places = [],
  onMarkerClick,
  onDiscoveryClick,
  onLocate,
  categoryFilter = 'all',
  focus,
  planningMode = false,
  planningPlaces = [],
  previewPlaces = [],
  suggestionPlaces = [],
  suggestionFitRequest = 0,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'satellite'>('roadmap');
  // keyed pin store for reconciliation: key -> { overlay, sig }
  const overlaysRef = useRef<globalThis.Map<string, { overlay: any; sig: string }>>(new globalThis.Map());
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

  useEffect(() => {
    if (map) {
      map.setMapTypeId(mapTypeId);
    }
  }, [map, mapTypeId]);

  const planningOverlaysRef = useRef<any[]>([]);
  const planningPolylineRef = useRef<any>(null);
  const planningAbortRef = useRef(false);
  const previewOverlaysRef = useRef<any[]>([]);
  const previewPolylineRef = useRef<any>(null);
  const suggestionOverlaysRef = useRef<any[]>([]);

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

  // render all pins (DB places + discovery) as HTML photo bubbles.
  // Reconciles against the existing overlay set by key instead of tearing
  // down and rebuilding every DOM node on each change.
  useEffect(() => {
    if (!map) return;

    const store = overlaysRef.current;

    if (planningMode) {
      // planning view hides regular pins
      store.forEach(({ overlay }) => overlay.setMap(null));
      store.clear();
      return;
    }

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

    // visual identity of a pin — if unchanged we keep the existing DOM node
    const sigOf = (m: PinModel) =>
      `${m.name}|${m.lat}|${m.lng}|${m.category}|${m.photoUrl ?? ''}|${m.approved}`;

    const desired = new Set(ordered.map((m) => m.key));

    // remove pins no longer present
    store.forEach(({ overlay }, key) => {
      if (!desired.has(key)) {
        overlay.setMap(null);
        store.delete(key);
      }
    });

    // add new / replace changed pins; leave unchanged ones untouched
    let newCount = 0;
    ordered.forEach((m) => {
      const sig = sigOf(m);
      const existing = store.get(m.key);
      if (existing && existing.sig === sig) return; // unchanged → keep DOM node
      if (existing) {
        existing.overlay.setMap(null);
        store.delete(m.key);
      }

      const color = m.approved
        ? '#F39C12'
        : CATEGORY_COLORS[m.category] ?? CATEGORY_COLORS.default;
      const emoji = CATEGORY_EMOJI[m.category] ?? CATEGORY_EMOJI.default;

      const wrap = document.createElement('div');
      wrap.className = 'map-pin' + (m.approved ? ' map-pin--approved' : '');
      wrap.style.setProperty('--pin-color', color);
      wrap.style.animationDelay = `${newCount++ * STAGGER_MS}ms`;

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
      store.set(m.key, { overlay, sig });
    });
  }, [map, places, discovery, categoryFilter, planningMode]);

  // tear down all regular pins on unmount
  useEffect(() => () => {
    overlaysRef.current.forEach(({ overlay }) => overlay.setMap(null));
    overlaysRef.current.clear();
  }, []);

  // Planning mode: sequential marker → line → marker → line animation
  useEffect(() => {
    if (!map || !planningMode || planningPlaces.length === 0) return;

    const g = (window as any).google?.maps;
    if (!g) return;

    planningAbortRef.current = false;
    const PinOverlay = getPinOverlayClass(g);

    const polyline = new g.Polyline({
      path: [],
      geodesic: true,
      strokeColor: '#FF8C00',
      strokeOpacity: 0.9,
      strokeWeight: 4,
      map,
    });
    planningPolylineRef.current = polyline;

    // Fit all planning places into view
    const bounds = new g.LatLngBounds();
    planningPlaces.forEach(p => bounds.extend(new g.LatLng(Number(p.lat), Number(p.lng))));
    map.fitBounds(bounds, 80);

    const run = async () => {
      const committed: Array<{ lat: number; lng: number }> = [];

      for (let i = 0; i < planningPlaces.length; i++) {
        if (planningAbortRef.current) break;

        const p = planningPlaces[i];
        const latLng = { lat: Number(p.lat), lng: Number(p.lng) };

        // Show numbered marker with bounce
        const el = document.createElement('div');
        el.className = 'planning-pin';
        el.innerHTML = `<div class="planning-pin-bubble">${i + 1}</div><span class="planning-pin-stem"></span>`;
        const overlay = new PinOverlay(new g.LatLng(latLng.lat, latLng.lng), el, () => {});
        overlay.setMap(map);
        planningOverlaysRef.current.push(overlay);

        await new Promise(r => setTimeout(r, 420));
        if (planningAbortRef.current) break;

        // Animate polyline segment to next marker
        if (i < planningPlaces.length - 1) {
          const nextP = planningPlaces[i + 1];
          const nextLatLng = { lat: Number(nextP.lat), lng: Number(nextP.lng) };
          const base = [...committed, latLng];
          const STEPS = 28;
          let step = 0;

          await new Promise<void>(resolve => {
            const tick = () => {
              if (planningAbortRef.current) { resolve(); return; }
              step++;
              const t = step / STEPS;
              polyline.setPath([
                ...base,
                { lat: latLng.lat + (nextLatLng.lat - latLng.lat) * t,
                  lng: latLng.lng + (nextLatLng.lng - latLng.lng) * t },
              ]);
              if (step < STEPS) requestAnimationFrame(tick);
              else resolve();
            };
            requestAnimationFrame(tick);
          });
        }

        committed.push(latLng);
        polyline.setPath([...committed]);
      }
    };

    run();

    return () => {
      planningAbortRef.current = true;
      planningOverlaysRef.current.forEach(o => o.setMap(null));
      planningOverlaysRef.current = [];
      if (planningPolylineRef.current) {
        planningPolylineRef.current.setMap(null);
        planningPolylineRef.current = null;
      }
    };
  }, [map, planningMode, planningPlaces]);

  // Preview mode: instant blue markers + semi-transparent polyline overlaid on whatever is visible
  useEffect(() => {
    previewOverlaysRef.current.forEach(o => o.setMap(null));
    previewOverlaysRef.current = [];
    if (previewPolylineRef.current) {
      previewPolylineRef.current.setMap(null);
      previewPolylineRef.current = null;
    }

    if (!map || previewPlaces.length === 0) return;

    const g = (window as any).google?.maps;
    if (!g) return;

    const PinOverlay = getPinOverlayClass(g);

    const path = previewPlaces.map(p => ({ lat: Number(p.lat), lng: Number(p.lng) }));
    const polyline = new g.Polyline({
      path,
      geodesic: true,
      strokeColor: '#3498DB',
      strokeOpacity: 0.55,
      strokeWeight: 3,
      map,
    });
    previewPolylineRef.current = polyline;

    previewPlaces.forEach((p, i) => {
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.transform = 'translate(-50%, -50%)';
      el.style.width = '26px';
      el.style.height = '26px';
      el.style.borderRadius = '50%';
      el.style.background = '#3498DB';
      el.style.border = '2.5px solid #fff';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.color = '#fff';
      el.style.fontSize = '11px';
      el.style.fontWeight = 'bold';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
      el.style.opacity = '0.9';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '6';
      el.textContent = String(i + 1);

      const overlay = new PinOverlay(new g.LatLng(Number(p.lat), Number(p.lng)), el, () => {});
      overlay.setMap(map);
      previewOverlaysRef.current.push(overlay);
    });

    return () => {
      previewOverlaysRef.current.forEach(o => o.setMap(null));
      previewOverlaysRef.current = [];
      if (previewPolylineRef.current) {
        previewPolylineRef.current.setMap(null);
        previewPolylineRef.current = null;
      }
    };
  }, [map, previewPlaces]);

  // Fit map to show all suggestion + preview places when requested
  useEffect(() => {
    if (!map || !suggestionFitRequest) return;
    const g = (window as any).google?.maps;
    if (!g) return;
    const all = [...previewPlaces, ...suggestionPlaces];
    if (all.length === 0) return;
    const bounds = new g.LatLngBounds();
    all.forEach(p => bounds.extend(new g.LatLng(Number(p.lat), Number(p.lng))));
    map.fitBounds(bounds, 80);
  }, [map, suggestionFitRequest]);

  // AI suggestions: green diamond pins (no polyline — unordered candidates)
  useEffect(() => {
    suggestionOverlaysRef.current.forEach(o => o.setMap(null));
    suggestionOverlaysRef.current = [];

    if (!map || suggestionPlaces.length === 0) return;

    const g = (window as any).google?.maps;
    if (!g) return;

    const PinOverlay = getPinOverlayClass(g);

    suggestionPlaces.forEach((p) => {
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.transform = 'translate(-50%, -50%)';
      el.style.width = '28px';
      el.style.height = '28px';
      el.style.borderRadius = '6px';
      el.style.rotate = '45deg';
      el.style.background = '#27AE60';
      el.style.border = '2.5px solid #fff';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
      el.style.opacity = '0.9';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '7';

      const inner = document.createElement('div');
      inner.style.width = '100%';
      inner.style.height = '100%';
      inner.style.display = 'flex';
      inner.style.alignItems = 'center';
      inner.style.justifyContent = 'center';
      inner.style.rotate = '-45deg';
      inner.style.color = '#fff';
      inner.style.fontSize = '14px';
      inner.style.lineHeight = '1';
      inner.textContent = '✦';
      el.appendChild(inner);

      const overlay = new PinOverlay(new g.LatLng(Number(p.lat), Number(p.lng)), el, () => {});
      overlay.setMap(map);
      suggestionOverlaysRef.current.push(overlay);
    });

    return () => {
      suggestionOverlaysRef.current.forEach(o => o.setMap(null));
      suggestionOverlaysRef.current = [];
    };
  }, [map, suggestionPlaces]);

  return (
    <div className="relative w-full h-full overflow-hidden shadow-neu-flat">
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

      {/* Layer toggle button */}
      <button
        onClick={() => setMapTypeId(prev => prev === 'roadmap' ? 'satellite' : 'roadmap')}
        title="Zmień widok"
        className="absolute top-32 right-4 z-20 w-12 h-12 rounded-full bg-white/95 dark:bg-gray-800/95 backdrop-blur shadow-neu-flat flex items-center justify-center text-spanish-orange active:shadow-neu-pressed transition-all"
      >
        <Layers size={22} className={mapTypeId === 'satellite' ? 'text-spanish-red' : ''} />
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

export default React.memo(Map);
