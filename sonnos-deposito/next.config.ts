import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
