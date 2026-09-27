import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SeniorLink",
    short_name: "SeniorLink",
    description: "We turn a neighbourhood into a support network.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf6f0",
    theme_color: "#1b4530",
    categories: ["health", "lifestyle", "social"],
    icons: [
      { src: "/icons/icon-192-v2.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-v2.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512-v2.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
