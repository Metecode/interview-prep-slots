export type ChevronIconProps = {
  className?: string;
};

/**
 * Aşağı bakan ok. Dönüşü (açık/kapalı) çağıran taraf CSS'te
 * aria-expanded seçicisiyle uygular, burada sabit durur.
 */
export function ChevronIcon({ className }: ChevronIconProps) {
  return (
    <svg
      className={className}
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M1.5 3.5 L5 7 L8.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
