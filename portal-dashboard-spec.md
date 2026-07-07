# UBF Customer Portal — Dashboard Build Spec

Reference: the 15 ShipLink screenshots (attach them in Cursor). Match colours, fonts, spacing, component style exactly.

## Route & shell
- Namespace `/portal/*`, separate layout from staff app, role-gated.
- Data scoped by RLS to the customer's `account_id` (reuse `portal_account_ids()`).
- Reuse `v_consols`, `invoices`, `tracking_events`.

## Design tokens (add to portal theme)
```
--bg:#F4F5F7  --card:#FFFFFF  --ink:#171A21  --ink2:#3C414D  --muted:#8A90A0  --faint:#B7BCC8
--line:#ECEEF2  --line2:#E4E7EC
--blue:#3B5BFE  --blue-dark:#2E49E0  --blue-soft:#EBEFFF  --dark:#12141C
--green:#2FBF71 /bg#E4F7EC   --amber:#F0B429 /bg#FDF3D7   --orange:#F5843C /bg#FCEADD
--red:#F0553D   --grey:#6B7280 /bg#EFF0F3
card radius 18px, shadow: 0 1px 2px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.05)
```
- Font: General Sans (self-host in repo). Fallback Inter. Tabular figures for all numbers.
- If the actual ShipLink font differs, confirm the name and swap.

## Layout (top → bottom)
1. **Top nav** (white, 62px, sticky): circular ShipLink-style logo mark + "UB Freight" · tabs [Dashboard, Shipments, Quotes, Track shipment, Billing] with dark underline on active · right: search / refresh / bell icons, "Customer portal ▾" + avatar. Blue "Create New | ▾" button lives in the title row.
2. **Title row**: "Dashboard overview" + last-updated subtitle · range segmented control [Last year, Last month, This week, Today, Custom] (active = grey pill) · blue "Create New" button.
3. **KPI row** (3 cards): (a) Shipment overview — Booked / In Transit / Departing / Arriving, each with a mini sparkline + green/red delta %. (b) Containers — big number + Active/Completed split. (c) Pending payments — $ + "N invoices left ›".
4. **Row: Live shipments (left ~2/3) + Needs attention (right ~1/3)**.
   - Live shipments = the animated dotted globe (KEEP — Bharat approved it). Canvas, orthographic, blue import arcs / orange export arcs, pulsing port bubbles sized by volume, hover tooltip. Legend Imports(blue)/Exports(orange). Reuse the globe code I wrote (offline HTML) — port it to a React canvas component.
   - Needs attention = exception cards, red border/bg for high severity, mode icon, lane, reason, ETA.
5. **Row: My Shipments table (left) + Schedule calendar (right)**.
   - Table: dark active tab [All / In Transit / Arriving / Departing]; columns Name+#tracking(blue), From(flag+port+ETD), To, Cargo, Mode(carrier chip+icon), Status pill. Status colours per tokens.
   - Calendar: week/month toggle (active = blue), arrivals(blue ↓) / departures(orange ↑) chips per day, keyed off ETA/ETD.

## Components to build (≤300 lines each, split at 200)
`PortalNav`, `RangeTabs`, `KpiOverview` (+`Sparkline`), `KpiStat`, `LiveGlobe` (canvas), `AttentionList`, `ShipmentsTable` (+`StatusPill`, `CarrierChip`), `ScheduleCalendar`.

## Globe component notes
- Port the hand-rolled projection from the offline HTML (no d3 needed): `vec()`, `project()`, `slerp()`, dotted sphere, graticule, flowing dashed arcs, pulsing bubbles, hover hit-test. Wrap in `useEffect` + `requestAnimationFrame`, `ResizeObserver` for width, cleanup on unmount. Respect `prefers-reduced-motion`.
- Real data: aggregate open shipments by origin/destination port → bubble volume + import/export split. Arcs = top lanes.

## Data wiring
- KPIs, shipments, attention, calendar all from RLS-scoped queries on the customer's `account_id`.
- Attention = shipments with exception flags / customs hold / rolled / detention risk.
- Do NOT ship mock data past first render; wire real queries.

## Out of scope this pass (stub nav only)
Bookings wizard (7-step, air/sea — 15 screens mapped separately), Quotes ("coming soon"), Invoices tab, shipment detail full page. Build after dashboard is approved.
