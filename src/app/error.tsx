"use client";

import { FriendlyState } from "@/components/friendly-state";

// Catches unexpected errors from any nested page or layout (including a
// failed database connection surfaced through a Server Component). The
// underlying error's message/stack is intentionally never rendered — it
// may contain a connection string, provider detail, or other internal
// information that must not reach the browser.
export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col px-6 py-10 sm:px-10">
      <FriendlyState
        title="We couldn't load this page."
        message="Please try again. If the problem continues, contact your system administrator."
        actions={[
          { label: "Try Again", onClick: reset },
          { label: "Return Home", href: "/" },
        ]}
      />
    </div>
  );
}
