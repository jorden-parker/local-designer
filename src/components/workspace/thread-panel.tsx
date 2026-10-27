"use client";

import { Loader2, Square } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { Composer } from "./composer";
import type { VersionSummary } from "./target-view";
import type { RunState } from "./use-change-runner";

type Props = {
  subject: string;
  versions: VersionSummary[];
  viewed: VersionSummary | null;
  latest: VersionSummary | null;
  run: RunState;
  onView: (number: number) => void;
  onRestore: (number: number) => void;
  onStop: () => void;
  onRequest: (request: string) => void;
};

const OUTPUT_TAIL_LINES = 14;

function tail(output: string): string {
  return output.split("\n").slice(-OUTPUT_TAIL_LINES).join("\n");
}

function VersionItem({
  version,
  isViewed,
  isLatest,
  onView,
  onRestore,
}: {
  version: VersionSummary;
  isViewed: boolean;
  isLatest: boolean;
  onView: () => void;
  onRestore: () => void;
}) {
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-md p-3",
        isViewed ? "bg-gray-alpha-100 shadow-border" : "hover:bg-gray-alpha-100",
      )}
    >
      <p className="text-copy text-gray-1000">{version.request}</p>
      <div className="flex items-center gap-1.5">
        <Badge variant={isViewed ? "blue" : "gray"}>v{version.number}</Badge>
        {version.nodeId && <Badge>Element</Badge>}
        <span className="truncate font-mono text-xs text-gray-900">{version.model}</span>
        <span className="ml-auto flex gap-1">
          {!isViewed && (
            <Button variant="tertiary" className="h-6 px-2 text-xs" onClick={onView}>
              View
            </Button>
          )}
          {!isLatest && (
            <Button variant="secondary" className="h-6 px-2 text-xs" onClick={onRestore}>
              Restore
            </Button>
          )}
        </span>
      </div>
    </li>
  );
}

function RunItem({
  run,
  onStop,
}: {
  run: Exclude<RunState, { status: "idle" }>;
  onStop: () => void;
}) {
  const failed = run.status === "failed";
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-md p-3 shadow-border",
        failed ? "bg-red-100" : "bg-background-200",
      )}
    >
      <p className="text-copy text-gray-1000">{run.request}</p>
      <div className="flex items-center gap-2 text-label text-gray-900">
        {failed ? (
          <span className="text-red-900">{run.error}</span>
        ) : (
          <>
            <Loader2 className="size-4 animate-spin" />
            Generating
            <Button variant="tertiary" className="ml-auto h-6 px-2 text-xs" onClick={onStop}>
              <Square className="size-3!" />
              Stop
            </Button>
          </>
        )}
      </div>
      {run.output && (
        <pre className="max-h-64 overflow-hidden rounded-sm bg-background-100 p-2 font-mono text-[11px] leading-4 whitespace-pre-wrap text-gray-900 shadow-border">
          {tail(run.output)}
        </pre>
      )}
    </li>
  );
}

export function ThreadPanel(props: Props) {
  const { subject, versions, viewed, latest, run, onView, onRestore, onStop, onRequest } = props;
  const end = useRef<HTMLDivElement>(null);
  const running = run.status === "running";
  const buildsOnOld = viewed && latest && viewed.number !== latest.number;

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [versions.length, run]);

  return (
    <section aria-label="History" className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <SectionLabel className="px-1 pb-2">History</SectionLabel>
        <ol className="flex flex-col gap-2">
          {versions.map((version) => (
            <VersionItem
              key={version.number}
              version={version}
              isViewed={version.number === viewed?.number}
              isLatest={version.number === latest?.number}
              onView={() => onView(version.number)}
              onRestore={() => onRestore(version.number)}
            />
          ))}
          {run.status !== "idle" && <RunItem run={run} onStop={onStop} />}
        </ol>
        <div ref={end} />
      </div>
      <div className="flex flex-col gap-2 border-t border-gray-alpha-400 p-3">
        {buildsOnOld && (
          <p className="text-xs text-gray-900">Changes will build on version {viewed.number}.</p>
        )}
        <Composer
          placeholder={`Describe a change to ${subject}`}
          disabled={running || !latest}
          onSubmit={onRequest}
        />
      </div>
    </section>
  );
}
