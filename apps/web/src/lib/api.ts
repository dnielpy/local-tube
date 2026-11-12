import type { components } from "./api-types";

export type Video = components["schemas"]["VideoOut"];
export type VideoPage = components["schemas"]["VideoPage"];
export type DownloadJob = components["schemas"]["DownloadJobOut"];
export type JobStatus = DownloadJob["status"];
export type Channel = components["schemas"]["ChannelOut"];
export type ChannelList = components["schemas"]["ChannelList"];
export type ChannelDetail = components["schemas"]["ChannelDetail"];
export type RemoteVideo = components["schemas"]["RemoteVideoOut"];
export type RemoteVideoPage = components["schemas"]["RemoteVideoPage"];
export type Status = components["schemas"]["StatusOut"];
export type VideoFormats = components["schemas"]["VideoFormatsOut"];
export type Profile = components["schemas"]["ProfileOut"];
export type CookieStatus = components["schemas"]["CookieStatusOut"];
export type HistoryPage = components["schemas"]["HistoryPage"];
export type HistoryEntry = components["schemas"]["HistoryEntryOut"];
export type WatchProgress = components["schemas"]["WatchProgressOut"];
export type Playlist = components["schemas"]["PlaylistOut"];
export type PlaylistDetail = components["schemas"]["PlaylistDetail"];

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: unknown,
  ) {
    super(errorMessage(detail) ?? `Request failed with status ${status}`);
  }
}

function errorMessage(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in detail) {
    return String(detail.message);
  }
  return undefined;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.detail);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export const api = {
  profiles: () => request<Profile[]>("/profiles"),
  session: () => request<Profile>("/session"),
  logout: () => request<void>("/session", { method: "DELETE" }),
  cookieStatus: () => request<CookieStatus>("/session/cookies"),
  createProfile: (body: { name: string; pin: string; cookies: string }) =>
    request<Profile>("/profiles", { method: "POST", body: JSON.stringify(body) }),
  unlockProfile: (id: string, pin: string) =>
    request<Profile>(`/profiles/${id}/unlock`, { method: "POST", body: JSON.stringify({ pin }) }),
  deleteProfile: (id: string, pin: string) =>
    request<void>(`/profiles/${id}`, { method: "DELETE", body: JSON.stringify({ pin }) }),
  updateCookies: (id: string, cookies: string) =>
    request<Profile>(`/profiles/${id}/cookies`, {
      method: "PUT",
      body: JSON.stringify({ cookies }),
    }),
  videos: (params: { q?: string; channel?: string; limit?: number } = {}) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") search.set(key, String(value));
    }
    const query = search.toString();
    return request<VideoPage>(`/videos${query ? `?${query}` : ""}`);
  },
  downloadedChannels: () => request<string[]>("/videos/channels"),
  status: () => request<Status>("/status"),
  setForcedOffline: (forcedOffline: boolean) =>
    request<Status>("/status", {
      method: "PUT",
      body: JSON.stringify({ forced_offline: forcedOffline }),
    }),
  channels: () => request<ChannelList>("/channels"),
  syncChannels: () => request<ChannelList>("/channels/sync", { method: "POST" }),
  channel: (id: string, refresh = false) =>
    request<ChannelDetail>(`/channels/${encodeURIComponent(id)}${refresh ? "?refresh=true" : ""}`),
  channelVideos: (id: string, offset: number) =>
    request<RemoteVideoPage>(`/channels/${encodeURIComponent(id)}/videos?offset=${offset}`),
  video: (id: string) => request<Video>(`/videos/${id}`),
  history: (params: { q?: string; limit?: number } = {}) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.limit) search.set("limit", String(params.limit));
    const query = search.toString();
    return request<HistoryPage>(`/history${query ? `?${query}` : ""}`);
  },
  watchProgress: () => request<WatchProgress[]>("/history/progress"),
  recordWatch: (id: string, position: number, duration: number | null) =>
    request<void>(`/history/${id}`, {
      method: "PUT",
      body: JSON.stringify({ position, duration }),
      keepalive: true,
    }),
  forgetWatch: (id: string) => request<void>(`/history/${id}`, { method: "DELETE" }),
  clearHistory: () => request<void>("/history", { method: "DELETE" }),
  playlists: (videoId?: string) =>
    request<Playlist[]>(`/playlists${videoId ? `?video_id=${videoId}` : ""}`),
  playlist: (id: string) => request<PlaylistDetail>(`/playlists/${id}`),
  createPlaylist: (name: string) =>
    request<Playlist>("/playlists", { method: "POST", body: JSON.stringify({ name }) }),
  renamePlaylist: (id: string, name: string) =>
    request<Playlist>(`/playlists/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deletePlaylist: (id: string) => request<void>(`/playlists/${id}`, { method: "DELETE" }),
  addToPlaylist: (id: string, videoId: string) =>
    request<void>(`/playlists/${id}/videos/${videoId}`, { method: "PUT" }),
  removeFromPlaylist: (id: string, videoId: string) =>
    request<void>(`/playlists/${id}/videos/${videoId}`, { method: "DELETE" }),
  deleteVideo: (id: string) => request<void>(`/videos/${id}`, { method: "DELETE" }),
  downloads: () => request<DownloadJob[]>("/downloads"),
  formats: (url: string) =>
    request<VideoFormats>(`/downloads/formats?url=${encodeURIComponent(url)}`),
  createDownload: ({ url, maxHeight }: { url: string; maxHeight: number | null }) =>
    request<DownloadJob>("/downloads", {
      method: "POST",
      body: JSON.stringify({ url, max_height: maxHeight }),
    }),
  cancelDownload: (id: string) =>
    request<DownloadJob>(`/downloads/${id}/cancel`, { method: "POST" }),
  retryDownload: (id: string) => request<DownloadJob>(`/downloads/${id}/retry`, { method: "POST" }),
  deleteDownload: (id: string) => request<void>(`/downloads/${id}`, { method: "DELETE" }),
};

export const queryKeys = {
  session: ["session"] as const,
  profiles: ["profiles"] as const,
  cookieStatus: ["cookie-status"] as const,
  history: (q: string, limit: number) => ["history", q, limit] as const,
  allHistory: ["history"] as const,
  watchProgress: ["watch-progress"] as const,
  playlists: (videoId?: string) => ["playlists", videoId ?? null] as const,
  allPlaylists: ["playlists"] as const,
  playlist: (id: string) => ["playlist", id] as const,
  videos: (params: object = {}) => ["videos", params] as const,
  allVideos: ["videos"] as const,
  channels: ["channels"] as const,
  downloadedChannels: ["downloaded-channels"] as const,
  status: ["status"] as const,
  channel: (id: string) => ["channel", id] as const,
  allChannels: ["channel"] as const,
  video: (id: string) => ["video", id] as const,
  downloads: ["downloads"] as const,
  formats: (url: string) => ["formats", url] as const,
};
