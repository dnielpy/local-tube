import { channelColor, channelInitial } from "@/lib/format";

export function ChannelAvatar({ name, size = 36 }: { name: string | null; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-medium text-white select-none"
      style={{ width: size, height: size, background: channelColor(name), fontSize: size * 0.45 }}
      aria-hidden="true"
    >
      {channelInitial(name)}
    </span>
  );
}
