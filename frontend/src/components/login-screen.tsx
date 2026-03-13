"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DemoUserCredentials } from "@/lib/types";
import { SigmaMark } from "./chat-components";
import { Loader2 } from "lucide-react";

export function LoginScreen({
  demoUsers,
  error,
  isAuthenticating,
  onLogin,
}: {
  demoUsers: DemoUserCredentials[];
  error: string | null;
  isAuthenticating: boolean;
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-4 py-10 text-[#152235]">
      <Card className="w-full max-w-3xl bg-white">
        <CardContent className="grid gap-6 p-6 md:grid-cols-[1.1fr_0.9fr] md:p-8">
          <div className="space-y-4">
            <SigmaMark />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b9ab0]">SIGMA Horo Demo</p>
              <h1 className="mt-2 text-3xl font-semibold text-[#152235]">Founder tenant login</h1>
              <p className="mt-3 text-sm leading-6 text-[#6b7a90]">
                Sign in as one of the demo founders to show that uploaded documents and chat threads remain isolated inside that founder&apos;s tenant.
              </p>
            </div>
            <div className="rounded-2xl border border-[#dbe4ef] bg-[#f8fbff] p-4">
              <p className="text-sm font-semibold text-[#213040]">What this demonstrates</p>
              <div className="mt-3 space-y-2 text-sm text-[#6b7a90]">
                <p>Each founder signs in with a separate JWT-backed identity.</p>
                <p>Document uploads, retrieval, and threads are all filtered by the authenticated founder&apos;s `user_id`.</p>
                <p>Switching founders gives you a clean workspace backed by a different tenant record set.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-[#e2e8f0] bg-[#fbfdff] p-4">
            <div>
              <p className="text-sm font-semibold text-[#213040]">Login</p>
              <p className="mt-1 text-xs text-[#7b8ba1]">Use a test account below or enter the credentials manually.</p>
            </div>

            <div className="space-y-3">
              {demoUsers.map((demoUser) => (
                <button
                  key={demoUser.id}
                  type="button"
                  onClick={() => {
                    setEmail(demoUser.email);
                    setPassword(demoUser.password);
                    void onLogin(demoUser.email, demoUser.password);
                  }}
                  disabled={isAuthenticating}
                  className="w-full rounded-2xl border border-[#dbe4ef] bg-white px-4 py-3 text-left transition hover:border-[#bfdbfe] hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#213040]">{demoUser.email}</p>
                      <p className="mt-1 text-xs text-[#7b8ba1]">Tenant: {demoUser.tenant_name}</p>
                    </div>
                    <Badge>{demoUser.password}</Badge>
                  </div>
                </button>
              ))}
            </div>

            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void onLogin(email, password);
              }}
            >
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[#516074]">Email</p>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-[#dbe4ef] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1f8fff]"
                  placeholder="founder@acme.io"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[#516074]">Password</p>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-[#dbe4ef] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1f8fff]"
                  placeholder="acme-demo"
                  autoComplete="current-password"
                />
              </div>
              {error ? <p className="text-sm text-red-500">{error}</p> : null}
              <Button type="submit" className="w-full rounded-xl" disabled={isAuthenticating || !email.trim() || !password.trim()}>
                {isAuthenticating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
