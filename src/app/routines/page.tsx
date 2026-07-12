import { HydrateClient } from "~/trpc/server";
import { Nav } from "../_components/nav";
import { RoutinesView } from "../_components/routines-view";

export default function RoutinesPage() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center bg-background px-4 py-16">
        <div className="flex w-full max-w-2xl flex-col gap-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-text sm:text-5xl">
                Routines
              </h1>
              <p className="mt-2 text-text/50">
                Chain habits together and run them step by step.
              </p>
            </div>
            <Nav />
          </div>
          <RoutinesView />
        </div>
      </main>
    </HydrateClient>
  );
}
