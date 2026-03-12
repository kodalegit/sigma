"use client";

import { useMemo } from "react";
import { BookOpen, ChevronDown, FileSearch, Search } from "lucide-react";


import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ChatEventRecord, Citation } from "@/lib/types";
import { cn } from "@/lib/utils";

type DisplayEvent =
  | { kind: "reasoning"; id: string; content: string }
  | {
      kind: "tool";
      id: string;
      toolCallId: string;
      tool: string;
      input?: Record<string, unknown>;
      summary?: string;
      status: "running" | "completed";
    };

function buildDisplayEvents(events: ChatEventRecord[]): DisplayEvent[] {
  const items: DisplayEvent[] = [];
  const toolIndexById = new Map<string, number>();

  events.forEach((event, index) => {
    if (event.type === "reasoning") {
      const content = event.content.trim();
      if (content) {
        items.push({ kind: "reasoning", id: `reasoning-${index}`, content });
      }
      return;
    }

    if (event.type === "tool_start") {
      const toolCallId = event.tool_call_id || `${event.tool}-${index}`;
      const existingIndex = toolIndexById.get(toolCallId);
      if (existingIndex === undefined) {
        toolIndexById.set(toolCallId, items.length);
        items.push({
          kind: "tool",
          id: `tool-${toolCallId}`,
          toolCallId,
          tool: event.tool,
          status: "running",
          input: event.input,
        });
      }
      return;
    }

    if (event.type === "tool_end") {
      const toolCallId = event.tool_call_id || `${event.tool}-${index}`;
      const existingIndex = toolIndexById.get(toolCallId);
      if (existingIndex === undefined) {
        toolIndexById.set(toolCallId, items.length);
        items.push({
          kind: "tool",
          id: `tool-${toolCallId}`,
          toolCallId,
          tool: event.tool,
          summary: event.summary,
          status: "completed",
        });
        return;
      }

      const existing = items[existingIndex];
      if (existing?.kind === "tool") {
        items[existingIndex] = {
          ...existing,
          tool: event.tool,
          summary: event.summary,
          input: existing.input,
          status: "completed",
        };
      }
    }
  });

  return items;
}

function formatToolLabel(tool: string, status: "running" | "completed"): string {
  const normalised = tool.toLowerCase().replaceAll("_", " ").trim();

  if (normalised.includes("search") && normalised.includes("document")) {
    return status === "running" ? "Searching your documents…" : "Searched your documents";
  }
  if (normalised.includes("search")) {
    return status === "running" ? "Searching knowledge base…" : "Searched knowledge base";
  }
  if (normalised.includes("retrieve") || normalised.includes("fetch")) {
    return status === "running" ? "Retrieving information…" : "Retrieved information";
  }

  const label = tool.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return status === "running" ? `Running ${label}…` : label;
}

function getToolIcon(tool: string) {
  const normalised = tool.toLowerCase();
  if (normalised.includes("search") && normalised.includes("document")) {
    return <FileSearch className="h-3.5 w-3.5" />;
  }
  if (normalised.includes("search")) {
    return <Search className="h-3.5 w-3.5" />;
  }
  return <BookOpen className="h-3.5 w-3.5" />;
}

export function SourcesPopover({ citations }: { citations: Citation[] }) {
  if (!citations.length) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="mt-5 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#dbe4ef] bg-[#f5f8fc] px-3 py-1.5 text-xs font-medium text-[#3d6a9e] transition-all hover:border-[#b7cfe6] hover:bg-[#edf3fa] hover:shadow-sm"
          />
        }
      >
        <BookOpen className="h-3 w-3" />
        Sources
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b border-[#edf1f7] px-4 py-3">
          <p className="text-sm font-semibold text-[#1c2d40]">Sources</p>
          <p className="mt-0.5 text-xs text-[#7b8ba1]">
            Passages supporting this response
          </p>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          <div className="space-y-1">
            {citations.map((citation, index) => (
              <div
                key={`${citation.chunk_id}-${citation.marker}`}
                className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[#f5f8fc]"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#e8eef6] text-[10px] font-bold text-[#3d6a9e]">
                  {citation.marker}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-snug text-[#1c2d40]">
                    {citation.title}
                    {citation.page ? <span className="font-normal text-[#7b8ba1]"> · p.{citation.page}</span> : null}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-[1.6] text-[#5d6f85]">
                    {citation.excerpt}
                  </p>
                  {index < citations.length - 1 ? (
                    <div className="mt-3 border-b border-[#f0f3f8]" />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AssistantEventPanels({ events }: { events: ChatEventRecord[] }) {
  const items = useMemo(() => buildDisplayEvents(events), [events]);

  if (!items.length) {
    return null;
  }

  return (
    <div className="mb-4 space-y-2">
      {items.map((item) => {
        if (item.kind === "reasoning") {
          return (
            <div
              key={item.id}
              className="rounded-lg border-l-2 border-[#d4dce8] bg-[#f7f9fc] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#5d6f85]"
            >
              {item.content}
            </div>
          );
        }

        const label = formatToolLabel(item.tool, item.status);
        const icon = getToolIcon(item.tool);

        return (
          <details key={item.id} className="group overflow-hidden rounded-lg border border-[#e4eaf2] bg-[#fafbfd]">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3.5 py-2.5 text-sm select-none">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                  item.status === "running"
                    ? "bg-[#eef5ff] text-[#3d6a9e]"
                    : "bg-[#edf5f0] text-[#2d7a4b]"
                )}
              >
                {item.status === "running" ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
                ) : (
                  icon
                )}
              </span>
              <span className="flex-1 text-[13px] font-medium text-[#2c3e50]">{label}</span>
              {item.summary ? (
                <ChevronDown className="h-3.5 w-3.5 text-[#9ba8b8] transition-transform group-open:rotate-180" />
              ) : null}
            </summary>
            {item.summary || item.input ? (
              <div className="border-t border-[#eef2f7] px-3.5 py-2.5 space-y-1.5">
                {item.input && typeof item.input.query === "string" ? (
                  <p className="text-[13px] leading-relaxed text-[#2c3e50]">
                    Query: <span className="font-medium">{item.input.query}</span>
                  </p>
                ) : null}
                {item.summary ? (
                  <p className="text-[13px] leading-relaxed text-[#5d6f85]">{item.summary}</p>
                ) : null}
              </div>
            ) : null}
          </details>
        );
      })}
    </div>
  );
}

export function SigmaMark() {
  return (
    <div className="flex items-center gap-2 text-[#1f3a5f]">
      <span className="text-lg leading-none">✦</span>
      <span className="text-xl font-bold tracking-tight">sigma</span>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed border-[#dbe4ef] bg-[#fbfcfe] shadow-none">
      <CardContent className="p-5">
        <p className="text-sm font-semibold text-[#213040]">{title}</p>
        <p className="mt-1 text-sm leading-6 text-[#6b7a90]">{description}</p>
      </CardContent>
    </Card>
  );
}
