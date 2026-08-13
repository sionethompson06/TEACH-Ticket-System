import { StatusIndicator } from "@/components/StatusIndicator";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 px-6 py-6 dark:border-slate-800 sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          TEACH Public Schools
        </p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
          TEACH Ticket System
        </h1>
      </header>

      <main className="flex flex-1 flex-col gap-8 px-6 py-10 sm:px-10">
        <section
          aria-labelledby="status-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="status-heading" className="text-lg font-semibold">
            Application status
          </h2>
          <StatusIndicator label="Operational" />
          <p className="max-w-2xl text-base leading-7 text-slate-700 dark:text-slate-300">
            Phase 2: Database foundation operational.
          </p>
        </section>

        <section
          aria-labelledby="about-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="about-heading" className="text-lg font-semibold">
            About this system
          </h2>
          <p className="max-w-2xl text-base leading-7 text-slate-700 dark:text-slate-300">
            The TEACH Ticket System will provide a secure, system-wide
            service-request platform for TEACH Public Schools staff. The initial
            planned departments are <strong>Information Technology</strong> and{" "}
            <strong>Facilities</strong>. The PostgreSQL schema, migration
            workflow, and TEACH location reference data are now established.
          </p>
        </section>

        <section
          aria-labelledby="availability-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="availability-heading" className="text-lg font-semibold">
            Availability
          </h2>
          <p className="max-w-2xl text-base leading-7 text-slate-700 dark:text-slate-300">
            Sign-in is not enabled yet. Ticket submission is not enabled yet. No
            live ticket or user data exists. This phase establishes the database
            foundation only.
          </p>
        </section>
      </main>

      <footer className="border-t border-slate-200 px-6 py-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:px-10">
        <p>
          Project documentation is maintained in this repository under{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] dark:bg-slate-900">
            docs/
          </code>
          .
        </p>
      </footer>
    </div>
  );
}
