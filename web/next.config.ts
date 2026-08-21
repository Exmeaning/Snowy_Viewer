import os from "node:os";
import type { NextConfig } from "next";

const internalApiBase = (process.env.INTERNAL_API_BASE_URL || "http://127.0.0.1:8080").replace(/\/+$/, "");
const enableLocalHarukiProxy = process.env.NODE_ENV !== "production";

const getAllowedDevOrigins = (): string[] => {
  const origins = new Set<string>(["localhost", "127.0.0.1"]);

  if (process.env.ALLOWED_DEV_ORIGINS) {
    process.env.ALLOWED_DEV_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((origin) => origins.add(origin));
  }

  try {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      if (iface) {
        for (const alias of iface) {
          if (alias.address) {
            origins.add(alias.address);
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return Array.from(origins);
};

const nextConfig: NextConfig = {
  output: "standalone",
  cacheMaxMemorySize: 50 * 1024 * 1024,
  trailingSlash: true,
  allowedDevOrigins: getAllowedDevOrigins(),
  async redirects() {
    return [
      {
        source: "/realtime-ranking",
        destination: "/realtime-ranking-next",
        permanent: true,
      },
      {
        source: "/realtime-ranking/:path*",
        destination: "/realtime-ranking-next/:path*",
        permanent: true,
      },
    ];
  },
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
