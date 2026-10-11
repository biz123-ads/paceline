import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME } from "@/config/app";
import { CREDIT_COST, SIGNUP_BONUS } from "@/config/credits";
import { ProductPreview } from "@/components/landing/ProductPreview";
import { LogoMark } from "@/components/icons";

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME}: see what it takes to reach your revenue goal` },
};

const primary =
  "inline-flex h-11 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-foreground/85";
const secondary =
  "inline-flex h-11 items-center justify-center rounded-xl border border-border-strong px-5 text-sm font-medium transition-colors hover:bg-surface-2";

function Section({ id, title, intro, children }: { id?: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="border-t border-border py-16 sm:py-24">
      <h2 className="max-w-2xl text-2xl font-medium tracking-tight sm:text-3xl">{title}</h2>
      {intro && <p className="mt-3 max-w-2xl text-muted">{intro}</p>}
      <div className="mt-10">{children}</div>
    </section>
  );
}

const STEPS = [
  {
    title: "Where you are",
    text: "Revenue and paying customers, month by month. Type them in, import a spreadsheet, or rebuild them from your Stripe subscriptions.",
  },
  {
    title: "Where you want to go",
    text: "A monthly revenue and a date. Every month lands above or below a plan line, so you always know if you are ahead or behind.",
  },
  {
    title: "What it takes",
    text: "How many new customers you need each month, where growth stalls at today's churn, and what changes if you raise prices or keep more customers.",
  },
];

const HONEST = [
  { title: "Measured from your months", text: "Price per customer, churn and new customers come from the numbers you entered." },
  { title: "Guesses are labelled", text: "With too little data, a value is marked as a guess until you replace it." },
  { title: "What-ifs you can undo", text: "Change a number to see the date move; one click takes you back to your data." },
];

export default function Landing() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">
      <header className="flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-[17px] font-medium tracking-tight">{APP_NAME}</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/demo" className="hidden rounded-lg px-3 py-2 text-muted hover:text-foreground sm:block">
            Demo
          </Link>
          <Link href="/projects" className="rounded-lg px-3 py-2 text-muted hover:text-foreground">
            Open the app
          </Link>
        </nav>
      </header>

      <main>
        <section className="grid grid-cols-1 items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h1 className="text-4xl font-medium tracking-tight sm:text-5xl lg:text-[56px] lg:leading-[1.05]">
              See what it takes to reach your revenue goal.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Put in your monthly revenue and paying customers. Pick a target, like €10k a month by
              next year. {APP_NAME} works out how many customers you need, what churn is costing
              you, and when you get there at today&apos;s pace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/projects/new" className={primary}>
                Start with your numbers
              </Link>
              <Link href="/demo" className={secondary}>
                Try the demo
              </Link>
            </div>
            <p className="mt-4 text-sm text-faint">Free. No account needed: your numbers stay in your browser.</p>
          </div>
          <ProductPreview className="mx-auto w-full max-w-md lg:max-w-none" />
        </section>

        <Section title="Three questions, one page" intro="For SaaS products, apps and side projects that charge every month.">
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-border bg-surface p-6">
                <span className="num flex h-6 w-6 items-center justify-center rounded-full bg-surface-3 text-xs text-muted">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-medium">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section
          title="A plan, not a prediction"
          intro="Forecasts are bets. This is arithmetic on numbers you can see, and it tells you which ones are guesses."
        >
          <ul className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
            {HONEST.map((h) => (
              <li key={h.title} className="border-l border-border-strong pl-4">
                <h3 className="font-medium">{h.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{h.text}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Ask about your numbers"
          intro={`An assistant that answers with the same plan engine as the page, so the numbers match. Pay per question: ${CREDIT_COST.question} credit, or ${CREDIT_COST.webSearch} with a web search. New accounts get ${SIGNUP_BONUS} free.`}
        >
          <div className="max-w-xl space-y-4 rounded-2xl border border-border bg-surface p-5 text-sm">
            <p className="ml-auto w-fit rounded-2xl rounded-br-md bg-surface-3 px-4 py-2.5">
              What if I raise my price to €25 a month?
            </p>
            <p className="text-xs text-faint">Ran the plan with price €25</p>
            <p className="leading-relaxed text-foreground/90">
              At €25 you need <strong className="font-medium">400</strong> paying customers instead of 500, about
              32 new ones a month. With the 5.2% who leave each month, today&apos;s 7 new customers still
              stall you around €3,400: price helps, but keeping customers is the bigger lever.
            </p>
          </div>
        </Section>

        <Section title="Your data stays yours">
          <ul className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
            <li className="border-l border-border-strong pl-4">
              <h3 className="font-medium">No account needed</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Numbers live in your browser, with a one-click backup file.
              </p>
            </li>
            <li className="border-l border-border-strong pl-4">
              <h3 className="font-medium">Sync when you want</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Sign in with your email to see your projects on any device.
              </p>
            </li>
            <li className="border-l border-border-strong pl-4">
              <h3 className="font-medium">Stripe, read-only</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                A restricted key you paste once to import your history. It is never stored.
              </p>
            </li>
          </ul>
        </Section>

        <section className="border-t border-border py-16 text-center sm:py-24">
          <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">Start with last month&apos;s numbers.</h2>
          <p className="mt-3 text-muted">Two numbers and a goal. It takes two minutes.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/projects/new" className={primary}>
              Start now
            </Link>
            <Link href="/demo" className={secondary}>
              Try the demo
            </Link>
          </div>
        </section>
      </main>

      <footer className="flex flex-wrap justify-between gap-3 border-t border-border py-8 text-xs text-faint">
        <span>{APP_NAME}</span>
        <span>Built with Next.js, Supabase, Stripe and Claude.</span>
      </footer>
    </div>
  );
}
