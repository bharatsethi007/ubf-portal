# UBF Portal — Customer Login Screen (Build Spec)

Split-screen login for the customer portal. First thing a customer sees — must match the ShipLink-quality portal behind it. Follows portal-design-system.md.

Route: the portal login (where portal users land when unauthenticated). Public.

## Layout — split screen
Two panels, 50/50 on desktop; stacks to single column (form only) on mobile.

### Left panel — the form (white)
- Background: white / `#FFFFFF`.
- Centred, max-width ~380px form block, generous vertical centring.
- Top: UBF logo mark + "UB Freight" wordmark (the same circular blue mark used in the portal nav — reuse the component, don't recreate).
- Heading (General Sans 600, ~24px, `#171A21`): "Welcome back" or "Sign in to your portal".
- Subtext (`#8A90A0`, 14px): "Track your shipments, bookings and invoices in one place."
- Fields (design-system inputs — thin `#ECEEF2` border, 10px radius, General Sans):
  - Email
  - Password (with show/hide toggle)
- Primary button: full-width, blue `#3B5BFE`, 600, "Sign in".
- Below: "Forgot password?" link (`#3B5BFE`) — routes to a reset request (can stub for now if reset flow isn't built; note it).
- Error state: inline, `#F0553D`, generic ("Incorrect email or password") — never reveal which field is wrong.
- Footer line (`#B7BCC8`, 12px): "Need access? Contact your UB Freight representative." (Customers can't self-register — access is staff-activated.)

### Right panel — the visual
- Full-height panel, deep navy gradient (`#0A2472` → darker), OR a freight/port image with a navy overlay for legibility. Prefer the gradient + a subtle version of the portal's dotted-world map motif so it ties to the dashboard — NO emoji, no stock-photo clutter.
- Overlaid content (white text, restrained):
  - Small tagline (General Sans 600, ~28px): e.g. "Your cargo, in real time."
  - One-line supporting text (muted white): "Live tracking across NZ, Australia and the Pacific."
  - Optional: 2–3 tiny stat/feature chips (e.g. "Live shipment tracking", "Invoices & payments", "Book air & sea") — thin, understated, not marketing-loud.
- Hidden on mobile (form takes full width).

## Behaviour
- On submit: `supabase.auth.signInWithPassword`. Success → `/portal`. Failure → generic inline error.
- If already authenticated → redirect to `/portal`.
- Respect the gate: after login, existing PortalAuthGate logic runs (status active check etc.).
- No "Sign up" / "Create account" anywhere — access is staff-activated only.

## Design non-negotiables (per portal-design-system.md)
- General Sans, restrained weights (600 only for heading/button/wordmark).
- Blue `#3B5BFE` primary, navy for the visual panel.
- No emoji. No coloured borders on the form card. Thin dividers only.
- Calm, premium, lots of white on the form side. The visual side carries the brand.
- Fully responsive: split on desktop (≥1024px), single-column form on mobile/tablet.

## Build notes
- Reuse the logo mark and design tokens from the portal — don't duplicate.
- If a password-reset flow doesn't exist yet, make "Forgot password?" a stub that shows "Contact UB Freight to reset your password" for now, and note it as a future build (it would reuse the same token pattern as activation).
