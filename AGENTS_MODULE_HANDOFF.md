# UBF Agents Module — Handoff

_Last updated: 20 Aug 2026. Design LOCKED. Step 1 (schema + sync) issued._

Overseas-partner (freehand agent) CRM, decoupled from customers. Mirrors the Rates
build pattern: schema-first, gated steps, Cursor commands + whole-file Copy-Item,
push before Claude builds on top.

---

## Purpose

Identify UBF's **overseas agents** (freehand partners) separately from customers, and:

1. Flag them out of the customer board (they're partners, not clients).
2. Track **freight-network** membership (WWPC / WFN / Lognet / NAP / Freight Midpoint / X2 / 4Next).
3. Measure **freehand reciprocity** — how much EXW/FOB business each origin agent sends us
   vs how much we give them.
4. Log **conferences** — which agents/prospect-agents we met, where, which year, which network;
   notes, follow-up, business cards.
5. Maintain **trusted agents** (approved by Rohit) that sales support can assign shipments to.
6. Know **which agent to use in which country / tradelane**.

---

## Menu placement (deliberately minimal — do NOT sprawl)

- **ONE new top-level sidebar hub: "Agents"**, with **two tabs**:
  - **Directory** — agent list; row → agent record holding networks, country, tradelanes,
    trusted status, contacts, business cards.
  - **Conferences** — log conference (name / year / place / network) + agents & prospects met,
    notes, follow-up, business-card attachments. A prospect here is a lead; it "promotes" to
    an active agent once contacted/onboarded.
- **Reports → new "Agents" tab** — freehand EXW/FOB reciprocity analytics (given vs received),
  cut by agent / network / country. Reuses `reporting.mv_job_financials` + lanes + incoterm.
- **Booking record → "Assign agent" action** — picker shows ONLY Rohit-approved **trusted**
  agents, pre-filtered to the shipment's country/lane. (Rohit's approval is a status flip on the
  agent record in the hub — set in one place, consumed here.)

No separate "routing" menu — the tradelane data lives on the agent record and surfaces in the
booking picker where it's used.

---

## Model decisions (LOCKED with Bharat)

- **Standalone `agents` table**, NOT a `customers.is_agent` flag. Reason: conference **prospects**
  have no ERP account code yet and must exist as agent cards before any shipment/customer row does.
- **Two sources** on one table:
  - `source='erp'` — synced from `ACC_CLIENTS` where `OS_AGENT='Y'`, carrying `erp_account_code`.
  - `source='prospect'` — hand-created conference cards, `erp_account_code = NULL`. When later set
    up in ERP + flagged OS Agent, the sync binds it by code and it becomes a live agent. No re-entry.
- **`erp_account_code` is nullable** and `= ACC_CLIENTS.ACCOUNTID = customers.account_id`.
- **Networks are PORTAL-OWNED**, many-to-many (`freight_networks` + `agent_networks` junction).
  Do NOT pull from ERP `CARGO_NETWORK` — it's null anyway. Same agent can hold multiple networks.
- **Trusted status is PORTAL-OWNED** (Rohit approves via `trusted` + `approved_by`/`approved_at`).
  This is NOT ERP's `TRUSTED_TRADER_FLAG` — that's a customs Trusted Trader flag, a different concept.
- **DUAL-FLAG RULE**: `OS_AGENT` wins absolutely. An account flagged OS Agent that is ALSO a Debtor
  (e.g. THIGR) leaves the customer board **entirely** — because that debtor balance IS agent freehand
  business (we invoice them for freehand they send us). They are agent-only on the board.
  - BUT the base `customers` table KEEPS them, so `bookings.os_agent_account_id` FK + AR still resolve.
  - The exclusion is a **view-level filter** on `v_customer_stats`, not a delete.

---

## ⚠️ ERP agent definition — CORRECTED 20 Aug 2026 (OS_AGENT is JUNK)

**Do NOT use `OS_AGENT`.** First sync used `OS_AGENT='Y'` and pulled **17,828** rows
(~half of all 39,876 accounts — the flag is default-on and never unticked; `AGENT`,
`CUST_AGENT`, `SHIPPING_L` are all similarly ~17,900 = all noise). `FORWARDER='Y'`
(496) is also wrong — mixes manufacturers/NZ businesses in AND misses real agents
(THIGR is `FORWARDER='N'`).

**The REAL signal is `SALESAREA`.** Ops tag overseas agents there, by network name or a
plain `AGENT` bucket. Grounded counts:

| SALESAREA (upper) | count | -> network |
|---|---|---|
| AGENT | 49 | (none — assign in portal) |
| LOGNET | 36 | LOGNET |
| WCA | 29 | WCA (**8th network, added** — WCA World) |
| WFN | 2 | WFN |
| NAP | 2 | NAP |
| **total agents** | **~118** | |

Everything else in SALESAREA is a sales REP (VINEET 318, JAY 236, SUE, BLAIR, JOHN...)
or junk (INACTIVE, S/L, ADA/LJ) — excluded by the tag whitelist. THIGR = `SALESAREA='AGENT'`.
Agent-sample eyeballed & confirmed: FLYING FISH TOKYO, HAWK FREIGHT FZE, RHENUS, OECL
SHIPPING, ACROSS LOGISTICS, AERO LINES GMBH — all genuine overseas forwarders.

**Bonus:** SALESAREA carries the network, so the sync AUTO-SEEDS `agent_networks` from the
tag (LOGNET/WCA/WFN/NAP + any of the 7). Plain `AGENT` rows get no network -> assign by hand.

The `agents` sync now filters `WHERE UPPER(TRIM(SALESAREA)) IN
('AGENT','LOGNET','WCA','WFN','NAP','WWPC','MIDPOINT','X2','4NEXT')`.

---

## ERP contract (original probe, 20 Aug 2026 — flag basis superseded above)

Source table: **`ACC_CLIENTS`** (account master, keyed by `ACCOUNTID`).

| Portal column        | ERP source                              | Notes |
|----------------------|-----------------------------------------|-------|
| `erp_account_code`   | `TRIM(ACCOUNTID)`                        | e.g. `THIGR`; = `customers.account_id` |
| (agent filter)       | `UPPER(TRIM(SALESAREA)) IN (tag set)`    | SALESAREA tags, NOT OS_AGENT (which is junk — see corrected section above) |
| `name`               | `COALESCE(ACCOUNT_NAME, NAME1)`         | `NAME1='T.H.I GROUP LTD'` |
| `country`            | `BUSINESS_COUNTRY`                       | **often NULL** on ACC_CLIENTS — real country lives in `ADDRESS.COUNTRY` (later enrichment). Nullable; correct by hand in Directory or via tradelanes. |
| `source`             | literal `'erp'`                          | |

**Do NOT use:** `CARGO_NETWORK` (null — networks are portal-owned), `TRUSTED_TRADER_FLAG`
(customs concept, not our trusted-agent), `OS_AGENT_CODE` (separate field, null for THIGR — ignore
for now). `SALESAREA='AGENT'` on these rows is why agents showed up as junk in the sales-rep filter
(note: filter list) — moving them off the customer board cleans that up.

The sync reads **only** the ERP-owned columns above; portal-owned columns (`trusted`, `approved_by`,
`status`, `agent_networks`) are NEVER sent, so nightly re-runs never clobber Rohit's approvals or
network assignments.

---

## Progress

### Step 1 — schema + sync — ISSUED 20 Aug 2026 (awaiting apply/test)

**Migration** `supabase/migration/20260820_agents_module_schema.sql`:
- `agents` — `id uuid pk`, `erp_account_code text unique` (nullable), `name`, `country` (nullable),
  `source ('erp'|'prospect')`, `status ('active'|'prospect'|'inactive')`, `trusted bool`,
  `approved_by`, `approved_at`, `notes`, timestamps. RLS staff-only via `is_staff()`.
- `freight_networks` — `code` unique, `name`, `sort_order`, `active`. Seeded 7:
  WWPC, WFN, LOGNET, NAP, MIDPOINT (Freight Midpoint), X2, 4NEXT, **WCA** (8th, added 20 Aug after SALESAREA probe showed 29 WCA agents).
- `agent_networks` — junction (`agent_id`, `network_id`), PK both, cascade delete.
- **`v_customer_stats` rebuilt** with `LEFT JOIN agents a ON a.erp_account_code=c.account_id`
  + `WHERE a.erp_account_code IS NULL` — this is the OS-agent exclusion from the customer board.
- `notify pgrst` at end.

**Sync** — new `sync_agents(cur)` function in `sync_to_supabase.py`, called in `main()` right after
`sync_references(cur)`. Dedicated pull (`WHERE OS_AGENT='Y'` across all ACC_CLIENTS — NOT scoped to
the shipment-party loop, because an overseas agent usually isn't the billing party on a job).
Upserts `agents` on `erp_account_code`, sending only the 4 ERP columns. Selects `CLOSED` too (not yet
mapped — reserved so a later step can auto-set `status='inactive'` for closed ERP agents without a
new probe).

**Gate:** `networks_seeded=7`, `agents_rows=0` pre-sync; after sync `thigr_is_agent=true` and
`thigr_on_board=false`.

### Next steps (in order)

2. **Directory list** — agents board (list → record), filter by network/country/status/trusted.
   List pattern like CustomersPage: `supabase.from('agents')`, PAGE_SIZE, debounced search, TanStack.
   Record shows editable name/country/status, network chip multi-select (reuse `MultiChipSelect`),
   trusted toggle + approver, contacts.
3. **Conferences** — `conferences` + `conference_attendees` schema (name/year/place/network; met agents
   & prospects, notes, follow-up state, business-card attachments). Prospect → agent promotion.
4. **Booking Assign-agent picker** — trusted-only, country/lane pre-filtered. THEN re-point
   `bookings.os_agent_account_id` from `customers` to `agents` (Bharat's call — deferred until the
   module exists; leave the existing FK as-is until then).
5. **Reports → Agents tab** — freehand EXW/FOB reciprocity (given vs received) by agent/network/country.
6. Deferred to their own steps: **tradelanes** schema (which agent per country/lane), **business cards**
   storage, conference business-card attachments.

---

## Patterns / gotchas (reuse)

- Repo migrations folder is **`supabase/migration`** (singular).
- Customer board reads the **`v_customer_stats` VIEW**, not `customers` directly (`CustomersPage.tsx`).
  Column is `account_id`. The agents exclusion is baked into the view — no frontend change needed to hide them.
- `bookings.os_agent_account_id text` FK → `customers(account_id)` already exists (added 15 Aug, manual
  agent link, "wire from ERP job party later"). LEAVE AS-IS; re-point to `agents` in Step 4.
- RLS staff pattern: `for all using (public.is_staff()) with check (public.is_staff())`.
- Sync helpers available in `sync_to_supabase.py`: `connect()` (DSN = `host:path`), `table_cols()`,
  `clean()`, `upsert(table, rows, on_conflict)` (chunked, merge-duplicates, de-dups on key).
- `probe_agent.py` (in `C:\Users\BharatS\Documents\Customer Portal`) is the throwaway that grounded
  the ERP contract — reuse/extend it for any further ACC_CLIENTS field questions.
- Country from ERP is unreliable (`BUSINESS_COUNTRY` null); the authoritative country is in the
  `ADDRESS` table (`ADDRESS.COUNTRY`, keyed by ACCOUNTID). Wire as enrichment later if needed; for now
  country is nullable and curated in-portal / via tradelanes.

---

## Working agreement

- Claude gives exact copy-paste Cursor commands / whole-file Copy-Item; Bharat builds & pushes.
- Gated steps with a test gate between each; push to GitHub before Claude builds on top (Claude
  re-clones + reads live DB to ground each step).
- FDB reads route through Bharat running a script in `C:\Users\BharatS\Documents\Customer Portal`
  (Claude has no network line to UBNZ.FDB).
