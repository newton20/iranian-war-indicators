import { safeFetch } from "./safe-fetch";

export interface PortWatchResult {
  transits: number;
  dataDate: string;
  nTanker: number | null;
  nContainer: number | null;
  nDryBulk: number | null;
  nCargo: number | null;
}

const PORTWATCH_URL =
  "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query?where=portid=%27chokepoint6%27&outFields=date,n_total,n_tanker,n_container,n_dry_bulk,n_general_cargo,n_roro&orderByFields=date+DESC&resultRecordCount=1&f=json";

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

      // Parse vessel type fields, treating missing values as null
      const nTanker = typeof feature.n_tanker === "number" && !isNaN(feature.n_tanker) ? feature.n_tanker : null;
      const nContainer = typeof feature.n_container === "number" && !isNaN(feature.n_container) ? feature.n_container : null;
      const nDryBulk = typeof feature.n_dry_bulk === "number" && !isNaN(feature.n_dry_bulk) ? feature.n_dry_bulk : null;
      const nGeneralCargo = typeof feature.n_general_cargo === "number" && !isNaN(feature.n_general_cargo) ? feature.n_general_cargo : 0;
      const nRoro = typeof feature.n_roro === "number" && !isNaN(feature.n_roro) ? feature.n_roro : 0;
      // Combine general cargo + roro into a single cargo field
      const nCargo = (nGeneralCargo || nRoro) ? nGeneralCargo + nRoro : null;

      console.log(`PortWatch: ${transits} transits on ${dataDate} (tanker=${nTanker}, container=${nContainer}, dry_bulk=${nDryBulk}, cargo=${nCargo})`);

      return { transits, dataDate, nTanker, nContainer, nDryBulk, nCargo };
    },
    {
      timeoutMs: 15000,
      validateResult: (d) => d.transits >= 0,
    }
  );
}
