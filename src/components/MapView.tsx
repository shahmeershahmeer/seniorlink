"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  kind: "request" | "volunteer" | "you" | "pickup" | "destination" | "driver";
  label: string;
}

const COLORS: Record<MapPoint["kind"], string> = {
  request: "#dc2626",
  volunteer: "#16a34a",
  you: "#2563eb",
  pickup: "#2563eb",
  destination: "#dc2626",
  driver: "#1b4530",
};

/** Leaflet + OpenStreetMap: no API key needed. Loaded client-side only (see Map.tsx). */
export default function MapView({
  points,
  center = [45.955, -66.645],
  zoom = 13,
  onSelect,
  route,
  fit = false,
  height = "h-64",
}: {
  points: MapPoint[];
  center?: [number, number];
  zoom?: number;
  onSelect?: (id: string) => void;
  /** Dashed line through these points, e.g. driver → pickup → destination. */
  route?: [number, number][];
  /** Zoom to show every point (once, on first render). */
  fit?: boolean;
  height?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(center, zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap",
    }).addTo(map.current);
    L.control.zoom({ position: "bottomright" }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const group = layer.current;
    if (!group) return;
    group.clearLayers();
    if (route && route.length > 1) {
      L.polyline(route, { color: "#1b4530", weight: 4, opacity: 0.7, dashArray: "8 8" }).addTo(group);
    }
    if (fit && !fitted.current && points.length > 1 && map.current) {
      map.current.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [36, 36], maxZoom: 15 });
      fitted.current = true;
    }
    for (const p of points) {
      L.circleMarker([p.lat, p.lng], {
        radius: p.kind === "driver" ? 12 : p.kind === "you" ? 11 : 9,
        color: "#fff",
        weight: 3,
        fillColor: COLORS[p.kind],
        fillOpacity: 1,
      })
        .bindTooltip(p.label)
        .on("click", () => onSelect?.(p.id))
        .addTo(group);
    }
  }, [points, onSelect, route, fit]);

  return <div ref={el} className={`${height} w-full`} role="img" aria-label="Map of Fredericton" />;
}
