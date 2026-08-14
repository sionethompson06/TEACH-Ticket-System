import { RequesterNav } from "./requester-nav";

export default function RequestsLayout({ children }: LayoutProps<"/requests">) {
  return (
    <div className="flex flex-1 flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <RequesterNav />
      <main className="flex flex-1 flex-col px-6 py-8 sm:px-10">
        {children}
      </main>
    </div>
  );
}
