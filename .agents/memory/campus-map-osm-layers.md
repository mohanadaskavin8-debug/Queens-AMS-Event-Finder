---
name: Campus map OSM clickable layers
description: Non-obvious Mapbox GL + data pitfalls when rendering all Queen's OSM buildings/parks as clickable pinned layers alongside DB event buildings.
---

# Making every OSM campus feature clickable/pinned (Mapbox GL Standard)

Context: the campus map shows ~14 DB "event" buildings (colored fill-extrusion + animated HTML markers) plus ALL Queen's OSM footprints (buildings + parks/fields) as neutral clickable context loaded from a static `public/queens-campus.geojson`.

## Pitfalls learned (not obvious from a code read)

- **Circle/symbol layers on Polygon geometry render one dot/label per vertex, not one per feature.** For a single pin + single label per feature, build a SEPARATE `geojson` Point source from each feature's centroid (the geojson carries `clon`/`clat`) and point the circle/symbol layers at it. Keep the Polygon source only for fills, fill-extrusion, and click hit-testing.
- **`["in", null, ...]` is a runtime RuntimeError in mapbox-gl** (the `in` needle must be string/number/boolean). Many OSM features have `name: null`. Never filter/dedupe on a possibly-null property; filter on a guaranteed-present numeric id (we assign every feature a numeric `fid`), and use `["coalesce", ["get","name"], ""]` for label text.
- **Deduping DB event buildings against their OSM footprint must be by centroid PROXIMITY, not by name.** OSM names differ from the DB names (e.g. ARC = OSM "Queen's Centre", JDUC = OSM "Students' Memorial Union"), so name matching silently misses many. Match each DB building to the closest `kind==="building"` OSM feature within ~50 m and exclude that `fid` from the neutral/pin/label layers.
- **Only dedupe FOOTPRINT-BACKED DB buildings.** Marker-only DB buildings have imprecise seed coordinates and will false-match an innocent neighbor (~30-40 m away), stripping that neighbor's pin/clickability. Footprint-backed buildings match their own OSM footprint at ~0 m, so `if (!b.footprint) continue;` in the dedupe is both safe and correct.
- Put pins/labels in the Standard style **`top` slot** (not `middle`) or 3D buildings occlude them at high pitch.
- Async layer setup (fetch geojson inside a `style.load` handler): guard every post-`await` map mutation — including the `.then(() => map.flyTo(...))` — with `mapRef.current === map` to avoid acting on a removed map after unmount.

## Known DB seed data issue (data, not code)
Some marker-only building seed coordinates are wrong: JDUC sits on Ellis Hall, ARC point is ~700 m from the real Queen's Centre, BioSciences near Humphrey Hall. This causes duplicate/misplaced pins for those specific buildings. Fixing needs correct lat/lng in `lib/db/seed/buildings.sql` + reseed — the proximity dedupe intentionally does not compensate for bad seed data.
