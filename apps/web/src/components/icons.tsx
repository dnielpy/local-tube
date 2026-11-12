import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function icon(path: string, viewBox = "0 0 24 24") {
  function Icon({ size = 24, ...props }: IconProps) {
    return (
      <svg
        viewBox={viewBox}
        width={size}
        height={size}
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        <path d={path} fillRule="evenodd" />
      </svg>
    );
  }
  return Icon;
}

// Guide and header icons, 24px, matching the outlined set youtube.com uses.
export const MenuIcon = icon("M21 6H3V5h18v1zm0 5H3v1h18v-1zm0 6H3v1h18v-1z");
export const HomeIcon = icon(
  "M12 4.44l7 6.09V20h-4v-6H9v6H5v-9.47l7-6.09m0-1.32l-8 6.96V21h6v-6h4v6h6V10.08l-8-6.96z",
);
export const HomeFilledIcon = icon("M4 21V10.08l8-6.96 8 6.96V21h-6v-6h-4v6H4z");
export const DownloadIcon = icon(
  "M17 18v1H6v-1h11zm-.5-6.6-.7-.7-3.8 3.7V4h-1v10.4l-3.8-3.8-.7.7 5 5 5-4.9z",
);
export const DownloadFilledIcon = icon(
  "M17 18v2H6v-2h11zm-.59-7.41L15 9.17l-2 2V4h-2v7.17l-2-2-1.41 1.42L12 15l4.41-4.41z",
);
export const SearchIcon = icon(
  "M20.87 20.17l-5.59-5.59C16.35 13.35 17 11.75 17 10c0-3.87-3.13-7-7-7s-7 3.13-7 7 3.13 7 7 7c1.75 0 3.35-.65 4.58-1.71l5.59 5.59.7-.71zM10 16c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z",
);
export const PlusIcon = icon("M20 12h-8v8h-1v-8H3v-1h8V3h1v8h8v1z");
export const BackIcon = icon(
  "M21 11v1H5.64l6.72 6.72-.71.71-7.93-7.93 7.92-7.92.71.71L5.64 11H21z",
);
export const CloseIcon = icon(
  "m12.71 12 8.15 8.15-.71.71L12 12.71l-8.15 8.15-.71-.71L11.29 12 3.15 3.85l.71-.71L12 11.29l8.15-8.15.71.71L12.71 12z",
);
export const MoreIcon = icon(
  "M12 16.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zM10.5 12c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5-1.5.67-1.5 1.5zm0-6c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5-1.5.67-1.5 1.5z",
);
export const TrashIcon = icon(
  "M11 17H9V8h2v9zm4-9h-2v9h2V8zm4-4v1h-1v16H6V5H5V4h4V3h6v1h4zm-2 1H7v15h10V5z",
);
export const RetryIcon = icon(
  "M12 4.5c-4.14 0-7.5 3.36-7.5 7.5S7.86 19.5 12 19.5c3.11 0 5.78-1.9 6.92-4.6l.92.39A8.507 8.507 0 0112 20.5c-4.69 0-8.5-3.81-8.5-8.5S7.31 3.5 12 3.5c2.68 0 5.07 1.25 6.63 3.19V4h1v4.5h-4.5v-1h2.68A7.476 7.476 0 0012 4.5z",
);
export const ExternalIcon = icon(
  "M21 3v7h-1V4.71l-9.15 9.15-.71-.71L19.29 4H14V3h7zm-3 15H4V5h7V4H3v15h16v-8h-1v7z",
);
export const ShareIcon = icon(
  "M15 5.63 20.66 12 15 18.37V14h-1c-3.96 0-7.14 1-9.75 3.09 1.84-4.07 5.11-6.4 9.89-7.1l.86-.13V5.63M14 3v6C6.22 10.13 3.11 15.33 2 21c2.78-3.97 6.44-6 12-6v6l8-9-8-9z",
);
export const CheckIcon = icon("M9.4 18.4l-.7-.7L4 13l.7-.7 4.7 4.7L19.3 7.1l.7.7z");
export const AlertIcon = icon(
  "M12 3.5c4.69 0 8.5 3.81 8.5 8.5s-3.81 8.5-8.5 8.5-8.5-3.81-8.5-8.5S7.31 3.5 12 3.5M12 2.5C6.75 2.5 2.5 6.75 2.5 12S6.75 21.5 12 21.5 21.5 17.25 21.5 12 17.25 2.5 12 2.5zM12.5 7h-1v7h1V7zm0 9h-1v1h1v-1z",
);
export const ChevronRightIcon = icon("m9.4 18.4-.7-.7 5.6-5.6-5.7-5.7.7-.7 6.4 6.4-6.3 6.3z");
export const LibraryIcon = icon(
  "M11 7l6 3.5-6 3.5V7zm7 13H4V6H3v15h15v-1zm3-2H6V3h15v15zM7 17h13V4H7v13z",
);

// Player icons use youtube.com's 36px grid.
const PLAYER = "0 0 36 36";
export const PlayIcon = icon(
  "M 12,26 18.5,22 18.5,14 12,10 z M 18.5,22 25,18 25,18 18.5,14 z",
  PLAYER,
);
export const PauseIcon = icon("M 12,26 16,26 16,10 12,10 z M 21,26 25,26 25,10 21,10 z", PLAYER);
export const ReplayIcon = icon(
  "M 18,11 V 7 l -5,5 5,5 v -4 c 3.3,0 6,2.7 6,6 0,3.3 -2.7,6 -6,6 -3.3,0 -6,-2.7 -6,-6 h -2 c 0,4.4 3.6,8 8,8 4.4,0 8,-3.6 8,-8 0,-4.4 -3.6,-8 -8,-8 z",
  PLAYER,
);
export const NextIcon = icon("M 12,24 20.5,18 12,12 V 24 z M 22,12 v 12 h 2 V 12 h -2 z", PLAYER);
export const VolumeHighIcon = icon(
  "M8,21 L12,21 L17,26 L17,10 L12,15 L8,15 L8,21 Z M19,14 L19,22 C20.48,21.32 21.5,19.77 21.5,18 C21.5,16.26 20.48,14.74 19,14 Z M19,11.29 C21.89,12.15 24,14.83 24,18 C24,21.17 21.89,23.85 19,24.71 L19,26.77 C23.01,25.86 26,22.28 26,18 C26,13.72 23.01,10.14 19,9.23 L19,11.29 Z",
  PLAYER,
);
export const VolumeLowIcon = icon(
  "M8,21 L12,21 L17,26 L17,10 L12,15 L8,15 L8,21 Z M19,14 L19,22 C20.48,21.32 21.5,19.77 21.5,18 C21.5,16.26 20.48,14.74 19,14 Z",
  PLAYER,
);
export const VolumeMutedIcon = icon(
  "m 21.48,17.98 c 0,-1.77 -1.02,-3.29 -2.5,-4.03 v 2.21 l 2.45,2.45 c .03,-0.2 .05,-0.41 .05,-0.63 z m 2.5,0 c 0,.94 -0.2,1.82 -0.54,2.64 l 1.51,1.51 c .66,-1.24 1.03,-2.65 1.03,-4.15 0,-4.28 -2.99,-7.86 -7,-8.76 v 2.05 c 2.89,.86 5,3.54 5,6.71 z M 9.25,8.98 l -1.27,1.26 4.72,4.73 H 7.98 v 6 H 11.98 l 5,5 v -6.73 l 4.25,4.25 c -0.67,.52 -1.42,.93 -2.25,1.18 v 2.06 c 1.38,-0.31 2.63,-0.95 3.69,-1.81 l 2.04,2.05 1.27,-1.27 -9,-9 -7.72,-7.72 z m 7.72,.99 -2.09,2.08 2.09,2.09 V 9.98 z",
  PLAYER,
);
export const SettingsIcon = icon(
  "m 23.94,18.78 c .03,-0.25 .05,-0.51 .05,-0.78 0,-0.27 -0.02,-0.52 -0.05,-0.78 l 1.68,-1.32 c .15,-0.12 .19,-0.33 .09,-0.51 l -1.6,-2.76 c -0.09,-0.17 -0.31,-0.24 -0.48,-0.17 l -1.99,.8 c -0.41,-0.32 -0.86,-0.58 -1.35,-0.78 l -0.30,-2.12 c -0.02,-0.19 -0.19,-0.33 -0.39,-0.33 l -3.2,0 c -0.2,0 -0.36,.14 -0.39,.33 l -0.30,2.12 c -0.48,.2 -0.93,.47 -1.35,.78 l -1.99,-0.8 c -0.18,-0.07 -0.39,0 -0.48,.17 l -1.6,2.76 c -0.10,.17 -0.05,.39 .09,.51 l 1.68,1.32 c -0.03,.25 -0.05,.52 -0.05,.78 0,.26 .02,.52 .05,.78 l -1.68,1.32 c -0.15,.12 -0.19,.33 -0.09,.51 l 1.6,2.76 c .09,.17 .31,.24 .48,.17 l 1.99,-0.8 c .41,.32 .86,.58 1.35,.78 l .30,2.12 c .02,.19 .19,.33 .39,.33 l 3.2,0 c .2,0 .36,-0.14 .39,-0.33 l .30,-2.12 c .48,-0.2 .93,-0.47 1.35,-0.78 l 1.99,.8 c .18,.07 .39,0 .48,-0.17 l 1.6,-2.76 c .09,-0.17 .05,-0.39 -0.09,-0.51 l -1.68,-1.32 0,0 z m -5.94,2.01 c -1.54,0 -2.8,-1.25 -2.8,-2.8 0,-1.54 1.25,-2.8 2.8,-2.8 1.54,0 2.8,1.25 2.8,2.8 0,1.54 -1.25,2.8 -2.8,2.8 l 0,0 z",
  PLAYER,
);
export const TheaterIcon = icon(
  "m 28,11 0,14 -20,0 0,-14 z m -18,2 16,0 0,10 -16,0 0,-10 z",
  PLAYER,
);
export const TheaterExitIcon = icon(
  "m 26,13 0,10 -16,0 0,-10 z m -14,2 12,0 0,6 -12,0 0,-6 z",
  PLAYER,
);
export const FullscreenIcon = icon(
  "m 10,16 2,0 0,-4 4,0 0,-2 L 10,10 l 0,6 0,0 z m 10,-6 0,2 4,0 0,4 2,0 L 26,10 l -6,0 0,0 z m 4,14 -4,0 0,2 6,0 0,-6 -2,0 0,4 0,0 z m -12,-4 -2,0 0,6 6,0 0,-2 -4,0 0,-4 0,0 z",
  PLAYER,
);
export const FullscreenExitIcon = icon(
  "m 14,14 -4,0 0,2 6,0 0,-6 -2,0 0,4 0,0 z m 8,-4 -2,0 0,6 6,0 0,-2 -4,0 0,-4 0,0 z m -2,16 2,0 0,-4 4,0 0,-2 -6,0 0,6 0,0 z m -10,-4 4,0 0,4 2,0 0,-6 -6,0 0,2 0,0 z",
  PLAYER,
);
export const SpeedIcon = icon(
  "M10,8v8l6-4L10,8L10,8z M6.3,5L5.7,4.2C7.2,3,9,2.2,11,2l0.1,1C9.3,3.2,7.7,3.9,6.3,5z M5,6.3L4.2,5.7C3,7.2,2.2,9,2,11 l1,.1C3.2,9.3,3.9,7.7,5,6.3z M5,17.7c-1.1-1.4-1.8-3.1-2-4.8L2,13c0.2,2,1,3.8,2.2,5.4L5,17.7z M11.1,21c-1.8-0.2-3.4-0.9-4.8-2 l-0.6,.8C7.2,21,9,21.8,11,22L11.1,21z M22,12c0-5.2-3.9-9.4-9-10l-0.1,1c4.6,.5,8.1,4.3,8.1,9s-3.5,8.5-8.1,9l0.1,1 C18.2,21.5,22,17.2,22,12z",
);

/** The play-button logo with the LocalTube wordmark, laid out like youtube.com's header logo. */
export function Logo() {
  return (
    <span className="flex items-center gap-[2px]">
      <svg viewBox="0 0 28 20" width={29} height={20} aria-hidden="true">
        <path
          d="M27.4 3.1A3.5 3.5 0 0 0 25 .6C22.8 0 14 0 14 0S5.2 0 3 .6A3.5 3.5 0 0 0 .6 3.1C0 5.3 0 10 0 10s0 4.7.6 6.9A3.5 3.5 0 0 0 3 19.4c2.2.6 11 .6 11 .6s8.8 0 11-.6a3.5 3.5 0 0 0 2.4-2.5c.6-2.2.6-6.9.6-6.9s0-4.7-.6-6.9z"
          fill="#ff0000"
        />
        <path d="M11.2 14.3 18.5 10l-7.3-4.3z" fill="#fff" />
      </svg>
      <span className="text-[19px] font-bold tracking-[-1.1px] text-yt-text">LocalTube</span>
    </span>
  );
}
