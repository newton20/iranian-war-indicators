import { safeFetch } from "./safe-fetch";

export interface FredResult {
  inflation1y: number;
  tbill3m: number;
}

function buildFredUrl(seriesId: string, apiKey: string): string {
  return `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;
}

async function fetchSeries(
  seriesId: string,
  apiKey: string
): Promise<{ data: number | null; error: string | null }> {
  const url = buildFredUrl(seriesId, apiKey);

  return safeFetch<number>(
    url,
    async (response) => {
      const json = await response.json();
      const rawValue = json?.observations?.[0]?.value;

      if (rawValue === "." || rawValue == null) {
        throw new Error(`FRED returned missing data for ${seriesId}`);
      }

      const num = Number(rawValue);
      if (isNaN(num)) {
        throw new Error(
          `FRED returned non-numeric value for ${seriesId}: ${rawValue}`
        );
      }

      // FRED returns percentages (e.g. 2.5 for 2.5%), convert to decimal
      return num / 100;
    },
    {
      timeoutMs: 15000,
      validateResult: (v) => typeof v === "number" && isFinite(v),
    }
  );
}

export async function fetchFred(): Promise<{
  data: FredResult | null;
  error: string | null;
}> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return { data: null, error: "FRED_API_KEY not configured" };
  }

  const [inflationResult, tbillResult] = await Promise.all([
    fetchSeries("EXPINF1YR", apiKey),
    fetchSeries("DTB3", apiKey),
  ]);

  if (inflationResult.error || inflationResult.data === null) {
    return {
      data: null,
      error: `Inflation fetch failed: ${inflationResult.error}`,
    };
  }

  if (tbillResult.error || tbillResult.data === null) {
    return {
      data: null,
      error: `T-Bill fetch failed: ${tbillResult.error}`,
    };
  }

  return {
    data: {
      inflation1y: inflationResult.data,
      tbill3m: tbillResult.data,
    },
    error: null,
  };
}
