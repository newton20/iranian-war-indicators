import { safeFetch } from "./safe-fetch";

export interface PortWatchResult {
  transits: number;
  dataDate: string;
}

const PORTWATCH_URL =
  "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query?where=portid=%27chokepoint6%27&outFields=date,n_total&orderByFields=date+DESC&resultRecordCount=1&f=json";

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
        const keys = json ? Object.keys(json) : [];
        console.error(
          `PortWatch parse error: no features in response. Top-level keys: [${keys.join(", ")}]`
        );
        throw new Error("PortWatch parse error: no features in response");
      }

      const transits = feature.n_total;
      if (transits === undefined || transits === null) {
        console.error(
          `PortWatch parse error: n_total missing. Feature keys: [${Object.keys(feature).join(", ")}]`
        );
        throw new Error("PortWatch parse error: n_total is missing");
      }
      if (typeof transits !== "number" || isNaN(transits)) {
        console.error(
          `PortWatch parse error: n_total is not a valid number. Value: ${transits}, type: ${typeof transits}`
        );
        throw new Error(
          `PortWatch parse error: n_total is not a valid number (${transits})`
        );
      }
      if (transits < 0) {
        console.error(`PortWatch parse error: n_total is negative (${transits})`);
        throw new Error(`PortWatch parse error: n_total is negative (${transits})`);
      }

      const rawDate = feature.date;
      if (typeof rawDate !== "number" || isNaN(rawDate) || rawDate <= 0) {
        console.error(
          `PortWatch parse error: invalid date field. Value: ${rawDate}, type: ${typeof rawDate}. Feature keys: [${Object.keys(feature).join(", ")}]`
        );
        throw new Error(
          `PortWatch parse error: date is not a valid epoch timestamp (${rawDate})`
        );
      }

      const dataDate = new Date(rawDate).toISOString().split("T")[0];
      console.log(`PortWatch: ${transits} transits on ${dataDate}`);

      return { transits, dataDate };
    },
    {
      timeoutMs: 15000,
      validateResult: (d) => d.transits >= 0,
    }
  );
}
