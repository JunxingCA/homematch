import { beforeEach, expect, it, vi } from "vitest";
const complete = vi.hoisted(() => vi.fn());
vi.mock("@/server/config", () => ({
  config: () => ({ APP_ORIGIN: "http://localhost:3000" }),
}));
vi.mock("@/server/controllers/AuthenticationController", () => ({
  AuthenticationController: class {
    completeOAuthSignIn = complete;
  },
}));
import { GET } from "@/app/auth/callback/route";
beforeEach(() => {
  complete.mockReset();
});
it("redirects successful login only to the configured origin", async () => {
  const response = await GET(
    new Request(
      "http://untrusted.test/auth/callback?code=valid&next=https://evil.test",
    ),
  );
  expect(complete).toHaveBeenCalledWith("valid");
  expect(response.headers.get("location")).toBe("http://localhost:3000/");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
});
it.each([
  "",
  "?code=",
  "?code=" + "x".repeat(2049),
  "?error=server_error&code=ignored",
])("rejects invalid callback %s", async (query) => {
  const response = await GET(
    new Request("http://localhost:3000/auth/callback" + query),
  );
  expect(response.headers.get("location")).toContain("auth=oauth-failed");
  expect(complete).not.toHaveBeenCalled();
});
it("handles cancellation without exposing provider error text", async () => {
  const response = await GET(
    new Request(
      "http://localhost:3000/auth/callback?error=access_denied&error_description=secret",
    ),
  );
  expect(response.headers.get("location")).toBe(
    "http://localhost:3000/?auth=cancelled",
  );
  expect(complete).not.toHaveBeenCalled();
});
it("handles failed exchanges", async () => {
  complete.mockRejectedValue(new Error("private provider detail"));
  const response = await GET(
    new Request("http://localhost:3000/auth/callback?code=expired"),
  );
  expect(response.headers.get("location")).toBe(
    "http://localhost:3000/?auth=oauth-failed",
  );
});
