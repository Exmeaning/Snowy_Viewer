import type { NextConfig } from "next";

const internalApiBase = (process.env.INTERNAL_API_BASE_URL || "http://127.0.0.1:8080").replace(/\/+$/, "");
const enableLocalHarukiProxy = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  output: "standalone",
  trailingSlash: true,
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  async rewrites() {
    return {
      beforeFiles: enableLocalHarukiProxy
        ? [
            {
              source: "/api/haruki-public/:path*",
              destination: "https://suite-api.haruki.seiunx.com/public/:path*",
            },
          ]
        : [],
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${internalApiBase}/api/:path*`,
        },
      ],
    };
  },
  turbopack: {
    root: "..",
    resolveAlias: {
      "sekai-calculator": "../refer/re_sekai-calculator/src/index.ts",
    },
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'github.com',
      },
      {
        protocol: 'https',
        hostname: 'moe.exmeaning.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'assets.unipjsk.com',
      },
      {
        protocol: 'https',
        hostname: 'api.qrserver.com',
      }
    ],
  },

};

export default nextConfig;
