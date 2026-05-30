# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite HMR)
npm run build      # Type-check + production build (tsc -b && vite build)
npm run lint       # ESLint
npm run preview    # Serve production build locally
```

No test suite is configured.

## Environment Variables

Required in `.env` (already present, do not commit changes):

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_GOOGLE_MAPS_API_KEY
VITE_GEMINI_API_KEY
VITE_OPENAI_API_KEY
```

## Architecture

**Spain Trip 2026** — a collaborative travel planning app, mobile view only. Multiple users share a live board of proposed places in Spain, vote on them, and an admin finalizes the daily itinerary. Includes an AI-powered trip wizard with animated route planning.

### Data layer — Supabase

All data flows through Supabase (Postgres + Realtime):

- `profiles` — extends `auth.users`; `role` is `'admin' | 'user'`
- `places` — proposed locations with lat/lng, category (`food | sightseeing | activity | scenery`), status (`proposed | approved | rejected`), `ai_suggested` flag
- `votes` — one row per user/place pair (unique constraint); inserting a duplicate vote is the toggle-off signal (error code `23505` → delete)
- `daily_plans` — admin-assigned ordered itinerary rows referencing `places`
- `favorites` — private per-user saved places (Google Places or board places)
- `voting_rounds` — timed voting rounds with `status`, `ends_at`, `winner_place_id`

RLS is enabled on all tables; admins have write access to `daily_plans` and can update any `places` row.

**`useRealtime<T>(table)`** (`src/hooks/useRealtime.ts`) — generic hook that does an initial `select('*')` then subscribes to Postgres CDC changes, maintaining local state for INSERT/UPDATE/DELETE events. Used in `App.tsx` for `places`, `votes`, `daily_plans`, `favorites`, `voting_rounds`.

### AI layer — Gemini / OpenAI

Two interchangeable providers expose the same `suggestPlaces(lat, lng, theme)` signature, returning `{ name, description, category, lat, lng }[]`:
- `src/lib/gemini.ts` — `gemini-2.5-flash`. Strips ` ```json ` fences via `[...]` regex before parsing.
- `src/lib/openai.ts` — `gpt-4o-mini` via Chat Completions with `response_format: json_object`; unwraps `{ places: [...] }`.

Provider choice persisted in `localStorage` as `ai_provider`, defaults to `gemini`. Both are used by the legacy `AIAssistant` component. The **TripWizard** builds its own richer prompt inline (6–8 places, ordered route) using the same provider setting.

### AI Trip Wizard — `src/components/TripWizard.tsx`

Full-screen bottom-sheet wizard with these steps/states:

```
'home'         → saved routes list + "Nowa trasa" CTA
'route_detail' → place list preview for a saved route
1 → 2 → 3 → 4 → wizard steps (duration / transport / food / vibe)
'loading'      → AI call in progress
'results'      → selectable place cards with Maps links
```

- Saved routes stored in `localStorage` key `saved_routes` (max 10, JSON array of `{ id, name, places, createdAt }`)
- Route name generated from form choices: e.g. `"2h · pieszo · kultura"`
- Prompt uses actual user coordinates (not hardcoded location)
- `onConfirm(places, name, alreadySaved?)` — called when user proceeds to map view
- Saving is **explicit** (button in planning mode), not automatic

### Planning Mode — `src/components/Map.tsx`

Props: `planningMode: boolean`, `planningPlaces: Array<{ name, lat, lng, category? }>`

When `planningMode = true`:
- Regular markers are hidden (main markers `useEffect` returns early)
- Sequential animation runs: marker #i bounces in → polyline animates to marker #i+1 → repeat
- Map `fitBounds` to all planning places
- Animation uses `requestAnimationFrame` for smooth polyline drawing; aborted via `planningAbortRef` on cleanup

When `planningMode = false`: regular markers re-render normally.

Planning mode state in `App.tsx`:
```typescript
planningMode: boolean
planningPlaces: any[]
planningRouteName: string
planningRouteSaved: boolean
```

Footer during planning mode: "Zapisz trasę" button (orange) → saves to localStorage → becomes "✓ Zapisano" chip + "Zakończ podgląd" button.

### Map layer — Google Maps JS API

`src/lib/google-maps.ts` uses the `@googlemaps/js-api-loader` v2 dynamic API. **Each library must be imported before use** — `importLibrary('marker')` required for `AdvancedMarkerElement` and `OverlayView`-based pins; `importLibrary('maps')` for `Polyline`. `mapOptions` is a warm light style centered on Madrid `40.4168, -3.7038`.

Custom HTML pins use `OverlayView` subclass (`PinOverlay`) cached in `overlayClassRef`. Two pin types:
- Regular pins: `map-pin` CSS class, photo bubble or emoji, staggered `pinPop` animation
- Planning pins: `planning-pin` CSS class, orange numbered circle, `planningPinPop` animation

Geolocation is read in both `Map.tsx` (updates internal `userPosRef` + calls `onLocate`) and **directly in `App.tsx`** on mount (ensures `userLocation` is set before TripWizard opens).

## Collaboration Rules

- **No commits, no design docs, no mockups** — write code directly, user tests manually
- **No brainstorming visualization/mock-up sessions** — go straight to plans and implementation
- **Terse responses** — user gives feedback themselves after testing; no trailing summaries
- **No visual companion / browser mockups** — text only

### UI conventions

- Styling: Tailwind v4 with custom theme tokens: `bg-spanish-bg` (`#F5F5F0`), `text-spanish-orange` (`#FF8C00`), `text-spanish-red` (`#D62828`), `shadow-neu-flat` / `shadow-neu-pressed` (neumorphic shadows).
- Animations: Framer Motion `AnimatePresence` + `motion.div` for view transitions and overlay slide-ins.
- Auth gate: `App.tsx` renders `<Auth />` when `session` is null; all Supabase writes assume an authenticated user.
- Admin gating: `userProfile?.role === 'admin'` passed as `isAdmin` prop; admin actions live in `App.tsx`.
- App.tsx return wraps everything in a `<>` Fragment — the TripWizard is rendered outside the main layout div as a `fixed inset-0` overlay.
