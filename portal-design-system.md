# UBF Customer Portal — Design System (LOCKED)

Single source of truth for all `/portal` frontend work. Cursor: read this every portal session. Do not deviate without Bharat's sign-off. Consistency over cleverness.

Reference: the ShipLink mockups. Principle: calm, restrained, minimal. Lots of white. Remove decoration. Less is the point. No emoji. No coloured card borders. No incidental bold.

## Colour tokens
```
--bg:#F4F5F7        page background
--card:#FFFFFF      card surface
--ink:#171A21       headings / primary numbers
--ink2:#3C414D      body text
--muted:#8A90A0     labels, secondary, nav inactive
--faint:#B7BCC8     disabled / empty-state text
--line:#ECEEF2      dividers, card borders (thin, 1px)
--line2:#E4E7EC     slightly stronger divider
--blue:#3B5BFE      primary action, imports, links, active
--blue-soft:#EBEFFF in-transit pill bg
--dark:#12141C      active dark tab (My Shipments)
--green:#2FBF71 /bg#E4F7EC   positive delta, delivered
--amber:#F0B429 /bg#FDF3D7   picked up / medium severity
--orange:#F5843C /bg#FCEADD  exports, departure, at-destination
--red:#F0553D                high-severity dot only (NEVER a border/fill)
--grey:#6B7280 /bg#EFF0F3    at-origin pill
```
Imports = blue. Exports = orange. Always.

## Typography
- Font: **General Sans** (self-hosted, weights 400/500/600/700). Fallback Inter. Verify it loads.
- Weights: card titles + big KPI numbers = **600**. Everything else **400**, with **500** only for genuine emphasis. No other bold.
- Colours: headings `--ink`, body `--ink2`, labels `--muted`.
- All numbers: `font-variant-numeric: tabular-nums`.

## Icons
- **lucide-react only.** Never emoji. Never scraped/branded logos.
- Size 14–16px, `--muted` default; active state inherits `--ink`.
- Nav: Dashboard=LayoutGrid, Shipments=Ship, Quotes=FileText, Track shipment=MapPin, Billing=Receipt.
- Mode: Air=Plane, Sea=Ship, Land=Truck. Payments=CreditCard.
- Carrier logos: NOT used (licensing). Monochrome glyph chip only.

## Cards
- White, radius 18px, border 1px `--line`, shadow `0 1px 2px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.05)`.
- Padding 24px. Generous whitespace. Dividers are 1px `--line` only — no heavy rules, no coloured borders.
- Section title = 600 `--ink`, optional single thin muted lucide icon before it.

## Components (canonical)
- **KPI stat**: label (`--muted` 12px) → subtle area sparkline (thin 1.5px line + low-opacity gradient fill, muted blue-grey, barely registers) → big number (600) + delta inline. Delta 12px, green ↑ / grey ↓. Never loud red.
- **Status pill**: soft pastel fill per status colour, regular-weight text, radius 20px, 12px. Map: At Origin=grey, In Transit=blue-soft, Picked up=amber, Departure/At Destination=orange, Delivered=green.
- **Nav**: text + lucide icon; active = `--ink` text + dark underline (`--dark`, 2.5px). Inactive `--muted`.
- **Range tabs**: segmented, active = grey pill (`--grey`bg tint) `--ink` text.
- **Attention row**: plain row, white bg, thin `--line` divider between rows, one 6px dot (red high / amber med) before reason text. NO box, NO border, NO fill.
- **Table**: uppercase 11px `--muted` headers; rows divided by 1px `--line`; job no. is `--blue` hyperlink; dates only (no ETD/ETA labels); flags via flag-icons.

## Layout
- Full-bleed width, even gutters, no wide left/right page margins.
- Dashboard grid: left = KPIs + My Shipments table; right column = Live shipments map (flat dotted world) + Needs attention.
- Map: flat equirectangular dotted world, `#D5D9E2` dots on white, lucide MapPin markers (blue import / orange export), thin dashed lanes, static.

## Data rules
- All queries RLS-scoped to `portal_users.account_id`.
- KPI counts at **JOB grain** (house/HAWB), never consol. Don't double-count off `v_consols`.
- Never fabricate a metric. If a source column is missing, STOP and list it — don't fake or approximate.

## Behaviour
- No animation unless specified. No hover gimmicks. Restraint.
- Reduced-motion respected anywhere motion exists.
- Empty states: plain `--faint` centred text ("No shipments in this view."). No illustrations.

## Change control
Any new portal screen/component conforms to the above. Propose additions to this file in the same PR; Bharat signs off; then it's canon.
