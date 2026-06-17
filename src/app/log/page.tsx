import { HydrateClient } from "~/trpc/server";
import { LogView } from "../_components/log-view";
import { Nav } from "../_components/nav";

export default function LogPage() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-[#2e026d] to-[#15162c] px-4 py-16 text-white">
        <div className="flex w-full max-w-2xl flex-col gap-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                Log
              </h1>
              <p className="mt-2 text-white/50">Every check-in you've logged, newest first.</p>
            </div>
            <Nav />
          </div>
          <LogView />
        </div>
      </main>
    </HydrateClient>
  );
}
