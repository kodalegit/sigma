import type { ChatMessageRecord, DocumentRecord, StreamEvent, ThreadRecord } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function listDocuments(): Promise<DocumentRecord[]> {
  return request<DocumentRecord[]>("/documents");
}

export function listThreads(): Promise<ThreadRecord[]> {
  return request<ThreadRecord[]>("/chat/threads");
}

export function listMessages(threadId: string): Promise<ChatMessageRecord[]> {
  return request<ChatMessageRecord[]>(`/chat/threads/${threadId}/messages`);
}

export function createThread(title: string): Promise<ThreadRecord> {
  return request<ThreadRecord>("/chat/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export async function uploadDocument(file: File): Promise<{ chunks_indexed: number; document: DocumentRecord }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Upload failed: ${response.status}`);
  }

  return response.json() as Promise<{ chunks_indexed: number; document: DocumentRecord }>;
}

export async function deleteDocument(documentId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Delete failed: ${response.status}`);
  }
}

export async function deleteThread(threadId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/chat/threads/${threadId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Delete failed: ${response.status}`);
  }
}

export async function streamChat(
  threadId: string,
  message: string,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ thread_id: threadId, message }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text();
    throw new Error(detail || `Stream failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function emitChunk(chunk: string) {
    const data = chunk
      .split("\n")
      .filter((entry) => entry.startsWith("data:"))
      .map((entry) => entry.slice(5).trimStart())
      .join("\n");

    if (!data) {
      return;
    }

    onEvent(JSON.parse(data) as StreamEvent);
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      emitChunk(part);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    emitChunk(buffer);
  }
}
