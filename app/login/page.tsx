"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { post } from "@/lib/client";
import { btn, Header } from "../ui";

const field = "w-full rounded-full border border-white/15 bg-transparent px-4 py-2.5 text-sm placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-fuchsia-400";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const register = mode === "register";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await post("/api/auth", { mode, username: form.get("username"), password: form.get("password") });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <>
      <Header />
      <main className="hero-glow flex flex-1 items-start justify-center px-5 pt-20">
        <form onSubmit={submit} className="fade-up w-full max-w-sm space-y-4 rounded-3xl border border-white/10 bg-white/[0.07] p-6 backdrop-blur">
          <h1 className="text-2xl font-semibold tracking-tight">{register ? "Create your account" : "Welcome back"}</h1>
          <div className="space-y-1">
            <label htmlFor="username" className="text-sm text-zinc-300">Username</label>
            <input id="username" name="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" autoComplete="username" className={field} />
            {register && <p className="text-xs text-zinc-400">3–20 letters, numbers or underscores. Shown on looks you share.</p>}
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm text-zinc-300">Password</label>
            <input id="password" name="password" type="password" required minLength={register ? 8 : 1} maxLength={200} autoComplete={register ? "new-password" : "current-password"} className={field} />
            {register && <p className="text-xs text-zinc-400">At least 8 characters.</p>}
          </div>
          <p role="alert" className="min-h-5 text-sm text-rose-300">{error}</p>
          <button className={`${btn} w-full py-2.5`} disabled={busy}>{busy ? "One moment…" : register ? "Create account" : "Log in"}</button>
          <p className="text-center text-sm text-zinc-400">
            {register ? "Already have an account?" : "New to Gemi?"}{" "}
            <button type="button" className="text-fuchsia-300 underline underline-offset-2" onClick={() => { setMode(register ? "login" : "register"); setError(""); }}>
              {register ? "Log in" : "Create one"}
            </button>
          </p>
        </form>
      </main>
    </>
  );
}
