import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** High-match cutoff for Find Jobs filters and “strong matches” banner. */
export const MATCH_THRESHOLD = 70;
