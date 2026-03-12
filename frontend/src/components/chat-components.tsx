"use client";

import { useMemo } from "react";
import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
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
          input: event.input,
          status: "running",
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
          status: "completed",
        };
      }
    }
  });

  return items;
}

function formatToolLabel(tool: string): string {
  return tool.replaceAll("_", " ");
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
            className="mt-4 inline-flex items-center rounded-full border border-[#d5e4f4] bg-[#eef6ff] px-3 py-1 text-xs font-medium text-[#2663a8] transition hover:border-[#b7d3ef] hover:bg-[#e4f0ff]"
          />
        }
      >
        {citations.length} source{citations.length === 1 ? "" : "s"}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <PopoverHeader>
          <PopoverTitle>Retrieved sources</PopoverTitle>
          <PopoverDescription>These passages support the assistant response.</PopoverDescription>
        </PopoverHeader>
        <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
          {citations.map((citation) => (
            <div key={`${citation.chunk_id}-${citation.marker}`} className="rounded-xl bg-[#f8fafc] p-3">
              <p className="text-sm font-medium text-[#213040]">
                [{citation.marker}] {citation.title}
                {citation.page ? ` · p.${citation.page}` : ""}
              </p>
              <p className="mt-1 line-clamp-3 text-xs leading-5 text-[#6b7a90]">{citation.excerpt}</p>
            </div>
          ))}
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
    <div className="mb-3 space-y-3">
      {items.map((item) => {
        if (item.kind === "reasoning") {
          return (
            <div key={item.id} className="rounded-2xl border border-[#e7edf5] bg-[#fbfcfe] px-4 py-3 text-sm leading-6 text-[#516074]">
              {item.content}
            </div>
          );
        }

        return (
          <details key={item.id} className="overflow-hidden rounded-2xl border border-[#dbe4ef] bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-[#213040]">{formatToolLabel(item.tool)}</p>
                <p className="text-xs text-[#7b8ba1]">
                  {item.status === "running" ? "Running" : "Completed"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={cn(item.status === "running" ? "border-[#d8e7fb] bg-[#eef6ff] text-[#2663a8]" : "border-[#cbe6d6] bg-[#edf9f1] text-[#2b7a4b]")}>{item.status}</Badge>
                <ChevronDown className="h-4 w-4 text-[#7b8ba1]" />
              </div>
            </summary>
            <div className="border-t border-[#eef2f7] px-4 py-3 text-sm text-[#516074]">
              {item.input ? (
                <p className="wrap-break-word text-xs text-[#7b8ba1]">Input: {JSON.stringify(item.input)}</p>
              ) : null}
              <p className={cn(item.input ? "mt-2" : "")}>{item.summary ?? "Searching your knowledge base..."}</p>
            </div>
          </details>
        );
      })}
    </div>
  );
}

export function SigmaMark() {
  return (
    <div className="flex items-center gap-2 text-[#2a5ca8]">
      <span className="text-lg leading-none">✦</span>
      <span className="text-2xl font-semibold tracking-tight">sigma</span>
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
