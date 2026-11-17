import { SITE_NAME } from "@/lib/brand";

/**
 * "মেধাবিকাশ শিক্ষালয়" mark: graduation cap, pen nib and open book.
 * `light` is for dark or green backgrounds (white badge behind the mark).
 */
export function LogoMark({ className = "size-9", light = false }: { className?: string; light?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/logo-mark.png"
      alt={SITE_NAME}
      className={`${className} shrink-0 ${light ? "rounded-full bg-white p-0.5" : ""} object-contain`}
    />
  );
}
