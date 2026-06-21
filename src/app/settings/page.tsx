import { HydrateClient } from "~/trpc/server";
import { AiSettings } from "../_components/ai-settings";
import { Nav } from "../_components/nav";
import { ReminderSettings } from "../_components/reminder-settings";

export default function SettingsPage() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-[#2e026d] to-[#15162c] px-4 py-16 text-white">
        <div className="flex w-full max-w-2xl flex-col gap-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                Settings
              </h1>
              <p className="mt-2 text-white/50">
                Control where your data goes and how AI processes it.
              </p>
            </div>
            <Nav />
          </div>

          {/* ── Reminders section ── */}
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
                Reminders
              </h2>
              <p className="mt-1 text-sm text-white/30">
                Get a push notification when it&apos;s time to check in — even
                when the app is closed.
              </p>
            </div>
            <ReminderSettings />
          </section>

          {/* ── AI & Data section ── */}
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
                AI Provider &amp; Data Residency
              </h2>
              <p className="mt-1 text-sm text-white/30">
                Your journal entries are private. Choose exactly where your words go
                when AI features run — your machine, your account, or Introspect's
                servers.
              </p>
            </div>
            <AiSettings />
          </section>
        </div>
      </main>
    </HydrateClient>
  );
}
