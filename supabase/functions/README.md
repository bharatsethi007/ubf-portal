# Edge functions

Synced with the live Supabase project (`cpnkudbdzgnzmodhsrbf`) on 6 Oct 2026.
Every deployed function now has its source here, in one layout:

```
supabase/functions/<slug>/index.ts      entry
supabase/functions/<slug>/*.ts          function-local files
supabase/functions/_shared/*.ts         shared helpers (one version for everyone)
supabase/config.toml                    verify_jwt per function (must match production)
```

## Rules

- **Deploy from this folder only.** Entry is `<slug>/index.ts`, include every file it imports (relative imports resolve inside this tree).
- **Keep `verify_jwt` as listed in `supabase/config.toml`.** `false` means the function does its own auth.
- **Outbound HTTP uses `apiFetch`** from `_shared/apiFetch.ts`, never bare `fetch`, so calls show on Setup › System health. Unknown hosts (our own Supabase) pass straight through unlogged.
- `navman-refresh`, `dispatch-route`, `navman-probe` need their `deno.json` as the import map.

## What changed in the sync

- 31 functions that only existed live were added (courier, cartage, AI parsers, CSAT, quote/booking extract, Navman, etc.).
- Live code won where it was newer than git (e.g. `share-track`, `marketing-brevo-sync` shipment attributes, `sli-create`, `whatsapp-webhook`).
- Git won where live was only a stripped copy (comments and types removed) of the same logic: `sli-*`, `staff-*`, `create-staff-user`, `rate-card-parse-cartage`, `seavantage-refresh/index.ts`.
- Shared files merged to one superset version: `_shared/portalCommon.ts`, `carrier-refresh/maerskClient.ts`.

## Known differences from live (git is ahead)

- `seavantage-refresh`: git uses the shared `seavantageRefreshRun.ts` with the Maersk fallback (same as `import-sea-tracking-auto` and `carrier-refresh`). The live `seavantage-refresh` button still runs the older copy without it until redeployed.
- `consol-track`: live bundle uses older shared SeaVantage files; redeploying from git upgrades it to the shared versions. Not yet redeployed.

- `portconnect-webhook/*` and `_shared/portconnectBookingAutomation.ts`: git has PortConnect task automation (Jul 24) that was never deployed. Webhook subscriptions are off, so nothing runs it.
- `_shared/portconnectRefreshRun.ts`: live version adopted. The Jul 24 automation variant is in git history (commit `248af05`).
