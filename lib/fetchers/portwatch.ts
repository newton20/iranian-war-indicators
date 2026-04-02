import { safeFetch } from "./safe-fetch";

export interface PortWatchResult {
  transits: number;
  dataDate: string;
}

const PORTWATCH_URL =
  "https://services.arcgis.com/ue9rwulIoeLEI9bj/arcgis/rest/services/chokepoint_daily_vessel_transit/FeatureServer/0/query?where=chokepoint_id=6&outFields=date,total_vessel_count&orderByFields=date DESC&resultRecordCount=1&f=json";

export async function fetchPortWatch(): Promise<{
  data: PortWatchResult | null;
  error: string | null;
}> {
  return safeFetch<PortWatchResult>(
    PORTWATCH_URL,
    async (response) => {
      const json = await response.json();
      const feature = json?.features?.[0]?.attributes;
      if (!feature) {
        throw new Error("No features returned from PortWatch");
      }

      const transits = feature.total_vessel_count;
      if (typeof transits !== "number" || transits < 0) {
        throw new Error(`Invalid transit count: ${transits}`);
      }

      const rawDate = feature.date;
      const dataDate =
        typeof rawDate === "number"
          ? new Date(rawDate).toISOString().split("T")[0]
          : String(rawDate);

      return { transits, dataDate };
    },
    {
      timeoutMs: 15000,
      validateResult: (d) => d.transits >= 0,
    }
  );
}
