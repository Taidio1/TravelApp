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
-- These rows are both the "Alicante" search result AND the default landing
-- list in "Odkrywaj Hiszpanię" (the app queries city = 'Alicante' on load).
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
   'scenery', 38.16556, -0.47889, 8),
  ('Alicante', 'Museo Arqueológico (MARQ)',
   'Nagradzane muzeum archeologiczne prezentujące historię regionu od prehistorii po średniowiecze. Nowoczesna, interaktywna ekspozycja wciąga zarówno dorosłych, jak i dzieci.',
   'sightseeing', 38.34908, -0.47899, 9),
  ('Alicante', 'Concatedral de San Nicolás',
   'Główna świątynia Alicante w surowym stylu herreriańskim z imponującą kopułą. Spokojne wnętrze i renesansowy krużganek dają wytchnienie od miejskiego zgiełku.',
   'sightseeing', 38.34778, -0.48056, 10),
  ('Alicante', 'Playa de San Juan',
   'Szeroka, kilometrowa plaża ze złotym piaskiem na obrzeżach miasta, ulubiona przez mieszkańców. Idealna na cały dzień nad wodą i sporty plażowe.',
   'scenery', 38.39556, -0.41806, 11),
  ('Alicante', 'Museo de Bellas Artes Gravina (MUBAG)',
   'Galeria sztuki w XVIII-wiecznym pałacu, z bogatą kolekcją alicantyjskiego malarstwa XIX wieku. Wstęp wolny i piękne, klimatyczne wnętrza.',
   'sightseeing', 38.34750, -0.47861, 12),
  ('Alicante', 'Parque de la Ereta',
   'Tarasowy park na zboczu pod zamkiem, z oliwkami, ścieżkami i punktami widokowymi na stare miasto. Doskonałe miejsce na zachód słońca nad dachami Alicante.',
   'scenery', 38.34944, -0.47694, 13),
  ('Alicante', 'Plaza de los Luceros',
   'Reprezentacyjny okrągły plac z monumentalną fontanną, sercem miejskiej komunikacji i fiesty Hogueras. Tętni życiem zwłaszcza podczas czerwcowych mascletà.',
   'sightseeing', 38.34528, -0.49000, 14),
  ('Alicante', 'Ayuntamiento de Alicante',
   'Okazały barokowy ratusz z dwiema wieżami i bogato zdobioną fasadą z XVIII wieku. W środku kryje się zerowy punkt pomiaru wysokości nad poziomem morza w Hiszpanii.',
   'sightseeing', 38.34639, -0.48083, 15);
