# Spain Trip 2026 🗺️

Collaborative travel planning app for a group Spain trip. Mobile-first. Multiple users propose places, vote on them in real time, and an admin finalises the daily itinerary. Includes an AI-powered trip wizard that builds and animates a personalised route on the map.

---

## Features

### Map & Discovery
- Interactive Google Maps with custom HTML photo-bubble markers
- Auto-discovery of nearby restaurants & cultural spots via Places API
- Category filters: Wszystkie / Restauracje / Kulturalne / 4fun / Widoczki / Must Have
- Tap any marker to open a detail card; tap the map to add a place manually

### AI Trip Wizard
- 4-step form: duration → transport → food preference → vibe
- Generates a 6–8 place ordered route via Gemini 2.5 Flash or GPT-4o-mini
- Results list with tap-to-select cards and direct Google Maps links
- **Planning mode**: existing markers fade out, selected places animate in sequentially as numbered pins (1 → line → 2 → line → 3…) with a live polyline route
- Map auto-fits bounds to the full route
- Explicit "Zapisz trasę" button; saved routes persist in `localStorage`

### Saved Routes ("Moje trasy")
- Up to 10 routes stored in `localStorage`
- Home screen of the wizard shows all saved routes with name, date, and place count
- Tap a route → **route detail view** with numbered place list + Maps links → "Pokaż trasę na mapie"
- Delete individual routes with the trash icon
- Loading a saved route immediately shows "✓ Zapisano" in planning mode

### Collaboration & Voting
- Real-time board of proposed places via Supabase Realtime (Postgres CDC)
- Upvote / downvote with toggle; live vote counts
- Admin starts timed voting rounds; top-voted place wins automatically
- Admin can finalize any place directly to the daily plan

### Auth & Profiles
- Email/password auth via Supabase Auth
- DiceBear avatar picker
- Role-based access: `admin` / `user`

### UX
- Dark mode (persisted)
- Neumorphic shadows (`shadow-neu-flat` / `shadow-neu-pressed`)
- Framer Motion transitions and overlay slide-ins
- Favorites list (private, per-user)
- Photo lightbox

---

## Tech Stack

| Layer | Library |
|---|---|
| UI | React 18 + TypeScript, Tailwind v4 |
| Animations | Framer Motion |
| Map | Google Maps JS API (`@googlemaps/js-api-loader` v2) |
| AI | Gemini 2.5 Flash (`@google/generative-ai`) / GPT-4o-mini |
| Backend | Supabase (Postgres + Realtime + Auth + RLS) |
| Build | Vite |

---

## Setup

```bash
npm install
```

Create `.env` (copy from `.env.example` if present):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_MAPS_API_KEY=
VITE_GEMINI_API_KEY=
VITE_OPENAI_API_KEY=
```

```bash
npm run dev       # dev server with HMR
npm run build     # type-check + production build
npm run preview   # serve production build locally
npm run lint      # ESLint
```

---

## Project Structure

```
src/
├── components/
│   ├── AIAssistant.tsx      # legacy free-text AI widget (kept, unused in main flow)
│   ├── AddPlaceForm.tsx     # manual place insertion via map tap
│   ├── Auth.tsx             # login / register gate
│   ├── DiscoveryCard.tsx    # Google Places discovery preview
│   ├── FavoritesList.tsx    # private saved places overlay
│   ├── LocationCard.tsx     # board place detail + vote + admin actions
│   ├── Map.tsx              # Google Maps with markers, planning mode, route animation
│   ├── Planner.tsx          # daily plan view
│   ├── ProfilePage.tsx      # avatar + sign-out
│   ├── SavedPlaces.tsx      # saved/favorites list view
│   ├── StartVoteModal.tsx   # date picker for starting a voting round
│   ├── TripWizard.tsx       # AI trip planner wizard + saved routes
│   └── VotingBanner.tsx     # live voting round countdown + candidates
├── hooks/
│   ├── useDarkMode.ts
│   └── useRealtime.ts       # generic Supabase CDC hook
├── lib/
│   ├── gemini.ts            # Gemini 2.5 Flash suggestPlaces()
│   ├── google-maps.ts       # loader + searchNearby()
│   ├── openai.ts            # GPT-4o-mini suggestPlaces()
│   └── supabase.ts          # Supabase client
└── App.tsx                  # root: state, routing between views, all overlays
```

---

## Database Schema (Supabase)

| Table | Key columns |
|---|---|
| `profiles` | `id` (→ auth.users), `role`, `username`, `avatar_url` |
| `places` | `name`, `lat`, `lng`, `category`, `status`, `ai_suggested`, `round_id`, `photo_url` |
| `votes` | `place_id`, `user_id`, `vote_type` (1 / -1) — unique per pair |
| `daily_plans` | `date`, `place_id`, `order`, `assigned_by` |
| `voting_rounds` | `target_date`, `status`, `ends_at`, `winner_place_id` |
| `favorites` | `user_id`, `name`, `google_place_id`, `photo_url` |

RLS enabled on all tables. Admins have elevated write access.
