import type { NextConfig } from "next";

import { getPostHogAssetsHost, getPostHogHost } from "./lib/posthog-config";

const posthogHost = getPostHogHost();
const posthogAssetsHost = getPostHogAssetsHost();

const nextConfig: NextConfig = {
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
