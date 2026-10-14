import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { AIServiceAdapter } from "../../src/server/adapters/AIServiceAdapter";

it("extracts synthetic preferences through the configured Gemini model without database writes", async () => {
  if (!process.env.GEMINI_API_KEY)
    throw Error("Load the local server environment for this opt-in Gemini call.");
  const { draft, model } = await new AIServiceAdapter().extract(
    "I want a 4-room resale HDB with a maximum budget of SGD 600000. I visit Jurong East MRT five times per week by public transport and play badminton.",
  );
  expect(model).toBe(process.env.GEMINI_MODEL || "gemini-3.1-flash-lite");
  expect(draft.category).toBe("Resale HDB");
  expect(draft.budgetMax).toBe(600000);
  expect(draft.flatTypes).toContain("4-room");
  expect(draft.budgetMin).toBeNull();
  expect(draft.weights).toBeNull();
  expect(draft.destinations).toHaveLength(1);
  expect(draft.destinations?.[0]).toMatchObject({ visits: 5, mode: "public" });
  expect(draft.lifestyles?.some((item) => item.category === "Badminton")).toBe(true);
});
