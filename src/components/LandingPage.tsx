"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PwaInstallButton } from "./PwaSupport";
import { IntroSequence, ReplayIntroButton } from "./lights/IntroSequence";
import { LivingWindow } from "./lights/LivingWindow";
import { MagnifierHeadline } from "./lights/MagnifierHeadline";
import { TiltCard } from "./lights/TiltCard";
import { Wordmark } from "./lights/Logo";
import { ThemeSwitch, type ThemeChoice } from "./lights/ThemeSwitch";
import type { LifestylePresetId } from "./lights/presets";
import styles from "./LandingPage.module.css";

type Props = {
  themeChoice: ThemeChoice;
  checking: boolean;
  signedIn: boolean;
  error: string;
  message: string;
  warning: boolean;
  onThemeChoice: (choice: ThemeChoice) => void;
  onSignIn: () => void;
  onStart: () => void;
  onPreview: () => void;
  onPreset: (preset: LifestylePresetId) => void;
};

const TRUST = [
  {
    title: "Official records",
    body: "HDB resale transactions from data.gov.sg",
    bg: "var(--amber-soft)",
    icon: "M9 12l2 2 4-4M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  },
  {
    title: "Real journeys",
    body: "OneMap public transport and driving routes",
    bg: "var(--pastel-blue)",
    icon: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  },
  {
    title: "You stay in control",
    body: "AI drafts are never saved without your review",
    bg: "var(--pastel-green)",
    icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12h6",
  },
  {
    title: "Not a listings site",
    body: "Area research, not sales or valuations",
    bg: "var(--pastel-pink)",
    icon: "M3 12l9-8 9 8M5 10v10h14V10M10 20v-6h4v6",
  },
];

const STEPS = [
  {
    label: "Ground floor",
    title: "Tell us how you live",
    body: "Your budget, up to four places you go every week, and the amenities you can’t live without.",
  },
  {
    label: "Second floor",
    title: "We read the neighbourhood",
    body: "Journey times, hawkers, parks, schools, healthcare and sports venues — scored against your priorities.",
  },
  {
    label: "Top floor",
    title: "Meet your matches",
    body: "Towns ranked by how well they fit your week, with the evidence behind every score. Save, compare, decide.",
  },
];

const PRESETS: {
  id: LifestylePresetId;
  title: string;
  body: string;
  tags: string[];
  bg: string;
  icon: string;
}[] = [
  {
    id: "hawker",
    title: "The hawker regular",
    body: "Kopi downstairs, a hawker centre within a short walk, groceries on the way home.",
    tags: ["Hawker centres", "Groceries"],
    bg: "var(--amber-soft)",
    icon: "M4 10h16M6 10l1 9h10l1-9M9 10V6a3 3 0 0 1 6 0v4",
  },
  {
    id: "family",
    title: "The young family",
    body: "Schools close by, a park for the weekend, a hospital within reach.",
    tags: ["Schools", "Parks", "Healthcare"],
    bg: "var(--pastel-green)",
    icon: "M12 3l9 8h-3v9H6v-9H3z",
  },
  {
    id: "runner",
    title: "The park runner",
    body: "A park at the void deck, a running track for the long run, a gym nearby.",
    tags: ["Parks", "Running tracks", "Gym"],
    bg: "var(--pastel-blue)",
    icon: "M12 3c3 4 5 6 5 9a5 5 0 0 1-10 0c0-3 2-5 5-9zM12 21v-6",
  },
  {
    id: "commuter",
    title: "The commuter",
    body: "Your daily journey matters most. Short, simple trips to the places you go.",
    tags: ["Journeys first"],
    bg: "var(--pastel-pink)",
    icon: "M7 3h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM5 11h14M8 21l2-4M16 21l-2-4",
  },
];

function StepFacade({ level }: { level: number }) {
  return (
    <div className={styles.stepFacade} aria-hidden="true">
      {[0, 1, 2].map((f) => (
        <span key={f}>
          <i style={{ background: f <= level ? "var(--amber)" : "#7E9C8B" }} />
          <i
            style={{
              background:
                f === level
                  ? "var(--coral)"
                  : f < level
                    ? "var(--amber)"
                    : "#7E9C8B",
            }}
          />
        </span>
      ))}
    </div>
  );
}

export function LandingPage({
  themeChoice,
  checking,
  signedIn,
  error,
  message,
  warning,
  onThemeChoice,
  onSignIn,
  onStart,
  onPreview,
  onPreset,
}: Props) {
  return (
    <div className={styles.page}>
      <IntroSequence />
      <a href="#landing-main" className={styles.skip}>
        Skip to content
      </a>
      <header className={`wrap ${styles.header}`}>
        <Link href="/" className={styles.brand} aria-label="HomeMatch home">
          <Wordmark />
        </Link>
        <nav className={styles.nav} aria-label="Main">
          <a className={styles.navLink} href="#how">
            How it works
          </a>
          <a className={styles.navLink} href="#lifestyles">
            Lifestyles
          </a>
          <ThemeSwitch choice={themeChoice} onChoose={onThemeChoice} />
          <ReplayIntroButton />
          <PwaInstallButton />
          <button
            type="button"
            className="btn btn--small"
            disabled={checking}
            onClick={signedIn ? onPreview : onSignIn}
          >
            {checking
              ? "Checking session..."
              : signedIn
                ? "Open workspace"
                : "Sign in"}
            <ArrowRight aria-hidden="true" size={17} />
          </button>
        </nav>
      </header>

      <main id="landing-main">
        <section className={`wrap ${styles.hero}`}>
          <div className={styles.heroCopy}>
            <div className={styles.chips}>
              <span className="chip">
                <span className="dot" />
                BTO launches
              </span>
              <span className="chip">
                <span className="dot" style={{ background: "var(--sage)" }} />
                HDB resale
              </span>
              <span className="chip">
                <span className="dot" style={{ background: "var(--coral)" }} />
                Condos and landed homes
              </span>
            </div>
            <MagnifierHeadline>
              Find a home that fits the way you{" "}
              <span className={styles.highlight}>live.</span>
            </MagnifierHeadline>
            <p className={styles.lede}>
              Tell us about your weekdays — the commute, the kopi, the school
              run. HomeMatch reads every neighbourhood and lights up the ones
              that fit.
            </p>
            <div className={styles.ctas}>
              <button
                type="button"
                className="btn"
                disabled={checking}
                onClick={signedIn ? onPreview : onStart}
              >
                {signedIn ? "Open my workspace" : "Start matching"}
                <ArrowRight aria-hidden="true" size={18} />
              </button>
              <a className="btn btn--ghost" href="#how">
                How it works
              </a>
            </div>
            {!signedIn && (
              <button
                type="button"
                className={styles.tryLink}
                onClick={onPreview}
              >
                Preview planner without an account
              </button>
            )}
          </div>
          <div className={styles.heroArt}>
            <LivingWindow />
          </div>
        </section>

        {(error || message) && (
          <div className={`wrap ${styles.feedback}`}>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            {message && (
              <p
                role={warning ? "alert" : "status"}
                className={warning ? styles.error : undefined}
              >
                {message}
              </p>
            )}
          </div>
        )}

        <section className="wrap" aria-label="Why people trust HomeMatch">
          <div className={`${styles.trust} reveal-on-scroll`}>
            {TRUST.map((t) => (
              <div key={t.title} className={styles.trustItem}>
                <span className={styles.trustIcon} style={{ background: t.bg }}>
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#14213D"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={t.icon} />
                  </svg>
                </span>
                <span>
                  <strong>{t.title}</strong>
                  <span>{t.body}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className={styles.how} aria-labelledby="how-title">
          <div className={`wrap ${styles.howInner}`}>
            <h2 id="how-title" className="h-section reveal-on-scroll">
              Three floors up to the right home.
            </h2>
            <div className={styles.steps}>
              {STEPS.map((s, i) => (
                <article
                  key={s.title}
                  className={`${styles.step} reveal-on-scroll`}
                >
                  <div className={styles.stepHead}>
                    <StepFacade level={i} />
                    <span className="chip chip--dark">
                      <span className="dot" />
                      {s.label}
                    </span>
                  </div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="lifestyles"
          className={`wrap ${styles.lifestyles}`}
          aria-labelledby="lifestyles-title"
        >
          <div className={`${styles.lifeHead} reveal-on-scroll`}>
            <h2 id="lifestyles-title" className="h-section">
              Not sure where to start? Pick a life.
            </h2>
            <p>
              Each one pre-fills your preferences. You can change everything
              after.
            </p>
          </div>
          <div className={styles.presets}>
            {PRESETS.map((p) => (
              <div key={p.id} className="reveal-on-scroll">
                <TiltCard onClick={() => onPreset(p.id)}>
                  <span
                    className={styles.presetIcon}
                    style={{ background: p.bg }}
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#14213D"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d={p.icon} />
                    </svg>
                  </span>
                  <span className={styles.presetTitle}>{p.title}</span>
                  <span className={styles.presetBody}>{p.body}</span>
                  <span className={styles.presetTags}>
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="tag"
                        style={{ background: p.bg }}
                      >
                        {t}
                      </span>
                    ))}
                  </span>
                </TiltCard>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`wrap ${styles.footerInner}`}>
          <div className={styles.footerTop}>
            <div className={styles.footerAbout}>
              <Wordmark tone="light" />
              <p>
                Home is more than four walls. It’s the walk to the MRT, the
                hawker downstairs and the park on Sunday.
              </p>
            </div>
            <div className={styles.footerCols}>
              <div className={styles.footerCol}>
                <span className="chip chip--dark">
                  <span className="dot" />
                  Product
                </span>
                <a href="#how">How it works</a>
                <a href="#lifestyles">Lifestyles</a>
              </div>
              <div className={styles.footerCol}>
                <span className="chip chip--dark">
                  <span className="dot" style={{ background: "var(--sage)" }} />
                  Evidence from
                </span>
                <a
                  href="https://www.onemap.gov.sg/"
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                >
                  OneMap
                </a>
                <a
                  href="https://data.gov.sg/"
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                >
                  data.gov.sg
                </a>
              </div>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span className="chip chip--dark">
              <span className="dot" style={{ background: "var(--mint)" }} />
              Area research, not a property valuation or eligibility assessment.
            </span>
            <span className="chip chip--dark">© 2026 HomeMatch</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
