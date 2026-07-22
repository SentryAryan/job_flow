"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { uploadResume } from "@/lib/profile";
import type { Profile } from "@/types";

function CloudUploadIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M12 12v9" />
      <path d="m16 16-4-4-4 4" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );
}

type ResumeUploadProps = {
  userId: string;
  resumePdfUrl: string | null;
  onUploaded: (profile: Profile) => void;
};

export function ResumeUpload({
  userId,
  resumePdfUrl,
  onUploaded,
}: ResumeUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setPending(true);
    setError(null);
    setFileName(file.name);

    const result = await uploadResume(userId, file);
    setPending(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onUploaded(result.data.profile);
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-text-primary">Resume</h2>
      <p className="mt-1 text-sm font-medium text-text-secondary">
        Upload an existing resume to auto-fill this profile, or generate a new
        tailored one from your details below.
      </p>

      <div className="mt-5 flex flex-col items-center justify-center rounded-lg border border-dashed border-border-muted bg-accent-muted/40 px-6 py-10 text-center">
        <CloudUploadIcon />
        <p className="mt-3 text-sm font-medium text-text-primary">
          Click to upload or drag and drop
        </p>
        <p className="mt-1 text-xs text-text-muted">
          PDF formats only. Maximum file size 5MB.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            void handleFile(file);
            e.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          className="mt-4"
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? "Uploading..." : "Select Resume"}
        </Button>
        {fileName ? (
          <p className="mt-3 text-xs text-text-secondary">{fileName}</p>
        ) : null}
        {resumePdfUrl && !fileName ? (
          <p className="mt-3 text-xs text-success-darker">Resume on file</p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-sm text-text-secondary">
          Need a fresh document based on the fields below?
        </p>
        <Button type="button" className="shrink-0" disabled>
          <DocumentIcon />
          Generate Resume from Profile
        </Button>
      </div>
    </Card>
  );
}
