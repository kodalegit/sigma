"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { AlertTriangle, Check, FileText, Loader2, Plus, Send, Trash2, Upload, X } from "lucide-react";

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
import { AssistantEventPanels, EmptyState, SigmaMark, SourcesPopover } from "@/components/chat-components";
import { MarkdownMessage } from "@/components/markdown-message";
import {
  createThread,
  deleteDocument,
  deleteThread,
  listDocuments,
  listMessages,
  listThreads,
  streamChat,
  uploadDocument,
} from "@/lib/api";
import type {
  ChatEventRecord,
  ChatMessageRecord,
  DocumentRecord,
  StreamEvent,
  ThreadRecord,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export function HoroApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const selectedThreadId = searchParams.get("thread");
  const [message, setMessage] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(selectedThreadId);
  const [streamingAssistantMessageId, setStreamingAssistantMessageId] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ id: string; name: string } | null>(null);
  const [openDeleteThreadId, setOpenDeleteThreadId] = useState<string | null>(null);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);

  const threadsQuery = useQuery({
    queryKey: ["threads"],
    queryFn: listThreads,
  });

  const documentsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments,
    refetchInterval: (query) => {
      const data = query.state.data as DocumentRecord[] | undefined;
      const hasProcessing = data?.some((d) => d.status !== "ready") ?? false;
      return hasProcessing ? 2000 : false;
    },
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", activeThreadId],
    queryFn: () => listMessages(activeThreadId as string),
    enabled: Boolean(activeThreadId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const uploadMutation = useMutation({
    mutationFn: uploadDocument,
    onSuccess: async (result) => {
      setAttachedFile({ id: result.document.id, name: result.document.title });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const deleteThreadMutation = useMutation({
    mutationFn: deleteThread,
    onSuccess: async (_, deletedThreadId) => {
      queryClient.setQueryData<ThreadRecord[]>(["threads"], (current = []) =>
        current.filter((thread) => thread.id !== deletedThreadId),
      );
      queryClient.removeQueries({ queryKey: ["messages", deletedThreadId] });
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
      if (activeThreadId === deletedThreadId) {
        setActiveThreadId(null);
        router.push("/");
      }
      setOpenDeleteThreadId(null);
      setDeletingThreadId(null);
    },
    onError: () => {
      setDeletingThreadId(null);
    },
  });

  const threadItems = threadsQuery.data ?? [];
  const documentItems = documentsQuery.data ?? [];
  const messageItems = activeThreadId ? (messagesQuery.data ?? []) : [];

  const attachedDocStatus = attachedFile
    ? documentItems.find((d) => d.id === attachedFile.id)?.status ?? "processing"
    : null;
  const isFileProcessing = uploadMutation.isPending || (attachedFile !== null && attachedDocStatus !== "ready");
  const isSendDisabled = isStreaming || isFileProcessing;

  const activeThread = threadItems.find((thread: ThreadRecord) => thread.id === activeThreadId) ?? null;
  const lastMessage = messageItems.length ? messageItems[messageItems.length - 1] : null;

  useEffect(() => {
    setActiveThreadId(selectedThreadId);
  }, [selectedThreadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeThreadId, messageItems.length, lastMessage?.id, lastMessage?.content, lastMessage?.citations.length, lastMessage?.metadata?.events?.length]);

  const clearAttachedFile = useCallback(() => {
    setAttachedFile(null);
  }, []);

  function appendMessagesToThread(threadId: string, messages: ChatMessageRecord[]) {
    queryClient.setQueryData<ChatMessageRecord[]>(["messages", threadId], (current = []) => [
      ...current,
      ...messages,
    ]);
  }

  function updateThreadMessage(
    threadId: string,
    messageId: string,
    updater: (message: ChatMessageRecord) => ChatMessageRecord,
  ) {
    queryClient.setQueryData<ChatMessageRecord[]>(["messages", threadId], (current = []) =>
      current.map((entry) => (entry.id === messageId ? updater(entry) : entry)),
    );
  }

  function appendAssistantEvent(threadId: string, messageId: string, event: ChatEventRecord) {
    updateThreadMessage(threadId, messageId, (current) => ({
      ...current,
      metadata: {
        ...current.metadata,
        events: [...(current.metadata?.events ?? []), event],
      },
    }));
  }

  function removeThreadMessage(threadId: string, messageId: string) {
    queryClient.setQueryData<ChatMessageRecord[]>(["messages", threadId], (current = []) =>
      current.filter((entry) => entry.id !== messageId),
    );
  }

  async function ensureThread(): Promise<string> {
    if (activeThreadId) {
      return activeThreadId;
    }

    const thread = await createThread("New chat");
    queryClient.setQueryData<ThreadRecord[]>(["threads"], (current = []) => [
      thread,
      ...current.filter((item) => item.id !== thread.id),
    ]);
    queryClient.setQueryData<ChatMessageRecord[]>(["messages", thread.id], (current) => current ?? []);
    setActiveThreadId(thread.id);
    router.push(`?thread=${thread.id}`);
    return thread.id;
  }

  function handleNewChat() {
    setActiveThreadId(null);
    router.push("/");
  }

  function handleSelectThread(threadId: string) {
    setActiveThreadId(threadId);
    router.push(`?thread=${threadId}`);
  }

  async function handleDeleteThread(threadId: string) {
    setDeletingThreadId(threadId);
    await deleteThreadMutation.mutateAsync(threadId);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextMessage = message;
    if (!nextMessage.trim() || isSendDisabled) {
      return;
    }

    setStreamError(null);
    setIsStreaming(true);
    let threadId: string | null = null;
    let assistantMessageId: string | null = null;

    try {
      threadId = await ensureThread();
      assistantMessageId = `optimistic-assistant-${Date.now()}`;
      const createdAt = new Date().toISOString();
      await queryClient.cancelQueries({ queryKey: ["messages", threadId] });
      const optimisticUserMessage: ChatMessageRecord = {
        id: `optimistic-user-${Date.now()}`,
        thread_id: threadId,
        role: "user",
        content: nextMessage,
        citations: [],
        metadata: {},
        created_at: createdAt,
      };
      const optimisticAssistantMessage: ChatMessageRecord = {
        id: assistantMessageId,
        thread_id: threadId,
        role: "assistant",
        content: "",
        citations: [],
        metadata: { events: [] },
        created_at: createdAt,
      };

      setMessage("");
      setAttachedFile(null);
      setStreamingAssistantMessageId(assistantMessageId);
      appendMessagesToThread(threadId, [optimisticUserMessage, optimisticAssistantMessage]);

      await streamChat(threadId, nextMessage, (event: StreamEvent) => {
        const stableThreadId = threadId;
        const stableAssistantMessageId = assistantMessageId;

        if (!stableThreadId || !stableAssistantMessageId) {
          return;
        }

        if (event.type === "title") {
          queryClient.setQueryData<ThreadRecord[]>(["threads"], (current = []) =>
            current.map((thread) =>
              thread.id === stableThreadId ? { ...thread, title: event.title } : thread,
            ),
          );
          return;
        }

        if (event.type === "token") {
          updateThreadMessage(stableThreadId, stableAssistantMessageId, (current) => ({
            ...current,
            content: current.content + event.delta,
          }));
        } else if (event.type === "reasoning") {
          appendAssistantEvent(stableThreadId, stableAssistantMessageId, event);
        } else if (event.type === "citation") {
          appendAssistantEvent(stableThreadId, stableAssistantMessageId, event);
          updateThreadMessage(stableThreadId, stableAssistantMessageId, (current) => ({
            ...current,
            citations: current.citations.some((item) => item.marker === event.marker)
              ? current.citations
              : [...current.citations, event],
          }));
        } else if (event.type === "tool_start") {
          appendAssistantEvent(stableThreadId, stableAssistantMessageId, event);
        } else if (event.type === "tool_end") {
          appendAssistantEvent(stableThreadId, stableAssistantMessageId, event);
        } else if (event.type === "done") {
          updateThreadMessage(stableThreadId, stableAssistantMessageId, (current) => ({
            ...current,
            content: event.content,
            citations: event.citations,
          }));
        } else if (event.type === "error") {
          setStreamError(event.message);
          const assistantMessage = queryClient
            .getQueryData<ChatMessageRecord[]>(["messages", stableThreadId])
            ?.find((entry) => entry.id === stableAssistantMessageId);
          if (!assistantMessage?.content.trim()) {
            removeThreadMessage(stableThreadId, stableAssistantMessageId);
          }
          void queryClient.invalidateQueries({ queryKey: ["messages", stableThreadId] });
        }
      });

      await queryClient.invalidateQueries({ queryKey: ["threads"] });
    } catch (error) {
      setStreamError(error instanceof Error ? error.message : "Failed to stream response.");
      if (threadId) {
        await queryClient.invalidateQueries({ queryKey: ["messages", threadId] });
      }
    } finally {
      setIsStreaming(false);
      setStreamingAssistantMessageId(null);
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    event.target.value = "";
    await uploadMutation.mutateAsync(file);
  }

  async function handleRemoveAttachedFile() {
    if (attachedFile) {
      await deleteMutation.mutateAsync(attachedFile.id);
    }
    clearAttachedFile();
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit(event as unknown as React.FormEvent<HTMLFormElement>);
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-[#f5f7fb] text-[#152235]">
      <div className="grid h-screen grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="flex h-full flex-col overflow-hidden border-r border-[#e2e8f0] bg-[#f8fafc]">
          <div className="flex flex-col px-5 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SigmaMark />
              </div>
            </div>

            <div className="mt-8">
              <p className="text-sm font-semibold text-[#213040]">Chat with Horo</p>
              <p className="mt-1 text-sm text-[#7b8ba1]">The Co-Pilot for your business</p>
            </div>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b9ab0]">Documents</p>
                <Badge>{documentItems.length}</Badge>
              </div>
              <label className="group flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-[#c8d5e4] bg-white p-4 transition hover:border-[#1f8fff] hover:bg-[#f8fbff]">
                <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.txt,.md" onChange={handleUpload} />
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef6ff] text-[#1f8fff] transition group-hover:scale-105 group-hover:bg-[#1f8fff] group-hover:text-white">
                  {uploadMutation.isPending ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-[#213040]">
                    {uploadMutation.isPending ? "Processing..." : "Upload document"}
                  </p>
                  <p className="mt-0.5 text-xs text-[#7b8ba1]">PDF, TXT, or MD files. Documents must finish processing before chat.</p>
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
                            <AlertDialogTrigger className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#7b8ba1] transition hover:bg-[#fee2e2] hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600/50">
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
                <Button size="sm" variant="outline" onClick={handleNewChat}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {threadItems.length ? (
                  threadItems.map((thread: ThreadRecord) => (
                    <div
                      key={thread.id}
                      className={cn(
                        "flex items-center justify-between rounded-2xl border px-4 py-3 transition",
                        activeThreadId === thread.id
                          ? "border-[#bfdbfe] bg-[#eef6ff] shadow-sm"
                          : "border-[#dbe4ef] bg-white hover:border-[#c4d4e7] hover:bg-[#fbfcfe]",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectThread(thread.id)}
                        className="min-w-0 flex-1 cursor-pointer text-left"
                      >
                        <p className="truncate text-sm font-medium text-[#213040]">{thread.title}</p>
                        <p className="mt-1 text-xs text-[#7b8ba1]">{new Date(thread.updated_at).toLocaleString()}</p>
                      </button>
                      <AlertDialog
                        open={openDeleteThreadId === thread.id}
                        onOpenChange={(open) => {
                          if (deletingThreadId === thread.id) {
                            return;
                          }
                          setOpenDeleteThreadId(open ? thread.id : null);
                        }}
                      >
                        <AlertDialogTrigger className="ml-2 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#7b8ba1] transition hover:bg-[#fee2e2] hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600/50">
                          <Trash2 className="h-4 w-4" />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-red-600" />
                              <AlertDialogTitle>Delete thread?</AlertDialogTitle>
                            </div>
                            <AlertDialogDescription>
                              This will permanently delete &quot;{thread.title}&quot; and all its messages. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={deletingThreadId === thread.id}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => void handleDeleteThread(thread.id)}
                              disabled={deletingThreadId === thread.id}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              {deletingThreadId === thread.id ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                "Delete"
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No threads yet" description="Create a thread to start a founder conversation with Horo." />
                )}
              </div>
            </section>
          </div>
        </aside>

        <main className="flex h-full flex-col overflow-hidden bg-[#f5f7fb]">
          <div className="flex flex-1 flex-col overflow-hidden px-4 py-5 sm:px-6 xl:px-10">
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b9ab0]">Horo Workspace</p>
                  <h1 className="mt-1 text-2xl font-semibold text-[#152235]">{activeThread?.title ?? "Select or create a thread"}</h1>
                </div>
                <Badge className="hidden sm:inline-flex">Grounded answers only</Badge>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto pb-6">
                {!messageItems.length ? (
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
                      <Card className={cn(entry.role === "assistant" ? "bg-white" : "border-[#cfe2ff] bg-[#eef6ff]") }>
                        <CardContent className="p-5">
                          {entry.role === "assistant" ? <AssistantEventPanels events={entry.metadata?.events ?? []} /> : null}
                          {entry.role === "assistant" ? (
                            <MarkdownMessage
                              content={
                                entry.id === streamingAssistantMessageId && isStreaming && !entry.content.trim()
                                  ? "Thinking..."
                                  : entry.content
                              }
                              citations={entry.citations}
                            />
                          ) : (
                            <p className="whitespace-pre-wrap text-sm leading-7 text-[#213040]">{entry.content}</p>
                          )}
                          {entry.role === "assistant" && !(isStreaming && entry.id === streamingAssistantMessageId) ? (
                            <SourcesPopover citations={entry.citations} />
                          ) : null}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ))}

                {streamError ? <p className="text-sm text-red-500">{streamError}</p> : null}
                <div ref={messagesEndRef} />
              </div>

              <Card className="sticky bottom-0 mt-auto border-[#bfd8f7] shadow-[0_16px_50px_rgba(63,94,139,0.08)]">
                <CardContent className="p-3">
                  <form className="space-y-3" onSubmit={handleSubmit}>
                    {attachedFile ? (
                      <div className="flex items-center justify-between rounded-xl border border-[#dbe4ef] bg-[#f8fbff] px-3 py-2 text-sm">
                        <div className="flex min-w-0 items-center gap-2 text-[#516074]">
                          {uploadMutation.isPending ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#1f8fff]" />
                          ) : attachedDocStatus === "ready" ? (
                            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                          ) : (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-500" />
                          )}
                          <FileText className="h-4 w-4 shrink-0 text-[#64748b]" />
                          <span className="truncate font-medium">{attachedFile.name}</span>
                          <span className="shrink-0 text-xs text-[#8b9ab0]">
                            {uploadMutation.isPending
                              ? "Uploading…"
                              : attachedDocStatus === "ready"
                                ? "Ready"
                                : "Processing…"}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 rounded-lg text-[#7b8ba1] hover:bg-red-50 hover:text-red-600"
                          onClick={() => void handleRemoveAttachedFile()}
                          disabled={deleteMutation.isPending || uploadMutation.isPending}
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ) : null}
                    <Textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      placeholder="Ask Horo about your uploaded documents..."
                      className="min-h-28 resize-none border-0 bg-transparent p-3 shadow-none focus:ring-0"
                      disabled={isStreaming}
                    />
                    <div className="flex items-center justify-between gap-4 border-t border-[#e8eef5] px-2 pt-3">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="rounded-xl text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1f8fff]"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadMutation.isPending || isFileProcessing}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSendDisabled || !message.trim()}
                        className="rounded-xl px-4"
                        size="icon"
                      >
                        {isStreaming ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="px-2 text-xs text-[#8b9ab0]">Press Enter to send. Press Shift + Enter for a new line.</p>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>

        <aside className="hidden h-full flex-col overflow-hidden border-l border-[#e2e8f0] bg-[#f7f9fc] xl:flex">
          <div className="flex h-full flex-col overflow-y-auto p-5">
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
