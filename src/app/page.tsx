import { HydrateClient } from "~/trpc/server";
import { JournalEditor } from "./_components/journal";
import { Nav } from "./_components/nav";

export default function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center bg-background px-4 py-16">
        <div className="flex w-full max-w-2xl flex-col gap-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-text sm:text-5xl">
                Introspect
              </h1>
              <p className="mt-2 text-text/50">Check in. Track what you do. Spot your habits.</p>
            </div>
            <Nav />
          </div>
          <JournalEditor />
        </div>
      </main>
    </HydrateClient>
  );
}
