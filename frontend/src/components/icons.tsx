// Minimal Lucide-style stroke icons (inline SVG, no emoji, no dependency).
const PATHS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M9 7h6",
  users: "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8",
  teacher: "M2 8l10-5 10 5-10 5zM6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5",
  card: "M3 6h18v12H3zM3 10h18M7 15h3",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0",
  video: "M3 6h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3zM16 10l5-3v10l-5-3",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  file: "M6 3h8l5 5v13H6zM14 3v5h5M9 13h6M9 17h6",
  clipboard: "M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12l2 2 4-4",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  plus: "M12 5v14M5 12h14",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  menu: "M4 6h16M4 12h16M4 18h16",
  x: "M6 6l12 12M18 6 6 18",
  check: "M5 12.5l4.5 4.5L19 7",
  play: "M7 4l13 8-13 8z",
  chart: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  edit: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5",
  lock: "M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3",
  radio: "M12 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 19a10 10 0 0 1 0-14M19.1 5a10 10 0 0 1 0 14",
  taka: "M7 4v13a3 3 0 0 0 3 3h1M7 9h9M7 13h6a3 3 0 0 0 0-6",
  alert: "M12 3 2 20h20zM12 10v4M12 17h.01",
  arrow: "M5 12h14M13 6l6 6-6 6",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12zM8.5 11h.01M12 11h.01M15.5 11h.01",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
