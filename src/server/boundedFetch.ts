import "server-only";

// Bound each SDK request without retrying writes or replacing caller cancellation.
export const boundedFetch: typeof fetch = (input, init) => {
  const caller =
    init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const timeout = AbortSignal.timeout(15000);
  return fetch(input, {
    ...init,
    signal: caller ? AbortSignal.any([caller, timeout]) : timeout,
  });
};
