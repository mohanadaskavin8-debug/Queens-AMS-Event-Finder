import { useEffect, useRef, useCallback, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Feature, FeatureCollection } from "geojson";
import type { FilterSpecification } from "mapbox-gl";
import type { Building } from "@workspace/api-client-react";

export type MapTheme = "day" | "night";

interface CampusMapProps {
  buildings: Building[];
  selectedBuildingId: number | null;
  onSelectBuilding: (id: number | null) => void;
  theme: MapTheme;
  /** Categories currently visible on the map. */
  visibleCategories: Set<string>;
  /** Increment to trigger a fly-to-overview action. */
  recenterSignal?: number;
  /** Increment to toggle the map tilt (pitch). */
  pitchSignal?: number;
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

const STANDARD_STYLE = "mapbox://styles/mapbox/standard";
const LIGHT_PRESET: Record<MapTheme, string> = { day: "day", night: "night" };

const CAMPUS_CENTER: [number, number] = [-76.4952, 44.2256];
const OVERVIEW = { center: CAMPUS_CENTER, zoom: 15.4, pitch: 55, bearing: -18 };

const STATUS_COLOR: Record<string, string> = {
  active: "#16a34a",
  upcoming_today: "#F9A01B",
  upcoming_week: "#3b82f6",
  none: "#64748b",
};

interface CampusFeatureProps {
  fid: number;
  clon: number;
  clat: number;
  kind: string;
  name: string | null;
  leisure: string | null;
}

type CampusCentroid = { fid: number; clon: number; clat: number; kind: string };

// Campus features that coincide with a DB event building (matched by proximity of
// centroids). Those buildings render colored extrusions + animated HTML markers, so
// we exclude their footprint/pin from the generic campus layers to avoid duplicates.
function computeDbFids(buildings: Building[], features: CampusCentroid[]): number[] {
  const R = 6371000;
  const toRad = Math.PI / 180;
  const MAX = 50; // metres
  const fids: number[] = [];
  for (const b of buildings) {
    // Only footprint-backed buildings dedupe cleanly (they match their own OSM
    // footprint at ~0 m). Marker-only buildings can have imprecise seed
    // coordinates that would wrongly suppress an innocent neighbour.
    if (!b.footprint || b.footprint.length < 4) continue;
    let best = -1;
    let bestD = MAX;
    for (const f of features) {
      if (f.kind !== "building") continue;
      const dLat = (b.latitude - f.clat) * toRad;
      const dLng = (b.longitude - f.clon) * toRad;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(f.clat * toRad) * Math.cos(b.latitude * toRad) * Math.sin(dLng / 2) ** 2;
      const d = 2 * R * Math.asin(Math.sqrt(a));
      if (d < bestD) {
        bestD = d;
        best = f.fid;
      }
    }
    if (best >= 0) fids.push(best);
  }
  return fids;
}

function buildingsToFeatureCollection(
  buildings: Building[],
  visible: Set<string>
): FeatureCollection {
  const features: Feature[] = [];
  for (const b of buildings) {
    if (!visible.has(b.category)) continue;
    if (!b.footprint || b.footprint.length < 4) continue;
    features.push({
      type: "Feature",
      id: b.id,
      properties: {
        id: b.id,
        name: b.name,
        status: b.eventStatus,
        height: Math.max(b.levels * 4.2, 10),
      },
      geometry: { type: "Polygon", coordinates: [b.footprint as number[][]] },
    });
  }
  return { type: "FeatureCollection", features };
}

export function CampusMap({
  buildings,
  selectedBuildingId,
  onSelectBuilding,
  theme,
  visibleCategories,
  recenterSignal = 0,
  pitchSignal = 0,
}: CampusMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
  const buildingsRef = useRef<Building[]>(buildings);
  const visibleRef = useRef<Set<string>>(visibleCategories);
  const selectedRef = useRef<number | null>(selectedBuildingId);
  const onSelectRef = useRef(onSelectBuilding);
  const styleReadyRef = useRef(false);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const campusFeaturesRef = useRef<CampusCentroid[]>([]);
  const [initError, setInitError] = useState<null | "token" | "webgl">(null);

  buildingsRef.current = buildings;
  visibleRef.current = visibleCategories;
  selectedRef.current = selectedBuildingId;
  onSelectRef.current = onSelectBuilding;

  // Add the event-status highlight source + extrusion layer + terrain.
  const addCampusLayers = useCallback(async (map: mapboxgl.Map) => {
    // Real 3D terrain relief.
    if (!map.getSource("mapbox-dem")) {
      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
    }
    try {
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.1 });
    } catch {
      /* terrain unsupported, ignore */
    }

    // Full Queen's campus footprints (all buildings + parks/fields) — clickable context.
    if (!map.getSource("campus")) {
      let data: FeatureCollection = { type: "FeatureCollection", features: [] };
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}queens-campus.geojson`);
        data = await res.json();
      } catch {
        /* keep empty on failure */
      }
      if (mapRef.current !== map) return; // unmounted during fetch
      // Cache centroid records for proximity dedupe against DB event buildings.
      campusFeaturesRef.current = (data.features ?? []).map((f) => {
        const p = (f.properties ?? {}) as CampusFeatureProps;
        return { fid: p.fid, clon: p.clon, clat: p.clat, kind: p.kind };
      });
      if (!map.getSource("campus")) {
        map.addSource("campus", { type: "geojson", data, promoteId: "fid" });
      }
      // Point source (centroids) drives pins + labels: one marker per feature,
      // not one dot per polygon vertex.
      if (!map.getSource("campus-points")) {
        const points: FeatureCollection = {
          type: "FeatureCollection",
          features: (data.features ?? []).map((f) => {
            const p = (f.properties ?? {}) as CampusFeatureProps;
            return {
              type: "Feature",
              id: p.fid,
              properties: p,
              geometry: { type: "Point", coordinates: [p.clon, p.clat] },
            } as Feature;
          }),
        };
        map.addSource("campus-points", { type: "geojson", data: points, promoteId: "fid" });
      }
    }

    const dbFids = computeDbFids(buildingsRef.current, campusFeaturesRef.current);
    const notDb = ["!", ["in", ["get", "fid"], ["literal", dbFids]]] as FilterSpecification;
    const campusBuildingFilter = [
      "all",
      ["==", ["get", "kind"], "building"],
      ["!", ["in", ["get", "fid"], ["literal", dbFids]]],
    ] as FilterSpecification;

    // Parks / fields / gardens.
    if (!map.getLayer("campus-green")) {
      map.addLayer({
        id: "campus-green",
        type: "fill",
        source: "campus",
        slot: "middle",
        filter: ["==", ["get", "kind"], "leisure"],
        paint: {
          "fill-color": ["match", ["get", "leisure"], "playground", "#f59e0b", "#22c55e"],
          "fill-opacity": 0.16,
        },
      });
    }
    if (!map.getLayer("campus-green-outline")) {
      map.addLayer({
        id: "campus-green-outline",
        type: "line",
        source: "campus",
        slot: "middle",
        filter: ["==", ["get", "kind"], "leisure"],
        paint: { "line-color": "#16a34a", "line-width": 1.1, "line-opacity": 0.5 },
      });
    }

    // Every campus building as neutral 3D context (clickable, sits under event colors).
    if (!map.getLayer("campus-buildings-3d")) {
      map.addLayer({
        id: "campus-buildings-3d",
        type: "fill-extrusion",
        source: "campus",
        slot: "middle",
        filter: campusBuildingFilter,
        paint: {
          "fill-extrusion-color": "#8ea3bf",
          "fill-extrusion-height": ["max", ["*", ["get", "levels"], 4.2], 10],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.85,
          "fill-extrusion-vertical-gradient": true,
        },
      });
    }

    // Event-building highlight extrusions (colored by status).
    if (!map.getSource("events")) {
      map.addSource("events", {
        type: "geojson",
        data: buildingsToFeatureCollection(buildingsRef.current, visibleRef.current),
        promoteId: "id",
      });
    }

    if (!map.getLayer("events-3d")) {
      map.addLayer({
        id: "events-3d",
        type: "fill-extrusion",
        source: "events",
        slot: "middle",
        paint: {
          "fill-extrusion-color": [
            "match",
            ["get", "status"],
            "active", STATUS_COLOR.active,
            "upcoming_today", STATUS_COLOR.upcoming_today,
            "upcoming_week", STATUS_COLOR.upcoming_week,
            STATUS_COLOR.none,
          ],
          "fill-extrusion-height": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            ["+", ["get", "height"], 14],
            ["+", ["get", "height"], 4],
          ],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": [
            "case",
            ["==", ["get", "status"], "none"],
            0.5,
            0.92,
          ],
          "fill-extrusion-vertical-gradient": true,
        },
      });
    }

    // Pins + name labels for every campus feature (excluding DB event buildings,
    // which render richer animated HTML markers). Native layers scale to hundreds.
    if (!map.getLayer("campus-pins")) {
      map.addLayer({
        id: "campus-pins",
        type: "circle",
        source: "campus-points",
        slot: "top",
        filter: notDb,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 2, 15.5, 3.5, 18, 5.5],
          "circle-color": ["match", ["get", "kind"], "leisure", "#16a34a", "#1e3a8a"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.4,
          "circle-opacity": 0.95,
        },
      });
    }
    if (!map.getLayer("campus-labels")) {
      map.addLayer({
        id: "campus-labels",
        type: "symbol",
        source: "campus-points",
        slot: "top",
        filter: notDb,
        layout: {
          "text-field": ["coalesce", ["get", "name"], ""],
          "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10, 17, 12.5],
          "text-offset": [0, -1.2],
          "text-anchor": "bottom",
          "text-optional": true,
          "symbol-sort-key": ["case", ["==", ["get", "kind"], "building"], 0, 1],
        },
        paint: {
          "text-color": "#0f172a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.4,
        },
      });
    }

    styleReadyRef.current = true;
    syncMarkers();
    applySelection(selectedRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build / update floating HTML markers. The Marker element (`.qmap-anchor`)
  // must stay transition-free so Mapbox can position it every frame with no lag.
  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<number>();

    for (const b of buildingsRef.current) {
      const categoryVisible = visibleRef.current.has(b.category);
      let marker = markersRef.current.get(b.id);

      if (!categoryVisible) {
        if (marker) {
          marker.remove();
          markersRef.current.delete(b.id);
        }
        continue;
      }
      seen.add(b.id);

      const status = b.eventStatus;
      const color = STATUS_COLOR[status] ?? STATUS_COLOR.none;
      const count =
        b.activeEventCount + b.todayEventCount > 0
          ? b.activeEventCount + b.todayEventCount
          : b.weekEventCount;

      if (!marker) {
        const el = document.createElement("div");
        el.className = "qmap-anchor";
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          const cur = selectedRef.current;
          onSelectRef.current(cur === b.id ? null : b.id);
        });
        marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([b.longitude, b.latitude])
          .addTo(map);
        markersRef.current.set(b.id, marker);
      } else {
        marker.setLngLat([b.longitude, b.latitude]);
      }

      const el = marker.getElement();
      const isActive = status === "active";
      const isSelected = selectedRef.current === b.id;
      el.dataset.status = status;
      el.dataset.selected = String(isSelected);
      el.style.setProperty("--qmap-color", color);
      el.style.zIndex = isSelected ? "30" : isActive ? "20" : "10";

      const inner = document.createElement("div");
      inner.className = "qmap-marker";
      if (isActive) {
        const pulse = document.createElement("span");
        pulse.className = "qmap-pulse";
        inner.appendChild(pulse);
      }
      const pin = document.createElement("span");
      pin.className = "qmap-pin";
      const dot = document.createElement("span");
      dot.className = "qmap-dot";
      pin.appendChild(dot);
      if (count > 0) {
        const badge = document.createElement("span");
        badge.className = "qmap-badge";
        badge.textContent = String(count);
        pin.appendChild(badge);
      }
      inner.appendChild(pin);
      const label = document.createElement("span");
      label.className = "qmap-label";
      label.textContent = b.shortName;
      inner.appendChild(label);
      el.replaceChildren(inner);
    }

    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }
  }, []);

  const applySelection = useCallback((id: number | null) => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;

    if (map.getSource("events")) {
      for (const b of buildingsRef.current) {
        try {
          map.setFeatureState({ source: "events", id: b.id }, { selected: b.id === id });
        } catch {
          /* feature not in source (marker-only / hidden) */
        }
      }
    }

    for (const [mid, marker] of markersRef.current) {
      marker.getElement().dataset.selected = String(mid === id);
    }

    if (id != null) {
      const b = buildingsRef.current.find((x) => x.id === id);
      if (b) {
        map.flyTo({
          center: [b.longitude, b.latitude],
          zoom: 17.2,
          pitch: 62,
          bearing: -18,
          offset: [0, 60],
          duration: 1600,
          essential: true,
        });
      }
    }
  }, []);

  // Initialize map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (!MAPBOX_TOKEN) {
      setInitError("token");
      return;
    }

    let map: mapboxgl.Map;
    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: STANDARD_STYLE,
        center: CAMPUS_CENTER,
        zoom: 13.6,
        pitch: 0,
        bearing: 0,
        antialias: true,
        attributionControl: false,
        maxPitch: 80,
      });
    } catch (err) {
      console.error("Failed to initialize Mapbox (WebGL unavailable)", err);
      setInitError("webgl");
      return;
    }
    mapRef.current = map;

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
    map.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true, showZoom: true, showCompass: true }),
      "bottom-right"
    );

    map.on("style.load", () => {
      try {
        map.setConfigProperty("basemap", "lightPreset", LIGHT_PRESET[theme]);
      } catch {
        /* config unsupported, ignore */
      }
      void addCampusLayers(map).then(() => {
        if (mapRef.current !== map) return; // unmounted during async layer setup
        map.flyTo({ ...OVERVIEW, duration: 3200, essential: true });
      });
    });

    map.on("error", (e) => {
      // A bad/expired token surfaces here; degrade to the fallback panel.
      const msg = (e?.error as { message?: string } | undefined)?.message ?? "";
      if (/access token|401|Unauthorized/i.test(msg)) {
        setInitError("token");
      }
    });

    // Lightweight info popup for any campus building / space.
    const typeLabel = (p: { kind?: string; leisure?: string }) => {
      if (p.kind === "building") return "Queen's building";
      const m: Record<string, string> = { park: "Park", pitch: "Sports field", garden: "Garden", playground: "Playground" };
      return (p.leisure && m[p.leisure]) || "Campus space";
    };
    const showFeaturePopup = (
      lngLat: mapboxgl.LngLatLike,
      p: { name?: string; kind?: string; leisure?: string }
    ) => {
      popupRef.current?.remove();
      const card = document.createElement("div");
      card.className = "qmap-popup";
      const title = document.createElement("div");
      title.className = "qmap-popup-title";
      title.textContent = p.name || typeLabel(p);
      const sub = document.createElement("div");
      sub.className = "qmap-popup-sub";
      sub.textContent = typeLabel(p);
      card.append(title, sub);
      popupRef.current = new mapboxgl.Popup({ closeButton: false, offset: 14, className: "qmap-popup-wrap" })
        .setLngLat(lngLat)
        .setDOMContent(card)
        .addTo(map);
    };

    // Click priority: event building (rich panel) → any campus feature (popup) → clear.
    map.on("click", (e) => {
      if (map.getLayer("events-3d")) {
        const ev = map.queryRenderedFeatures(e.point, { layers: ["events-3d"] });
        const fid = ev[0]?.id;
        if (typeof fid === "number") {
          popupRef.current?.remove();
          const cur = selectedRef.current;
          onSelectRef.current(cur === fid ? null : fid);
          return;
        }
      }
      const ctxLayers = ["campus-buildings-3d", "campus-green"].filter((l) => map.getLayer(l));
      if (ctxLayers.length) {
        const f = map.queryRenderedFeatures(e.point, { layers: ctxLayers })[0];
        if (f) {
          showFeaturePopup(e.lngLat, (f.properties ?? {}) as { name?: string; kind?: string; leisure?: string });
          onSelectRef.current(null);
          return;
        }
      }
      popupRef.current?.remove();
      onSelectRef.current(null);
    });

    for (const layerId of ["events-3d", "campus-buildings-3d", "campus-green"]) {
      map.on("mouseenter", layerId, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = "";
      });
    }

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      for (const [, marker] of markersRef.current) marker.remove();
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      styleReadyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Day / night via Standard light preset (no style reload).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    try {
      map.setConfigProperty("basemap", "lightPreset", LIGHT_PRESET[theme]);
    } catch {
      /* ignore */
    }
  }, [theme]);

  // Update event source + markers when buildings or category visibility change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    const src = map.getSource("events") as mapboxgl.GeoJSONSource | undefined;
    if (src) src.setData(buildingsToFeatureCollection(buildings, visibleCategories));
    // Keep DB event buildings out of the generic campus layers (they render colored
    // extrusions + HTML markers). Recompute the proximity dedupe as buildings change.
    const dbFids = computeDbFids(buildings, campusFeaturesRef.current);
    const notDb = ["!", ["in", ["get", "fid"], ["literal", dbFids]]] as FilterSpecification;
    const bFilter = [
      "all",
      ["==", ["get", "kind"], "building"],
      ["!", ["in", ["get", "fid"], ["literal", dbFids]]],
    ] as FilterSpecification;
    if (map.getLayer("campus-buildings-3d")) map.setFilter("campus-buildings-3d", bFilter);
    for (const layerId of ["campus-pins", "campus-labels"]) {
      if (map.getLayer(layerId)) map.setFilter(layerId, notDb);
    }
    syncMarkers();
    applySelection(selectedRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings, visibleCategories]);

  // React to selection changes.
  useEffect(() => {
    applySelection(selectedBuildingId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBuildingId]);

  // Recenter to overview.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || recenterSignal === 0) return;
    map.flyTo({ ...OVERVIEW, duration: 2000, essential: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterSignal]);

  // Toggle tilt / pitch.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || pitchSignal === 0) return;
    const p = map.getPitch();
    map.easeTo({ pitch: p > 10 ? 0 : 60, duration: 700, essential: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitchSignal]);

  return (
    <div className="absolute inset-0 h-full w-full">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      {initError && (
        <div className="absolute inset-0 flex items-center justify-center bg-background p-8">
          <div className="max-w-md text-center">
            <h2 className="text-lg font-semibold text-foreground">
              {initError === "token" ? "Map needs configuration" : "Map unavailable"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {initError === "token"
                ? "This interactive 3D map needs a Mapbox access token to load. Once it's configured, the map will appear here. Event listings, search, and building details still work in the sidebar."
                : "This interactive 3D map needs WebGL, which isn't available in the current view. Try opening the app in a modern desktop browser with hardware acceleration enabled. Event listings and search still work in the sidebar."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
