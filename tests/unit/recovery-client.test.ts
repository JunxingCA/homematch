import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  mode: "supabase",
  enabled: false,
  create: vi.fn(),
  cookies: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.create }));
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));
vi.mock("@/server/config", () => ({
  config: () => ({
    APP_MODE: mocks.mode,
    PASSWORD_RECOVERY_ENABLED: mocks.enabled,
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "public-key",
    SUPABASE_SERVICE_ROLE_KEY: "private-key",
  }),
}));
import { recoveryClient } from "@/server/supabase";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.mode = "supabase";
  mocks.enabled = false;
});
it("keeps recovery disabled until explicitly configured", () => {
  expect(() => recoveryClient()).toThrow(
    "Password recovery is not available yet",
  );
  expect(mocks.create).not.toHaveBeenCalled();
});
it("never enables account recovery in preview mode", () => {
  mocks.enabled = true;
  mocks.mode = "preview";
  expect(() => recoveryClient()).toThrow();
  expect(mocks.create).not.toHaveBeenCalled();
});
it("uses an ephemeral public-key client without touching browser authentication cookies", () => {
  mocks.enabled = true;
  recoveryClient();
  expect(mocks.create).toHaveBeenCalledWith(
    "https://example.supabase.co",
    "public-key",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: expect.any(Function) },
    },
  );
  expect(mocks.cookies).not.toHaveBeenCalled();
});
