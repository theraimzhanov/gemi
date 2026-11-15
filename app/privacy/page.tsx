import type { Metadata } from "next";
import { display } from "../styles";
import { Logo } from "../ui";

export const metadata: Metadata = { title: "Privacy and terms — Gemi" };

const h2 = `${display} mt-12 scroll-mt-6 text-3xl`;
const list = "mt-4 list-disc space-y-2 pl-5";

export default function Privacy() {
  return (
    <>
      <header className="mx-auto w-full max-w-3xl px-5 py-5"><Logo /></header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20 leading-relaxed">
        <h1 className={`${display} text-5xl`}>Privacy and terms</h1>
        <p className="mt-4 text-mute">Gemi is a student project built for HackUTA 2026. This page says plainly what it does with your information.</p>

        <h2 id="privacy" className={h2}>Privacy</h2>
        <ul className={list}>
          <li><b>Your account.</b> We store your email, your public name and a scrambled form of your password. Your real password is never stored.</li>
          <li><b>Your photo.</b> The photo of yourself stays in your browser. It is sent to the AI model only while a look is being made, and it is not saved in our database.</li>
          <li><b>Your looks.</b> Every picture Gemi makes for you is saved to your account, with its list of clothes. A look is private until you choose to share it; a shared look, and your public name on it, can be seen by every signed-in user.</li>
          <li><b>Your chat.</b> Your requests, saved plans, likes and style preferences are stored so Gemi can answer, remember what you asked and suggest clothes you may like.</li>
          <li><b>Other services.</b> Photos, voice recordings and requests are processed by Google Gemini models, reached through OpenRouter. Data is stored in a Tiger Data database. Store pages you open are run by those stores.</li>
          <li><b>What we do not do.</b> We do not sell your information and we do not show ads.</li>
          <li><b>Removing your data.</b> Write to the address below and we will delete your account and everything saved with it.</li>
        </ul>

        <h2 id="terms" className={h2}>Terms of use</h2>
        <ul className={list}>
          <li>Only upload photos of yourself, or photos you have permission to use.</li>
          <li>Pictures are made by AI. They show an idea of how clothes could look, not an exact fit, colour or size.</li>
          <li>Prices, stock and links come from web search and can be wrong or out of date. Check the store before you buy. Gemi does not sell anything and takes no payment.</li>
          <li>Do not use Gemi to make offensive, misleading or harmful pictures of anyone.</li>
          <li>Gemi is a demo, offered as it is, with no guarantee that it is always available.</li>
        </ul>

        <h2 id="contact" className={h2}>Contact</h2>
        <p className="mt-4">
          Email <a className="underline" href="mailto:raimjanovnursultan@gmail.com">raimjanovnursultan@gmail.com</a> or call <a className="underline" href="tel:+12818929691">(281) 892-9691</a>.
        </p>
      </main>
    </>
  );
}
