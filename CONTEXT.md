# UB Freight — Internal Dashboard (build context)

This is the **internal staff dashboard** for UB Freight: staff track all shipments.
It reads from the same Supabase project as the customer portal but staff see ALL data.

## Stack
React + Vite + TypeScript, Supabase JS, react-router-dom, lucide-react (icons).
Plain CSS with design tokens (no Tailwind). Keep components under ~300 lines.
Supabase client already in `src/supabase.ts`. Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Supabase tables (read-only for this app)
- **shipments** (one row per house bill, the unit a customer/staff tracks)
  `job_unique` (PK, int) · `module` (FIA/FIS/FEA/FES) · `mode` (air|sea) ·
  `direction` (import|export) · `customer_account_id` (FK customers) ·
  `house_bill` · `job_no` · `shipment_no` (consol no) · `origin` · `destination`
  (these are UN/port codes e.g. CNNGB, AUSYD, GBBRS) · `vessel_flight` ·
  `etd` `eta` `departed` `arrived` `doc_date` (dates) · `status` · `modified_src`.
- **customers** `account_id` (PK) · `name` · `branch` · `is_importer` · `is_exporter`.
- **contacts** `account_id` · `first_name` · `last_name` · `email` · `is_prime`.
- **staff_users** `user_id` — presence means the logged-in user is staff (sees all).
- **portal_users** `user_id` → `account_id` (customer logins; ignore in this app).

For this app, the logged-in user is staff, so `supabase.from('shipments').select(...)`
returns ALL shipments (RLS allows it). Join customers for the client name.

## Status values (derived; only these occur)
`Booked` · `Scheduled` (future ETD) · `In transit` · `Arrived (est.)` · `Arrived`.
Pill colors: Booked=slate, Scheduled=blue, In transit=amber, Arrived*=green.

## Dashboard stat-card definitions (compute via Supabase count queries)
- Total Shipments: all rows.
- Not Yet Departed: status in (Booked, Scheduled).
- In Transit: status = 'In transit'.
- Arriving in 7 Days: eta between today and today+7 and status not like 'Arrived%'.
- Watchlist: count of the user's starred shipments (needs a `watchlist` table — not built yet; show 0 for now).

## Data we DON'T have yet (render these as empty states, label "No data yet")
- Tracking-history events, masterbill, full housebill line items, documents,
  consol-level grouping detail, geographic map coordinates.
Derive the Shipment-detail progress bar/timeline from the dates we DO have
(doc_date → etd/departed → eta → arrived) plus `status`.

## Build as later-phase stubs ("Coming soon" pages, styled but not wired)
New Booking, Estimates & Quotes, Invoices, Schedules, Reports, Users.
These are write-back/transactional and need a backend we haven't built.

## Design tokens (from the UB Freight brand + the mockups)
- Sidebar / ink: `#0E1B2D` (deep navy). Text on navy: `#FFFFFF`.
- Accent (logo orange, "New Booking" button): `#F5A623`.
- Page bg: `#F4F6FA`. Cards: `#FFFFFF`. Border: `#E4E9F0`. Muted text: `#6B7C93`.
- Action blue: `#1763E6`. Status: slate `#64748B`, blue `#1763E6`, amber `#D97706`, green `#0E9F6E`.
- Display font: 'Space Grotesk'. Body: 'Inter'. Data (bills/ports/dates): 'IBM Plex Mono'.
- Layout: fixed left sidebar ~230px, top bar with quick search + user menu, content max-width ~1200px.

## Screens (match the provided screenshots)
1. App shell: navy sidebar (logo, orange New Booking button, nav: Dashboard, Estimates & Quotes,
   Shipments, Invoices, Schedules, Reports, Users), top bar (quick search, user menu). react-router routes.
2. Dashboard: 5 stat cards, left filter panel (Mode, Status, Origin country, Departure/Arrival
   date ranges, Shipper, Client), shipments table (Shipment#, Tradelane, Status pill, Shipper,
   Client, Origin, Destination, ETD, ETA, Vessel/AWB, watchlist star). Map = placeholder.
3. Shipment detail: progress bar, Shipment Details, Tracking History (derived), Voyage Details,
   Housebill Lines (empty state), Summary, Documents (empty state).

   ## ports table (reference, public read)
code (PK, matches shipments.origin/destination) · name · lat · lng · kind (air|sea).
Join shipments.origin/destination -> ports.code to get coordinates. ~99.6% of shipments resolve.
