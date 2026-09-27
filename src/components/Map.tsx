"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` on import, so it must never render on the server.
const Map = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-[1.25rem] bg-sand" />,
});

export default Map;
export type { MapPoint } from "./MapView";
