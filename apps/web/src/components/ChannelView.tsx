"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { browser } from "react-dom";

import { api, ApiError, queryKeys, type ChannelDetail } from "@/lib/api";
import { formatCount, timeAgo } from "@/lib/format";

import { ChannelPhoto } from "./ChannelPhoto";
import { GRID, GridSkeleton } from "./HomeFeed";
import { CheckIcon, ExternalIcon, RetryIcon } from "./icons";
import { RemoteVideoCard, useDownloadJobs } from "./RemoteVideoCard";
import { VideoCard } from "./VideoCard";

type Tab = "videos" | "downloaded";

export function ChannelView() {
  use(browser("Channel data is fetched from the api in the browser."));
  const id = decodeURIComponent(useParams<{ id: string }>().id);
  const client = useQueryClient();
  const channel = useQuery({
    queryKey: queryKeys.channel(id),
    queryFn: () => api.channel(id),
    refetchInterval: (query) => (query.state.data?.refreshing ? 2000 : false),
  });
  const refresh = useMutation({
    mutationFn: () => api.channel(id, true),
    onSuccess: (data) => client.setQueryData(queryKeys.channel(id), data),
  });

  const jobs = useDownloadJobs();
  const completed = jobs.data?.filter((job) => job.status === "completed").length ?? 0;
  const seen = useRef(completed);
  useEffect(() => {
    if (completed > seen.current) {
      client.invalidateQueries({ queryKey: queryKeys.channel(id) });
      client.invalidateQueries({ queryKey: queryKeys.allVideos });
    }
    seen.current = completed;
  }, [completed, client, id]);

  const data = channel.data;
  useEffect(() => {
    if (data?.known) document.title = `${data.name} - LocalTube`;
  }, [data?.known, data?.name]);

  if (channel.isError) {
    const notFound = channel.error instanceof ApiError && channel.error.status === 404;
    return (
      <div className="flex flex-col items-center px-4 py-24 text-center">
        <h1 className="text-2xl">Este canal no está disponible</h1>
        <p className="mt-2 text-yt-text-secondary">
          {notFound
            ? "No hay información guardada de este canal. Conéctate para cargarla."
            : "No se pudo cargar el canal."}
        </p>
        <Link
          href="/"
          className="mt-6 flex h-9 items-center rounded-full bg-yt-cta-bg px-4 text-sm font-medium text-yt-cta-text"
        >
          Ir al inicio
        </Link>
      </div>
    );
  }

  if (!data || (!data.known && data.refreshing && data.downloaded.length === 0)) {
    return <ChannelSkeleton />;
  }

  return (
    <ChannelPage
      key={id}
      data={data}
      refreshing={data.refreshing || refresh.isPending}
      onRefresh={() => refresh.mutate()}
    />
  );
}

function ChannelPage({
  data,
  refreshing,
  onRefresh,
}: {
  data: ChannelDetail;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [chosen, setChosen] = useState<Tab | null>(null);
  const [expanded, setExpanded] = useState(false);
  const tabs: Tab[] = data.online ? ["videos", "downloaded"] : ["downloaded"];
  const tab = chosen && tabs.includes(chosen) ? chosen : tabs[0];

  const meta = [
    data.handle,
    formatCount(data.subscriber_count, "suscriptores"),
    data.downloaded.length > 0
      ? `${data.downloaded.length} ${data.downloaded.length === 1 ? "video descargado" : "videos descargados"}`
      : null,
  ].filter(Boolean);

  const pill =
    "flex h-9 shrink-0 items-center gap-[6px] rounded-full px-4 text-sm font-medium disabled:opacity-50";

  return (
    <div className="mx-auto max-w-[1284px] px-4 pb-10 search:px-6">
      {data.banner_url && (
        <div className="mt-4 aspect-[6.2/1] w-full overflow-hidden rounded-2xl bg-yt-skeleton">
          <img src={data.banner_url} alt="" className="size-full object-cover" />
        </div>
      )}

      <header className="mt-4 flex items-center gap-4">
        <div className="hidden mini:block">
          <ChannelPhoto src={data.avatar_url} name={data.name} size={160} />
        </div>
        <div className="mini:hidden">
          <ChannelPhoto src={data.avatar_url} name={data.name} size={72} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl leading-8 font-bold break-words mini:text-[36px] mini:leading-[50px]">
            {data.name}
          </h1>
          {meta.length > 0 && (
            <p className="mt-1 text-sm text-yt-text-secondary">
              {meta.map((part, index) => (
                <span key={index}>
                  {index > 0 && <span className="px-1">·</span>}
                  <span className={index === 0 && data.handle ? "font-medium text-yt-text" : ""}>
                    {part}
                  </span>
                </span>
              ))}
            </p>
          )}
          {data.description && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className={`mt-2 max-w-[680px] text-left text-sm text-yt-text-secondary ${
                expanded ? "block" : "flex items-baseline gap-1"
              }`}
            >
              <span className={expanded ? "whitespace-pre-wrap" : "min-w-0 truncate"}>
                {data.description}
              </span>
              <span className="shrink-0 font-medium text-yt-text">
                {expanded ? " Mostrar menos" : "...más"}
              </span>
            </button>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {data.subscribed && (
              <span className={`${pill} bg-yt-surface`}>
                <CheckIcon size={20} />
                Suscrito
              </span>
            )}
            <a
              href={data.youtube_url}
              target="_blank"
              rel="noreferrer"
              className={`${pill} bg-yt-surface hover:bg-yt-surface-hover`}
            >
              <ExternalIcon size={20} />
              Ver en YouTube
            </a>
            {data.online && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className={`${pill} bg-yt-surface hover:bg-yt-surface-hover`}
              >
                <RetryIcon size={20} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Actualizando…" : "Actualizar"}
              </button>
            )}
          </div>
        </div>
      </header>

      <nav className="mt-4 flex border-b border-yt-divider" role="tablist">
        {tabs.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setChosen(value)}
            className={`-mb-px h-12 border-b-2 px-3 text-base font-medium ${
              tab === value
                ? "border-yt-text text-yt-text"
                : "border-transparent text-yt-text-secondary hover:border-yt-text-secondary hover:text-yt-text"
            }`}
          >
            {value === "videos" ? "Videos" : "Descargados"}
          </button>
        ))}
        {!data.online && (
          <span className="ml-auto self-center text-xs text-yt-text-secondary">
            Sin conexión: solo lo descargado
          </span>
        )}
      </nav>

      <div className="pt-6">
        {tab === "videos" ? (
          data.latest.length > 0 ? (
            <>
              {data.latest_fetched_at && (
                <p className="mb-4 text-xs text-yt-text-secondary">
                  Actualizado {timeAgo(data.latest_fetched_at)}
                </p>
              )}
              <div className={GRID}>
                {data.latest.map((video) => (
                  <RemoteVideoCard key={video.youtube_id} video={video} channelId={data.id} />
                ))}
              </div>
            </>
          ) : refreshing ? (
            <GridSkeleton />
          ) : (
            <p className="py-16 text-center text-sm text-yt-text-secondary">
              No se pudieron cargar los videos de este canal.
            </p>
          )
        ) : data.downloaded.length > 0 ? (
          <div className={GRID}>
            {data.downloaded.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-yt-text-secondary">
            Todavía no has descargado videos de este canal.
          </p>
        )}
      </div>
    </div>
  );
}

export function ChannelSkeleton() {
  return (
    <div className="mx-auto max-w-[1284px] px-4 pb-10 search:px-6">
      <div className="yt-skeleton mt-4 aspect-[6.2/1] w-full rounded-2xl" />
      <div className="mt-4 flex items-center gap-4">
        <div className="yt-skeleton size-[72px] shrink-0 rounded-full mini:size-40" />
        <div className="flex-1 space-y-3">
          <div className="yt-skeleton h-9 w-64 rounded" />
          <div className="yt-skeleton h-4 w-80 rounded" />
          <div className="yt-skeleton h-9 w-40 rounded-full" />
        </div>
      </div>
      <div className="mt-10">
        <GridSkeleton />
      </div>
    </div>
  );
}
