"use client";

import { useEffect, useState } from "react";
import { api } from "~/trpc/react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type Tier = "hosted" | "byo" | "selfhost";
type Mode = "auto" | "tool" | "json";

const BYO_PROVIDERS = ["openai", "anthropic", "google", "groq"] as const;
const SELFHOST_PROVIDERS = ["ollama", "custom"] as const;

const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
  google: "gemini-2.0-flash",
  groq: "llama-3.3-70b-versatile",
  ollama: "llama3.1:8b",
  custom: "",
  hosted: "",
};

const WEAK_TOOL_RE = /^gemma|^phi-2/i;
function isWeakModel(model: string) {
  return WEAK_TOOL_RE.test(model.trim());
}

const TIER_META: Record<Tier, { label: string; tagline: string; privacy: string; icon: string }> = {
  hosted: {
    label: "Introspect Hosted",
    tagline: "Managed models by Introspect",
    privacy: "Entries processed on Introspect servers · Coming soon",
    icon: "✦",
  },
  byo: {
    label: "Your Provider",
    tagline: "Use an API key you already have",
    privacy: "Entries sent to the provider you choose",
    icon: "⬡",
  },
  selfhost: {
    label: "Self-Hosted",
    tagline: "Run AI on your own machine",
    privacy: "Entries never leave your device",
    icon: "◈",
  },
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  groq: "Groq",
  ollama: "Ollama",
  custom: "Custom",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiSettings() {
  const utils = api.useUtils();
  const { data: current } = api.settings.get.useQuery();

  const [tier, setTier] = useState<Tier>("selfhost");
  const [provider, setProvider] = useState("ollama");
  const [model, setModel] = useState(DEFAULT_MODELS.ollama ?? "");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [mode, setMode] = useState<Mode>("auto");
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  useEffect(() => {
    if (!current) return;
    if (current.tier) setTier(current.tier as Tier);
    if (current.provider) setProvider(current.provider);
    if (current.model) setModel(current.model);
    if (current.baseUrl) setBaseUrl(current.baseUrl);
    if (current.mode) setMode(current.mode as Mode);
  }, [current]);

  const updateSettings = api.settings.update.useMutation({
    onSuccess: async () => {
      await utils.settings.get.invalidate();
      setApiKey("");
    },
  });

  const clearSettings = api.settings.clear.useMutation({
    onSuccess: async () => {
      await utils.settings.get.invalidate();
      setTier("selfhost");
      setProvider("ollama");
      setModel(DEFAULT_MODELS.ollama ?? "");
      setApiKey("");
      setBaseUrl("");
      setMode("auto");
      setTestResult(null);
    },
  });

  const testConnection = api.settings.testConnection.useMutation({
    onSuccess: (res) => setTestResult(res),
    onError: (err) => setTestResult({ ok: false, error: err.message }),
  });

  const handleTierSelect = (t: Tier) => {
    if (t === "hosted") return;
    setTier(t);
    setTestResult(null);
    const defaultProvider = t === "selfhost" ? "ollama" : "openai";
    setProvider(defaultProvider);
    setModel(DEFAULT_MODELS[defaultProvider] ?? "");
    setApiKey("");
    setBaseUrl("");
  };

  const handleProviderChange = (p: string) => {
    setProvider(p);
    setModel(DEFAULT_MODELS[p] ?? "");
    setTestResult(null);
  };

  const handleSave = () => {
    updateSettings.mutate({ provider, model, apiKey: apiKey || undefined, baseUrl: baseUrl || undefined, mode, tier });
  };

  const handleTest = () => {
    setTestResult(null);
    testConnection.mutate({ provider, model, apiKey: apiKey || undefined, baseUrl: baseUrl || undefined, mode, tier });
  };

  const weakWarning = isWeakModel(model);
  const providerList = tier === "byo" ? BYO_PROVIDERS : SELFHOST_PROVIDERS;
  const needsApiKey = tier === "byo";
  const needsBaseUrl = provider === "ollama" || provider === "custom";

  return (
    <div className="flex flex-col gap-6">
      {/* ── Active config summary ── */}
      {current && (
        <p className="text-xs text-text/40">
          Active:{" "}
          <span className="text-text/60">
            {current.provider} / {current.model}
          </span>
          {current.hasApiKey && " · custom key set"}
          {current.mode && current.mode !== "auto" && ` · mode: ${current.mode}`}
        </p>
      )}

      {/* ── Tier cards ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(["hosted", "byo", "selfhost"] as Tier[]).map((t) => {
          const meta = TIER_META[t];
          const isDisabled = t === "hosted";
          const isActive = tier === t;
          return (
            <button
              key={t}
              onClick={() => handleTierSelect(t)}
              disabled={isDisabled}
              className={`flex flex-col gap-1.5 rounded-xl border p-4 text-left transition ${
                isDisabled
                  ? "cursor-not-allowed border-text/5 opacity-40"
                  : isActive
                    ? "border-primary/40 bg-primary/5"
                    : "border-text/10 bg-white hover:border-text/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-base">{meta.icon}</span>
                {isDisabled && (
                  <span className="rounded-md border border-text/15 px-1.5 py-0.5 text-[10px] text-text/40">
                    soon
                  </span>
                )}
                {isActive && !isDisabled && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </div>
              <p className={`text-sm font-semibold ${isActive ? "text-primary" : "text-text/70"}`}>
                {meta.label}
              </p>
              <p className="text-xs text-text/40">{meta.tagline}</p>
              <p className="mt-1 text-[10px] leading-tight text-text/30">{meta.privacy}</p>
            </button>
          );
        })}
      </div>

      {/* ── Provider / model config ── */}
      {tier !== "hosted" && (
        <div className="flex flex-col gap-4 rounded-xl border border-text/10 bg-white p-5">
          {/* Provider buttons */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text/40">
              Provider
            </p>
            <div className="flex flex-wrap gap-2">
              {providerList.map((p) => (
                <button
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    provider === p
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-text/15 bg-text/5 text-text/50 hover:border-text/25 hover:text-text/70"
                  }`}
                >
                  {PROVIDER_LABELS[p] ?? p}
                </button>
              ))}
            </div>
          </div>

          {/* Model ID */}
          <input
            className="w-full rounded-lg border border-text/15 bg-background px-3 py-2 text-sm text-text placeholder-text/30 outline-none transition focus:border-primary/40 focus:ring-1 focus:ring-primary/10"
            placeholder="Model ID (e.g. llama3.1:8b)"
            value={model}
            onChange={(e) => { setModel(e.target.value); setTestResult(null); }}
          />

          {/* Compatibility hint */}
          {weakWarning && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <span className="font-semibold">Heads up:</span> {model} may not support structured
              tool calls. Set mode to <strong>Auto</strong> or{" "}
              <strong>JSON</strong>, or use a tool-capable model like{" "}
              <span className="font-mono">qwen2.5:7b</span> or{" "}
              <span className="font-mono">llama3.1:8b</span>.
            </div>
          )}

          {/* API key */}
          {needsApiKey && (
            <input
              className="w-full rounded-lg border border-text/15 bg-background px-3 py-2 text-sm text-text placeholder-text/30 outline-none transition focus:border-primary/40 focus:ring-1 focus:ring-primary/10"
              placeholder="API key (leave blank to use env)"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          )}

          {/* Base URL */}
          {needsBaseUrl && (
            <input
              className="w-full rounded-lg border border-text/15 bg-background px-3 py-2 text-sm text-text placeholder-text/30 outline-none transition focus:border-primary/40 focus:ring-1 focus:ring-primary/10"
              placeholder={
                provider === "ollama"
                  ? "Base URL (default: http://localhost:11434/v1)"
                  : "Base URL (e.g. http://localhost:11434/v1)"
              }
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          )}

          {/* Mode selector */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text/40">
              Output mode
            </p>
            <div className="flex gap-2">
              {(["auto", "tool", "json"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    mode === m
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-text/15 bg-text/5 text-text/50 hover:border-text/25 hover:text-text/70"
                  }`}
                >
                  {m === "auto" ? "Auto (recommended)" : m === "tool" ? "Tool calls" : "JSON mode"}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-text/30">
              {mode === "auto"
                ? "Tries tool calls first; falls back to JSON for models that don't support them."
                : mode === "tool"
                  ? "Forces structured tool calling. Requires a tool-capable model."
                  : "Uses JSON generation mode. Works with most models including Gemma."}
            </p>
          </div>

          {/* Test + save row */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleTest}
              disabled={testConnection.isPending || !model}
              className="rounded-lg border border-text/15 px-4 py-2 text-sm text-text/60 transition hover:border-text/25 hover:text-text/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {testConnection.isPending ? "Testing…" : "Test connection"}
            </button>
            <button
              onClick={handleSave}
              disabled={updateSettings.isPending || !model}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {updateSettings.isPending ? "Saving…" : "Save"}
            </button>
            {current && (
              <button
                onClick={() => clearSettings.mutate()}
                disabled={clearSettings.isPending}
                className="rounded-lg border border-text/15 px-4 py-2 text-sm text-text/40 transition hover:border-text/25 hover:text-text/60 disabled:opacity-40"
              >
                Reset to default
              </button>
            )}
          </div>

          {/* Test result */}
          {testResult && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                testResult.ok
                  ? "border-emerald-500/30 bg-emerald-50 text-emerald-700"
                  : "border-rose-500/30 bg-rose-50 text-rose-700"
              }`}
            >
              {testResult.ok ? (
                "✓ Connection successful"
              ) : (
                <>
                  <span className="font-semibold">Connection failed:</span>{" "}
                  {testResult.error ?? "Unknown error"}
                </>
              )}
            </div>
          )}

          {/* Save success */}
          {updateSettings.isSuccess && (
            <p className="text-xs text-emerald-600">Settings saved.</p>
          )}
        </div>
      )}
    </div>
  );
}
