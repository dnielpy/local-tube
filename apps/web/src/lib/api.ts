import type { components } from "./api-types";

export type Video = components["schemas"]["VideoOut"];
export type VideoPage = components["schemas"]["VideoPage"];
export type DownloadJob = components["schemas"]["DownloadJobOut"];
export type JobStatus = DownloadJob["status"];

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
  videos: (params: { q?: string; channel?: string; limit?: number } = {}) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") search.set(key, String(value));
    }
    const query = search.toString();
    return request<VideoPage>(`/videos${query ? `?${query}` : ""}`);
  },
  channels: () => request<string[]>("/videos/channels"),
  video: (id: string) => request<Video>(`/videos/${id}`),
  deleteVideo: (id: string) => request<void>(`/videos/${id}`, { method: "DELETE" }),
  downloads: () => request<DownloadJob[]>("/downloads"),
  createDownload: (url: string) =>
    request<DownloadJob>("/downloads", { method: "POST", body: JSON.stringify({ url }) }),
  retryDownload: (id: string) => request<DownloadJob>(`/downloads/${id}/retry`, { method: "POST" }),
  deleteDownload: (id: string) => request<void>(`/downloads/${id}`, { method: "DELETE" }),
};

export const queryKeys = {
  videos: (params: object = {}) => ["videos", params] as const,
  allVideos: ["videos"] as const,
  channels: ["channels"] as const,
  video: (id: string) => ["video", id] as const,
  downloads: ["downloads"] as const,
};
