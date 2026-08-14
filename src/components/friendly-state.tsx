import Link from "next/link";

export interface FriendlyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

function ActionLink({
  action,
  primary,
}: {
  action: FriendlyStateAction;
  primary: boolean;
}) {
  const className = primary
    ? "inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
    : "inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800";

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}

// Shared shape for every friendly error/empty/access-denied state in the
// app (not-found pages, error boundaries, access-denied blocks). Plain
// function component with no hooks or "use client" directive of its own,
// so it renders equally well from Server Components (not-found.tsx,
// inline access-denied blocks) and Client Components (error.tsx, whose
// "Try Again" action needs an onClick rather than an href).
export function FriendlyState({
  title,
  message,
  actions = [],
}: {
  title: string;
  message: string;
  actions?: FriendlyStateAction[];
}) {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
      <p className="max-w-md text-base leading-7 text-slate-600 dark:text-slate-400">
        {message}
      </p>
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {actions.map((action, index) => (
            <ActionLink
              key={action.label}
              action={action}
              primary={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
