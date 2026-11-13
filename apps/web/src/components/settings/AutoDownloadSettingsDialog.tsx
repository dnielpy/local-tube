"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, queryKeys, type AutoDownloadSettings } from "@/lib/api";
import { formatClock, nextAt, qualityName } from "@/lib/format";

import { BoltIcon } from "../icons";
import { ChannelPicker, ChannelsOption, Option, Select, SettingsDialog } from "./SettingsDialog";

const QUALITIES = [2160, 1440, 1080, 720, 480, 360, 240, 144];
const PER_CHANNEL = [1, 2, 3, 5, 10, 15, 20, 30];
const TIMES = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  return `${hours}:${index % 2 ? "30" : "00"}`;
});

/** The auto-download options of the profile: quality, start hour, videos per channel, channels. */
export function AutoDownloadSettingsDialog({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const settings = useQuery({
    queryKey: queryKeys.autoDownloadSettings,
    queryFn: api.autoDownloadSettings,
  });
  const channels = useQuery({
    queryKey: queryKeys.autoDownloadChannels,
    queryFn: api.autoDownloadChannels,
  });
  const [draft, setDraft] = useState<AutoDownloadSettings | null>(null);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [view, setView] = useState<"options" | "channels">("options");

  const all = (channels.data ?? []).filter((channel) => channel.id);
  const values = draft ?? settings.data;
  const selected =
    picked ?? new Set(all.filter((channel) => channel.enabled).map((channel) => channel.id!));

  const save = useMutation({
    mutationFn: async () => {
      if (values) {
        client.setQueryData(
          queryKeys.autoDownloadSettings,
          await api.setAutoDownloadSettings(values),
        );
      }
      if (picked) {
        client.setQueryData(
          queryKeys.autoDownloadChannels,
          await api.setAutoDownloadChannels([...picked]),
        );
      }
    },
    onSuccess: onClose,
  });

  const change = (patch: Partial<AutoDownloadSettings>) =>
    values && setDraft({ ...values, ...patch });

  return (
    <SettingsDialog
      title="Autodescarga de videos"
      icon={BoltIcon}
      intro="Con el botón ⚡ de la barra de arriba, LocalTube busca los videos nuevos de tus canales y te los propone para descargar."
      heading={view === "channels" ? "Canales" : "Opciones"}
      onBack={view === "channels" ? () => setView("options") : undefined}
      onClose={onClose}
      loading={!values || channels.isPending}
      failed={settings.isError || channels.isError}
      saveFailed={save.isError}
      saving={save.isPending}
      onSave={() => save.mutate()}
    >
      {!values ? null : view === "channels" ? (
        <ChannelPicker all={all} selected={selected} onChange={setPicked} />
      ) : (
        <div className="divide-y divide-yt-divider">
          <Option
            title="Calidad de descarga"
            description="La que se elige por defecto para cada video. Si no la tiene, la más cercana por debajo."
          >
            <Select
              label="Calidad de descarga"
              value={String(values.max_height)}
              onChange={(value) => change({ max_height: Number(value) })}
              options={QUALITIES.map((height) => [
                String(height),
                `${height}p · ${qualityName(height)}`,
              ])}
            />
          </Option>
          <Option
            title="Hora de inicio"
            description={
              values.start_time
                ? `Los videos que elijas quedan programados y empiezan a bajar a las ${formatClock(nextAt(values.start_time))}.`
                : "Los videos que elijas empiezan a bajar en cuanto los añades."
            }
          >
            <Select
              label="Hora de inicio"
              value={values.start_time ?? ""}
              onChange={(value) => change({ start_time: value || null })}
              options={[
                ["", "Al momento"],
                ...TIMES.map((time) => [time, formatClock(nextAt(time))] as [string, string]),
              ]}
            />
          </Option>
          <Option
            title="Videos por canal"
            description="Como máximo, de los publicados después del último que tienes. Si no tienes ninguno del canal, solo el último."
          >
            <Select
              label="Videos por canal"
              value={String(values.per_channel)}
              onChange={(value) => change({ per_channel: Number(value) })}
              options={PER_CHANNEL.map((count) => [String(count), String(count)])}
            />
          </Option>
          <ChannelsOption
            description="Los canales cuyos videos nuevos se buscan."
            count={selected.size}
            onOpen={() => setView("channels")}
          />
        </div>
      )}
    </SettingsDialog>
  );
}
