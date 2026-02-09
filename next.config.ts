import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },

  outputFileTracingIncludes: {
    "/api/process-video": [
      "./node_modules/ffmpeg-static/**",
      "./node_modules/ffprobe-static/**",

      // pnpm (frequente no Vercel)
      "./node_modules/.pnpm/**/node_modules/ffmpeg-static/**",
      "./node_modules/.pnpm/**/node_modules/ffprobe-static/**",
    ],
  },

  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT" },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
