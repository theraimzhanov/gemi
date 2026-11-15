import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Logo, Photo } from "../ui";
import { AuthForm } from "./form";

// Every request reads the login cookie, so this route renders on the server instead of from a static shell.
export const instant = false;

export default async function Login({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  if (await currentUser().catch(() => null)) redirect("/studio");
  const register = (await searchParams).mode === "register";
  return (
    <main className="grid flex-1 md:grid-cols-2">
      <div className="hidden overflow-hidden bg-mist p-6 md:block" aria-hidden="true">
        <div className="masonry columns-3">
          {[0, 5, 9, 2, 7, 10, 4, 1, 6].map((i) => (
            <Photo key={i} i={i} className="rounded-3xl" />
          ))}
        </div>
      </div>
      <div className="flex flex-col px-6 py-6">
        <Logo />
        <div className="m-auto w-full max-w-sm py-10">
          <AuthForm register={register} />
        </div>
      </div>
    </main>
  );
}
