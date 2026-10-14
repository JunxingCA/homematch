"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Download, RefreshCw, Share, WifiOff, X } from "lucide-react";
import styles from "./PwaSupport.module.css";

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type PwaState = {
  ready: boolean;
  installed: boolean;
  ios: boolean;
  secure: boolean;
  offline: boolean;
  prompt: InstallPrompt | null;
  consumePrompt(): void;
  worker: "development" | "unsupported" | "loading" | "ready" | "failed";
};
const PwaContext = createContext<PwaState | null>(null);

export function PwaProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [secure, setSecure] = useState(false);
  const [offline, setOffline] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [worker, setWorker] = useState<PwaState["worker"]>("loading");
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const reloadApproved = useRef(false);

  useEffect(() => {
    let alive = true;
    const standalone = window.matchMedia("(display-mode: standalone)");
    const updateInstalled = () =>
      setInstalled(
        standalone.matches ||
          Boolean(
            (navigator as Navigator & { standalone?: boolean }).standalone,
          ),
      );
    const online = () => setOffline(!navigator.onLine);
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const appInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    const controllerChanged = () => {
      if (reloadApproved.current) window.location.reload();
    };
    queueMicrotask(() => {
      if (!alive) return;
      updateInstalled();
      online();
      setIos(
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
      );
      setSecure(window.isSecureContext);
      setReady(true);
    });
    standalone.addEventListener("change", updateInstalled);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);

    const canRegister = "serviceWorker" in navigator && window.isSecureContext;
    if (canRegister)
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        controllerChanged,
      );
    if (process.env.NODE_ENV !== "production" || !canRegister) {
      queueMicrotask(() => {
        if (alive)
          setWorker(
            process.env.NODE_ENV !== "production"
              ? "development"
              : "unsupported",
          );
      });
    } else {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((registration) => {
          if (!alive) return;
          if (registration.waiting) setWaiting(registration.waiting);
          const watch = () => {
            const candidate = registration.installing;
            if (!candidate) return;
            candidate.addEventListener("statechange", () => {
              if (!alive) return;
              if (
                candidate.state === "installed" &&
                navigator.serviceWorker.controller
              )
                setWaiting(registration.waiting ?? candidate);
              if (candidate.state === "redundant" && !registration.active)
                setWorker("failed");
            });
          };
          watch();
          registration.addEventListener("updatefound", watch);
          return navigator.serviceWorker.ready.then(() => {
            if (alive) setWorker("ready");
          });
        })
        .catch(() => {
          if (alive) setWorker("failed");
        });
    }
    return () => {
      alive = false;
      standalone.removeEventListener("change", updateInstalled);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
      if (canRegister)
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          controllerChanged,
        );
    };
  }, []);

  return (
    <PwaContext.Provider
      value={{
        ready,
        installed,
        ios,
        secure,
        offline,
        prompt,
        consumePrompt: () => setPrompt(null),
        worker,
      }}
    >
      {offline && (
        <div className={styles.status} role="status">
          <WifiOff aria-hidden="true" />
          <span>
            You are offline. Changes are not saved until you reconnect and
            submit them.
          </span>
        </div>
      )}
      {waiting && (
        <div className={styles.status} role="status">
          <span>A HomeMatch update is available.</span>
          <button
            disabled={offline}
            onClick={() => {
              if (
                !window.confirm(
                  "Reload to update HomeMatch? Unsaved edits will be lost.",
                )
              )
                return;
              reloadApproved.current = true;
              waiting.postMessage({ type: "ACTIVATE_UPDATE" });
            }}
          >
            <RefreshCw aria-hidden="true" />
            Update now
          </button>
        </div>
      )}
      {children}
    </PwaContext.Provider>
  );
}

export function PwaInstallButton() {
  const state = useContext(PwaContext);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  if (!state?.ready || state.installed) return null;
  return (
    <>
      <button
        className={styles.icon}
        aria-label="Install HomeMatch"
        title="Install HomeMatch"
        onClick={() => {
          setMessage("");
          setOpen(true);
        }}
      >
        <Download aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        aria-labelledby="pwa-title"
        aria-describedby="pwa-description"
      >
        <header>
          <h2 id="pwa-title">HomeMatch, closer.</h2>
          <button
            className={styles.icon}
            aria-label="Close installation dialog"
            onClick={() => setOpen(false)}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <p id="pwa-description">
          Add HomeMatch to your device. Your workspace stays connected to the
          same account.
        </p>
        {!state.secure ? (
          <p role="status">
            Open the secure HTTPS website to install HomeMatch.
          </p>
        ) : state.ios ? (
          <ol>
            <li>Open HomeMatch in Safari.</li>
            <li>
              <Share aria-hidden="true" /> Open Share, then Add to Home Screen.
            </li>
            <li>Keep Open as Web App enabled if shown, then tap Add.</li>
          </ol>
        ) : state.prompt ? (
          <button
            className={styles.install}
            disabled={busy || state.offline}
            onClick={async () => {
              const event = state.prompt;
              if (!event || busy) return;
              setBusy(true);
              state.consumePrompt();
              try {
                await event.prompt();
                const choice = await event.userChoice;
                setMessage(
                  choice.outcome === "accepted"
                    ? "Installation requested. Follow your device's confirmation."
                    : "Installation cancelled. You can still use HomeMatch here.",
                );
              } catch {
                setMessage(
                  "Installation could not start. Use your browser's install menu instead.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download aria-hidden="true" />
            Install app
          </button>
        ) : (
          <p>
            Use your browser menu to install HomeMatch. In Chrome or Edge, look
            for Install app. In Safari on Mac, choose File, then Add to Dock.
          </p>
        )}
        {busy && <p role="status">Waiting for your device...</p>}
        {message && <p role="status">{message}</p>}
        <p className={styles.note}>
          An internet connection is required for sign-in, maps, searches and
          saving. No account data is saved for offline use.
        </p>
        {state.worker === "development" && (
          <p className={styles.note}>
            Offline support is enabled in the production build, not this
            development preview.
          </p>
        )}
        {state.worker === "failed" && (
          <p className={styles.note} role="status">
            Offline setup could not finish. Reconnect and reopen HomeMatch to
            retry.
          </p>
        )}
        {state.worker === "unsupported" && (
          <p className={styles.note}>
            This browser cannot prepare an offline screen. The website remains
            available online.
          </p>
        )}
      </dialog>
    </>
  );
}
