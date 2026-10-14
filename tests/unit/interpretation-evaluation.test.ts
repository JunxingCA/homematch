import { expect, it } from "vitest";
import { interpretationRequest } from "@/domain/interpretation";
import { evaluationCases } from "../fixtures/interpretation-evaluation";

it("keeps the live corpus bounded, distinct and valid without calling a provider", () => {
  expect(evaluationCases).toHaveLength(8);
  expect(new Set(evaluationCases.map((c) => c.id)).size).toBe(8);
  for (const scenario of evaluationCases)
    expect(
      interpretationRequest.safeParse({ text: scenario.text, consent: true })
        .success,
    ).toBe(true);
});
