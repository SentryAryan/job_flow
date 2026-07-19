type LogLine = {
  tag: string;
  tagColor: string;
  text: string;
};

const LOGS: LogLine[] = [
  { tag: "START", tagColor: "text-accent", text: "Initializing JobPilot agent…" },
  { tag: "DONE", tagColor: "text-success-alt", text: "Searched Adzuna — 24 matching jobs" },
  { tag: "DONE", tagColor: "text-success-alt", text: "Scored 24 roles against your profile" },
  { tag: "DONE", tagColor: "text-success-alt", text: "Filtered to 8 strong matches (70%+)" },
  { tag: "RUN", tagColor: "text-info", text: "Researching company: Stripe…" },
  { tag: "RUN", tagColor: "text-info", text: "Building company dossier" },
];

export default function AgentTerminal() {
  return (
    <div className="overflow-hidden rounded-xl border border-overlay-dark bg-overlay-dark shadow-xl">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-error" />
        <span className="h-3 w-3 rounded-full bg-warning" />
        <span className="h-3 w-3 rounded-full bg-success" />
        <span className="ml-2 text-xs font-medium text-white/60">
          agent · logs
        </span>
      </div>

      <div className="space-y-2.5 p-5 font-mono text-[13px] leading-relaxed">
        {LOGS.map((log, index) => (
          <div key={index} className="flex items-start gap-3">
            <span className="w-4 shrink-0 text-white/30">{index + 1}</span>
            <span className={`w-14 shrink-0 font-semibold ${log.tagColor}`}>
              {log.tag}
            </span>
            <span className="text-white/80">{log.text}</span>
          </div>
        ))}
        <div className="flex items-center gap-3 pt-1">
          <span className="w-4 shrink-0" />
          <span className="h-4 w-2 animate-pulse bg-white/70" />
        </div>
      </div>
    </div>
  );
}
