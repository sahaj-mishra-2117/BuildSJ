# Build SJ

Build SJ is a wildfire-preparedness website for residents of San Jose District 10. It brings together local hazard information, evacuation guidance, and tools to help households prepare.

## Features

- Interactive map of wildfire hazard zones and selected District 10 neighborhoods.
- An optional home marker on the map, saved locally in the current browser after confirmation.
- Evacuation guidance and links to emergency resources.
- Categorized preparation checklist with account-synced answers, neighborhood participation totals, and saved address support.
- Email/password and Google sign-in using Supabase.
- Responsive pages for desktop and mobile.

## Run locally

The website is static HTML, CSS, and JavaScript. From the repository root, start a local web server:

```powershell
py -m http.server 5500 --directory docs
```

Open [http://localhost:5500/home.html](http://localhost:5500/home.html). Stop the server with `Ctrl+C`.

If the `py` command is unavailable, use `python -m http.server 5500 --directory docs`.

### Authentication setup

Authentication and profile data use the Supabase project configured in `docs/supabase-client.js`. For a different Supabase project, update that file with its project URL and publishable key. Configure the Supabase Auth site URL and allowed redirect URLs for both local development and the deployed site. Enable Google as an auth provider in Supabase if Google sign-in is needed.

Never put a Supabase service-role key in the browser client.

### Profile pictures

The account menu stores uploaded pictures in Supabase Storage and saves their URL in the signed-in user's Auth metadata. Configure a **public** Storage bucket named `avatars` with a 5 MB file limit and PNG, JPEG, and WebP allowed. Avatar images are publicly readable; upload, replace, and delete access is limited to the signed-in user's folder.

Run this once in the Supabase SQL editor to create the bucket and access policies:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

create policy "Avatar images are publicly readable"
on storage.objects for select to public
using (bucket_id = 'avatars');

create policy "Users can upload their own avatars"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can replace their own avatars"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can remove their own avatars"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

### Checklist sync and neighborhood totals

Apply the migrations in `supabase/migrations/` to the configured Supabase project, in filename order, before deploying the checklist changes. You can run them in the Supabase SQL Editor. They add per-account checklist answers, an authenticated function that saves answers for all 25 checklist items and recalculates progress, recalculate existing profile totals against the current checklist, and add a count-only function for neighborhood participation.

Checklist answers sync for signed-in accounts. Neighborhood totals count accounts with at least one completed item; areas with fewer than five participating accounts are omitted. The count function returns only neighborhood names and totals, not profile details.

On the first sign-in after the migration, an existing browser-local checklist is copied into the account. Older progress totals cannot reveal which individual items were checked, so the backfill preserves the old completed-task count when individual answers are unavailable; that first sync must happen on the browser holding the previous checklist.

## Generate or refresh the map

The generated map is `docs/map.html`. To rebuild it from the checked-in GeoJSON data, install the Python packages and run the map script from the repository root:

```powershell
py -m pip install folium requests
py .\map.py
```

To download an updated wildfire hazard-zone snapshot before rebuilding the map:

```powershell
py .\fetch_fire_zones.py
py .\map.py
```

The neighborhood boundaries are read from `docs/neighborhoods.geojson` and `docs/specific_neighborhoods.geojson`.

## Deploy

The project is configured for Vercel with `vercel.json`. The site root is rewritten to `docs/home.html`, and other paths are served from `docs/`. Configure the Supabase redirect URLs for the deployed domain before enabling sign-in there.

## Project layout

- `docs/` — website pages, styles, browser scripts, GeoJSON data, and generated map.
- `map.py` — builds the interactive map.
- `fetch_fire_zones.py` — downloads a wildfire hazard-zone data snapshot.
- `fetch_neighborhoods.py` — loads and filters the checked-in neighborhood GeoJSON.
- `vercel.json` — deployment routing.
