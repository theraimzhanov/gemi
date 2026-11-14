"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { post } from "@/lib/client";
import { btn, display } from "../ui";

const field = "w-full rounded-2xl border border-line bg-white px-4 py-3 text-base placeholder:text-mute";
const label = "mb-1.5 block text-sm font-medium";

export function AuthForm({ register }: { register: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await post("/api/auth", {
        mode: register ? "register" : "login",
        email: form.get("email"), username: form.get("username"), password: form.get("password"),
      });
      router.push("/studio");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className={`${display} text-4xl`}>{register ? "Create your account" : "Log in to Gemi"}</h1>
        <p className="mt-2 text-mute">{register ? "Save every look you make and share the ones you love." : "Your looks are waiting where you left them."}</p>
      </div>
      <div>
        <label htmlFor="email" className={label}>Email</label>
        <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" className={field} />
      </div>
      {register && (
        <div>
          <label htmlFor="username" className={label}>Username</label>
          <input id="username" name="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" autoComplete="nickname" aria-describedby="username-help" className={field} />
          <p id="username-help" className="mt-1.5 text-sm text-mute">3 to 20 letters, numbers or underscores. Shown on looks you share.</p>
        </div>
      )}
      <div>
        <label htmlFor="password" className={label}>Password</label>
        <input id="password" name="password" type="password" required minLength={register ? 8 : 1} maxLength={200} autoComplete={register ? "new-password" : "current-password"} aria-describedby={register ? "password-help" : undefined} className={field} />
        {register && <p id="password-help" className="mt-1.5 text-sm text-mute">At least 8 characters.</p>}
      </div>
      <p role="alert" className="min-h-5 text-sm font-medium text-berry">{error}</p>
      <button className={`${btn} w-full py-3.5 text-base`} disabled={busy}>{busy ? "One moment…" : register ? "Create account" : "Log in"}</button>
      <p className="text-center text-sm text-mute">
        {register ? "Already have an account? " : "New to Gemi? "}
        <Link href={register ? "/login" : "/login?mode=register"} className="font-semibold text-ink underline underline-offset-2">
          {register ? "Log in" : "Create one"}
        </Link>
      </p>
    </form>
  );
}
