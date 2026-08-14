"use client";

// Only rendered if the root layout itself throws, so this file must
// supply its own complete <html>/<body> — the layout that would normally
// provide them (including its stylesheet link and navigation) is exactly
// what failed. Kept intentionally plain and inline-styled rather than
// depending on Tailwind classes being available.
export default function GlobalError() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "1rem",
          padding: "2.5rem 1.5rem",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: "#0f172a",
          backgroundColor: "#ffffff",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
          We couldn&apos;t load this page.
        </h1>
        <p style={{ maxWidth: "32rem", fontSize: "1rem", lineHeight: 1.75 }}>
          Please try again. If the problem continues, contact your system
          administrator.
        </p>
        {/* A plain <a>, not next/link's <Link>, is intentional here: this
            file replaces the entire document when the root layout itself
            has crashed, so it must not depend on that layout's router
            context being in a working state. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            borderRadius: "9999px",
            backgroundColor: "#0f172a",
            color: "#ffffff",
            padding: "0.625rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Return Home
        </a>
      </body>
    </html>
  );
}
