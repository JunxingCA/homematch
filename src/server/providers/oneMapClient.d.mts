export class OneMapError extends Error {
  constructor(retryAfter?: number);
  retryAfter?: number;
}
export function createOneMapClient(options?: {
  getEnv?: () => {
    ONEMAP_TOKEN?: string;
    ONEMAP_EMAIL?: string;
    ONEMAP_PASSWORD?: string;
  };
  fetcher?: typeof fetch;
  now?: () => number;
}): {
  getToken(rejectedToken?: string): Promise<string>;
  json(
    input: string | URL,
    options?: { signal?: AbortSignal; timeoutMs?: number },
  ): Promise<unknown>;
};
