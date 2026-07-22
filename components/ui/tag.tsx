type TagProps = {
  label: string;
  onRemove?: () => void;
};

export function Tag({ label, onRemove }: TagProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-primary">
      {label}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-3.5 w-3.5 items-center justify-center text-accent hover:text-accent-dark"
          aria-label={`Remove ${label}`}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </span>
  );
}
