"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { AlertTriangle, Trash2, Upload } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  createThread,
  deleteDocument,
  listDocuments,
  listMessages,
  listThreads,
  streamChat,
  uploadDocument,
} from "@/lib/api";
import type {
  ChatMessageRecord,
  Citation,
  DocumentRecord,
  StreamEvent,
  ThreadRecord,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const citationPattern = /\[(\d+)\]/g;

function linkifyCitations(content: string): string {
  return content.replace(citationPattern, (_, marker: string) => {
    return `[${marker}](citation://${marker})`;
  });
}

function CitationBadge({ citation }: { citation: Citation }) {
  return (
    <Badge className="gap-1 rounded-full border-[#d5e4f4] bg-[#eef6ff] text-[#2663a8]">
      {citation.title}
      {citation.page ? ` · p.${citation.page}` : ""}
    </Badge>
  );
}

function MarkdownMessage({ content, citations }: { content: string; citations: Citation[] }) {
  const citationMap = useMemo(() => {
    return new Map(citations.map((citation) => [citation.marker, citation]));
  }, [citations]);

  return (
    <div className="prose max-w-none text-[#324255] prose-p:my-2 prose-headings:text-[#152235] prose-strong:text-[#152235] prose-li:marker:text-[#5d6b80] prose-code:text-[#1f8fff] prose-a:text-[#1f8fff]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }: { href?: string; children?: ReactNode }) => {
            if (href?.startsWith("citation://")) {
              const marker = Number(href.replace("citation://", ""));
              const citation = citationMap.get(marker);
              if (!citation) {
                return <span className="rounded-md bg-[#eef6ff] px-1.5 py-0.5 text-xs text-[#2663a8]">[{marker}]</span>;
              }
              return (
                <span
                  className="mx-0.5 inline-flex cursor-default rounded-md bg-[#eef6ff] px-1.5 py-0.5 text-xs font-medium text-[#2663a8]"
                  title={`${citation.title}${citation.page ? ` page ${citation.page}` : ""}\n\n${citation.excerpt}`}
                >
                  [{marker}]
                </span>
              );
            }

            return (
              <a href={href} target="_blank" rel="noreferrer" className="text-[#1f8fff] underline">
                {children}
              </a>
            );
          },
        }}
      >
        {linkifyCitations(content)}
      </ReactMarkdown>
    </div>
  );
}

function SigmaMark() {
  return (
    <div className="flex items-center gap-2 text-[#2a5ca8]">
      <span className="text-lg leading-none">✦</span>
      <span className="text-2xl font-semibold tracking-tight">sigma</span>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed border-[#dbe4ef] bg-[#fbfcfe] shadow-none">
      <CardContent className="p-5">
        <p className="text-sm font-semibold text-[#213040]">{title}</p>
        <p className="mt-1 text-sm leading-6 text-[#6b7a90]">{description}</p>
      </CardContent>
    </Card>
  );
}

export function HoroApp() {
  const queryClient = useQueryClient();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [streamingMessage, setStreamingMessage] = useState("");
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);
  const [toolEvents, setToolEvents] = useState<string[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const threadsQuery = useQuery({
    queryKey: ["threads"],
    queryFn: listThreads,
  });

  const documentsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments,
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", selectedThreadId],
    queryFn: () => listMessages(selectedThreadId as string),
    enabled: Boolean(selectedThreadId),
  });

  const createThreadMutation = useMutation({
    mutationFn: createThread,
    onSuccess: async (thread: ThreadRecord) => {
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
      setSelectedThreadId(thread.id);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: uploadDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const threadItems = threadsQuery.data ?? [];
  const documentItems = documentsQuery.data ?? [];
  const messageItems = messagesQuery.data ?? [];

  const activeThread = threadItems.find((thread: ThreadRecord) => thread.id === selectedThreadId) ?? null;

  async function ensureThread(): Promise<string> {
    if (selectedThreadId) {
      return selectedThreadId;
    }
    const thread = await createThreadMutation.mutateAsync("New chat");
    return thread.id;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) {
      return;
    }

    const threadId = await ensureThread();
    const nextMessage = message;
    setMessage("");
    setStreamingMessage("");
    setStreamingCitations([]);
    setToolEvents([]);
    setStreamError(null);
    setIsStreaming(true);

    const optimisticUserMessage: ChatMessageRecord = {
      id: `optimistic-${Date.now()}`,
      thread_id: threadId,
      role: "user",
      content: nextMessage,
      citations: [],
      created_at: new Date().toISOString(),
    };

    queryClient.setQueryData<ChatMessageRecord[]>(["messages", threadId], (current = []) => [
      ...current,
      optimisticUserMessage,
    ]);

    try {
      await streamChat(threadId, nextMessage, (event: StreamEvent) => {
        if (event.type === "token") {
          setStreamingMessage((current) => current + event.delta);
        } else if (event.type === "citation") {
          setStreamingCitations((current) => {
            if (current.some((item) => item.marker === event.marker)) {
              return current;
            }
            return [...current, event];
          });
        } else if (event.type === "tool_start") {
          setToolEvents((current) => [...current, `Searching documents for ${JSON.stringify(event.input ?? {})}`]);
        } else if (event.type === "tool_end") {
          setToolEvents((current) => [...current, event.summary]);
        } else if (event.type === "done") {
          setStreamingMessage(event.content);
          setStreamingCitations(event.citations);
        } else if (event.type === "error") {
          setStreamError(event.message);
        }
      });
      await queryClient.invalidateQueries({ queryKey: ["messages", threadId] });
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
    } catch (error) {
      setStreamError(error instanceof Error ? error.message : "Failed to stream response.");
    } finally {
      setIsStreaming(false);
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await uploadMutation.mutateAsync(file);
    event.target.value = "";
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#152235]">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="border-r border-[#e2e8f0] bg-[#f8fafc]">
          <div className="flex h-full flex-col px-5 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SigmaMark />
              </div>
            </div>

            <div className="mt-8">
              <p className="text-sm font-semibold text-[#213040]">Chat with Horo</p>
              <p className="mt-1 text-sm text-[#7b8ba1]">The Co-Pilot for your business</p>
            </div>

            <div className="mt-8 flex-1 space-y-6 overflow-y-auto pr-1">
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b9ab0]">Documents</p>
                  <Badge>{documentItems.length}</Badge>
                </div>
                <label className="group flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-[#c8d5e4] bg-white p-4 transition hover:border-[#1f8fff] hover:bg-[#f8fbff]">
                  <input type="file" className="hidden" accept=".pdf,.txt,.md" onChange={handleUpload} />
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef6ff] text-[#1f8fff] transition group-hover:scale-105 group-hover:bg-[#1f8fff] group-hover:text-white">
                    {uploadMutation.isPending ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-[#213040]">
                      {uploadMutation.isPending ? "Uploading..." : "Upload document"}
                    </p>
                    <p className="mt-0.5 text-xs text-[#7b8ba1]">PDF, TXT, or MD files supported</p>
                  </div>
                </label>
                {uploadMutation.isError ? <p className="text-sm text-red-500">{String(uploadMutation.error)}</p> : null}
                {deleteMutation.isError ? <p className="text-sm text-red-500">{String(deleteMutation.error)}</p> : null}
                <div className="space-y-2">
                  {documentItems.length ? (
                    documentItems.map((document: DocumentRecord) => (
                      <Card key={document.id} className="bg-white">
                        <CardContent className="flex items-start justify-between gap-3 p-3.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[#213040]">{document.title}</p>
                            <p className="mt-1 text-xs text-[#7b8ba1]">{document.mime_type || "document"}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={cn(document.status === "ready" ? "border-[#cbe6d6] bg-[#edf9f1] text-[#2b7a4b]" : "")}>{document.status}</Badge>
                            <AlertDialog>
                              <AlertDialogTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#7b8ba1] transition hover:bg-[#fee2e2] hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600/50">
                                <Trash2 className="h-4 w-4" />
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-red-600" />
                                    <AlertDialogTitle>Delete document?</AlertDialogTitle>
                                  </div>
                                  <AlertDialogDescription>
                                    This will permanently delete &quot;{document.title}&quot; and all its indexed chunks. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(document.id)}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <EmptyState title="No documents yet" description="Upload your first source and Horo will ground answers with citations." />
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b9ab0]">Threads</p>
                  <Button size="sm" variant="outline" onClick={() => createThreadMutation.mutate("New chat")}>
                    New
                  </Button>
                </div>
                <div className="space-y-2">
                  {threadItems.length ? (
                    threadItems.map((thread: ThreadRecord) => (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => setSelectedThreadId(thread.id)}
                        className={cn(
                          "w-full rounded-2xl border px-4 py-3 text-left transition",
                          selectedThreadId === thread.id
                            ? "border-[#bfdbfe] bg-[#eef6ff] shadow-sm"
                            : "border-[#dbe4ef] bg-white hover:border-[#c4d4e7] hover:bg-[#fbfcfe]",
                        )}
                      >
                        <p className="truncate text-sm font-medium text-[#213040]">{thread.title}</p>
                        <p className="mt-1 text-xs text-[#7b8ba1]">{new Date(thread.updated_at).toLocaleString()}</p>
                      </button>
                    ))
                  ) : (
                    <EmptyState title="No threads yet" description="Create a thread to start a founder conversation with Horo." />
                  )}
                </div>
              </section>
            </div>
          </div>
        </aside>

        <main className="flex min-h-screen flex-col bg-[#f5f7fb]">
          <div className="flex flex-1 flex-col px-4 py-5 sm:px-6 xl:px-10 mt-4">
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b9ab0]">Horo Workspace</p>
                  <h1 className="mt-1 text-2xl font-semibold text-[#152235]">{activeThread?.title ?? "Select or create a thread"}</h1>
                </div>
                <Badge className="hidden sm:inline-flex">Grounded answers only</Badge>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto pb-6">
                {!messageItems.length && !streamingMessage ? (
                  <Card className="bg-white">
                    <CardContent className="p-6 text-center">
                      <p className="text-sm font-medium text-[#213040]">Start a conversation with Horo</p>
                      <p className="mt-2 text-sm leading-6 text-[#6b7a90]">
                        Ask questions about uploaded documents and Horo will answer with source-backed citations.
                      </p>
                    </CardContent>
                  </Card>
                ) : null}

                {messageItems.map((entry: ChatMessageRecord) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex w-full",
                      entry.role === "assistant" ? "justify-start" : "justify-end",
                    )}
                  >
                    <div className={cn("max-w-3xl", entry.role === "assistant" ? "w-full" : "max-w-xl") }>
                      <div className={cn("mb-2 flex items-center gap-2 text-xs text-[#8b9ab0]", entry.role === "user" ? "justify-end" : "justify-start")}>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#dbe4ef] bg-white text-[11px] font-semibold text-[#64748b]">
                          {entry.role === "assistant" ? "AI" : "You"}
                        </div>
                      </div>
                      <Card className={cn(entry.role === "assistant" ? "bg-white" : "border-[#cfe2ff] bg-[#eef6ff]")}>
                        <CardContent className="p-5">
                          {entry.role === "assistant" ? (
                            <MarkdownMessage content={entry.content} citations={entry.citations} />
                          ) : (
                            <p className="whitespace-pre-wrap text-sm leading-7 text-[#213040]">{entry.content}</p>
                          )}
                          {entry.citations.length ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {entry.citations.map((citation) => (
                                <CitationBadge key={`${entry.id}-${citation.marker}`} citation={citation} />
                              ))}
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ))}

                {isStreaming || streamingMessage ? (
                  <div className="flex w-full justify-start">
                    <div className="w-full max-w-3xl">
                      <div className="mb-2 flex items-center gap-2 text-xs text-[#8b9ab0]">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#dbe4ef] bg-white text-[11px] font-semibold text-[#64748b]">AI</div>
                      </div>
                      <Card className="bg-white">
                        <CardContent className="p-5">
                          <MarkdownMessage content={streamingMessage || "Thinking..."} citations={streamingCitations} />
                          {streamingCitations.length ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {streamingCitations.map((citation) => (
                                <CitationBadge key={`stream-${citation.marker}`} citation={citation} />
                              ))}
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : null}

                {toolEvents.length ? (
                  <Card className="max-w-3xl bg-[#fbfcfe]">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b9ab0]">tool activity</p>
                      <div className="mt-3 space-y-2 text-sm text-[#516074]">
                        {toolEvents.map((item, index) => (
                          <p key={`${item}-${index}`}>{item}</p>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {streamError ? <p className="text-sm text-red-500">{streamError}</p> : null}
              </div>

              <Card className="sticky bottom-0 mt-auto border-[#bfd8f7] shadow-[0_16px_50px_rgba(63,94,139,0.08)]">
                <CardContent className="p-3">
                  <form className="space-y-3" onSubmit={handleSubmit}>
                    <Textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Ask Horo about terms, clauses, onboarding steps, CAC, or anything in your uploaded documents..."
                      className="min-h-28 resize-none border-0 bg-transparent p-3 shadow-none focus:ring-0"
                    />
                    <div className="flex items-center justify-between gap-4 border-t border-[#e8eef5] px-2 pt-3">
                      <div className="flex items-center gap-2 text-sm text-[#7b8ba1]">
                        <Button size="icon" variant="ghost" className="rounded-xl text-[#64748b]">+</Button>
                        <span>Chat with Horo</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="rounded-xl">▷</Button>
                        <Button type="submit" disabled={isStreaming || !message.trim()} className="rounded-xl px-5">
                          {isStreaming ? "Streaming..." : "Send"}
                        </Button>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>

        <aside className="hidden border-l border-[#e2e8f0] bg-[#f7f9fc] xl:block">
          <div className="flex h-full flex-col p-5">
            <div className="mt-6 space-y-4">
              <Card className="bg-white">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-[#213040]">Session summary</p>
                  <p className="mt-2 text-sm leading-6 text-[#6b7a90]">
                    Horo answers using uploaded founder documents only and cites supporting chunks inline.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#213040]">Knowledge base</p>
                    <Badge>{documentItems.length}</Badge>
                  </div>
                  <div className="mt-3 space-y-3">
                    {documentItems.slice(0, 4).map((document: DocumentRecord) => (
                      <div key={document.id} className="rounded-xl bg-[#f8fafc] p-3">
                        <p className="truncate text-sm font-medium text-[#213040]">{document.title}</p>
                        <p className="mt-1 text-xs text-[#7b8ba1]">{document.status}</p>
                      </div>
                    ))}
                    {!documentItems.length ? (
                      <p className="text-sm text-[#7b8ba1]">Upload documents to populate the retrieval context.</p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-[#213040]">How Horo works</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[#6b7a90]">
                    <li>Uploads are chunked and embedded for semantic retrieval.</li>
                    <li>Answers cite supporting passages with source markers.</li>
                    <li>If evidence is missing, Horo should say it doesn&apos;t know.</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
