import { Camera, Cloud, LogIn, MoonStar, SunMedium } from "lucide-react";
import { useState } from "react";
import { signInWithPassword, signUpWithPassword } from "../lib/supabase";

function AuthScreen({ configured, theme, onToggleTheme }) {
  const [mode, setMode] = useState("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!configured) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setNotice("");

      if (mode === "sign-in") {
        await signInWithPassword({ email: email.trim(), password });
      } else {
        const response = await signUpWithPassword({ email: email.trim(), password });

        if (response.session) {
          setNotice("Account created. You are now signed in.");
        } else {
          setNotice("Account created. Check your inbox if email confirmation is enabled.");
        }
      }
    } catch (requestError) {
      setError(requestError.message || "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(11,201,166,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(255,164,91,0.16),transparent_28%)]" />

      <div className="relative z-10 w-full max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
          <section className="glass-panel-strong flex flex-col justify-between gap-8 px-6 py-8 sm:px-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3 rounded-full border border-line/70 bg-surface/80 px-4 py-2 text-sm font-semibold text-text">
                <Camera className="h-4 w-4 text-accent" />
                Lumen Photos on Supabase
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">
                  Free Static Deployment
                </p>
                <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
                  Personal photo storage without a dedicated backend.
                </h1>
                <p className="max-w-2xl text-sm text-muted sm:text-base">
                  The app now runs as a static React client on GitHub Pages and stores images,
                  albums, and metadata directly in Supabase.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <InfoCard title="Storage" text="Images go to a private Supabase Storage bucket." />
              <InfoCard title="Database" text="Albums and metadata live in Postgres with RLS." />
              <InfoCard title="Deploy" text="GitHub Pages hosts the frontend for free." />
            </div>
          </section>

          <section className="glass-panel px-6 py-8 sm:px-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Access</p>
                <h2 className="font-display text-3xl font-bold tracking-tight">
                  {configured ? "Sign in to your library" : "Finish Supabase setup"}
                </h2>
              </div>

              <button
                type="button"
                onClick={onToggleTheme}
                className="action-button border border-line/70 bg-panel/80 text-text hover:border-accent/60 hover:bg-accentSoft/70"
              >
                {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
              </button>
            </div>

            {configured ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex rounded-full border border-line/70 bg-panel/75 p-1">
                  <button
                    type="button"
                    onClick={() => setMode("sign-in")}
                    className={[
                      "flex-1 rounded-full px-4 py-2 text-sm font-semibold transition",
                      mode === "sign-in" ? "bg-text text-bg" : "text-muted hover:text-text"
                    ].join(" ")}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("sign-up")}
                    className={[
                      "flex-1 rounded-full px-4 py-2 text-sm font-semibold transition",
                      mode === "sign-up" ? "bg-text text-bg" : "text-muted hover:text-text"
                    ].join(" ")}
                  >
                    Create account
                  </button>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-text">Email</span>
                  <div className="input-shell rounded-[22px]">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
                      placeholder="you@example.com"
                    />
                  </div>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-text">Password</span>
                  <div className="input-shell rounded-[22px]">
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
                      placeholder="At least 6 characters"
                    />
                  </div>
                </label>

                {error ? <p className="text-sm text-rose-300">{error}</p> : null}
                {notice ? <p className="text-sm text-emerald-300">{notice}</p> : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="action-button w-full bg-text text-bg hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogIn className="h-4 w-4" />
                  {submitting
                    ? mode === "sign-in"
                      ? "Signing in..."
                      : "Creating account..."
                    : mode === "sign-in"
                      ? "Sign in"
                      : "Create account"}
                </button>

                <p className="text-sm text-muted">
                  Use Supabase Auth email/password. For the fastest first setup, disable email
                  confirmation in your Supabase Auth settings or configure an SMTP provider.
                </p>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  Add your Supabase project settings to `.env` locally and to GitHub repository
                  variables for deployment.
                </p>

                <div className="rounded-[24px] border border-line/70 bg-panel/80 p-4">
                  <p className="text-sm font-semibold text-text">Required variables</p>
                  <div className="mt-3 space-y-2 font-mono text-sm text-muted">
                    <div>VITE_SUPABASE_URL</div>
                    <div>VITE_SUPABASE_ANON_KEY</div>
                    <div>VITE_SUPABASE_BUCKET=photos</div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-line/70 bg-panel/80 p-4 text-sm text-muted">
                  Then run the SQL in `supabase/schema.sql`, enable Email auth in Supabase, and
                  restart `npm run dev`.
                </div>
              </div>
            )}

            <div className="mt-6 rounded-[24px] border border-line/70 bg-panel/75 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accentSoft text-accent">
                  <Cloud className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-text">Static frontend, managed backend</p>
                  <p className="mt-1 text-sm text-muted">
                    This migration keeps the UI on GitHub Pages and moves uploads, metadata, and
                    auth into Supabase so the project remains free to host.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ text, title }) {
  return (
    <div className="rounded-[24px] border border-line/70 bg-panel/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">{title}</p>
      <p className="mt-2 text-sm text-muted">{text}</p>
    </div>
  );
}

export default AuthScreen;
