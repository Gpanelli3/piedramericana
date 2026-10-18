export function MarmoGestMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <path d="M16 4.4 27.4 10 16 15.6 4.6 10Z" fill="currentColor" opacity="0.95" />
      <path d="M4.6 10 16 15.6V26.8L4.6 21.2Z" fill="currentColor" opacity="0.55" />
      <path d="M16 15.6 27.4 10V21.2L16 26.8Z" fill="currentColor" opacity="0.75" />
    </svg>
  );
}
