"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchResumeBlob, uploadResume } from "@/lib/profile";
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

function ExpandIcon() {
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
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

type ResumeUploadProps = {
  userId: string;
  resumePdfUrl: string | null;
  onUploaded: (profile: Profile) => void;
};

type ResumePreviewProps = {
  previewUrl: string;
  loading: boolean;
  error: string | null;
  pending: boolean;
  accessPending: boolean;
  expanded: boolean;
  onExpand: () => void;
  onCloseExpand: () => void;
  onDownload: () => void;
  onRetry: () => void;
};

function ResumePreview({
  previewUrl,
  loading,
  error,
  pending,
  accessPending,
  expanded,
  onExpand,
  onCloseExpand,
  onDownload,
  onRetry,
}: ResumePreviewProps) {
  useEffect(() => {
    if (!expanded) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseExpand();
    }

    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [expanded, onCloseExpand]);

  return (
    <>
      <div className="mt-5 w-full overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-sm font-medium text-text-primary">Preview</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={pending || accessPending || !previewUrl || Boolean(error)}
              onClick={onExpand}
            >
              <ExpandIcon />
              Expand
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending || accessPending}
              onClick={onDownload}
            >
              Download
            </Button>
          </div>
        </div>

        <div className="relative min-h-72 bg-surface-secondary">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-text-secondary">
              <span
                className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent"
                aria-hidden="true"
              />
              Loading preview…
            </div>
          ) : null}
          {!loading && error ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-4 text-center">
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
              <Button type="button" variant="secondary" onClick={onRetry}>
                Try again
              </Button>
            </div>
          ) : null}
          {!loading && !error && previewUrl ? (
            <iframe
              title="Resume preview"
              src={previewUrl}
              className="h-72 w-full border-0 bg-surface"
            />
          ) : null}
        </div>
      </div>

      {expanded && previewUrl && !error ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-dark/70 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Resume preview"
          onClick={onCloseExpand}
        >
          <div
            className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-card)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <p className="text-sm font-medium text-text-primary">Resume</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending || accessPending}
                  onClick={onDownload}
                >
                  Download
                </Button>
                <Button type="button" variant="secondary" onClick={onCloseExpand}>
                  Close
                </Button>
              </div>
            </div>
            <iframe
              title="Expanded resume preview"
              src={previewUrl}
              className="min-h-0 flex-1 w-full border-0 bg-surface"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ResumeUpload({
  userId,
  resumePdfUrl,
  onUploaded,
}: ResumeUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [accessPending, setAccessPending] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [previewReloadKey, setPreviewReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    function clearPreview() {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreviewUrl(null);
      setPreviewError(null);
      setExpanded(false);
    }

    if (!resumePdfUrl) {
      clearPreview();
      setPreviewLoading(false);
      return () => {
        active = false;
      };
    }

    clearPreview();
    setPreviewLoading(true);

    void fetchResumeBlob(userId, resumePdfUrl).then((result) => {
      if (!active) return;

      if (!result.success) {
        setPreviewError(result.error);
        setPreviewLoading(false);
        return;
      }

      const objectUrl = URL.createObjectURL(result.data);
      previewUrlRef.current = objectUrl;
      setPreviewUrl(objectUrl);
      setPreviewError(null);
      setPreviewLoading(false);
    });

    return () => {
      active = false;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, [userId, resumePdfUrl, previewReloadKey]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setPending(true);
    setFileName(file.name);

    try {
      const result = await uploadResume(userId, file, {
        previousUrl: resumePdfUrl,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      onUploaded(result.data.profile);
      toast.success("Resume uploaded");
    } finally {
      setPending(false);
    }
  }

  async function handleDownload() {
    setAccessPending(true);
    try {
      const result = await fetchResumeBlob(userId, resumePdfUrl);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const objectUrl = URL.createObjectURL(result.data);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "resume.pdf";
      anchor.rel = "noopener";
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setAccessPending(false);
    }
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
          disabled={pending || accessPending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? "Uploading..." : "Select Resume"}
        </Button>
        {fileName ? (
          <p className="mt-3 text-xs text-text-secondary">{fileName}</p>
        ) : null}
      </div>

      {resumePdfUrl ? (
        <ResumePreview
          previewUrl={previewUrl ?? ""}
          loading={previewLoading}
          error={previewError}
          pending={pending}
          accessPending={accessPending}
          expanded={expanded}
          onExpand={() => setExpanded(true)}
          onCloseExpand={() => setExpanded(false)}
          onDownload={() => void handleDownload()}
          onRetry={() => setPreviewReloadKey((key) => key + 1)}
        />
      ) : null}

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
