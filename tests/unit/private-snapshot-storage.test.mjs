import { expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import { normaliseUra } from "../../src/domain/marketEvidence.mjs";
import {
  encodePrivateSnapshot,
  decodePrivateSnapshot,
} from "../../src/server/providers/privateSnapshotStorage.mjs";

const snapshot = normaliseUra(
  [
    {
      Status: "Success",
      Result: [
        {
          project: "Public test fixture",
          street: "Example",
          x: "28001.642",
          y: "38744.572",
          transaction: [
            {
              contractDate: "0926",
              district: "04",
              propertyType: "Condominium",
              price: "1200000",
              area: "90",
              typeOfArea: "Strata",
              typeOfSale: "3",
              noOfUnits: "1",
            },
          ],
        },
      ],
    },
    ...Array.from({ length: 3 }, () => ({ Status: "Success", Result: [] })),
  ],
  "2026-10-31T00:00:00.000Z",
  "ura-storage-test",
);

it("losslessly round-trips validated prices and retains legacy snapshot compatibility", () => {
  expect(decodePrivateSnapshot(encodePrivateSnapshot(snapshot))).toEqual(
    snapshot,
  );
  expect(decodePrivateSnapshot(snapshot)).toEqual(snapshot);
});
it("rejects corrupted data, wrong sizes and mismatched source identities", () => {
  const encoded = encodePrivateSnapshot(snapshot);
  expect(() =>
    decodePrivateSnapshot({ ...encoded, sha256: "0".repeat(64) }),
  ).toThrow();
  expect(() => decodePrivateSnapshot({ ...encoded, bytes: 1 })).toThrow();
  expect(() =>
    decodePrivateSnapshot({ ...encoded, id: "different" }),
  ).toThrow();
  expect(() =>
    decodePrivateSnapshot({ ...encoded, data: "not-base64!" }),
  ).toThrow();
  expect(() =>
    decodePrivateSnapshot({ ...encoded, encoding: "unknown" }),
  ).toThrow();
});
it("bounds decompression even if a stored envelope lies about its size", () => {
  const encoded = encodePrivateSnapshot(snapshot);
  const bomb = gzipSync(Buffer.alloc(32 * 1024 * 1024 + 1)).toString("base64");
  expect(() => decodePrivateSnapshot({ ...encoded, data: bomb })).toThrow();
});
