"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useCallback,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FilePenLine,
  House,
  Info,
  Layers,
  ListFilter,
  LogOut,
  MapPin,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  TrainFront,
  Trash2,
  Trees,
  UserRound,
  X,
  Bookmark,
} from "lucide-react";
import {
  categories,
  confirmedProfileSchema,
  editDestinationQuery,
  flatTypes,
  lifestyleCategories,
  type Location,
  type Preference,
  type Profile,
} from "@/domain/preferences";
import { samplePreference } from "@/domain/fixtures";
import styles from "./HomeMatch.module.css";
import { RecommendationResults } from "./RecommendationResults";
import { AreaExplorer } from "./AreaExplorer";
import type { MarketFilters } from "@/domain/marketEvidence.mjs";
import { PwaInstallButton } from "./PwaSupport";
import type { Discovery } from "@/domain/recommendations";
import type { SavedArea } from "@/domain/shortlist";
import { Shortlist } from "./Shortlist";
import { PreferenceInterpretation } from "./PreferenceInterpretation";
import { amenityPresentation } from "./amenityPresentation";
import { AccountDialog, type DeletionFeedback } from "./AccountDialog";
import { LandingPage } from "./LandingPage";
import {
  draftProposal,
  type InterpretationResult,
} from "@/domain/interpretation";

const money = (value: number) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: 0,
  }).format(value);
const clone = <T,>(value: T): T => structuredClone(value);
type Viewer = { id: string; email?: string };
function initialPreference(preview: boolean, locationMode: string): Preference {
  const value = clone(samplePreference);
  if (!preview && locationMode === "onemap")
    value.destinations = [
      { query: "", location: null, visits: 5, mode: "public" },
    ];
  return value;
}
type ApiError = {
  code: string;
  message: string;
  fields?: { path: string; message: string }[];
};
class RequestError extends Error {
  constructor(public detail: ApiError) {
    super(detail.message);
  }
}
async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new RequestError(result.error);
  return result;
}

function Section({
  icon,
  title,
  detail,
  children,
}: {
  icon: ReactNode;
  title: string;
  detail?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div className={styles.sectionTitle}>
          {icon}
          <h2>{title}</h2>
        </div>
        {detail && <small>{detail}</small>}
      </div>
      {children}
    </section>
  );
}

export function HomeMatch({
  mode,
  locationMode,
  appleSignInEnabled = false,
  welcome = false,
}: {
  mode: "preview" | "supabase";
  locationMode: "fixtures" | "onemap";
  appleSignInEnabled?: boolean;
  welcome?: boolean;
}) {
  const preview = mode === "preview";
  const [theme, setTheme] = useState("dark");
  const [palette, setPalette] = useState("red");
  const [ready, setReady] = useState(false);
  const [sessionReady, setSessionReady] = useState(preview);
  const [plannerPreview, setPlannerPreview] = useState(false);
  const [preference, setPreference] = useState<Preference>(() =>
    initialPreference(preview, locationMode),
  );
  const [step, setStep] = useState<
    | "edit"
    | "review"
    | "done"
    | "profiles"
    | "results"
    | "shortlist"
    | "explore"
  >("edit");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [active, setActive] = useState<Profile | null>(null);
  const [user, setUser] = useState<Viewer | null>(null);
  const previousUserId = useRef<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const [accountWarning, setAccountWarning] = useState(false);
  const [authKind, setAuthKind] = useState<"sign-in" | "sign-up" | "recover">(
    "sign-in",
  );
  const [authMessage, setAuthMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<{ path: string; message: string }[]>([]);
  const [candidates, setCandidates] = useState<Record<number, Location[]>>({});
  const [searching, setSearching] = useState<number | null>(null);
  const [searchError, setSearchError] = useState<Record<number, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [dirty, setDirty] = useState(false);
  const [interpretationVersion, setInterpretationVersion] = useState(0);
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [searchProfile, setSearchProfile] = useState<Profile | null>(null);
  const [marketFilters, setMarketFilters] = useState<MarketFilters>();
  const [history, setHistory] = useState<
    { id: string; createdAt: string; profileName: string }[]
  >([]);
  const historyGeneration = useRef(0);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [clearingHistory, setClearingHistory] = useState(false);
  const loadHistory = useCallback(
    async (isCurrent: () => boolean = () => true) => {
      const generation = ++historyGeneration.current;
      try {
        const result = await api<{
          discoveries: { id: string; createdAt: string; profileName: string }[];
        }>("/api/discoveries");
        if (generation !== historyGeneration.current || !isCurrent()) return;
        setHistory(result.discoveries);
        setHistoryError("");
      } catch (e) {
        if (generation === historyGeneration.current && isCurrent())
          setHistoryError(
            e instanceof Error ? e.message : "Recent searches are unavailable.",
          );
      } finally {
        if (generation === historyGeneration.current && isCurrent())
          setHistoryReady(true);
      }
    },
    [],
  );
  const discoveryGeneration = useRef(0);
  const shortlistGeneration = useRef(0);
  const [savedAreas, setSavedAreas] = useState<SavedArea[]>([]);
  const [shortlistReady, setShortlistReady] = useState(false);
  const [shortlistError, setShortlistError] = useState("");
  const [savingArea, setSavingArea] = useState(false);
  const [initialArea, setInitialArea] = useState<string>();
  const [fromShortlist, setFromShortlist] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const authDialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const requestGeneration = useRef(0);
  const accountGeneration = useRef(0);
  const accountEvents = useRef<BroadcastChannel | null>(null);
  const clearAccountWorkspace = useCallback(() => {
    accountGeneration.current++;
    requestGeneration.current++;
    discoveryGeneration.current++;
    shortlistGeneration.current++;
    historyGeneration.current++;
    setDiscovery(null);
    setHistory([]);
    setHistoryReady(false);
    setHistoryError("");
    setClearingHistory(false);
    setSearchProfile(null);
    setMarketFilters(undefined);
    setSavedAreas([]);
    setShortlistReady(false);
    setShortlistError("");
    setSavingArea(false);
    setUser(null);
    setPlannerPreview(false);
    setProfiles([]);
    setActive(null);
    previousUserId.current = null;
    setPreference(initialPreference(preview, locationMode));
    setDirty(false);
    setCandidates({});
    setSearchError({});
    setSearching(null);
    setFields([]);
    setInterpretationVersion((version) => version + 1);
    setInitialArea(undefined);
    setFromShortlist(false);
    setDeleteTarget(null);
    setAccountOpen(false);
    setStep("edit");
  }, [preview, locationMode]);

  useEffect(() => {
    if (!user || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("homematch-account-events");
    accountEvents.current = channel;
    channel.onmessage = (event) => {
      if (
        event.data?.type === "history-cleared" &&
        event.data.userId === user.id
      ) {
        setHistory([]);
        void loadHistory();
      }
      if (
        event.data?.type === "account-deleted" &&
        event.data.userId === user.id
      ) {
        clearAccountWorkspace();
        setAccountWarning(false);
        setAccountMessage("Your HomeMatch account was deleted in another tab.");
      }
    };
    return () => {
      channel.close();
      if (accountEvents.current === channel) accountEvents.current = null;
    };
  }, [user, clearAccountWorkspace, loadHistory]);

  useEffect(() => {
    const requestedPalette = new URLSearchParams(location.search).get(
      "palette",
    );
    if (
      requestedPalette === "rose" ||
      requestedPalette === "red" ||
      requestedPalette === "emerald"
    )
      document.documentElement.dataset.palette = requestedPalette;
    else if (!document.documentElement.dataset.palette)
      document.documentElement.dataset.palette = "red";
    queueMicrotask(() =>
      setPalette(
        document.documentElement.dataset.palette === "red"
          ? "red"
          : document.documentElement.dataset.palette === "rose"
            ? "rose"
            : "emerald",
      ),
    );
    const stored = localStorage.getItem("homematch-theme");
    const selected = stored === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = selected;
    // Theme is non-sensitive; preferences and identity never enter localStorage.
    queueMicrotask(() => {
      setTheme(selected);
      setReady(true);
    });
    const authStatus = new URLSearchParams(location.search).get("auth");
    if (authStatus === "password-reset" || authStatus === "recovery")
      queueMicrotask(() => {
        setAuthKind(authStatus === "recovery" ? "recover" : "sign-in");
        setAuthMessage(
          authStatus === "password-reset"
            ? "Your password was reset. Sign in with your new password."
            : "",
        );
        setAuthOpen(true);
        window.history.replaceState(null, "", "/");
      });
    else if (authStatus)
      queueMicrotask(() =>
        setError(
          authStatus === "cancelled"
            ? "Sign-in was cancelled. You can try again."
            : authStatus === "oauth-failed"
              ? "Sign-in could not be completed. Please try again."
              : "The confirmation link expired or was invalid. Please try signing in.",
        ),
      );
    if (!preview) {
      api<{ user: Viewer }>("/api/auth/session")
        .then((result) => {
          previousUserId.current = result.user.id;
          setUser(result.user);
        })
        .catch((e) => {
          if (e instanceof RequestError && e.detail.code !== "SIGN_IN_REQUIRED")
            setError(e.message);
        })
        .finally(() => setSessionReady(true));
    }
  }, [preview]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const savedGeneration = shortlistGeneration.current;
    api<{ savedAreas: SavedArea[] }>("/api/shortlist")
      .then((result) => {
        if (alive && savedGeneration === shortlistGeneration.current) {
          setSavedAreas(result.savedAreas);
          setShortlistReady(true);
          setShortlistError("");
        }
      })
      .catch((e) => {
        if (alive && savedGeneration === shortlistGeneration.current) {
          setShortlistError(e.message);
          setShortlistReady(true);
        }
      });
    void loadHistory(() => alive);
    api<{ profiles: Profile[] }>("/api/profiles")
      .then((result) => {
        if (alive) setProfiles(result.profiles);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    // Only actual interactions cause a throttled activity request; no heartbeat.
    let lastSent = Date.now();
    const activity = () => {
      if (Date.now() - lastSent < 60_000) return;
      lastSent = Date.now();
      api("/api/auth/activity", "POST").catch((e) => {
        if (
          e instanceof RequestError &&
          ["SIGN_IN_REQUIRED", "SESSION_EXPIRED"].includes(e.detail.code)
        ) {
          setUser(null);
          setProfiles([]);
          shortlistGeneration.current++;
          setSavedAreas([]);
          setShortlistReady(false);
          setSavingArea(false);
          discoveryGeneration.current++;
          setDiscovery(null);
          setHistory([]);
          setSearchProfile(null);
          setAuthOpen(true);
          setError(e.message);
        }
      });
    };
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    return () => {
      alive = false;
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
    };
  }, [user, loadHistory]);

  useEffect(() => {
    if (!authOpen && !deleteTarget) return;
    const dialog = authDialogRef.current;
    const focused = document.activeElement as HTMLElement;
    // Preserve the opener across pending/error renders and inert-background blur.
    if (focused !== document.body && !dialog?.contains(focused))
      previousFocus.current = focused;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not([disabled]),input,select,a[href]",
        ) ?? [],
      );
    focusable()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        setAuthOpen(false);
        setDeleteTarget(null);
      }
      if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previousFocus.current?.focus();
    };
  }, [authOpen, deleteTarget, busy]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function fail(e: unknown) {
    const detail = e instanceof RequestError ? e.detail : null;
    setError(
      e instanceof Error
        ? e.message
        : "Unable to connect. Your entries are unchanged.",
    );
    if (detail?.fields) setFields(detail.fields);
    if (
      detail &&
      ["SIGN_IN_REQUIRED", "SESSION_EXPIRED"].includes(detail.code)
    ) {
      setUser(null);
      setProfiles([]);
      clearShortlist();
      discoveryGeneration.current++;
      setDiscovery(null);
      setHistory([]);
      setSearchProfile(null);
      setAuthOpen(true);
      setBusy(false);
    }
  }
  function clearShortlist() {
    shortlistGeneration.current++;
    setSavedAreas([]);
    setShortlistReady(false);
    setShortlistError("");
    setSavingArea(false);
  }
  async function reloadShortlist() {
    const generation = ++shortlistGeneration.current;
    setShortlistReady(false);
    setShortlistError("");
    try {
      const result = await api<{ savedAreas: SavedArea[] }>("/api/shortlist");
      if (generation === shortlistGeneration.current)
        setSavedAreas(result.savedAreas);
    } catch (e) {
      if (generation === shortlistGeneration.current) {
        setShortlistError(e instanceof Error ? e.message : "Please retry.");
        fail(e);
      }
    } finally {
      if (generation === shortlistGeneration.current) setShortlistReady(true);
    }
  }
  async function removeSavedArea(item: SavedArea) {
    if (savingArea) return;
    const generation = shortlistGeneration.current;
    setSavingArea(true);
    setError("");
    try {
      await api(`/api/shortlist/${item.id}`, "DELETE");
      if (generation === shortlistGeneration.current)
        setSavedAreas((items) => items.filter((s) => s.id !== item.id));
    } catch (e) {
      if (generation === shortlistGeneration.current) fail(e);
    } finally {
      if (generation === shortlistGeneration.current) setSavingArea(false);
    }
  }
  async function toggleSavedArea(areaId: string) {
    if (!discovery || savingArea || !shortlistReady || shortlistError) return;
    const existing = savedAreas.find((s) => s.result.area.id === areaId);
    if (existing) return removeSavedArea(existing);
    const generation = shortlistGeneration.current;
    setSavingArea(true);
    setError("");
    try {
      const result = await api<{ savedArea: SavedArea }>(
        "/api/shortlist",
        "POST",
        { discoveryId: discovery.id, areaId },
      );
      if (generation === shortlistGeneration.current)
        setSavedAreas((items) => [
          result.savedArea,
          ...items.filter((s) => s.result.area.id !== areaId),
        ]);
    } catch (e) {
      if (generation === shortlistGeneration.current) fail(e);
    } finally {
      if (generation === shortlistGeneration.current) setSavingArea(false);
    }
  }
  function update(change: Partial<Preference>) {
    setPreference((p) => ({ ...p, ...change }));
    setDirty(true);
    setFields([]);
    setError("");
  }
  function applyInterpretation(result: InterpretationResult) {
    requestGeneration.current++;
    const { preference: proposed } = draftProposal(preference, result.draft);
    update(proposed);
    setCandidates({});
    setSearchError({});
    setSearching(null);
    const matches: Record<number, Location[]> = {};
    const problems: Record<number, string> = {};
    if (result.draft.destinations !== null)
      result.locations.forEach((location, i) => {
        matches[i] = location.candidates;
        if (location.error) problems[i] = location.error;
        else if (!location.candidates.length)
          problems[i] =
            "No OneMap match. Search another building name or postal code.";
      });
    setCandidates(matches);
    setSearchError(problems);
  }
  async function findAreas(profile: Profile, filters?: MarketFilters) {
    if (
      dirty &&
      !window.confirm("Use the saved profile and discard unsaved changes?")
    )
      return;
    const generation = ++discoveryGeneration.current;
    setInitialArea(undefined);
    setFromShortlist(false);
    setSearchProfile(profile);
    setMarketFilters(filters);
    setDiscovery(null);
    if (profile.preference.category !== "Resale HDB" && !filters) {
      navigate("explore");
      return;
    }
    navigate("results");
    setBusy(true);
    try {
      const result = await api<{ discovery: Discovery }>(
        filters ? "/api/market-rankings" : "/api/discoveries",
        "POST",
        {
          profileId: profile.id,
          revision: profile.revision,
          ...(filters ? { filters } : {}),
        },
      );
      if (generation !== discoveryGeneration.current) return;
      setDiscovery(result.discovery);
      historyGeneration.current++;
      setHistoryReady(true);
      setHistoryError("");
      setHistory((list) =>
        [
          {
            id: result.discovery.id,
            createdAt: result.discovery.createdAt,
            profileName: result.discovery.preference.name,
          },
          ...list,
        ].slice(0, 10),
      );
    } catch (e) {
      if (generation === discoveryGeneration.current) fail(e);
    } finally {
      if (generation === discoveryGeneration.current) setBusy(false);
    }
  }
  async function clearRecentSearches() {
    if (
      busy ||
      clearingHistory ||
      !user ||
      !window.confirm(
        "Clear all recent searches from your history? Saved profiles and saved areas will stay. Stored result evidence is retained for saved areas; this does not delete your account data.",
      )
    )
      return;
    const generation = accountGeneration.current;
    historyGeneration.current++;
    setClearingHistory(true);
    setHistoryError("");
    try {
      await api("/api/discoveries", "DELETE", { confirm: true });
      if (generation !== accountGeneration.current) return;
      setHistory([]);
      setHistoryReady(true);
      accountEvents.current?.postMessage({
        type: "history-cleared",
        userId: user.id,
      });
      await loadHistory();
    } catch (e) {
      if (generation === accountGeneration.current) {
        setHistoryError(
          e instanceof Error
            ? e.message
            : "Recent searches could not be cleared.",
        );
        if (
          e instanceof RequestError &&
          ["SIGN_IN_REQUIRED", "SESSION_EXPIRED"].includes(e.detail.code)
        )
          fail(e);
      }
    } finally {
      if (generation === accountGeneration.current) setClearingHistory(false);
    }
  }
  async function openDiscovery(id: string, areaId?: string) {
    const generation = ++discoveryGeneration.current;
    navigate("results");
    setInitialArea(areaId);
    setFromShortlist(Boolean(areaId));
    setBusy(true);
    setDiscovery(null);
    setSearchProfile(null);
    try {
      const result = await api<{ discovery: Discovery }>(
        `/api/discoveries/${id}`,
      );
      if (generation === discoveryGeneration.current) {
        setDiscovery(result.discovery);
        setMarketFilters(result.discovery.market?.filters);
        setSearchProfile(
          profiles.find((p) => p.id === result.discovery.profileId) ?? null,
        );
      }
    } catch (e) {
      if (generation === discoveryGeneration.current) fail(e);
    } finally {
      if (generation === discoveryGeneration.current) setBusy(false);
    }
  }
  function navigate(next: typeof step) {
    setStep(next);
    setError("");
    setFields([]);
    mainRef.current?.scrollIntoView({ block: "start" });
  }
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("homematch-theme", next);
  }
  function editProfile(profile: Profile) {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    setInterpretationVersion((v) => v + 1);
    requestGeneration.current++;
    setActive(profile);
    setPreference(clone(profile.preference));
    setCandidates({});
    setSearchError({});
    setDirty(false);
    navigate("edit");
  }
  function newProfile() {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    if (!preview && profiles.length >= 4) {
      setError(
        "You already have four profiles. Delete one before creating another.",
      );
      setStep("profiles");
      return;
    }
    requestGeneration.current++;
    setActive(null);
    setInterpretationVersion((v) => v + 1);
    setPreference(initialPreference(preview, locationMode));
    setCandidates({});
    setSearchError({});
    setDirty(false);
    navigate("edit");
  }
  async function search(index: number) {
    const query = preference.destinations[index].query;
    if (query.trim().length < 2) {
      setSearchError((e) => ({
        ...e,
        [index]: "Enter at least two characters.",
      }));
      return;
    }
    const generation = ++requestGeneration.current;
    setSearching(index);
    setSearchError((e) => ({ ...e, [index]: "" }));
    try {
      const { locations } = await api<{ locations: Location[] }>(
        `/api/locations/search?q=${encodeURIComponent(query)}`,
      );
      if (generation !== requestGeneration.current) return;
      setCandidates((c) => ({ ...c, [index]: locations }));
      if (!locations.length)
        setSearchError((e) => ({
          ...e,
          [index]:
            preview || locationMode === "fixtures"
              ? "No preview match. Try Nanyang, Raffles, Tampines or Bishan."
              : "No locations found. Try a building name or postal code.",
        }));
    } catch (e) {
      if (generation === requestGeneration.current) {
        setSearchError((v) => ({
          ...v,
          [index]:
            e instanceof Error ? e.message : "Search unavailable. Retry.",
        }));
        if (e instanceof RequestError && e.detail.code === "SESSION_EXPIRED")
          fail(e);
      }
    } finally {
      if (generation === requestGeneration.current) setSearching(null);
    }
  }
  function review(event: FormEvent) {
    event.preventDefault();
    const result = confirmedProfileSchema.safeParse(preference);
    if (!result.success) {
      setFields(
        result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      );
      setError("A few preferences need your attention.");
      mainRef.current?.scrollIntoView();
      return;
    }
    setPreference(result.data);
    navigate("review");
  }
  async function save() {
    if (preview) {
      setDirty(false);
      navigate("done");
      return;
    }
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setBusy(true);
    setError("");
    const generation = accountGeneration.current;
    try {
      const saved = await api<{ profile: Profile }>(
        active ? `/api/profiles/${active.id}` : "/api/profiles",
        active ? "PUT" : "POST",
        { preference, ...(active ? { revision: active.revision } : {}) },
      );
      // Keep the new revision even if confirmation fails; a retry cannot duplicate it.
      if (generation !== accountGeneration.current) return;
      setActive(saved.profile);
      setProfiles((list) => [
        saved.profile,
        ...list.filter((x) => x.id !== saved.profile.id),
      ]);
      const confirmed = await api<{ profile: Profile }>(
        `/api/profiles/${saved.profile.id}/confirm`,
        "POST",
        { revision: saved.profile.revision },
      );
      if (generation !== accountGeneration.current) return;
      setActive(confirmed.profile);
      setProfiles((list) => [
        confirmed.profile,
        ...list.filter((x) => x.id !== confirmed.profile.id),
      ]);
      setDirty(false);
      navigate("done");
    } catch (e) {
      if (generation === accountGeneration.current) fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function authenticateOAuth(provider: "google" | "apple") {
    if (
      dirty &&
      !window.confirm(
        "Sign-in will leave this page. Unsaved preferences will be lost. Continue?",
      )
    )
      return;
    setBusy(true);
    setAuthMessage("");
    try {
      const result = await api<{ url: string }>(
        `/api/auth/${provider}`,
        "POST",
      );
      window.location.assign(result.url);
    } catch (e) {
      setAuthMessage(
        e instanceof Error ? e.message : "Sign-in unavailable. Retry.",
      );
      setBusy(false);
    }
  }
  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setAuthMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await api<{ user?: Viewer; message?: string }>(
        `/api/auth/${authKind}`,
        "POST",
        authKind === "recover"
          ? { email: data.get("email") }
          : { email: data.get("email"), password: data.get("password") },
      );
      if (result.user) {
        if (
          previousUserId.current &&
          previousUserId.current !== result.user.id
        ) {
          setProfiles([]);
          clearShortlist();
          setActive(null);
          setPreference(initialPreference(preview, locationMode));
          setDirty(false);
          setStep("edit");
          discoveryGeneration.current++;
          setDiscovery(null);
          setHistory([]);
          setSearchProfile(null);
        }
        previousUserId.current = result.user.id;
        setUser(result.user);
        setPlannerPreview(true);
        setAuthOpen(false);
        setError("");
      } else setAuthMessage(result.message ?? "Check your email.");
    } catch (e) {
      setAuthMessage(
        e instanceof Error ? e.message : "Sign-in unavailable. Retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    try {
      await api("/api/auth/sign-out", "POST");
      clearAccountWorkspace();
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function deleteAccount(
    confirmation: string,
  ): Promise<DeletionFeedback> {
    const deletingUserId = user?.id;
    try {
      const result = await api<{ deleted: boolean }>("/api/account", "DELETE", {
        confirmation,
      });
      if (result.deleted !== true)
        throw new Error("Unexpected deletion response");
      try {
        accountEvents.current?.postMessage({
          type: "account-deleted",
          userId: deletingUserId,
        });
      } catch {
        // Cross-tab UI notification must not change a confirmed deletion outcome.
      }
      clearAccountWorkspace();
      setError("");
      setAuthOpen(false);
      setAccountWarning(false);
      setAccountMessage(
        "Your HomeMatch account and stored research have been deleted.",
      );
      return {};
    } catch (e) {
      if (
        e instanceof RequestError &&
        [
          "ACCOUNT_REAUTH_REQUIRED",
          "SESSION_EXPIRED",
          "SIGN_IN_REQUIRED",
        ].includes(e.detail.code)
      )
        return { error: e.message, reauthenticate: true };
      if (
        e instanceof RequestError &&
        [
          "VALIDATION",
          "INVALID_ORIGIN",
          "PAYLOAD_TOO_LARGE",
          "ACCOUNT_AUTH_UNAVAILABLE",
        ].includes(e.detail.code)
      )
        return { error: e.message };
      clearAccountWorkspace();
      setAuthOpen(false);
      setAccountWarning(true);
      setAccountMessage(
        e instanceof RequestError
          ? e.message
          : "Deletion could not be confirmed. Sign in to check your account before retrying.",
      );
      return {};
    }
  }
  async function removeProfile() {
    if (!deleteTarget) return;
    setBusy(true);
    const generation = accountGeneration.current;
    try {
      await api(`/api/profiles/${deleteTarget.id}`, "DELETE", {
        revision: deleteTarget.revision,
      });
      if (generation !== accountGeneration.current) return;
      setProfiles((list) => list.filter((x) => x.id !== deleteTarget.id));
      if (active?.id === deleteTarget.id) setActive(null);
      setDeleteTarget(null);
    } catch (e) {
      if (generation !== accountGeneration.current) return;
      setDeleteTarget(null);
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  const total = Object.values(preference.weights).reduce((a, b) => a + b, 0);
  const existing = preference.category !== "BTO";
  const privateHousing = ["Condominium", "Private / landed"].includes(
    preference.category,
  );
  const showLanding = (welcome || (!preview && !user)) && !plannerPreview;
  const logoSrc =
    palette === "red"
      ? "/homematch-logo-red.svg"
      : palette === "rose"
        ? "/homematch-logo-rose.svg"
        : "/homematch-logo-emerald.svg";

  return (
    <div
      className={`${styles.shell} ${step === "explore" || (step === "results" && (discovery || busy)) ? styles.mapShell : ""}`}
      data-ready={ready}
    >
      {showLanding ? (
        <div inert={authOpen || !!deleteTarget}>
          <LandingPage
            logoSrc={logoSrc}
            theme={theme}
            checking={!sessionReady}
            signedIn={!!user}
            error={error}
            message={accountMessage}
            warning={accountWarning}
            onTheme={toggleTheme}
            onSignIn={() => {
              previousFocus.current = document.activeElement as HTMLElement;
              setAuthMessage("");
              setAuthKind("sign-in");
              setAuthOpen(true);
            }}
            onStart={() => {
              previousFocus.current = document.activeElement as HTMLElement;
              setAuthMessage("");
              setAuthKind("sign-up");
              setAuthOpen(true);
            }}
            onPreview={() => setPlannerPreview(true)}
          />
        </div>
      ) : (
        <>
          <header className={styles.header}>
            <Link
              href="/"
              className={styles.brand}
              aria-label="HomeMatch home"
              onClick={(event) => {
                if (!preview && !user) {
                  event.preventDefault();
                  setPlannerPreview(false);
                }
              }}
            >
              <Image src={logoSrc} alt="" width={37} height={44} priority />
              <span>
                Home<span>Match</span>
              </span>
            </Link>
            <div className={styles.headerRight}>
              <span className={styles.badge}>
                <i />
                {preview ? "Workspace preview" : "Personal workspace"}
              </span>
              <button
                className={styles.icon}
                onClick={toggleTheme}
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              >
                {theme === "dark" ? <Sun /> : <Moon />}
              </button>
              <PwaInstallButton />
              {user ? (
                <>
                  <span className={styles.email}>{user.email}</span>
                  <button
                    className={styles.icon}
                    disabled={busy}
                    title="Account settings"
                    aria-label="Account settings"
                    onClick={() => {
                      setAuthOpen(false);
                      setDeleteTarget(null);
                      setAccountMessage("");
                      setAccountOpen(true);
                    }}
                  >
                    <UserRound />
                  </button>
                  <button
                    className={styles.icon}
                    disabled={busy}
                    onClick={signOut}
                    title="Sign out"
                    aria-label="Sign out"
                  >
                    <LogOut />
                  </button>
                </>
              ) : (
                <button
                  className={`${styles.button} ${styles.secondary}`}
                  onClick={() => {
                    setAuthMessage("");
                    setAuthKind("sign-in");
                    setAuthOpen(true);
                  }}
                >
                  <UserRound />
                  Sign in
                </button>
              )}
            </div>
          </header>
          <div className={styles.layout}>
            <aside className={styles.sidebar} aria-label="Workspace navigation">
              <div>
                <div className={styles.eyebrow}>Workspace</div>
                <button
                  className={`${styles.navItem} ${!["profiles", "shortlist", "results"].includes(step) ? styles.navActive : ""}`}
                  onClick={() => navigate("edit")}
                >
                  <SlidersHorizontal />
                  Preferences
                </button>
                <button
                  className={`${styles.navItem} ${step === "profiles" ? styles.navActive : ""}`}
                  onClick={() => navigate("profiles")}
                >
                  <Layers />
                  My profiles <span>{profiles.length}/4</span>
                </button>
                <button
                  className={`${styles.navItem} ${step === "shortlist" ? styles.navActive : ""}`}
                  onClick={() => navigate("shortlist")}
                >
                  <Bookmark /> Saved areas <span>{savedAreas.length}</span>
                </button>
              </div>
              <div className={styles.profileList}>
                <div className={styles.sideHeading}>
                  <span className={styles.eyebrow}>Your profiles</span>
                  <button
                    className={styles.icon}
                    aria-label="Create a new profile"
                    title="Create a new profile"
                    onClick={newProfile}
                  >
                    <Plus />
                  </button>
                </div>
                {profiles.map((p) => (
                  <button
                    className={styles.navItem}
                    key={p.id}
                    onClick={() => editProfile(p)}
                  >
                    <FilePenLine />
                    {p.preference.name}
                  </button>
                ))}
                {!profiles.length && (
                  <p className={styles.hint}>
                    {preview
                      ? "No saved profiles in preview."
                      : user
                        ? "Your saved profiles appear here."
                        : "Sign in to save your preferences."}
                  </p>
                )}
              </div>
              <div className={styles.asideNote}>
                <ShieldCheck size={21} />
                <strong>Your places. Your priorities.</strong>
                <p>
                  Personal preferences stay in your account, never in browser
                  storage.
                </p>
              </div>
            </aside>
            <main ref={mainRef} className={styles.main}>
              <div className={styles.topline}>
                <div>
                  <p className={styles.eyebrow}>
                    Your next chapter / Singapore
                  </p>
                  <h1>
                    {step === "shortlist"
                      ? "Your saved areas"
                      : step === "profiles"
                        ? "Your profiles"
                        : step === "results"
                          ? "Your area matches"
                          : step === "review"
                            ? "A little more you."
                            : step === "done"
                              ? "Preferences, confirmed."
                              : "Make room for your life."}
                  </h1>
                  <p className={styles.subtitle}>
                    {step === "shortlist"
                      ? "Areas worth keeping, with their original research."
                      : step === "profiles"
                        ? "Different possibilities, thoughtfully kept in one place."
                        : step === "results"
                          ? "Compare the evidence behind your everyday fit."
                          : step === "review"
                            ? "Check the places and priorities that will shape your search."
                            : step === "done"
                              ? preview
                                ? "Your preview is complete. Nothing has been saved to an account."
                                : "Your profile is saved and ready for the next stage."
                              : "Start with the places you go, the things you love, and a budget that fits."}
                  </p>
                </div>
                <span className={styles.script}>feel at home.</span>
              </div>
              {(preview || locationMode === "fixtures") && (
                <div className={styles.notice}>
                  <Info />
                  <span>
                    {preview
                      ? "Preview only. Sample locations; edits stay in this tab and are not saved."
                      : "Development fixtures. These locations are not live OneMap results."}
                  </span>
                </div>
              )}
              {error && (
                <div className={styles.error} role="alert">
                  {error}
                  {fields.length > 0 && (
                    <ul>
                      {fields.map((f, i) => (
                        <li key={i}>{f.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {accountMessage && (
                <p
                  className={`${styles.accountMessage} ${accountWarning ? styles.accountWarning : ""}`}
                  role={accountWarning ? "alert" : "status"}
                >
                  {accountMessage}
                </p>
              )}
              {step !== "profiles" &&
                step !== "results" &&
                step !== "explore" &&
                step !== "shortlist" && (
                  <div
                    className={styles.steps}
                    role="group"
                    aria-label="Profile progress"
                  >
                    {["Your preferences", "Review & confirm"].map(
                      (label, i) => (
                        <div
                          key={label}
                          className={`${styles.step} ${(step === "edit" ? i === 0 : i === 1) ? styles.stepActive : ""}`}
                          aria-current={
                            (step === "edit" ? i === 0 : i === 1)
                              ? "step"
                              : undefined
                          }
                        >
                          <span className={styles.stepNumber}>{i + 1}</span>
                          {label}
                        </div>
                      ),
                    )}
                  </div>
                )}
              {step === "shortlist" ? (
                <Shortlist
                  key={user?.id ?? "guest"}
                  items={savedAreas}
                  ready={shortlistReady}
                  error={shortlistError}
                  pending={savingArea}
                  signedIn={Boolean(user)}
                  onReload={reloadShortlist}
                  onRemove={removeSavedArea}
                  onOpen={(item) =>
                    openDiscovery(item.discoveryId, item.result.area.id)
                  }
                  onFind={() => navigate("profiles")}
                  onSignIn={() => setAuthOpen(true)}
                />
              ) : step === "explore" && searchProfile ? (
                <AreaExplorer
                  key={`${searchProfile.id}:${searchProfile.revision}`}
                  profile={searchProfile}
                  theme={theme === "light" ? "light" : "dark"}
                  onBack={() => navigate("profiles")}
                  onRank={(filters) => findAreas(searchProfile, filters)}
                />
              ) : step === "results" ? (
                <RecommendationResults
                  key={`${discovery?.id ?? "loading"}:${initialArea ?? ""}`}
                  discovery={discovery}
                  theme={theme === "light" ? "light" : "dark"}
                  loading={busy}
                  onBack={() =>
                    navigate(fromShortlist ? "shortlist" : "profiles")
                  }
                  backLabel={fromShortlist ? "Saved areas" : "My profiles"}
                  initialArea={initialArea}
                  savedAreas={savedAreas}
                  saving={savingArea}
                  shortlistReady={shortlistReady && !shortlistError}
                  onToggleSave={toggleSavedArea}
                  onRetry={() => {
                    if (searchProfile)
                      findAreas(
                        searchProfile,
                        discovery?.market?.filters ?? marketFilters,
                      );
                    else navigate("profiles");
                  }}
                />
              ) : step === "profiles" ? (
                <>
                  <div className={styles.sectionHeading}>
                    <h2>Saved preferences</h2>
                    <button className={styles.button} onClick={newProfile}>
                      <Plus />
                      New profile
                    </button>
                  </div>
                  {!profiles.length ? (
                    <div className={styles.empty}>
                      <Layers size={30} />
                      <h2>No saved profiles yet</h2>
                      <p>
                        {preview
                          ? "Sign-in and persistent profiles need a configured Supabase project."
                          : user
                            ? "Create your first profile to get started."
                            : "Sign in to see your profiles."}
                      </p>
                    </div>
                  ) : (
                    profiles.map((p) => (
                      <article className={styles.saved} key={p.id}>
                        <div className={styles.savedTitle}>
                          <h2>{p.preference.name}</h2>
                          <span className={styles.badge}>
                            {p.confirmed ? "Confirmed" : "Draft"}
                          </span>
                        </div>
                        <p className={styles.hint}>
                          {p.preference.category} ·{" "}
                          {money(p.preference.budgetMin)} -{" "}
                          {money(p.preference.budgetMax)}
                        </p>
                        <div className={styles.savedActions}>
                          <button
                            className={styles.textButton}
                            disabled={!p.confirmed || busy}
                            onClick={() => findAreas(p)}
                          >
                            <Search />{" "}
                            {p.preference.category === "Resale HDB"
                              ? "Find matching areas"
                              : "Explore areas"}
                          </button>
                          <button
                            className={styles.textButton}
                            onClick={() => editProfile(p)}
                          >
                            <FilePenLine />
                            Edit profile
                          </button>
                          <button
                            className={styles.icon}
                            aria-label={`Delete ${p.preference.name}`}
                            title="Delete profile"
                            onClick={() => setDeleteTarget(p)}
                          >
                            <Trash2 />
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                  {user && (
                    <section
                      className={styles.section}
                      style={{ marginTop: 28 }}
                      aria-label="Recent area searches"
                    >
                      <div className={styles.sectionHeading}>
                        <h2>Recent area searches</h2>
                        <button
                          type="button"
                          className={`${styles.button} ${styles.secondary}`}
                          disabled={
                            busy ||
                            clearingHistory ||
                            !historyReady ||
                            !history.length
                          }
                          onClick={clearRecentSearches}
                        >
                          <Trash2 />
                          {clearingHistory
                            ? "Clearing…"
                            : "Clear recent searches"}
                        </button>
                      </div>
                      {historyError && (
                        <p role="alert">
                          {historyError}{" "}
                          <button
                            type="button"
                            className={styles.textButton}
                            disabled={clearingHistory}
                            onClick={() => void loadHistory()}
                          >
                            Retry loading history
                          </button>
                        </p>
                      )}
                      {!historyReady && (
                        <p role="status">Loading recent searches…</p>
                      )}
                      {historyReady && !historyError && !history.length && (
                        <p role="status">No recent searches.</p>
                      )}
                      {history.map((item) => (
                        <button
                          key={item.id}
                          className={styles.navItem}
                          disabled={busy || clearingHistory}
                          onClick={() => openDiscovery(item.id)}
                        >
                          <MapPin />
                          <span>
                            {item.profileName} ·{" "}
                            {new Date(item.createdAt).toLocaleDateString(
                              "en-SG",
                            )}
                          </span>
                          <ChevronRight />
                        </button>
                      ))}
                    </section>
                  )}
                </>
              ) : (
                <div className={styles.content}>
                  <div className={styles.form}>
                    {step === "edit" ? (
                      <>
                        <PreferenceInterpretation
                          key={`${user?.id ?? "guest"}:${active?.id ?? "new"}:${interpretationVersion}`}
                          base={preference}
                          signedIn={Boolean(user)}
                          preview={preview}
                          onApply={applyInterpretation}
                          onSignIn={() => setAuthOpen(true)}
                          onSessionError={(message) =>
                            fail(
                              new RequestError({
                                code: "SESSION_EXPIRED",
                                message,
                              }),
                            )
                          }
                        />
                        <form onSubmit={review} noValidate>
                          <Section
                            icon={<House />}
                            title="A place to call home"
                          >
                            <div
                              className={styles.segmented}
                              role="group"
                              aria-label="Housing pathway"
                            >
                              <button
                                type="button"
                                className={`${styles.segment} ${!existing ? styles.selected : ""}`}
                                aria-pressed={!existing}
                                onClick={() => update({ category: "BTO" })}
                              >
                                <Building2 />
                                BTO
                              </button>
                              <button
                                type="button"
                                className={`${styles.segment} ${existing ? styles.selected : ""}`}
                                aria-pressed={existing}
                                onClick={() =>
                                  update({ category: "Resale HDB" })
                                }
                              >
                                <House />
                                Existing homes
                              </button>
                            </div>
                            <div className={styles.grid2}>
                              <label className={styles.field}>
                                Profile name
                                <input
                                  value={preference.name}
                                  maxLength={60}
                                  onChange={(e) =>
                                    update({ name: e.target.value })
                                  }
                                  autoComplete="off"
                                />
                              </label>
                              <label className={styles.field}>
                                Property type
                                <select
                                  aria-label="Property type"
                                  value={preference.category}
                                  onChange={(e) =>
                                    update({
                                      category: e.target
                                        .value as Preference["category"],
                                    })
                                  }
                                >
                                  {(existing
                                    ? categories.filter((x) => x !== "BTO")
                                    : ["BTO"]
                                  ).map((c) => (
                                    <option key={c}>{c}</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <div className={styles.grid2}>
                              <label className={styles.field}>
                                Minimum budget (SGD)
                                <input
                                  type="number"
                                  min={0}
                                  max={20000000}
                                  step={10000}
                                  value={preference.budgetMin}
                                  onChange={(e) =>
                                    update({
                                      budgetMin: Number(e.target.value),
                                    })
                                  }
                                />
                              </label>
                              <label className={styles.field}>
                                Maximum budget (SGD)
                                <input
                                  type="number"
                                  min={1}
                                  max={20000000}
                                  step={10000}
                                  value={preference.budgetMax}
                                  onChange={(e) =>
                                    update({
                                      budgetMax: Number(e.target.value),
                                    })
                                  }
                                />
                              </label>
                            </div>
                            <fieldset className={styles.field}>
                              <legend>HDB comparison flat types</legend>
                              <div className={styles.checks}>
                                {flatTypes.map((type) => (
                                  <label key={type} className={styles.check}>
                                    <input
                                      type="checkbox"
                                      checked={preference.flatTypes.includes(
                                        type,
                                      )}
                                      onChange={(e) =>
                                        update({
                                          flatTypes: e.target.checked
                                            ? [...preference.flatTypes, type]
                                            : preference.flatTypes.filter(
                                                (x) => x !== type,
                                              ),
                                        })
                                      }
                                    />
                                    {type}
                                  </label>
                                ))}
                              </div>
                            </fieldset>
                            <label>
                              Transaction lookback
                              <select
                                value={preference.lookbackMonths}
                                onChange={(e) =>
                                  update({
                                    lookbackMonths: Number(e.target.value),
                                  })
                                }
                              >
                                {[3, 6, 12, 24, 36, 60].map((m) => (
                                  <option key={m} value={m}>
                                    Last {m} complete months
                                  </option>
                                ))}
                              </select>
                            </label>
                            {(!existing || privateHousing) && (
                              <p className={styles.hint}>
                                {privateHousing
                                  ? "HDB resale evidence does not measure private-property affordability. Area exploration only."
                                  : "Historical resale evidence is neighborhood context, not BTO project pricing."}
                              </p>
                            )}
                          </Section>
                          <Section
                            icon={<MapPin />}
                            title="The places that matter"
                            detail={`${preference.destinations.length} of 4`}
                          >
                            {preference.destinations.map((d, index) => (
                              <div className={styles.destination} key={index}>
                                <div className={styles.destinationHead}>
                                  <b>Destination {index + 1}</b>
                                  <button
                                    type="button"
                                    className={styles.icon}
                                    title="Remove destination"
                                    aria-label={`Remove destination ${index + 1}`}
                                    disabled={
                                      preference.destinations.length === 1
                                    }
                                    onClick={() => {
                                      requestGeneration.current++;
                                      setCandidates({});
                                      setSearchError({});
                                      setSearching(null);
                                      update({
                                        destinations:
                                          preference.destinations.filter(
                                            (_, i) => i !== index,
                                          ),
                                      });
                                    }}
                                  >
                                    <X />
                                  </button>
                                </div>
                                <label
                                  htmlFor={`place-${index}`}
                                  className="sr-only"
                                >
                                  Destination {index + 1} location
                                </label>
                                <div className={styles.searchRow}>
                                  <input
                                    id={`place-${index}`}
                                    placeholder="Building, MRT station or postal code"
                                    value={d.query}
                                    onChange={(e) => {
                                      requestGeneration.current++;
                                      setSearching(null);
                                      setCandidates((c) => ({
                                        ...c,
                                        [index]: [],
                                      }));
                                      update({
                                        destinations:
                                          preference.destinations.map((x, i) =>
                                            i === index
                                              ? editDestinationQuery(
                                                  x,
                                                  e.target.value,
                                                )
                                              : x,
                                          ),
                                      });
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        search(index);
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className={styles.icon}
                                    disabled={searching !== null}
                                    aria-label={`Search destination ${index + 1}`}
                                    title="Search locations"
                                    onClick={() => search(index)}
                                  >
                                    <Search />
                                  </button>
                                </div>
                                {d.location ? (
                                  <div className={styles.resolved}>
                                    <CheckCircle2 />
                                    {d.location.source === "fixture"
                                      ? "Sample location selected"
                                      : "OneMap location selected"}
                                  </div>
                                ) : (
                                  <p className={styles.hint}>
                                    Search and select a location to confirm it.
                                  </p>
                                )}
                                {searchError[index] && (
                                  <p className={styles.hint} role="alert">
                                    {searchError[index]}
                                  </p>
                                )}
                                {!!candidates[index]?.length && (
                                  <div
                                    className={styles.results}
                                    aria-label="Location matches"
                                  >
                                    {candidates[index].map((loc) => (
                                      <button
                                        className={styles.result}
                                        type="button"
                                        key={loc.id}
                                        onClick={() => {
                                          update({
                                            destinations:
                                              preference.destinations.map(
                                                (x, i) =>
                                                  i === index
                                                    ? {
                                                        ...x,
                                                        query: loc.label,
                                                        location: loc,
                                                      }
                                                    : x,
                                              ),
                                          });
                                          setCandidates((c) => ({
                                            ...c,
                                            [index]: [],
                                          }));
                                        }}
                                      >
                                        <MapPin />
                                        {loc.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <div className={styles.grid2}>
                                  <label>
                                    Visits per week
                                    <input
                                      type="number"
                                      min={1}
                                      max={21}
                                      value={d.visits}
                                      onChange={(e) =>
                                        update({
                                          destinations:
                                            preference.destinations.map(
                                              (x, i) =>
                                                i === index
                                                  ? {
                                                      ...x,
                                                      visits: Number(
                                                        e.target.value,
                                                      ),
                                                    }
                                                  : x,
                                            ),
                                        })
                                      }
                                    />
                                  </label>
                                  <label>
                                    Travel by
                                    <select
                                      value={d.mode}
                                      onChange={(e) =>
                                        update({
                                          destinations:
                                            preference.destinations.map(
                                              (x, i) =>
                                                i === index
                                                  ? {
                                                      ...x,
                                                      mode: e.target.value as
                                                        "public" | "private",
                                                    }
                                                  : x,
                                            ),
                                        })
                                      }
                                    >
                                      <option value="public">
                                        Public transport
                                      </option>
                                      <option value="private">
                                        Private transport
                                      </option>
                                    </select>
                                  </label>
                                </div>
                              </div>
                            ))}
                            <button
                              className={styles.textButton}
                              type="button"
                              disabled={preference.destinations.length >= 4}
                              onClick={() =>
                                update({
                                  destinations: [
                                    ...preference.destinations,
                                    {
                                      query: "",
                                      location: null,
                                      visits: 1,
                                      mode: "public",
                                    },
                                  ],
                                })
                              }
                            >
                              <Plus />
                              Add a destination
                            </button>
                          </Section>
                          <Section
                            icon={<Trees />}
                            title="Life around your home"
                            detail={`${preference.lifestyles.length} of 6`}
                          >
                            {preference.lifestyles.some(
                              (l) =>
                                ![
                                  "Parks",
                                  "Groceries",
                                  "Hawker centres",
                                  "Schools",
                                  "Healthcare",
                                ].includes(l.category),
                            ) && (
                              <p className={styles.hint}>
                                Sports data includes private, condominium and
                                school venues. Public access, memberships and
                                bookings are not verified; source coordinates
                                are approximate.
                              </p>
                            )}
                            {preference.lifestyles.some(
                              (l) => l.category === "Groceries",
                            ) && (
                              <p className={styles.hint}>
                                Groceries uses a partial OneMap supermarket
                                directory. Missing stores can affect rankings;
                                no match is not proof of no nearby shops.
                              </p>
                            )}
                            {preference.lifestyles.some(
                              (l) => l.category === "Healthcare",
                            ) && (
                              <p className={styles.hint}>
                                Healthcare currently measures hospital
                                proximity, not GP or polyclinic access.
                              </p>
                            )}
                            {preference.lifestyles.some(
                              (l) => l.category === "Schools",
                            ) && (
                              <p className={styles.hint}>
                                Schools uses the MOE school directory. Proximity
                                does not establish admission eligibility.
                              </p>
                            )}
                            {preference.lifestyles.map((l, index) => (
                              <div className={styles.lifeRow} key={l.category}>
                                <div className={styles.lifeName}>
                                  {(() => {
                                    const Icon =
                                      amenityPresentation[l.category].icon;
                                    return <Icon />;
                                  })()}
                                  {amenityPresentation[l.category].label}
                                </div>
                                <label>
                                  Radius (m)
                                  <input
                                    aria-label={`${l.category} radius`}
                                    type="number"
                                    min={100}
                                    max={5000}
                                    step={100}
                                    value={l.radius}
                                    onChange={(e) =>
                                      update({
                                        lifestyles: preference.lifestyles.map(
                                          (x, i) =>
                                            i === index
                                              ? {
                                                  ...x,
                                                  radius: Number(
                                                    e.target.value,
                                                  ),
                                                }
                                              : x,
                                        ),
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  Priority
                                  <select
                                    aria-label={`${l.category} priority`}
                                    value={l.priority}
                                    onChange={(e) =>
                                      update({
                                        lifestyles: preference.lifestyles.map(
                                          (x, i) =>
                                            i === index
                                              ? {
                                                  ...x,
                                                  priority: Number(
                                                    e.target.value,
                                                  ),
                                                }
                                              : x,
                                        ),
                                      })
                                    }
                                  >
                                    {[1, 2, 3, 4, 5].map((n) => (
                                      <option key={n}>{n}</option>
                                    ))}
                                  </select>
                                </label>
                                <button
                                  type="button"
                                  className={styles.icon}
                                  title={`Remove ${l.category}`}
                                  aria-label={`Remove ${l.category}`}
                                  onClick={() =>
                                    update({
                                      lifestyles: preference.lifestyles.filter(
                                        (_, i) => i !== index,
                                      ),
                                    })
                                  }
                                >
                                  <X />
                                </button>
                              </div>
                            ))}
                            {preference.lifestyles.length < 6 && (
                              <label className={styles.hint}>
                                Add a lifestyle preference
                                <select
                                  aria-label="Add a lifestyle preference"
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value)
                                      update({
                                        lifestyles: [
                                          ...preference.lifestyles,
                                          {
                                            category: e.target
                                              .value as Preference["lifestyles"][number]["category"],
                                            priority: 3,
                                            radius: 1000,
                                          },
                                        ],
                                      });
                                  }}
                                >
                                  <option value="">
                                    Choose an amenity or interest
                                  </option>
                                  {lifestyleCategories
                                    .filter(
                                      (c) =>
                                        !preference.lifestyles.some(
                                          (l) => l.category === c,
                                        ),
                                    )
                                    .map((c) => (
                                      <option key={c} value={c}>
                                        {amenityPresentation[c].label}
                                      </option>
                                    ))}
                                </select>
                              </label>
                            )}
                          </Section>
                          <Section
                            icon={<ListFilter />}
                            title="What matters most"
                            detail="Total must be 100%"
                          >
                            {(
                              [
                                "destination",
                                "lifestyle",
                                "affordability",
                              ] as const
                            ).map((key, index) => (
                              <div className={styles.weight} key={key}>
                                <label htmlFor={`weight-${key}`}>
                                  {
                                    [
                                      "Your journeys",
                                      "Your lifestyle",
                                      "Your budget",
                                    ][index]
                                  }
                                </label>
                                <input
                                  id={`weight-${key}`}
                                  type="range"
                                  min={0}
                                  max={100}
                                  step={5}
                                  value={preference.weights[key]}
                                  onChange={(e) =>
                                    update({
                                      weights: {
                                        ...preference.weights,
                                        [key]: Number(e.target.value),
                                      },
                                    })
                                  }
                                />
                                <output htmlFor={`weight-${key}`}>
                                  {preference.weights[key]}%
                                </output>
                              </div>
                            ))}
                            <div className={styles.weightTotal}>
                              <span>Combined priority</span>
                              <strong
                                style={{
                                  color:
                                    total === 100
                                      ? "var(--accent)"
                                      : "var(--danger)",
                                }}
                              >
                                {total}%{" "}
                                {total === 100 ? "/ 100%" : "- adjust to 100%"}
                              </strong>
                            </div>
                          </Section>
                          <div className={styles.footer}>
                            <span>
                              {preview
                                ? "Preview changes are not saved."
                                : "Review before saving to your account."}
                            </span>
                            <button className={styles.button} type="submit">
                              Review preferences
                              <ArrowRight />
                            </button>
                          </div>
                        </form>
                      </>
                    ) : step === "review" ? (
                      <>
                        <Section
                          icon={<ClipboardCheck />}
                          title="Your profile, at a glance"
                          detail={
                            <button
                              className={styles.textButton}
                              onClick={() => navigate("edit")}
                            >
                              <FilePenLine />
                              Edit
                            </button>
                          }
                        >
                          <dl>
                            <div className={styles.reviewItem}>
                              <dt>Profile & housing</dt>
                              <dd>
                                {preference.name} · {preference.category}
                              </dd>
                            </div>
                            <div className={styles.reviewItem}>
                              <dt>Budget & historical evidence</dt>
                              <dd>
                                {money(preference.budgetMin)} -{" "}
                                {money(preference.budgetMax)}
                                <p>
                                  {preference.flatTypes.join(", ")} ·{" "}
                                  {preference.lookbackMonths} complete months
                                </p>
                              </dd>
                            </div>
                            <div className={styles.reviewItem}>
                              <dt>Frequent places</dt>
                              <dd>
                                {preference.destinations.map((d, i) => (
                                  <p key={i}>
                                    {d.location?.label} · {d.visits} visits/week
                                    ·{" "}
                                    {d.mode === "public" ? "Public" : "Private"}{" "}
                                    transport
                                  </p>
                                ))}
                              </dd>
                            </div>
                            <div className={styles.reviewItem}>
                              <dt>Lifestyle</dt>
                              <dd>
                                {preference.lifestyles.length
                                  ? preference.lifestyles.map((l) => (
                                      <p key={l.category}>
                                        {l.category} · {l.radius} m radius ·
                                        priority {l.priority}/5
                                      </p>
                                    ))
                                  : "No lifestyle preferences"}
                              </dd>
                            </div>
                            <div className={styles.reviewItem}>
                              <dt>Priorities</dt>
                              <dd>
                                Journeys {preference.weights.destination}% ·
                                Lifestyle {preference.weights.lifestyle}% ·
                                Budget {preference.weights.affordability}%
                              </dd>
                            </div>
                          </dl>
                        </Section>
                        <div className={styles.footer}>
                          <button
                            className={`${styles.button} ${styles.secondary}`}
                            onClick={() => navigate("edit")}
                          >
                            <ArrowLeft />
                            Back
                          </button>
                          <button
                            className={styles.button}
                            disabled={busy}
                            onClick={save}
                          >
                            {busy
                              ? "Saving..."
                              : preview
                                ? "Confirm preview"
                                : "Confirm & save"}
                            <Check />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={styles.success}>
                          <CheckCircle2 size={34} />
                        </div>
                        <h2>
                          {preview ? "Preview reviewed" : "Profile saved"}
                        </h2>
                        <p className={styles.subtitle}>
                          {preview
                            ? "This is a reviewed sample, not a stored profile or a recommendation."
                            : `${preference.name} is confirmed. You can return to it from My profiles.`}
                        </p>
                        <p className={styles.hint}>
                          Area ranking currently supports Resale HDB, with
                          parks, hawker centres, badminton venues, schools and
                          hospitals. Grocery evidence is partial; its rankings
                          are provisional.
                        </p>
                        <div
                          className={styles.footer}
                          style={{ marginTop: 28 }}
                        >
                          <button
                            className={`${styles.button} ${styles.secondary}`}
                            onClick={() => navigate("edit")}
                          >
                            <FilePenLine />
                            Edit preferences
                          </button>
                          {!preview && (
                            <button
                              className={styles.button}
                              disabled={busy || !active?.confirmed}
                              onClick={() => {
                                if (active) findAreas(active);
                              }}
                            >
                              <Search />{" "}
                              {active?.preference.category === "Resale HDB"
                                ? "Find matching areas"
                                : "Explore areas"}
                            </button>
                          )}
                          {!preview && (
                            <button
                              className={styles.textButton}
                              onClick={() => navigate("profiles")}
                            >
                              My profiles
                              <ChevronRight />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <aside
                    className={styles.preview}
                    aria-label="Preference summary"
                  >
                    <p className={styles.eyebrow}>The bigger picture</p>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        margin: "22px 0",
                      }}
                    >
                      <Image src={logoSrc} alt="" width={46} height={55} />
                      <div>
                        <h2 className={styles.summaryTitle}>
                          {preference.name || "Your next home"}
                        </h2>
                        <p className={styles.summaryLabel}>
                          {preference.category}
                        </p>
                      </div>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Budget</span>
                      <strong>
                        {money(preference.budgetMin)}
                        <br />
                        to {money(preference.budgetMax)}
                      </strong>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Regular places</span>
                      <strong>
                        {preference.destinations.length} destination
                        {preference.destinations.length !== 1 ? "s" : ""}
                      </strong>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Lifestyle</span>
                      <strong>{preference.lifestyles.length} priorities</strong>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Evidence period</span>
                      <strong>{preference.lookbackMonths} months</strong>
                    </div>
                    <div className={styles.weightBar}>
                      {[
                        preference.weights.destination,
                        preference.weights.lifestyle,
                        preference.weights.affordability,
                      ].map((w, i) => (
                        <span
                          key={i}
                          style={{
                            width: `${w}%`,
                            background: [
                              "var(--accent)",
                              "var(--cyan)",
                              "var(--purple)",
                            ][i],
                          }}
                        />
                      ))}
                    </div>
                    <div className={styles.legend}>
                      {["Journeys", "Lifestyle", "Budget"].map((label, i) => (
                        <div key={label}>
                          <i
                            style={{
                              background: [
                                "var(--accent)",
                                "var(--cyan)",
                                "var(--purple)",
                              ][i],
                            }}
                          />
                          {label}
                        </div>
                      ))}
                    </div>
                    <p className={styles.disclaimer}>
                      <TrainFront size={16} />
                      <br />A home is more than an address.
                      <br />
                      Keep your everyday journeys close.
                    </p>
                    <p className={styles.disclaimer}>
                      Area research only. Not financial, legal, or
                      housing-eligibility advice.
                    </p>
                  </aside>
                </div>
              )}
            </main>
          </div>
        </>
      )}
      {user && accountOpen && (
        <AccountDialog
          email={user.email}
          onClose={() => setAccountOpen(false)}
          onDelete={deleteAccount}
          onReauthenticate={async () => {
            if (await signOut()) {
              setAuthKind("sign-in");
              setAuthMessage(
                "Sign in again, then reopen Account settings and confirm deletion.",
              );
              setAuthOpen(true);
            } else throw new Error("Unable to end the current session");
          }}
        />
      )}
      {(authOpen || deleteTarget) && (
        <div className={styles.overlay}>
          <div
            className={styles.dialog}
            ref={authDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <header>
              <h2 id="dialog-title">
                {deleteTarget
                  ? "Delete this profile?"
                  : authKind === "sign-in"
                    ? "Welcome home."
                    : authKind === "recover"
                      ? "Reset your password"
                      : "Create your account"}
              </h2>
              <button
                className={styles.icon}
                aria-label="Close dialog"
                disabled={busy}
                onClick={() => {
                  setAuthOpen(false);
                  setDeleteTarget(null);
                }}
              >
                <X />
              </button>
            </header>
            {deleteTarget ? (
              <>
                <p>
                  {deleteTarget.preference.name} will be permanently removed.
                  This cannot be undone.
                </p>
                <button
                  className={styles.button}
                  disabled={busy}
                  onClick={removeProfile}
                >
                  {busy ? "Deleting..." : "Delete profile"}
                  <Trash2 />
                </button>
              </>
            ) : preview ? (
              <>
                <p>
                  Account sign-in is not connected in this preview. Your entries
                  remain in this tab.
                </p>
                <button
                  className={styles.button}
                  onClick={() => setAuthOpen(false)}
                >
                  Return to preferences
                  <ArrowRight />
                </button>
              </>
            ) : (
              <form onSubmit={authenticate}>
                {authKind !== "recover" && (
                  <button
                    type="button"
                    className={styles.button}
                    disabled={busy}
                    onClick={() => authenticateOAuth("google")}
                  >
                    Continue with Google <ArrowRight />
                  </button>
                )}
                {authKind !== "recover" && appleSignInEnabled && (
                  <button
                    type="button"
                    className={styles.button}
                    disabled={busy}
                    onClick={() => authenticateOAuth("apple")}
                  >
                    Continue with Apple <ArrowRight />
                  </button>
                )}
                <p className={styles.hint}>
                  {authKind === "recover"
                    ? "Enter your account email to request a recovery link."
                    : "Or use your email"}
                </p>
                <label>
                  Email
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                  />
                </label>
                {authKind !== "recover" && (
                  <label>
                    Password
                    <input
                      type="password"
                      name="password"
                      autoComplete={
                        authKind === "sign-in"
                          ? "current-password"
                          : "new-password"
                      }
                      required
                      minLength={authKind === "sign-up" ? 12 : 1}
                      maxLength={128}
                    />
                  </label>
                )}
                {authKind === "sign-up" && (
                  <p className={styles.hint}>Use at least 12 characters.</p>
                )}
                {authMessage && <p role="alert">{authMessage}</p>}
                <button className={styles.button} type="submit" disabled={busy}>
                  {busy
                    ? "Please wait..."
                    : authKind === "sign-in"
                      ? "Sign in"
                      : authKind === "recover"
                        ? "Send recovery email"
                        : "Create account"}
                  <ArrowRight />
                </button>
                <div className={styles.dialogBottom}>
                  {authKind === "sign-in" && (
                    <button
                      type="button"
                      className={styles.textButton}
                      disabled={busy}
                      onClick={() => {
                        setAuthKind("recover");
                        setAuthMessage("");
                      }}
                    >
                      Forgot password?
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.textButton}
                    disabled={busy}
                    onClick={() => {
                      setAuthKind(
                        authKind === "sign-in" ? "sign-up" : "sign-in",
                      );
                      setAuthMessage("");
                    }}
                  >
                    {authKind === "sign-in"
                      ? "New here? Create an account"
                      : "Back to sign in"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
