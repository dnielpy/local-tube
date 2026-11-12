import type { Profile } from "@/lib/api";

const COLORS = ["#e50914", "#2b7bff", "#f5a623", "#22a06b", "#8e44ad", "#e2557c"];

function color(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function ProfileAvatar({
  profile,
  size,
  rounded = "rounded-md",
}: {
  profile: Pick<Profile, "name" | "avatar_url">;
  size: number;
  rounded?: string;
}) {
  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 bg-yt-skeleton object-cover ${rounded}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center font-medium text-white ${rounded}`}
      style={{ width: size, height: size, background: color(profile.name), fontSize: size * 0.42 }}
    >
      {profile.name.charAt(0).toUpperCase()}
    </span>
  );
}
