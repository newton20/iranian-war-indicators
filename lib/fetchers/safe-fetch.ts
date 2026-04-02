export interface FetchResult<T> {
  data: T | null;
  error: string | null;
}

export async function safeFetch<T>(
  url: string,
  parser: (response: Response) => Promise<T>,
  options?: {
    timeoutMs?: number;
    headers?: Record<string, string>;
    validateResult?: (data: T) => boolean;
  }
): Promise<FetchResult<T>> {
  const timeoutMs = options?.timeoutMs ?? 15000;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: options?.headers,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        data: null,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await parser(response);

    if (options?.validateResult && !options.validateResult(data)) {
      return {
        data: null,
        error: `Validation failed for parsed data`,
      };
    }

    return { data, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown fetch error";
    return { data: null, error: message };
  }
}
