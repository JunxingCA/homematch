import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { z } from "zod";
import { privateSnapshotSchema } from "../../domain/marketEvidence.mjs";

const MAX_BYTES = 32 * 1024 * 1024;
const envelopeSchema = z
  .object({
    id: z.string().min(1).max(200),
    kind: z.literal("private"),
    storageVersion: z.literal(1),
    encoding: z.literal("gzip-base64"),
    bytes: z.number().int().positive().max(MAX_BYTES),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    data: z
      .string()
      .min(1)
      .max(MAX_BYTES)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict();
const hash = (data) => createHash("sha256").update(data).digest("hex");

export function encodePrivateSnapshot(input) {
  const snapshot = privateSnapshotSchema.parse(input);
  const bytes = Buffer.from(JSON.stringify(snapshot));
  if (bytes.length > MAX_BYTES)
    throw Error("Private snapshot exceeds storage limit");
  return envelopeSchema.parse({
    id: snapshot.id,
    kind: "private",
    storageVersion: 1,
    encoding: "gzip-base64",
    bytes: bytes.length,
    sha256: hash(bytes),
    data: gzipSync(bytes).toString("base64"),
  });
}

export function decodePrivateSnapshot(input) {
  if (input?.encoding === undefined) return privateSnapshotSchema.parse(input);
  const envelope = envelopeSchema.parse(input);
  const compressed = Buffer.from(envelope.data, "base64");
  if (compressed.toString("base64") !== envelope.data)
    throw Error("Invalid snapshot encoding");
  const bytes = gunzipSync(compressed, { maxOutputLength: MAX_BYTES });
  if (bytes.length !== envelope.bytes || hash(bytes) !== envelope.sha256)
    throw Error("Private snapshot integrity check failed");
  const snapshot = privateSnapshotSchema.parse(
    JSON.parse(bytes.toString("utf8")),
  );
  if (snapshot.id !== envelope.id)
    throw Error("Private snapshot identity mismatch");
  return snapshot;
}
