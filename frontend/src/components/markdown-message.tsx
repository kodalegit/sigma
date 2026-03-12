"use client";

import type { ReactNode } from "react";
import { Fragment, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Citation } from "@/lib/types";

const citationPattern = /\[(\d+)\]/g;

function CitationMarker({ marker, citation }: { marker: number; citation?: Citation }) {
  if (!citation) {
    return (
      <span className="mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded bg-[#e8eef6] px-1 text-[10px] font-bold leading-none text-[#3d6a9e]">
        {marker}
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="mx-0.5 inline-flex h-[18px] min-w-[18px] cursor-pointer items-center justify-center rounded bg-[#e8eef6] px-1 text-[10px] font-bold leading-none text-[#3d6a9e] transition-colors hover:bg-[#d5e1f0] hover:text-[#2a5189]" />
        }
      >
        {marker}
      </TooltipTrigger>
      <TooltipContent className="max-w-[220px] px-3 py-2 text-left">
        <p className="text-xs font-semibold leading-snug">
          {citation.title}
          {citation.page ? `, p.${citation.page}` : ""}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

function renderTextWithCitations(
  text: string,
  citationMap: Map<number, Citation>,
): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = new RegExp(citationPattern.source, "g");
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const marker = Number(match[1]);
    parts.push(
      <CitationMarker
        key={`citation-${match.index}-${marker}`}
        marker={marker}
        citation={citationMap.get(marker)}
      />,
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function MarkdownMessage({
  content,
  citations,
}: {
  content: string;
  citations: Citation[];
}) {
  const citationMap = useMemo(() => {
    return new Map(citations.map((c) => [c.marker, c]));
  }, [citations]);

  return (
    <div className="prose prose-sm max-w-none text-[#2c3e50] prose-p:my-3 prose-p:leading-[1.8] prose-headings:text-[#152235] prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-strong:text-[#1c2d40] prose-strong:font-semibold prose-li:my-1 prose-li:leading-[1.8] prose-li:marker:text-[#8b9ab0] prose-ul:my-3 prose-ol:my-3 prose-code:rounded prose-code:bg-[#f0f4f8] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[13px] prose-code:font-medium prose-code:text-[#3d6a9e] prose-code:before:content-none prose-code:after:content-none prose-a:text-[#2663a8] prose-a:underline prose-a:decoration-[#2663a8]/30 hover:prose-a:decoration-[#2663a8] prose-blockquote:border-l-[#d4dce8] prose-blockquote:text-[#5d6f85] prose-hr:border-[#e8eef5]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => {
            const processed = processChildren(children, citationMap);
            return <p>{processed}</p>;
          },
          li: ({ children }) => {
            const processed = processChildren(children, citationMap);
            return <li>{processed}</li>;
          },
          a: ({ href, children }: { href?: string; children?: ReactNode }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function processChildren(
  children: ReactNode,
  citationMap: Map<number, Citation>,
): ReactNode {
  if (typeof children === "string") {
    return renderTextWithCitations(children, citationMap);
  }

  if (Array.isArray(children)) {
    return children.map((child, index) => (
      <Fragment key={index}>{processChildren(child, citationMap)}</Fragment>
    ));
  }

  if (children && typeof children === "object" && "props" in children) {
    const element = children as React.ReactElement<{ children?: ReactNode }>;
    if (element.props.children) {
      return {
        ...element,
        props: {
          ...element.props,
          children: processChildren(element.props.children, citationMap),
        },
      };
    }
  }

  return children;
}
