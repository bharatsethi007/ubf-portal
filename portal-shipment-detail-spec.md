# UBF Portal — Shipment Detail Page (Build Spec)

Full-page shipment detail, ShipLink layout (reference: mockup image 15), tabbed, tracking timeline (NO map for v1). Follows portal-design-system.md. Route: `/portal/shipments/:jobNo` (replaces the existing stub). RLS-scoped to the customer's account.

Principle: populate every tab with REAL synced data; where data isn't synced yet, show an honest empty state — never fabricate. Flag each gap.

## Route & data
- Route param: the job number shown in My Shipments. Resolve to the shipment row (confirm whether the stable key is `job_unique` or `job`; use the unique one, display the human one).
- One data hook `usePortalShipment(jobNo)` → the shipment row + its containers (via `consol_key`) + linked invoices (see Invoices tab) + derived timeline + derived tasks. RLS enforces the customer can only open their own jobs; a non-owned job → "not found" (don't leak existence).

## Header
- Breadcrumb: Home / Shipments / Shipment detail.
- Title = shipper (imports) / consignee (exports) or job description; job no; mode; weight; direction (Import/Export). Status pill (design-system colours). Placed/created date.
- Keep restrained, per design system — no emoji, no coloured borders.

## Tabs (full set)
Summary · Task · Track & trace · Invoices · Cargo & containers · Documents · Additional services

### 1. Summary  (real data — strong)
Left column:
- **Shipment overview**: Origin → Destination (port names + flags, correct source per mode — IATA for air, UN for sea), transit time (etd→eta or departed→arrived).
- **Route plan**: origin → origin port → dest port → final destination (chain, from `port_origin`, `port_dest`, `final_dest`).
- **Booking details** grid: Job no, Mode, Type (Import/Export), Freight type (LCL/FCL from `load_type`), House bill, Master bill (`master_bill`), Load (pcs/weight/CBM), Reference (`customer_ref`).
- **Carrier**: vessel/flight (`vessel_flight`), container number(s) for sea (via `containers`).
- **Party**: shipper (imports) / consignee (exports).
Right column:
- **Recent updates**: the derived timeline (see Track & trace) in compact form.

### 2. Task  (derived — no task engine)
- Derive action items from the same heuristics as the dashboard Needs-attention: overdue ETA, arriving ≤3 days, documents missing (once documents exist), detention risk. Render as a simple checklist with severity dots.
- Empty state: "No outstanding tasks."
- Do NOT build a task/assignment system. Derived only.

### 3. Track & trace  (DERIVED timeline — flag it)
- No `tracking_events` table exists yet, and no PortConnect feed. Build a DERIVED milestone timeline from the dates we have:
  Booked (`doc_date`/created) → Departed origin (`departed`/`etd`) → In transit → Arrived destination (`arrived`/`eta`) → Delivered.
- Mark each step done/pending from available dates; show the date where known, "estimated" where only ETD/ETA. Current status highlighted.
- Header note that live milestone tracking (PortConnect, vessel position) is coming — this is a derived view for now.
- Structure the timeline component so it can later be swapped to read real `tracking_events` without a UI rewrite.

### 4. Invoices  (CHECK LINK FIRST)
- Show invoices for THIS shipment. **Confirm before building**: do synced `invoices` carry a job/shipment reference (job no / job_unique / shipment_no) to link per-shipment? 
  - If yes → list invoices for this job (no, date, amount, balance, status), RLS-scoped.
  - If NO job link exists on invoices → report it. Interim: show a link to the account Billing tab instead of faking a per-shipment list. Do not guess a join.

### 5. Cargo & containers  (real data)
- Cargo lines: goods (`goods`/`goods1`/`goods2`), pack qty, pack type, weight, CBM, marks.
- Containers: number, size (`container_size`), seal, avail dates — from `containers` via `consol_key` (dedup). Consol-grain caveat (may over-show on shared/LCL consols; per-job needs FIS_JOBCONT sync — separate task). Air: no containers.

### 6. Documents  (EMPTY for now — flag)
- No shipment documents are synced to the portal yet. Show an honest empty state: "No documents available for this shipment." 
- Do NOT wire to anything or fake documents. Note as a future module (would need a documents source + storage, similar to SLI documents).

### 7. Additional services  (EMPTY for now — flag)
- Nothing synced. Honest empty state or hide the tab until there's a source. Note as future.

## Data checks to report BEFORE building
1. Stable route key: `job_unique` vs `job`.
2. Invoices → job link: does a job/shipment reference exist on synced `invoices`? (decides the Invoices tab)
3. Confirm the derived-timeline approach is acceptable until `tracking_events` exists.

## Build order
1. Route + `usePortalShipment` hook + header.
2. Summary tab (strongest data).
3. Cargo & containers tab.
4. Track & trace derived timeline (built to swap to real events later).
5. Task (derived) + Invoices (per link check) tabs.
6. Documents + Additional services honest empty states.

## Non-negotiables
- Per portal-design-system.md: General Sans, restrained weights, no emoji, no coloured borders, soft pills, thin dividers.
- RLS: customer can only open their own jobs.
- Never fabricate data for empty tabs. Empty state over fake content.
