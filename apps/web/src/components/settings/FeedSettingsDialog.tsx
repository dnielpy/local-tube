"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, queryKeys, type FeedSettings } from "@/lib/api";

import { FeedIcon } from "../icons";
import { ChannelPicker, ChannelsOption, Option, Select, SettingsDialog } from "./SettingsDialog";

const REFRESH_HOURS = [1, 2, 3, 6, 12, 24];

/** The feed options of the profile: its channels and how often it is refreshed. */
export function FeedSettingsDialog({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const settings = useQuery({ queryKey: queryKeys.feedSettings, queryFn: api.feedSettings });
  const channels = useQuery({ queryKey: queryKeys.feedChannels, queryFn: api.feedChannels });
  const [draft, setDraft] = useState<FeedSettings | null>(null);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [view, setView] = useState<"options" | "channels">("options");

  const all = (channels.data ?? []).filter((channel) => channel.id);
  const values = draft ?? settings.data;
  const selected =
    picked ?? new Set(all.filter((channel) => channel.enabled).map((channel) => channel.id!));

  const save = useMutation({
    mutationFn: async () => {
      if (values) {
        client.setQueryData(queryKeys.feedSettings, await api.setFeedSettings(values));
      }
      if (picked) {
        client.setQueryData(queryKeys.feedChannels, await api.setFeedChannels([...picked]));
      }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.feed });
      onClose();
    },
  });

  return (
    <SettingsDialog
      title="Feed"
      icon={FeedIcon}
      intro="Al entrar en LocalTube ves el último video de cada canal del feed, y cuáles ya tienes descargados. Sin conexión ves tus descargas."
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
            title="Actualizar cada"
            description="LocalTube busca solo los videos nuevos de tus canales con esta frecuencia. Con el botón ↻ de arriba lo haces al momento."
          >
            <Select
              label="Actualizar cada"
              value={String(values.refresh_hours)}
              onChange={(value) => setDraft({ ...values, refresh_hours: Number(value) })}
              options={REFRESH_HOURS.map((hours) => [
                String(hours),
                hours === 1 ? "1 hora" : `${hours} horas`,
              ])}
            />
          </Option>
          <ChannelsOption
            description="Los canales cuyo último video aparece en el feed."
            count={selected.size}
            onOpen={() => setView("channels")}
          />
        </div>
      )}
    </SettingsDialog>
  );
}
