"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Login fehlgeschlagen.");
      return;
    }
    window.location.assign("/dashboard");
  }

  return (
    <main className="grid min-h-screen grid-cols-1 bg-ez-bg lg:grid-cols-[420px_1fr]">
      <section className="flex flex-col justify-between bg-ez-petrol p-8 text-white">
        <div>
          <Image src="/brand/ezag-logo-white.png" alt="Eckert & Ziegler" width={190} height={38} className="h-8 w-auto" priority />
          <div className="mt-10 text-3xl font-semibold leading-tight">Pay Transparency HR Suite</div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
            Sichere Compensation-Governance fuer Stellenbewertung, Gehaltsbaender, Auskunft und Pay-Gap-Reporting.
          </p>
        </div>
        <div className="rounded-md border border-white/15 bg-white/10 p-4 text-sm text-white/75">
          Azure Entra ID ist als produktiver OIDC-Provider vorbereitet. Lokal ist der Entwicklungszugang aktiv, damit ohne Kunden-Azure-Struktur entwickelt werden kann.
        </div>
      </section>
      <section className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-md rounded-md border border-ez-line bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-ez-petrol-50 p-2 text-ez-petrol">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-ez-navy">Anmelden</h1>
              <p className="text-sm text-ez-muted">Lokaler Entwicklungsmodus</p>
            </div>
          </div>

          <label className="mt-6 block text-sm font-medium text-ez-navy">
            E-Mail
            <input
              className="focus-ring mt-1 w-full rounded border border-ez-line px-3 py-2"
              value={email}
              type="email"
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="mt-4 block text-sm font-medium text-ez-navy">
            Passwort
            <input
              className="focus-ring mt-1 w-full rounded border border-ez-line px-3 py-2"
              value={password}
              type="password"
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error && <div className="mt-4 rounded border border-ez-burgundy-100 bg-ez-burgundy-50 px-3 py-2 text-sm text-ez-burgundy-700">{error}</div>}

          <button
            disabled={loading}
            className="focus-ring mt-6 w-full rounded bg-ez-petrol px-4 py-2 font-semibold text-white hover:bg-ez-petrol-700 disabled:cursor-wait disabled:opacity-70"
          >
            {loading ? "Anmeldung..." : "Einloggen"}
          </button>
        </form>
      </section>
    </main>
  );
}
