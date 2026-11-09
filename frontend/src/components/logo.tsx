import { SITE_NAME } from "@/lib/brand";

/**
 * "আমাদের বিদ্যালয়" mark: an open book with a rising sun (knowledge).
 * `light` is for dark or green backgrounds (white badge, green book).
 */
export function LogoMark({ className = "size-9", light = false }: { className?: string; light?: boolean }) {
  const circle = light ? "#ffffff" : "#166534";
  const left = light ? "#166534" : "#ffffff";
  const right = light ? "#86c99a" : "#dcfce7";
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={SITE_NAME}>
      <circle cx="32" cy="32" r="32" fill={circle} />
      <g stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round">
        <line x1="23.3" y1="20.1" x2="19.7" y2="18.5" />
        <line x1="26.8" y1="16" x2="24.6" y2="12.7" />
        <line x1="32" y1="14.5" x2="32" y2="10.5" />
        <line x1="37.2" y1="16" x2="39.4" y2="12.7" />
        <line x1="40.7" y1="20.1" x2="44.3" y2="18.5" />
      </g>
      <circle cx="32" cy="24" r="5.5" fill="#f59e0b" />
      <path d="M10 39C18 35 26 35 31 39V54C26 50 18 50 10 54Z" fill={left} />
      <path d="M54 39C46 35 38 35 33 39V54C38 50 46 50 54 54Z" fill={right} />
    </svg>
  );
}
