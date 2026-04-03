import { safeFetch } from "./safe-fetch";

export interface FredResult {
  inflation1y: number;
  tbill3m: number;
}

// NOTE: API key is in the query string (FRED API requirement). Ensure error logging never exposes the full URL.
function buildFredUrl(seriesId: string, apiKey: string): string {
  return `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;
}

const STALENESS_LIMITS: Record<string, number> = {
  DTB3: 90,
  EXPINF1YR: 60,
};

function redactApiKey(text: string, apiKey: string): string {
  return text.replaceAll(apiKey, 'REDACTED');
}

async function fetchSeries(
  seriesId: string,
  apiKey: string
): Promise<{ data: number | null; error: string | null }> {
  const url = buildFredUrl(seriesId, apiKey);

  const result = await safeFetch<number>(
    url,
    async (response) => {
      const json = await response.json();
      const observation = json?.observations?.[0];
      const rawValue = observation?.value;

      if (rawValue === "." || rawValue == null) {
        console.error(
          `FRED parse error: missing data marker for ${seriesId}. Raw value: "${rawValue}"`
        );
        throw new Error(`FRED returned missing data for ${seriesId}`);
      }

      const num = Number(rawValue);
      if (isNaN(num)) {
        console.error(
          `FRED parse error: non-numeric value for ${seriesId}: "${rawValue}"`
        );
        throw new Error(
          `FRED returned non-numeric value for ${seriesId}: ${rawValue}`
        );
      }

      if (!isFinite(num) || num <= 0) {
        console.error(
          `FRED parse error: value out of range for ${seriesId}: ${num}`
        );
        throw new Error(
          `FRED parse error: value is not finite and positive for ${seriesId}: ${num}`
        );
      }

      // Validate observation date staleness
      const obsDate = observation?.date;
      if (obsDate) {
        const maxDays = STALENESS_LIMITS[seriesId] ?? 90;
        const obsDt = new Date(obsDate);
        const now = new Date();
        const daysDiff =
          (now.getTime() - obsDt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > maxDays) {
          console.error(
            `FRED parse error: stale data for ${seriesId}. Observation date: ${obsDate}, ${Math.round(daysDiff)} days old (limit: ${maxDays})`
          );
          throw new Error(
            `FRED parse error: ${seriesId} observation is ${Math.round(daysDiff)} days old (limit: ${maxDays})`
          );
        }
      }

      // FRED returns percentages (e.g. 2.5 for 2.5%), convert to decimal
      const decimal = num / 100;
      console.log(
        `FRED: ${seriesId} = ${num}% (${decimal}) as of ${obsDate ?? "unknown"}`
      );
      return decimal;
    },
    {
      timeoutMs: 15000,
      validateResult: (v) => typeof v === "number" && isFinite(v),
    }
  );

  // Redact API key from any error messages before returning
  if (result.error) {
    return { data: null, error: redactApiKey(result.error, apiKey) };
  }
  return result;
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
