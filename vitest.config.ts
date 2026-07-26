import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "ECC", "graphify-out"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "lib/profile.ts",
        "lib/errors.ts",
        "lib/storage-keys.ts",
        "lib/resume-extract.ts",
        "lib/resume-generate.ts",
        "lib/profile-dirty.ts",
        "lib/api-auth.ts",
        "lib/ai/provider.ts",
        "lib/pdf-text.ts",
        "lib/app-env.ts",
        "lib/rate-limit.ts",
        "lib/resume-ai-rate-limit.ts",
        "lib/resume-ai-usage.ts",
        "lib/resume-extract-rate-limit.ts",
        "lib/resume-generate-rate-limit.ts",
        "app/api/resume/extract/route.ts",
        "app/api/resume/generate/route.ts",
        "app/api/resume/usage/route.ts",
        "components/auth/AuthProvider.tsx",
        "components/profile/ResumeUpload.tsx",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 65,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
