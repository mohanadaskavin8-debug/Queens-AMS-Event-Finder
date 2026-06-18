import { useEffect, useRef, useCallback, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, FeatureCollection } from "geojson";
import type { Building } from "@workspace/api-client-react";

export type MapTheme = "day" | "night";

interface CampusMapProps {
  buildings: Building[];
  selectedBuildingId: number | null;
  onSelectBuilding: (id: number | null) => void;
  theme: MapTheme;
  /** Increment to trigger a fly-to-overview action. */
  recenterSignal?: number;
}

const STYLES: Record<MapTheme, string> = {
  day: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  night: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

const CAMPUS_CENTER: [number, number] = [-76.4952, 44.2256];
const OVERVIEW = { center: CAMPUS_CENTER, zoom: 15.4, pitch: 55, bearing: -18 };

const STATUS_COLOR: Record<string, string> = {
  active: "#16a34a",
  upcoming_today: "#F9A01B",
  upcoming_week: "#3b82f6",
  none: "#64748b",
};

const THEME_CONTEXT: Record<MapTheme, { color: string; opacity: number }> = {
  day: { color: "#c8d2e0", opacity: 0.92 },
  night: { color: "#243449", opacity: 0.9 },
};

function firstSymbolLayerId(map: maplibregl.Map): string | undefined {
  const layers = map.getStyle().layers ?? [];
  for (const l of layers) {
    if (l.type === "symbol") return l.id;
  }
  return undefined;
}

function buildingsToFeatureCollection(buildings: Building[]): FeatureCollection {
  const features: Feature[] = [];
  for (const b of buildings) {
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
  recenterSignal = 0,
}: CampusMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<number, maplibregl.Marker>>(new Map());
  const buildingsRef = useRef<Building[]>(buildings);
  const selectedRef = useRef<number | null>(selectedBuildingId);
  const onSelectRef = useRef(onSelectBuilding);
  const styleReadyRef = useRef(false);
  const styleGenRef = useRef(0);
  const [initError, setInitError] = useState(false);

  buildingsRef.current = buildings;
  selectedRef.current = selectedBuildingId;
  onSelectRef.current = onSelectBuilding;

  // Add campus context (3D extrusions) + event highlight layers to current style.
  const addCampusLayers = useCallback(async (map: maplibregl.Map, gen: number) => {
    const ctx = THEME_CONTEXT[theme];
    const beforeId = firstSymbolLayerId(map);

    // Hide base style's flat building fills to avoid double-draw.
    for (const l of map.getStyle().layers ?? []) {
      if (/building/i.test(l.id) && l.type !== "symbol") {
        try {
          map.setLayoutProperty(l.id, "visibility", "none");
        } catch {
          /* noop */
        }
      }
    }

    // Full-campus footprints for the 3D context (loaded once).
    if (!map.getSource("campus")) {
      let geojson: FeatureCollection;
      try {
        const url = `${import.meta.env.BASE_URL}queens-buildings.geojson`;
        const res = await fetch(url);
        geojson = await res.json();
      } catch {
        geojson = { type: "FeatureCollection", features: [] };
      }
      // Bail if the style was swapped or the map torn down while fetching.
      if (gen !== styleGenRef.current || mapRef.current !== map) return;
      if (!map.getSource("campus")) {
        map.addSource("campus", { type: "geojson", data: geojson });
      }
    }

    if (!map.getLayer("campus-3d")) {
      map.addLayer(
        {
          id: "campus-3d",
          type: "fill-extrusion",
          source: "campus",
          paint: {
            "fill-extrusion-color": [
              "interpolate",
              ["linear"],
              ["get", "height"],
              0, ctx.color,
              40, theme === "day" ? "#aeb9cb" : "#2e4258",
            ] as unknown as maplibregl.DataDrivenPropertyValueSpecification<string>,
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": ctx.opacity,
            "fill-extrusion-vertical-gradient": true,
          },
        },
        beforeId
      );
    }

    // Event-building highlight extrusions.
    if (!map.getSource("events")) {
      map.addSource("events", {
        type: "geojson",
        data: buildingsToFeatureCollection(buildingsRef.current),
        promoteId: "id",
      });
    }

    if (!map.getLayer("events-3d")) {
      map.addLayer(
        {
          id: "events-3d",
          type: "fill-extrusion",
          source: "events",
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
              0.55,
              0.95,
            ],
            "fill-extrusion-vertical-gradient": true,
          },
        },
        beforeId
      );
    }

    // Atmospheric sky for depth.
    try {
      map.setSky({
        "sky-color": theme === "day" ? "#bcd4ef" : "#0a1626",
        "horizon-color": theme === "day" ? "#eaf1fb" : "#16263d",
        "fog-color": theme === "day" ? "#e9eef6" : "#0d1b2e",
        "fog-ground-blend": 0.5,
        "sky-horizon-blend": 0.6,
        "horizon-fog-blend": 0.5,
        "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 12, 0.2, 16, 0],
      } as maplibregl.SkySpecification);
    } catch {
      /* sky unsupported, ignore */
    }

    styleReadyRef.current = true;
    syncMarkers();
    applySelection(selectedRef.current);
  }, [theme]);

  // Build / update floating HTML markers.
  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<number>();

    for (const b of buildingsRef.current) {
      seen.add(b.id);
      const status = b.eventStatus;
      const color = STATUS_COLOR[status] ?? STATUS_COLOR.none;
      const count =
        b.activeEventCount + b.todayEventCount > 0
          ? b.activeEventCount + b.todayEventCount
          : b.weekEventCount;

      let marker = markersRef.current.get(b.id);
      if (!marker) {
        const el = document.createElement("div");
        el.className = "qmap-marker";
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          const cur = selectedRef.current;
          onSelectRef.current(cur === b.id ? null : b.id);
        });
        marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
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
      el.replaceChildren();
      if (isActive) {
        const pulse = document.createElement("span");
        pulse.className = "qmap-pulse";
        el.appendChild(pulse);
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
      el.appendChild(pin);
      const label = document.createElement("span");
      label.className = "qmap-label";
      label.textContent = b.shortName;
      el.appendChild(label);
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
          /* feature not in source (marker-only) */
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
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLES[theme],
        center: CAMPUS_CENTER,
        zoom: 13.6,
        pitch: 0,
        bearing: 0,
        canvasContextAttributes: { antialias: true },
        attributionControl: { compact: true },
        maxPitch: 75,
      });
    } catch (err) {
      console.error("Failed to initialize MapLibre (WebGL unavailable)", err);
      setInitError(true);
      return;
    }
    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true, showZoom: true, showCompass: true }),
      "bottom-right"
    );

    map.on("load", () => {
      void addCampusLayers(map, styleGenRef.current).then(() => {
        map.flyTo({ ...OVERVIEW, duration: 3200, essential: true });
      });
    });

    // Clicking a highlighted building footprint selects it; clicking empty map clears.
    map.on("click", (e) => {
      if (map.getLayer("events-3d")) {
        const feats = map.queryRenderedFeatures(e.point, { layers: ["events-3d"] });
        const fid = feats[0]?.id;
        if (typeof fid === "number") {
          const cur = selectedRef.current;
          onSelectRef.current(cur === fid ? null : fid);
          return;
        }
      }
      onSelectRef.current(null);
    });

    map.on("mouseenter", "events-3d", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "events-3d", () => {
      map.getCanvas().style.cursor = "";
    });

    return () => {
      for (const [, marker] of markersRef.current) marker.remove();
      markersRef.current.clear();
      styleGenRef.current += 1;
      map.remove();
      mapRef.current = null;
      styleReadyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle theme switch: reload style and re-add layers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded() && !styleReadyRef.current) return;
    styleReadyRef.current = false;
    styleGenRef.current += 1;
    const gen = styleGenRef.current;
    map.setStyle(STYLES[theme]);
    const handler = () => {
      void addCampusLayers(map, gen);
    };
    map.once("idle", handler);
    return () => {
      map.off("idle", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // Update event source + markers when buildings change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    const src = map.getSource("events") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(buildingsToFeatureCollection(buildings));
    syncMarkers();
    applySelection(selectedRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings]);

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

  return (
    <div className="absolute inset-0 h-full w-full">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      {initError && (
        <div className="absolute inset-0 flex items-center justify-center bg-background p-8">
          <div className="max-w-md text-center">
            <h2 className="text-lg font-semibold text-foreground">Map unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This interactive 3D map needs WebGL, which isn&apos;t available in the
              current view. Try opening the app in a modern desktop browser with
              hardware acceleration enabled. Event listings and search still work in
              the sidebar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
