export function officialDownloadUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !/(^|\.)s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/.test(url.hostname)
  )
    throw Error("Invalid official download origin");
  return url;
}
export async function boundedText(response, maxBytes, signal) {
  if (
    !response.ok ||
    !response.body ||
    Number(response.headers.get("Content-Length")) > maxBytes
  )
    throw Error("Provider download unavailable or too large");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw Error("Provider download too large");
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join("");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
