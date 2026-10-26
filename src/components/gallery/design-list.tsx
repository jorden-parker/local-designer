import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { DesignSummary } from "@/lib/types";

const UPDATED = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function DesignList({ designs }: { designs: DesignSummary[] }) {
  if (designs.length === 0) {
    return <p className="text-center text-copy text-gray-900">Your designs will appear here.</p>;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {designs.map((design) => (
        <li key={design.id}>
          <Link
            href={`/d/${design.id}`}
            className="flex h-full flex-col gap-3 rounded-xl bg-background-100 p-4 shadow-border transition-shadow hover:shadow-menu"
          >
            <div className="h-24 rounded-md dot-grid" />
            <p className="line-clamp-2 text-sm font-medium">{design.title}</p>
            <div className="mt-auto flex items-center gap-2 text-xs text-gray-900">
              <Badge>
                {design.pageCount} {design.pageCount === 1 ? "page" : "pages"}
              </Badge>
              {UPDATED.format(new Date(design.updatedAt))}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
