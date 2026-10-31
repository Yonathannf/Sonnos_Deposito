import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las fotos se achican en el navegador (~300 KB) antes de subirse.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // Sin cacheComponents: toda la app es dinámica por usuario (sesión + permisos por request).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
