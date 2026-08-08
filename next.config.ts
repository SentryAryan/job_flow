import type { NextConfig } from "next";

import { getPostHogAssetsHost, getPostHogHost } from "./lib/posthog-config";

const posthogHost = getPostHogHost();
const posthogAssetsHost = getPostHogAssetsHost();

/** Native canvas + pdf worker must ship with the extract serverless function. */
const PDF_TRACE_GLOBS = [
  "./node_modules/pdf-parse/**/*",
  "./node_modules/@napi-rs/canvas/**/*",
  "./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
  "./node_modules/pdfjs-dist/**/*",
] as const;

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/resume/extract": [...PDF_TRACE_GLOBS],
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: `${posthogAssetsHost}/static/:path*`,
      },
      {
        source: "/ingest/array/:path*",
        destination: `${posthogAssetsHost}/array/:path*`,
      },
      {
        source: "/ingest/:path*",
        destination: `${posthogHost}/:path*`,
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
