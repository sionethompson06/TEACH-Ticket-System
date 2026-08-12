type StatusIndicatorProps = {
  label: string;
};

// Status is conveyed by the text label, not color alone; the dot is decorative.
export function StatusIndicator({ label }: StatusIndicatorProps) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-emerald-700/30 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-950 dark:text-emerald-300">
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400"
      />
      <span>{label}</span>
    </p>
  );
}
