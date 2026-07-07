# UBF Portal — Shipment Detail Route Map (Build Spec)

An eye-catching animated route map on the shipment detail page. Dotted-map style (no Mapbox, no API token, no per-load cost — matches the dashboard). Follows portal-design-system.md.

## Placement
- Shipment detail page, RIGHT column, its own dedicated card (separate from Recent updates). Make it prominent — larger than a thumbnail. It should be a focal element of the page.
- Card title: "Route" (thin, per design system).

## The map
- Base: the same dotted-world map style used on the dashboard Live shipments card (grey dot-matrix continents, `#D5D9E2` dots on white). Reuse that component/renderer — don't build a new base map.
- Plot the shipment's origin and destination ports at their lat/lng (resolve via the ports table — IATA for air, UN for sea).

## Markers & colours
- **Origin = blue** (`#3B5BFE`) marker.
- **Destination = orange** (`#F5843C`) marker.
- Clear, crisp pin/dot markers with a subtle glow — premium, not clip-art.

## The route line
- A **great-circle arc** from origin to destination (curved, not a straight line — looks far better across distance).
- **Animated moving dashed line** flowing origin → destination to show direction (dash offset animation, like the dashboard arcs). Respect `prefers-reduced-motion` (static line if reduced).
- Line colour: a gradient or blend from blue (origin) to orange (destination), or neutral with directional flow. Keep it clean.

## In-transit indicator
- When the shipment is IN TRANSIT, show a moving icon travelling along the arc at the approximate current position:
  - **Sea** → a vessel/ship icon.
  - **Air** → a plane icon.
- Position: estimate progress from ETD→ETA against today's date (e.g. 40% of the way) and place the icon at that fraction along the arc. If dates are missing, place at midpoint.
- When NOT in transit (booked / delivered / at destination), show the arc + markers without the moving vehicle (or a static icon at origin/destination as appropriate).

## Reuse
- The animated globe/arc code from the earlier prototype (great-circle interpolation, dashed-flow animation, marker rendering) can be adapted — but this is a FLAT dotted map, not a 3D globe. Use flat equirectangular projection consistent with the dashboard map.
- Keep it performant: canvas render, requestAnimationFrame, cleanup on unmount, ResizeObserver for width.

## Design non-negotiables
- Per portal-design-system.md: clean, premium, no clutter. The graphics should feel high-quality and intentional — this is the "wow" element of the detail page.
- Blue origin / orange destination is the consistent language (matches dashboard Imports=blue / Exports=orange).
- No Mapbox (cost/token). Dotted map only.

## Data
- Origin/destination lat/lng from ports table (mode-aware: IATA vs UN).
- Mode (sea/air) → vessel vs plane icon.
- Status → in-transit shows moving icon; otherwise static.
- ETD/ETA → progress fraction for the in-transit icon position.
