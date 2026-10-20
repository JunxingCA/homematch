"use client";

import Link from "next/link";
import {
  useEffect,
  useCallback,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  Bookmark,
  Info,
  Layers,
  LogOut,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  confirmedProfileSchema,
  editDestinationQuery,
  type Location,
  type Preference,
  type Profile,
} from "@/domain/preferences";
import { samplePreference } from "@/domain/fixtures";
import styles from "./HomeMatch.module.css";
import { applyTheme, initialTheme } from "./theme";
import { ThemeSwitch, type ThemeChoice } from "./lights/ThemeSwitch";
import { applyPreset, type LifestylePresetId } from "./lights/presets";
import { RecommendationResults } from "./RecommendationResults";
import { AreaExplorer } from "./AreaExplorer";
import type { MarketFilters } from "@/domain/marketEvidence.mjs";
import { PwaInstallButton } from "./PwaSupport";
import type { Discovery } from "@/domain/recommendations";
import type { SavedArea } from "@/domain/shortlist";
import { Shortlist } from "./Shortlist";
import { PreferenceInterpretation } from "./PreferenceInterpretation";
import { AccountDialog, type DeletionFeedback } from "./AccountDialog";
import { LandingPage } from "./LandingPage";
import { Wordmark } from "./lights/Logo";
import { setSoundEnabled, soundEnabled } from "./lights/sound";
import { PreferenceBuilder } from "./workspace/PreferenceBuilder";
import { DoneView, ProfilesView, ReviewView } from "./workspace/WorkspaceViews";
import ws from "./workspace/Workspace.module.css";
import {
  draftProposal,
  type InterpretationResult,
} from "@/domain/interpretation";

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
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>("auto");
  const [sounds, setSounds] = useState(true);
  const headerRef = useRef<HTMLElement>(null);
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
    const stored = localStorage.getItem("homematch-theme");
    const selected = initialTheme(stored);
    document.documentElement.dataset.theme = selected;
    // Theme is non-sensitive; preferences and identity never enter localStorage.
    queueMicrotask(() => {
      setTheme(selected);
      setThemeChoice(stored === "light" || stored === "dark" ? stored : "auto");
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

  useEffect(() => {
    queueMicrotask(() => setSounds(soundEnabled()));
  }, []);

  useEffect(() => {
    // Map screens size themselves to the space under the header, however it wraps.
    const header = headerRef.current;
    if (!header) return;
    const apply = () =>
      document.documentElement.style.setProperty(
        "--workspace-header",
        `${header.offsetHeight}px`,
      );
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(header);
    return () => observer.disconnect();
  });

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
  function chooseTheme(choice: ThemeChoice) {
    const next = choice === "auto" ? initialTheme(null) : choice;
    setThemeChoice(choice);
    setTheme(next);
    applyTheme(next);
    if (choice === "auto") localStorage.removeItem("homematch-theme");
    else localStorage.setItem("homematch-theme", choice);
  }
  function startFromPreset(id: LifestylePresetId) {
    setPreference((p) => applyPreset(p, id));
    setDirty(true);
    setStep("edit");
    setPlannerPreview(true);
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
  const showLanding = (welcome || (!preview && !user)) && !plannerPreview;

  const mapStep =
    step === "explore" || (step === "results" && Boolean(discovery || busy));
  const notice = (preview || locationMode === "fixtures") && (
    <div className={ws.notice}>
      <Info aria-hidden="true" />
      <span>
        {preview
          ? "Preview only. Sample locations; edits stay in this tab and are not saved."
          : "Development fixtures. These locations are not live OneMap results."}
      </span>
    </div>
  );
  const navCurrent =
    step === "profiles"
      ? "profiles"
      : step === "shortlist"
        ? "shortlist"
        : step === "results" || step === "explore"
          ? "results"
          : "edit";

  return (
    <div
      className={`${styles.shell} ${mapStep ? styles.mapShell : ""}`}
      data-ready={ready}
    >
      {showLanding ? (
        <div inert={authOpen || !!deleteTarget}>
          <LandingPage
            themeChoice={themeChoice}
            onThemeChoice={chooseTheme}
            onPreset={startFromPreset}
            checking={!sessionReady}
            signedIn={!!user}
            error={error}
            message={accountMessage}
            warning={accountWarning}
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
          <header ref={headerRef} className={`wrap ${ws.header}`}>
            <Link
              href="/"
              className={ws.brand}
              aria-label="HomeMatch home"
              onClick={(event) => {
                if (!preview && !user) {
                  event.preventDefault();
                  setPlannerPreview(false);
                }
              }}
            >
              <Wordmark />
            </Link>
            <nav className={ws.nav} aria-label="Workspace navigation">
              <button
                type="button"
                className={ws.navItem}
                aria-current={navCurrent === "edit" ? "page" : undefined}
                onClick={() => navigate("edit")}
              >
                <SlidersHorizontal aria-hidden="true" />
                Preferences
              </button>
              <button
                type="button"
                className={ws.navItem}
                aria-current={navCurrent === "profiles" ? "page" : undefined}
                onClick={() => navigate("profiles")}
              >
                <Layers aria-hidden="true" />
                My profiles{" "}
                <span className={ws.count}>{profiles.length}/4</span>
              </button>
              <button
                type="button"
                className={ws.navItem}
                aria-current={navCurrent === "shortlist" ? "page" : undefined}
                onClick={() => navigate("shortlist")}
              >
                <Bookmark aria-hidden="true" /> Saved areas{" "}
                <span className={ws.count}>{savedAreas.length}</span>
              </button>
            </nav>
            <div className={ws.tools}>
              <span className={`chip ${ws.mode}`}>
                <span className="dot" />
                {preview ? "Workspace preview" : "Personal workspace"}
              </span>
              <button
                type="button"
                className={ws.iconButton}
                aria-pressed={sounds}
                aria-label="Sounds"
                title={sounds ? "Sounds on" : "Sounds off"}
                onClick={() => {
                  setSoundEnabled(!sounds);
                  setSounds(!sounds);
                }}
              >
                {sounds ? (
                  <Volume2 aria-hidden="true" />
                ) : (
                  <VolumeX aria-hidden="true" />
                )}
              </button>
              <ThemeSwitch choice={themeChoice} onChoose={chooseTheme} />
              <PwaInstallButton />
              {user ? (
                <>
                  <span className={`chip ${ws.email}`}>{user.email}</span>
                  <button
                    type="button"
                    className={ws.iconButton}
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
                    <UserRound aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={ws.iconButton}
                    disabled={busy}
                    onClick={signOut}
                    title="Sign out"
                    aria-label="Sign out"
                  >
                    <LogOut aria-hidden="true" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => {
                    setAuthMessage("");
                    setAuthKind("sign-in");
                    setAuthOpen(true);
                  }}
                >
                  <UserRound aria-hidden="true" size={16} />
                  <span className={ws.signInText}>Sign in</span>
                </button>
              )}
            </div>
            {mapStep && notice && (
              <div className={ws.headerNotice}>{notice}</div>
            )}
          </header>
          <main
            ref={mainRef}
            className={mapStep ? ws.mapMain : `wrap ${ws.main}`}
          >
            {!mapStep && notice}
            {error && (
              <div className={ws.alert} role="alert">
                {error}
                {fields.length > 0 && (
                  <ul>
                    {[...new Set(fields.map((f) => f.message))].map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {accountMessage && (
              <p
                className={ws.message}
                data-warning={accountWarning}
                role={accountWarning ? "alert" : "status"}
              >
                {accountMessage}
              </p>
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
              <ProfilesView
                profiles={profiles}
                preview={preview}
                signedIn={Boolean(user)}
                busy={busy}
                history={history}
                historyReady={historyReady}
                historyError={historyError}
                clearingHistory={clearingHistory}
                onNew={newProfile}
                onEdit={editProfile}
                onFind={(p) => findAreas(p)}
                onDelete={(p) => setDeleteTarget(p)}
                onOpenHistory={(id) => openDiscovery(id)}
                onClearHistory={clearRecentSearches}
                onRetryHistory={() => void loadHistory()}
              />
            ) : step === "review" ? (
              <ReviewView
                preference={preference}
                preview={preview}
                busy={busy}
                onEdit={() => navigate("edit")}
                onConfirm={save}
              />
            ) : step === "done" ? (
              <DoneView
                preference={preference}
                preview={preview}
                busy={busy}
                canSearch={Boolean(active?.confirmed)}
                searchLabel={
                  active?.preference.category === "Resale HDB"
                    ? "Find matching areas"
                    : "Explore areas"
                }
                onEdit={() => navigate("edit")}
                onSearch={() => {
                  if (active) findAreas(active);
                }}
                onProfiles={() => navigate("profiles")}
              />
            ) : (
              <PreferenceBuilder
                preference={preference}
                update={update}
                preview={preview}
                fields={fields}
                candidates={candidates}
                searching={searching}
                searchError={searchError}
                onSearch={search}
                onQueryChange={(index, query) => {
                  requestGeneration.current++;
                  setSearching(null);
                  setCandidates((c) => ({ ...c, [index]: [] }));
                  update({
                    destinations: preference.destinations.map((x, i) =>
                      i === index ? editDestinationQuery(x, query) : x,
                    ),
                  });
                }}
                onSelectLocation={(index, loc) => {
                  update({
                    destinations: preference.destinations.map((x, i) =>
                      i === index
                        ? { ...x, query: loc.label, location: loc }
                        : x,
                    ),
                  });
                  setCandidates((c) => ({ ...c, [index]: [] }));
                }}
                onRemoveDestination={(index) => {
                  requestGeneration.current++;
                  setCandidates({});
                  setSearchError({});
                  setSearching(null);
                  update({
                    destinations: preference.destinations.filter(
                      (_, i) => i !== index,
                    ),
                  });
                }}
                onAddDestination={() =>
                  update({
                    destinations: [
                      ...preference.destinations,
                      { query: "", location: null, visits: 1, mode: "public" },
                    ],
                  })
                }
                onSubmit={review}
                ai={
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
                }
              />
            )}
          </main>
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
