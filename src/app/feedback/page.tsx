import { FeedbackForm } from "../_components/feedback-form";
import { Nav } from "../_components/nav";

export default function FeedbackPage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-background px-4 py-16">
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-text sm:text-5xl">
              Feedback
            </h1>
            <p className="mt-2 text-text/50">
              Every message goes straight to the person building this. Be blunt.
            </p>
          </div>
          <Nav />
        </div>

        <FeedbackForm />
      </div>
    </main>
  );
}
