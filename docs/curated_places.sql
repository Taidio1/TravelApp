-- Curated, hand-picked places shown instantly (from DB) in "Odkrywaj Hiszpanię"
-- city search. The rest of the list is filled in by AI.
-- Run this in the Supabase SQL editor.

create table if not exists curated_places (
  id          uuid primary key default gen_random_uuid(),
  city        text not null,
  name        text not null,
  description text not null,
  category    text not null check (category in ('food', 'sightseeing', 'activity', 'scenery')),
  lat         double precision not null,
  lng         double precision not null,
  photo_url   text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists curated_places_city_idx on curated_places (lower(city));

-- Read-only for everyone (curated content is public to the app).
alter table curated_places enable row level security;

drop policy if exists "curated_places readable by all" on curated_places;
create policy "curated_places readable by all"
  on curated_places for select
  using (true);

-- ── Seed: Alicante ──────────────────────────────────────────────────────────
delete from curated_places where lower(city) = 'alicante';

insert into curated_places (city, name, description, category, lat, lng, sort_order) values
  ('Alicante', 'Castillo de Santa Bárbara',
   'Średniowieczna twierdza na szczycie góry Benacantil górująca nad miastem. Roztacza się stąd najlepsza panorama Alicante i Morza Śródziemnego.',
   'sightseeing', 38.34889, -0.47556, 1),
  ('Alicante', 'Explanada de España',
   'Reprezentacyjna nadmorska promenada wyłożona 6,5 miliona kolorowych kostek tworzących falujący wzór. Idealne miejsce na wieczorny spacer wśród palm.',
   'sightseeing', 38.34167, -0.48139, 2),
  ('Alicante', 'Playa del Postiguet',
   'Miejska plaża z drobnym piaskiem tuż przy centrum, u stóp zamkowego wzgórza. Świetna na kąpiel i relaks bez wychodzenia z miasta.',
   'scenery', 38.34583, -0.47694, 3),
  ('Alicante', 'Barrio de Santa Cruz',
   'Malownicza stara dzielnica z wąskimi uliczkami, bielonymi domami i doniczkami pełnymi kwiatów. Prowadzi pod górę aż do zamku.',
   'sightseeing', 38.34917, -0.47833, 4),
  ('Alicante', 'Mercado Central de Alicante',
   'Tętniąca życiem hala targowa w modernistycznym budynku, pełna świeżych ryb, owoców morza i lokalnych specjałów. Najlepsze miejsce, by poczuć smak miasta.',
   'food', 38.34722, -0.48389, 5),
  ('Alicante', 'Basílica de Santa María',
   'Najstarszy kościół w Alicante, wzniesiony na miejscu dawnego meczetu, z efektowną barokową fasadą. Wnętrze kryje bogato zdobiony złoty ołtarz.',
   'sightseeing', 38.34806, -0.47750, 6),
  ('Alicante', 'Puerto de Alicante',
   'Nowoczesna marina i port pełen jachtów, restauracji i barów nad samą wodą. Wieczorem rozświetla się i staje sercem nocnego życia miasta.',
   'activity', 38.33889, -0.48417, 7),
  ('Alicante', 'Isla de Tabarca',
   'Niewielka wyspa i rezerwat morski, do której dopływa się łodzią z portu. Krystaliczna woda i historyczna osada czynią z niej idealną wycieczkę na dzień.',
   'scenery', 38.16556, -0.47889, 8);

-- ── Seed: default feed (instant first list in "Odkrywaj Hiszpanię") ──────────
-- city = '__feed__' is a reserved marker for the default landing list,
-- not a real city. These show instantly; AI then appends more below.
delete from curated_places where city = '__feed__';

insert into curated_places (city, name, description, category, lat, lng, sort_order) values
  ('__feed__', 'Sagrada Família',
   'Niedokończona bazylika Gaudíego i symbol Barcelony, zachwycająca strzelistymi wieżami i baśniową fasadą. W środku światło przesącza się przez witraże niczym w kamiennym lesie.',
   'sightseeing', 41.40360, 2.17436, 1),
  ('__feed__', 'Alhambra',
   'Wspaniały kompleks pałacowy Maurów nad Granadą, z misternymi zdobieniami i ogrodami Generalife. Jedno z najpiękniejszych dzieł architektury islamskiej w Europie.',
   'sightseeing', 37.17610, -3.58810, 2),
  ('__feed__', 'Museo del Prado',
   'Jedno z najważniejszych muzeów sztuki na świecie, z arcydziełami Velázqueza, Goi i El Greca. Serce madryckiego trójkąta sztuki.',
   'sightseeing', 40.41381, -3.69213, 3),
  ('__feed__', 'Mercado de San Miguel',
   'Zabytkowa hala targowa w sercu Madrytu, dziś świątynia tapas i hiszpańskich smaków. Idealne miejsce, by spróbować wszystkiego po trochu.',
   'food', 40.41535, -3.70898, 4),
  ('__feed__', 'Park Güell',
   'Kolorowy park Gaudíego z falującymi ławkami z mozaiki i widokiem na całą Barcelonę. Bajkowa przestrzeń, gdzie architektura zlewa się z naturą.',
   'scenery', 41.41450, 2.15270, 5),
  ('__feed__', 'Real Alcázar de Sevilla',
   'Królewski pałac z bajecznymi dziedzińcami i ogrodami, wciąż używany przez hiszpańską rodzinę królewską. Mieszanka stylów mudejar, gotyku i renesansu.',
   'sightseeing', 37.38291, -5.99025, 6),
  ('__feed__', 'Ciudad de las Artes y las Ciencias',
   'Futurystyczny kompleks Calatravy w Walencji z oceanarium, planetarium i muzeum nauki. Architektoniczna wizja przyszłości nad dawnym korytem rzeki.',
   'activity', 39.45404, -0.35369, 7),
  ('__feed__', 'Playa de la Concha',
   'Jedna z najpiękniejszych miejskich plaż Europy, łukiem obejmująca zatokę San Sebastián. Złoty piasek i nadmorska promenada zachwycają o każdej porze.',
   'scenery', 43.31830, -1.98890, 8);
