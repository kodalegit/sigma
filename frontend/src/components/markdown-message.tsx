"use client";

import type { ReactNode } from "react";
import { Fragment, memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Citation } from "@/lib/types";

const citationPattern = /\[(\d+)\]/g;

function parseMarkdownIntoBlocks(markdown: string): string[] {
  return markdown
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean);
}

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

const MemoizedMarkdownBlock = memo(
  ({ content, citationMap }: { content: string; citationMap: Map<number, Citation> }) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => {
          const processed = processChildren(children, citationMap);
          return <p>{processed}</p>;
        },
        ul: ({ children }) => (
          <ul className="mb-3 list-disc space-y-2 pl-5 marker:text-[#5e7492]">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 list-decimal space-y-2 pl-5 marker:text-[#5e7492]">
            {children}
          </ol>
        ),
        li: ({ children }) => {
          const processed = processChildren(children, citationMap);
          return <li className="leading-7 text-[#1f2f46]">{processed}</li>;
        },
        h1: ({ children }) => <h1>{children}</h1>,
        h2: ({ children }) => <h2>{children}</h2>,
        h3: ({ children }) => <h3>{children}</h3>,
        a: ({ href, children }: { href?: string; children?: ReactNode }) => (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  ),
  (previous, next) => previous.content === next.content && previous.citationMap === next.citationMap,
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

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

  const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);

  if (!content.trim()) {
    return null;
  }

  return (
    <div className="prose prose-sm max-w-none text-[#243648] prose-p:my-3 prose-p:leading-7 prose-headings:mt-6 prose-headings:mb-3 prose-headings:text-[#152235] prose-headings:font-semibold prose-h1:text-[1.35rem] prose-h2:text-[1.1rem] prose-h3:text-base prose-strong:font-semibold prose-strong:text-[#152235] prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6 prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6 prose-li:my-1.5 prose-li:pl-1 prose-li:leading-7 prose-li:marker:text-[#7f90a7] prose-code:rounded-md prose-code:bg-[#eef4fb] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[13px] prose-code:font-medium prose-code:text-[#2f5f93] prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-2xl prose-pre:border prose-pre:border-[#dbe4ef] prose-pre:bg-[#f8fbff] prose-pre:px-4 prose-pre:py-3 prose-pre:text-[13px] prose-a:text-[#2663a8] prose-a:underline prose-a:decoration-[#2663a8]/30 hover:prose-a:decoration-[#2663a8] prose-blockquote:rounded-r-xl prose-blockquote:border-l-4 prose-blockquote:border-l-[#d4dce8] prose-blockquote:bg-[#f8fafc] prose-blockquote:py-1 prose-blockquote:pl-4 prose-blockquote:text-[#5d6f85] prose-hr:my-6 prose-hr:border-[#e8eef5]">
      {blocks.map((block, index) => (
        <MemoizedMarkdownBlock
          key={`markdown-block-${index}`}
          content={block}
          citationMap={citationMap}
        />
      ))}
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
