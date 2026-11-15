import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { DEMO } from "@/lib/demo";
import { totalUsd } from "@/lib/gemini";
import { btn, btnGhost, display } from "./styles";
import { Icon, Logo, Photo, Tag } from "./ui";

const fade = { maskImage: "linear-gradient(to bottom, transparent, #000 10%, #000 90%, transparent)" };

function Column({ from, reverse }: { from: number; reverse?: boolean }) {
  const looks = [0, 1, 2, 3].map((i) => (from + i * 3) % DEMO.length);
  return (
    <div className={reverse ? "drift-reverse" : "drift"}>
      {[...looks, ...looks].map((i, n) => (
        <Photo key={n} i={i} className="mb-4 rounded-3xl" />
      ))}
    </div>
  );
}

function UseCase({ title, body, flip, children }: { title: string; body: string; flip?: boolean; children: React.ReactNode }) {
  return (
    <section className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
      <div className={flip ? "md:order-2" : ""}>
        <h2 className={`${display} text-4xl md:text-5xl`}>{title}</h2>
        <p className="mt-4 max-w-md text-lg leading-8 text-mute">{body}</p>
      </div>
      <div className="rounded-[2rem] bg-mist p-5 sm:p-8">{children}</div>
    </section>
  );
}

// HackUTA theme: each thing the agent does on its own, paired with its part of Homer's Odyssey.
const badge = "absolute rounded-full bg-white px-2.5 py-1 text-xs font-semibold shadow-sm";
const VOYAGE: [string, string, React.ReactNode][] = [
  ["Athena", "Tries it on you", (
    <>
      <div className="grid grid-cols-2 gap-1.5 p-0.5">
        <Photo i="you" className="rounded-xl" alt="A man in a plain tee and jeans" />
        <Photo i="you-wearing" className="rounded-xl ring-2 ring-berry" alt="The same man wearing a denim jacket outfit" />
      </div>
    </>
  )],
  ["The voyage", "Searches the stores", (
    <>
      <Photo i={0} className="rounded-xl" alt="A woman in a red wrap dress with sandals and a bag" />
      <span className="absolute left-2 top-2 flex flex-col items-start gap-1.5">{DEMO[0].garments.slice(0, 3).map((g) => <Tag key={g.description} price={g.price_usd} />)}</span>
    </>
  )],
  ["Ithaca", "Plans for a date", (
    <>
      <Photo i={3} className="rounded-xl" alt="A person in a planned outfit" />
      <span className="absolute left-2 top-2 overflow-hidden rounded-xl bg-white text-center shadow-sm">
        <span className="block bg-berry px-3 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-white">Dec</span>
        <span className={`${display} block px-3 py-0.5 text-xl`}>10</span>
      </span>
    </>
  )],
  ["Mentor", "Knows your taste", (
    <>
      <Photo i={9} className="rounded-xl" alt="A look that matches the saved style" />
      <span className={`${badge} right-2 top-2 !p-1.5 text-berry`}><Icon name="heart" fill className="size-4" /></span>
      <span className={`${badge} bottom-2 left-2`}>Size M · Casual</span>
    </>
  )],
  ["Penelope", "Works while you are away", (
    <>
      <Photo i={5} className="rounded-xl" alt="A finished look" />
      <span className={`${badge} inset-x-2 bottom-2 flex items-center justify-center gap-1`}><Icon name="check" className="size-4 text-berry" /> Ready for you</span>
    </>
  )],
];

const Caption =({ children }: { children: React.ReactNode }) => <p className="mt-2 text-center text-sm font-medium">{children}</p>;

// Every request reads the login cookie, so this route renders on the server instead of from a static shell.
export const instant = false;

export default async function Landing() {
  if (await currentUser().catch(() => null)) redirect("/studio");
  return (
    <>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
        <Logo />
        <nav className="flex gap-2">
          <Link href="/login" className={btnGhost}>Log in</Link>
          <Link href="/login?mode=register" className={btn}>Sign up</Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-24 px-5 pb-24 md:space-y-32">
        <section className="grid items-center gap-10 md:grid-cols-[1.05fr_1fr]">
          <div className="py-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-berry">Athena dressed Odysseus. Gemi dresses you.</p>
            <h1 className={`${display} text-6xl leading-[0.95] md:text-8xl`}>Try it on before you buy it.</h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-mute">
              Show Gemi a photo, type what you want, or just say it. It finds real clothes, dresses you in them and hands you the receipt.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login?mode=register" className={`${btn} px-7 py-3.5 text-base`}>Create your account</Link>
              <Link href="/login" className={`${btnGhost} px-7 py-3.5 text-base`}>Log in</Link>
            </div>
          </div>
          <div className="grid h-[22rem] grid-cols-3 gap-4 overflow-hidden md:h-[40rem]" style={fade} aria-hidden="true">
            <Column from={0} />
            <Column from={1} reverse />
            <Column from={2} />
          </div>
        </section>

        <section>
          <h2 className={`${display} max-w-3xl text-4xl md:text-5xl`}>Gemi makes the odyssey. You arrive dressed.</h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-mute">An agent that sails the stores for you, the way Athena looked after Odysseus.</p>
          <ol className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
            {VOYAGE.map(([myth, does, visual]) => (
              <li key={myth} className="rounded-3xl bg-mist p-3">
                <div className="relative flex aspect-[3/4] items-center overflow-hidden rounded-xl">{visual}</div>
                <p className="mt-3 px-1 text-xs font-semibold uppercase tracking-widest text-berry">{myth}</p>
                <h3 className={`${display} px-1 pb-1 text-lg leading-tight`}>{does}</h3>
              </li>
            ))}
          </ol>
        </section>

        <UseCase title="Copy a whole outfit from one photo" body="See a look you love on someone else? Upload the picture. Gemi finds every piece in it, from jacket to shoes, and puts all of it on you in one go.">
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 sm:gap-3">
            <div><Photo i={1} className="rounded-2xl" alt="A man in a denim jacket, white tee, olive cargo trousers and white sneakers" /><Caption>Their outfit</Caption></div>
            <Icon name="plus" className="size-5 text-mute" />
            <div><Photo i="you" className="rounded-2xl" alt="A different man in a plain tee and jeans" /><Caption>You</Caption></div>
            <span className={`${display} text-xl text-mute`} aria-hidden="true">=</span>
            <div><Photo i="you-wearing" className="rounded-2xl ring-2 ring-berry" alt="The second man now wearing the same denim jacket outfit" /><Caption>You, wearing it</Caption></div>
          </div>
        </UseCase>

        <UseCase flip title="Shop with a budget, in your own words" body="Ask for a red dress under $100. Gemi searches real stores, stays inside your budget and shows the price and the link for every item it picked.">
          <div className="space-y-4">
            <p className="ml-auto w-fit rounded-3xl rounded-br-md bg-ink px-5 py-3 text-sm text-white">Find a red dress under $100</p>
            <div className="flex gap-4 rounded-3xl bg-white p-4">
              <Photo i={0} className="!w-32 shrink-0 rounded-2xl sm:!w-40" alt="A woman in a red wrap midi dress with tan sandals and a black bag" />
              <ul className="flex-1 self-center text-sm">
                {DEMO[0].garments.map((g) => (
                  <li key={g.description} className="flex items-center justify-between gap-2 border-b border-line py-2.5">
                    <span className="font-medium">{g.description}</span><Tag price={g.price_usd} />
                  </li>
                ))}
                <li className={`${display} flex justify-between pt-3 text-base`}><span>Total</span><span>${totalUsd(DEMO[0].garments)}</span></li>
              </ul>
            </div>
          </div>
        </UseCase>

        <UseCase title="Change one piece, keep the rest" body="Only need a blue top? Say so. Gemi swaps that one thing and leaves the rest of your outfit exactly as it was.">
          <div className="grid grid-cols-2 gap-4">
            <div><Photo i={8} className="rounded-2xl" alt="A woman in a pink tank top and navy pleated skirt" /><Caption>Before</Caption></div>
            <div><Photo i="after" className="rounded-2xl ring-2 ring-berry" alt="The same woman, now in a blue tank top with the same skirt" /><Caption>After: only the top changed</Caption></div>
          </div>
        </UseCase>

        <UseCase flip title="Wear what the community is wearing" body="Share a look you like. Anyone can then try that exact outfit on themselves with one click, using only their own photo.">
          <div className="masonry columns-3">
            {[6, 3, 9, 5, 11, 7].map((i, n) => (
              <div key={i}>
                <div className="relative overflow-hidden rounded-2xl">
                  <Photo i={i} />
                  {n === 1 && <span className="absolute inset-x-2 bottom-2 rounded-full bg-white py-1.5 text-center text-xs font-semibold">Try on me</span>}
                </div>
                <div className="flex items-center justify-between px-1 pt-1.5 text-xs">
                  <span className="font-medium">{DEMO[i].author}</span><Tag price={totalUsd(DEMO[i].garments)} />
                </div>
              </div>
            ))}
          </div>
        </UseCase>

        <section className="rounded-[2.5rem] bg-ink px-6 py-16 text-center text-white">
          <h2 className={`${display} mx-auto max-w-2xl text-5xl md:text-6xl`}>Your fitting room is open.</h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-white/70">Free to start. All you need is one photo of yourself.</p>
          <Link href="/login?mode=register" className="mt-8 inline-flex rounded-full bg-tag px-7 py-3.5 text-base font-semibold text-ink transition-colors hover:bg-white">Create your account</Link>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-5 pb-10 text-sm text-mute">
        <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6 border-t border-line pt-8">
          <div className="max-w-sm">
            <p className="font-semibold text-ink">Powered by Google Gemini</p>
            <p className="mt-1">The people on this page are AI-generated and do not exist. Looks you create in Gemi are generated from your own photo.</p>
          </div>
          <nav aria-label="Legal" className="flex flex-col gap-1">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/privacy#terms" className="hover:text-ink">Terms of use</Link>
          </nav>
          <address className="flex flex-col gap-1 not-italic">
            <span className="font-semibold text-ink">Contact</span>
            <a href="mailto:raimjanovnursultan@gmail.com" className="hover:text-ink">raimjanovnursultan@gmail.com</a>
            <a href="tel:+12818929691" className="hover:text-ink">(281) 892-9691</a>
          </address>
        </div>
      </footer>
    </>
  );
}
