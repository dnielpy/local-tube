import type { Video } from "@/lib/api";
import { formatDuration } from "@/lib/format";

export function Thumbnail({
  video,
  rounded = "rounded-xl",
  progress,
}: {
  video: Video;
  rounded?: string;
  progress?: number;
}) {
  return (
    <div className={`relative aspect-video w-full overflow-hidden bg-yt-skeleton ${rounded}`}>
      {video.thumbnail_url && (
        <img
          src={video.thumbnail_url}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {video.duration_seconds != null && (
        <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1 py-[1px] text-xs leading-[18px] font-medium text-white">
          {formatDuration(video.duration_seconds)}
        </span>
      )}
      {progress != null && progress > 0 && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-[#717171]/60">
          <div
            className="h-full bg-yt-brand"
            style={{ width: `${Math.min(progress, 1) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
