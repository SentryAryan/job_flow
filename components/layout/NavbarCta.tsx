"use client";

import { AuthAwareCta } from "@/components/auth/AuthAwareCta";
import { captureEvent } from "@/lib/analytics";

export function NavbarCta() {
  return (
    <AuthAwareCta
      className="inline-flex items-center rounded-md bg-overlay-dark px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black"
      onClick={() => captureEvent("navbar_cta_clicked")}
    >
      Start for free
    </AuthAwareCta>
  );
}
