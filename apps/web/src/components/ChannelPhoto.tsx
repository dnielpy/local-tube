import { ChannelAvatar } from "./ChannelAvatar";

export function ChannelPhoto({
  src,
  name,
  size = 36,
}: {
  src?: string | null;
  name: string | null;
  size?: number;
}) {
  if (!src) return <ChannelAvatar name={name} size={size} />;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-full bg-yt-skeleton object-cover"
      style={{ width: size, height: size }}
    />
  );
}
