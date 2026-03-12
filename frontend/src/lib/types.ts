export type DocumentRecord = {
  id: string;
  user_id: string;
  filename: string;
  title: string;
  mime_type: string;
  status: string;
  created_at: string;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  tenant_name: string;
  created_at: string;
};

export type DemoUserCredentials = {
  id: string;
  email: string;
  password: string;
  tenant_name: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  expires_at: string;
  user: AuthenticatedUser;
};

export type ThreadRecord = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ChatEventRecord =
  | { type: "title"; title: string }
  | { type: "reasoning"; content: string }
  | { type: "tool_start"; tool: string; tool_call_id: string; input?: Record<string, unknown> }
  | { type: "tool_end"; tool: string; tool_call_id: string; summary: string }
  | { type: "citation"; marker: number; doc_id: string; title: string; excerpt: string; chunk_id: string; page?: number | null; category?: string };

export type ChatMessageRecord = {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  metadata?: {
    events?: ChatEventRecord[];
  };
  created_at: string;
};

export type Citation = {
  marker: number;
  doc_id: string;
  title: string;
  category?: string;
  excerpt: string;
  chunk_id: string;
  page?: number | null;
};

export type StreamEvent =
  | { type: "title"; title: string }
  | { type: "reasoning"; content: string }
  | { type: "token"; delta: string }
  | { type: "tool_start"; tool: string; tool_call_id: string; input?: Record<string, unknown> }
  | { type: "tool_end"; tool: string; tool_call_id: string; summary: string }
  | { type: "citation"; marker: number; doc_id: string; title: string; excerpt: string; chunk_id: string; page?: number | null; category?: string }
  | { type: "done"; content: string; citations: Citation[] }
  | { type: "error"; message: string; code: string };
