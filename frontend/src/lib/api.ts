import type {
  AuthenticatedUser,
  ChatMessageRecord,
  DemoUserCredentials,
  DocumentRecord,
  LoginResponse,
  StreamEvent,
  ThreadRecord,
} from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

let authToken: string | null = null;

function buildHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }
  return headers;
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: buildHeaders(init?.headers),
    cache: "no-store",
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    let message = response.statusText || "Request failed";

    try {
      if (contentType.includes("application/json")) {
        const data = (await response.json()) as { detail?: string; message?: string };
        message = data?.detail || data?.message || message;
      } else {
        const text = await response.text();
        const stripped = text.replace(/<[^>]*>?/gm, "").trim();
        if (stripped) {
          message = stripped.slice(0, 280);
        }
      }
    } catch (error) {
      console.error("Failed to parse error response", error);
    }

    throw new Error(`${message} (status ${response.status})`);
  }

  return response.json();
}

export function listDemoUsers(): Promise<{ users: DemoUserCredentials[] }> {
  return request<{ users: DemoUserCredentials[] }>("/auth/test-users");
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function getCurrentUser(): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>("/auth/me");
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
    headers: buildHeaders(),
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
    headers: buildHeaders(),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Delete failed: ${response.status}`);
  }
}

export async function deleteThread(threadId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/chat/threads/${threadId}`, {
    method: "DELETE",
    headers: buildHeaders(),
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
    headers: buildHeaders({ "Content-Type": "application/json" }),
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
