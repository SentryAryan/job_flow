"use client";

import { LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useUser } from "@/components/auth/AuthProvider";
import {
    NavbarAiUsagePanel,
    NavbarOpenRouterKeysPanel,
} from "@/components/layout/NavbarAiPanels";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { captureEvent, resetAnalytics } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const CLOSE_DELAY_MS = 180;
const IGNORE_CLOSE_MS = 100;

function displayNameFromUser(email: string, name?: string): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  const local = email.split("@")[0]?.trim();
  return local && local.length > 0 ? local : "Account";
}

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** Read OAuth/auth profile image URL (InsForge stores `avatar_url` on profile). */
export function resolveAuthAvatarUrl(
  profile: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!profile) return undefined;
  const candidates = [profile.avatar_url, profile.avatarUrl, profile.picture];
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return undefined;
}

/**
 * Navbar right CTA: “Get Started” → `/login` when signed out;
 * avatar menu (hover open, click to pin) when signed in.
 */
export function NavbarCta() {
  const router = useRouter();
  const { user, isLoaded, signOut } = useUser();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [usageRefreshToken, setUsageRefreshToken] = useState(0);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const ignoreNextCloseRef = useRef(false);

  const clearCloseTimer = (): void => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const clearIgnoreCloseTimer = (): void => {
    if (ignoreCloseTimerRef.current) {
      clearTimeout(ignoreCloseTimerRef.current);
      ignoreCloseTimerRef.current = null;
    }
  };

  const [avatarFailed, setAvatarFailed] = useState(false);

  const avatarUrl = resolveAuthAvatarUrl(
    user?.profile as Record<string, unknown> | null | undefined,
  );

  useEffect(() => {
    return () => {
      clearCloseTimer();
      clearIgnoreCloseTimer();
    };
  }, []);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  const openOnHover = (): void => {
    clearCloseTimer();
    setOpen(true);
  };

  const scheduleClose = (): void => {
    if (pinned) return;
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
    }, CLOSE_DELAY_MS);
  };

  const handleSignOut = (): void => {
    captureEvent("user_signed_out");
    resetAnalytics();
    void signOut().then(() => {
      router.replace("/");
    });
  };

  if (!isLoaded) {
    return (
      <Skeleton
        className="size-9 shrink-0 rounded-full"
        aria-hidden
      />
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex cursor-pointer items-center rounded-md bg-overlay-dark px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black"
        onClick={() => captureEvent("navbar_cta_clicked")}
      >
        Get Started
      </Link>
    );
  }

  const name = displayNameFromUser(
    user.email,
    typeof user.profile?.name === "string" ? user.profile.name : undefined,
  );

  return (
    <DropdownMenu
      open={open}
      modal={false}
      onOpenChange={(next) => {
        if (!next && ignoreNextCloseRef.current) {
          ignoreNextCloseRef.current = false;
          setOpen(true);
          return;
        }
        setOpen(next);
        if (!next) {
          setPinned(false);
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "cursor-pointer rounded-full outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          )}
          aria-label="Account menu"
          onMouseEnter={openOnHover}
          onMouseLeave={scheduleClose}
          onClick={() => {
            captureEvent("navbar_cta_clicked");
            if (pinned) {
              setPinned(false);
              setOpen(false);
              return;
            }
            // Hover may already have opened the menu; pin and ignore the
            // close Radix emits from this same click.
            setPinned(true);
            setOpen(true);
            ignoreNextCloseRef.current = true;
            clearIgnoreCloseTimer();
            ignoreCloseTimerRef.current = setTimeout(() => {
              ignoreNextCloseRef.current = false;
              ignoreCloseTimerRef.current = null;
            }, IGNORE_CLOSE_MS);
          }}
        >
          <Avatar size="default">
            {avatarUrl && !avatarFailed ? (
              // eslint-disable-next-line @next/next/no-img-element -- OAuth CDN needs referrerPolicy; next/image not required here
              <img
                data-slot="avatar-image"
                src={avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="aspect-square size-full rounded-full object-cover"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <AvatarFallback className="bg-accent-light text-xs font-medium text-accent">
                {initialsFromName(name)}
              </AvatarFallback>
            )}
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[min(36rem,85vh)] w-80 min-w-72 overflow-y-auto"
        onMouseEnter={openOnHover}
        onMouseLeave={scheduleClose}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5 px-0.5 py-0.5">
            <span className="truncate text-sm font-medium text-text-primary">
              {name}
            </span>
            <span className="truncate text-xs text-text-secondary">
              {user.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <User />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <NavbarAiUsagePanel refreshToken={usageRefreshToken} />
        <DropdownMenuSeparator />
        <NavbarOpenRouterKeysPanel
          onKeysChanged={() => setUsageRefreshToken((n) => n + 1)}
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer"
          onSelect={() => {
            handleSignOut();
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
