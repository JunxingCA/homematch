import { expect, it } from "vitest";
import { z } from "zod";
import { createOneMapClient } from "../../src/server/providers/oneMapClient.mjs";

it.skipIf(!process.env.ONEMAP_EMAIL || !process.env.ONEMAP_PASSWORD)(
  "exchanges the configured credentials and searches one public landmark without account/database writes",
  async () => {
    const client = createOneMapClient({
      getEnv: () => ({
        ONEMAP_EMAIL: process.env.ONEMAP_EMAIL,
        ONEMAP_PASSWORD: process.env.ONEMAP_PASSWORD,
      }),
    });
    // No seed token: the first request must use an actual credential exchange.
    const response = await client.json(
      "https://www.onemap.gov.sg/api/common/elastic/search?searchVal=NANYANG%20TECHNOLOGICAL%20UNIVERSITY&returnGeom=Y&getAddrDetails=Y&pageNum=1",
      { timeoutMs: 15000 },
    );
    const data = z
      .object({
        results: z
          .array(
            z.object({
              ADDRESS: z.string(),
              LATITUDE: z.string(),
              LONGITUDE: z.string(),
            }),
          )
          .min(1),
      })
      .parse(response);
    expect(
      data.results.every(
        (point) =>
          Number.isFinite(Number(point.LATITUDE)) &&
          Number.isFinite(Number(point.LONGITUDE)),
      ),
    ).toBe(true);
  },
);
