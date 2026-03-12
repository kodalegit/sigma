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
      <span className="mx-0.5 inline-flex rounded-md bg-[#eef6ff] px-1.5 py-0.5 text-xs font-medium text-[#2663a8]">
        [{marker}]
      </span>
    );
  }

  const truncatedExcerpt = citation.excerpt.length > 220 ? `${citation.excerpt.slice(0, 220).trimEnd()}…` : citation.excerpt;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="mx-0.5 inline-flex cursor-pointer rounded-md bg-[#eef6ff] px-1.5 py-0.5 text-xs font-medium text-[#2663a8]" />
        }
      >
        {marker}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs whitespace-pre-line px-3 py-2 text-left">
        <div>
          <p className="font-medium">
            {citation.title}
            {citation.page ? ` · p.${citation.page}` : ""}
          </p>
          <p className="mt-1 text-[11px] leading-5 opacity-90">{truncatedExcerpt}</p>
        </div>
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
    <div className="prose max-w-none text-[#324255] prose-p:my-2 prose-headings:text-[#152235] prose-strong:text-[#152235] prose-li:marker:text-[#5d6b80] prose-code:text-[#1f8fff] prose-a:text-[#1f8fff]">
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
            <a href={href} target="_blank" rel="noreferrer" className="text-[#1f8fff] underline">
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
