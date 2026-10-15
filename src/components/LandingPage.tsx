"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Building2,
  House,
  Moon,
  Sun,
} from "lucide-react";
import { PwaInstallButton } from "./PwaSupport";
import styles from "./LandingPage.module.css";

type Props = {
  logoSrc?: string;
  theme: string;
  checking: boolean;
  signedIn: boolean;
  error: string;
  message: string;
  warning: boolean;
  onTheme: () => void;
  onSignIn: () => void;
  onStart: () => void;
  onPreview: () => void;
};

export function LandingPage({
  logoSrc = "/homematch-logo.svg",
  theme,
  checking,
  signedIn,
  error,
  message,
  warning,
  onTheme,
  onSignIn,
  onStart,
  onPreview,
}: Props) {
  return (
    <div className={styles.page}>
      <a href="#landing-main" className={styles.skip}>
        Skip to content
      </a>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="HomeMatch home">
          <Image src={logoSrc} alt="" width={32} height={39} priority />
          <span>
            Home<span>Match</span>
          </span>
        </Link>
        <nav className={styles.nav} aria-label="Housing pathways">
          <a href="#bto-path">BTO</a>
          <a href="#existing-path">Existing homes</a>
        </nav>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.icon}
            onClick={onTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </button>
          <PwaInstallButton />
          <button
            type="button"
            className={styles.signIn}
            disabled={checking}
            onClick={signedIn ? onPreview : onSignIn}
          >
            {checking
              ? "Checking session..."
              : signedIn
                ? "Open workspace"
                : "Sign in"}
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </header>
      <main id="landing-main">
        <section className={styles.hero} aria-labelledby="landing-title">
          <Image
            src="/singapore-homes.jpg"
            alt="Singapore HDB apartment blocks surrounded by trees"
            fill
            sizes="100vw"
            priority
            className={styles.photo}
          />
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>SINGAPORE / A PLACE TO BELONG</p>
            <h1 id="landing-title">HomeMatch</h1>
            <p className={styles.promise}>Find an area that feels like you.</p>
            <p className={styles.description}>
              Your everyday places. Your favourite things.{" "}
              <br className={styles.desktopBreak} />A neighbourhood that brings
              them together.
            </p>
            <div className={styles.heroActions}>
              <button
                type="button"
                className={styles.primary}
                disabled={checking}
                onClick={signedIn ? onPreview : onStart}
              >
                {signedIn ? "Go to my workspace" : "Find my area"}
                <ArrowRight aria-hidden="true" />
              </button>
              {!signedIn && (
                <button
                  type="button"
                  className={styles.preview}
                  onClick={onPreview}
                >
                  Preview planner <ArrowRight aria-hidden="true" />
                </button>
              )}
            </div>
            <span className={styles.script}>feel at home.</span>
          </div>
          <a href="#housing-paths" className={styles.scrollLink}>
            Find your next chapter <ArrowDown aria-hidden="true" />
          </a>
        </section>
        {(error || message) && (
          <div className={styles.feedback}>
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
        <section
          id="housing-paths"
          className={styles.pathways}
          aria-labelledby="pathways-title"
        >
          <div className={styles.sectionIntro}>
            <p className={styles.sectionEyebrow}>
              DIFFERENT HOMES. THE SAME EVERYDAY LIFE.
            </p>
            <h2 id="pathways-title">Where does your next chapter begin?</h2>
          </div>
          <div className={styles.paths}>
            <article id="bto-path" className={styles.path}>
              <Building2 aria-hidden="true" />
              <div>
                <span className={styles.pathNumber}>01 / A FRESH START</span>
                <h3>BTO</h3>
                <p>A new home, with your familiar places still close.</p>
                <small>
                  Published launch-price research. Current catalogue: archived
                  June 2026 projects.
                </small>
              </div>
            </article>
            <article id="existing-path" className={styles.path}>
              <House aria-hidden="true" />
              <div>
                <span className={styles.pathNumber}>
                  02 / SOMETHING ALREADY ROOTED
                </span>
                <h3>Existing homes</h3>
                <p>Resale HDB, condominiums and landed homes.</p>
                <small>
                  Historical HDB evidence. Private pricing awaits a verified URA
                  import.
                </small>
              </div>
            </article>
          </div>
          <div className={styles.join}>
            <p>Make room for the life you want to live.</p>
            <button
              type="button"
              className={styles.textAction}
              disabled={checking}
              onClick={signedIn ? onPreview : onStart}
            >
              {signedIn ? "Open my workspace" : "Get started"}
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.mobileInstall}>
          <PwaInstallButton />
        </div>
        <div>
          <strong>HomeMatch</strong>
          <p>
            Area research, not a property valuation or eligibility assessment.
          </p>
        </div>
        <div className={styles.sourceLinks}>
          <span>Evidence from</span>
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
          <a
            href="https://unsplash.com/photos/a-group-of-tall-buildings-m6WvddK353k"
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            Photo: S M / Unsplash
          </a>
        </div>
      </footer>
    </div>
  );
}
