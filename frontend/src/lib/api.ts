export const API_BASE = (import.meta.env.VITE_API_BASE ?? "/api").replace(/\/$/, "");

export type DataQuality = {
  status?: string;
  integrity?: string;
  wal_mode?: string;
  snapshot_time?: string;
  [key: string]: unknown;
};

export type Profile = {
  username: string;
  display_name?: string;
  nickname?: string;
  remark?: string;
  alias?: string;
  avatar_url?: string;
};

export type ProfileResponse = {
  profile: Profile;
  stats?: Record<string, number | string | null>;
  data_quality?: DataQuality;
  snapshot_time?: string;
  metric_basis?: string;
};

export type HealthResponse = {
  status: "ok" | "setup_required" | string;
  configured?: boolean;
  detail?: string;
  database_root?: string;
  report_path?: string;
  missing?: string[];
  message_count?: number;
  snapshot_time?: string;
  data_quality?: DataQuality;
  [key: string]: unknown;
};

export type TrendPoint = { date: string; count: number; sent?: number; received?: number; episodes?: number };
export type Contact = {
  username: string;
  display_name?: string;
  avatar_url?: string;
  is_group?: boolean;
  message_count?: number;
  active_days?: number;
  first_interaction?: string;
  last_active?: string;
  sent_count?: number;
  received_count?: number;
  bidirectional_ratio?: number;
  response_median_seconds?: number;
  relationship_strength?: number;
  channels?: string[];
  summary?: string;
};

export type OverviewResponse = {
  profile?: Profile;
  kpis?: Record<string, number | string | null>;
  trend?: TrendPoint[];
  top_contacts?: Contact[];
  message_types?: Array<{ type: string; label?: string; count: number }>;
  recent_messages?: Array<Record<string, unknown>>;
  heatmap?: Array<{ date: string; count: number }>;
  snapshot_time?: string;
  metric_basis?: string;
};

export type ContactsResponse = {
  items: Contact[];
  total: number;
  snapshot_time?: string;
  metric_basis?: string;
};

export type GraphResponse = {
  nodes: Array<{ id: string; name: string; value: number; category?: string | number; avatar_url?: string }>;
  links: Array<{ source: string; target: string; value: number }>;
};

export type MediaItem = {
  id: string | number;
  kind: string;
  message_key?: string;
  file_name?: string;
  file_size?: number;
  modify_time?: string;
  create_time?: string;
  available?: boolean;
  resource_available?: boolean;
  browser_supported?: boolean;
  url?: string;
  thumbnail_url?: string;
  title?: string;
  source?: string;
  snippet?: string;
  confidence?: number;
  text?: string;
};

export type ChatSessionItem = {
  username: string;
  display_name: string;
  avatar_url?: string;
  is_group: boolean;
  message_count: number;
  active_days: number;
  last_active?: string;
  summary?: string;
  latest_category?: string;
  latest_is_self?: boolean;
  alias?: string;
  remark?: string;
  relationship_strength?: number;
};

export type ChatListResponse = {
  items: ChatSessionItem[];
  total: number;
  counts: { all: number; groups: number; contacts: number };
  scope: "all" | "groups" | "contacts";
  query?: string;
  snapshot_time?: string;
  metric_basis?: string;
};

export type MediaResponse = {
  counts?: Record<string, number>;
  items?: MediaItem[];
  keywords?: Array<{ word: string; count: number }>;
  topics?: Array<{ name: string; value: number }>;
  files?: MediaItem[];
  links?: MediaItem[];
  ocr?: MediaItem[];
  snapshot_time?: string;
  metric_basis?: string;
};

export type ContributionDay = {
  date: string;
  count: number;
  sent?: number;
  received?: number;
  quoted?: number;
  quality?: number;
};

export type ContributionsResponse = {
  year: number;
  available_years?: number[];
  kpis?: Record<string, number>;
  heatmap?: ContributionDay[];
  selected_day?: Record<string, unknown>;
  snapshot_time?: string;
  metric_basis?: string;
};

export type ConversationEpisode = {
  id: string | number;
  date: string;
  start_time?: string;
  end_time?: string;
  session_username?: string;
  session_name?: string;
  avatar_url?: string;
  message_count?: number;
  turn_count?: number;
  summary?: string;
  categories?: string[];
  media?: MediaItem[];
};

export type ConversationsResponse = {
  items: ConversationEpisode[];
  total: number;
  hourly?: Array<{ hour: number; count: number }>;
  trend?: TrendPoint[];
  top_quoted?: Array<Record<string, unknown>>;
  kpis?: Record<string, number | string | null>;
  snapshot_time?: string;
  metric_basis?: string;
};

export type ConversationMessage = {
  id: string;
  session_username?: string;
  session_name?: string;
  sender_username?: string;
  sender_name?: string;
  avatar_url?: string;
  create_time?: string;
  timestamp?: number;
  summary?: string;
  content?: string;
  category?: string;
  decoded?: boolean;
  decode_error?: string;
  local_type?: number;
  base_type?: number;
  app_subtype?: number;
  title?: string;
  description?: string;
  url?: string;
  file_name?: string;
  file_size?: number;
  is_self?: boolean;
  quote_count?: number;
  reference?: { server_id?: string | number; from_username?: string; chat_username?: string; display_name?: string; content?: string } | null;
  resources?: MediaItem[];
};

export type ConversationDetailResponse = {
  episode: Record<string, unknown>;
  messages: ConversationMessage[];
  resources?: MediaItem[];
  snapshot_time?: string;
};

export type ChatSessionDetailResponse = {
  session: ChatSessionItem & {
    alias?: string;
    remark?: string;
    nickname?: string;
    remote_avatar_available?: boolean;
    first_interaction?: string;
    sent_count?: number;
    received_count?: number;
    bidirectional_ratio?: number;
    tags?: string[];
  };
  messages: ConversationMessage[];
  files: ConversationMessage[];
  year: number;
  available_years: number[];
  heatmap: Array<{ date: string; count: number; sent?: number; received?: number }>;
  stats: { messages: number; quality: number; quoted: number; active_days: number };
  selected_day: {
    date?: string;
    messages: number;
    sent: number;
    received: number;
    quality: number;
    quoted: number;
    speakers: number;
    first_time?: string;
    last_time?: string;
  };
  categories: Array<{ category: string; count: number }>;
  snapshot_time?: string;
  metric_basis?: string;
};

export type MessageDetailResponse = ConversationMessage & {
  referenced_message?: ConversationMessage | null;
};

export type SearchResponse = {
  query: string;
  items: Array<Record<string, unknown>>;
  fts_used?: boolean;
  errors?: string[];
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function fetchApi<T>(path: string, params?: Record<string, string | number | boolean | undefined | null>, signal?: AbortSignal): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json() as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // Preserve the HTTP status when a proxy returns a non-JSON error body.
    }
    throw new ApiError(response.status, detail);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: (signal?: AbortSignal) => fetchApi<HealthResponse>("/health", undefined, signal),
  profile: (signal?: AbortSignal) => fetchApi<ProfileResponse>("/profile", undefined, signal),
  overview: (days = 30, signal?: AbortSignal) => fetchApi<OverviewResponse>("/overview", { days }, signal),
  contacts: (params: Record<string, string | number | undefined> = {}, signal?: AbortSignal) => fetchApi<ContactsResponse>("/contacts", params, signal),
  graph: (limit = 30, signal?: AbortSignal) => fetchApi<GraphResponse>("/contacts/graph", { limit }, signal),
  chatList: (params: Record<string, string | number | undefined> = {}, signal?: AbortSignal) => fetchApi<ChatListResponse>("/chat-list", params, signal),
  chatSession: (username: string, params: Record<string, string | number | undefined> = {}, signal?: AbortSignal) => fetchApi<ChatSessionDetailResponse>(`/chat-list/${encodeURIComponent(username)}`, params, signal),
  media: (params: Record<string, string | number | undefined> = {}, signal?: AbortSignal) => fetchApi<MediaResponse>("/media", params, signal),
  contributions: (year: number, date?: string, signal?: AbortSignal) => fetchApi<ContributionsResponse>("/contributions", { year, date }, signal),
  conversations: (params: Record<string, string | number | undefined> = {}, signal?: AbortSignal) => fetchApi<ConversationsResponse>("/conversations", params, signal),
  conversation: (id: string | number, signal?: AbortSignal) => fetchApi<ConversationDetailResponse>(`/conversations/${encodeURIComponent(String(id))}`, undefined, signal),
  message: (id: string, signal?: AbortSignal) => fetchApi<MessageDetailResponse>(`/messages/${encodeURIComponent(id)}`, undefined, signal),
  search: (q: string, scope = "all", signal?: AbortSignal) => fetchApi<SearchResponse>("/search", { q, scope, limit: 50 }, signal),
};

export function conversationExportUrl(format: "csv" | "json" | "html", params: Record<string, string | undefined>): string {
  const url = new URL(`${API_BASE}/conversations/export`, window.location.origin);
  url.searchParams.set("format", format);
  Object.entries(params).forEach(([key, value]) => { if (value) url.searchParams.set(key, value); });
  return `${url.pathname}${url.search}`;
}

export function assetUrl(value?: string): string | undefined {
  if (!value) return undefined;
  if (/^(https?:|data:|blob:)/.test(value)) return value;
  if (value.startsWith("/")) return value;
  return `${API_BASE}/${value.replace(/^\/+/, "")}`;
}

export function externalUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
