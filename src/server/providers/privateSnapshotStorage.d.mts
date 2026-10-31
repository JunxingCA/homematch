import type { PrivateSnapshot } from "../../domain/marketEvidence.mjs";
export type StoredPrivateSnapshot = {
  id: string;
  kind: "private";
  storageVersion: 1;
  encoding: "gzip-base64";
  bytes: number;
  sha256: string;
  data: string;
};
export function encodePrivateSnapshot(input: unknown): StoredPrivateSnapshot;
export function decodePrivateSnapshot(input: unknown): PrivateSnapshot;
