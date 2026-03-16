const wait = (ms: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, ms);
});

const isAbortError = (error: unknown) => {
  if (error instanceof DOMException) {
    return error.name === 'AbortError';
  }

  return error instanceof Error && error.name === 'AbortError';
};

export const fetchWithRetry = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  retries = 3,
  baseDelayMs = 700
) => {
  let lastError: unknown;
  const requestInit: RequestInit = init
    ? { credentials: 'include' as RequestCredentials, ...init }
    : { credentials: 'include' as RequestCredentials };

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await fetch(input, requestInit);
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      lastError = error;
      if (attempt === retries - 1) break;
      await wait(baseDelayMs * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('fetch_retry_failed');
};
