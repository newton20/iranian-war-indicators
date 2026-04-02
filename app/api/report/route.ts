import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getLatestIndicator, DailyIndicator } from "@/lib/db";

export async function GET() {
  try {
    const data = await getLatestIndicator();

    if (!data) {
      return NextResponse.json(
        { status: "empty", message: "No data available" },
        { status: 200 }
      );
    }

    const alerts: string[] = [];

    // Hormuz transit threshold
    if (data.hormuz_transits !== null && data.hormuz_transits < 10) {
      alerts.push("WARNING: Hormuz transits critically low");
    }

    // Hormuz closure — count consecutive closed days
    if (data.hormuz_status === "CLOSED") {
      const sql = neon(process.env.DATABASE_URL!);
      const rows = await sql`
        SELECT date, hormuz_status
        FROM daily_indicators
        ORDER BY date DESC
      `;
      let consecutiveClosed = 0;
      for (const row of rows) {
        if (row.hormuz_status === "CLOSED") {
          consecutiveClosed++;
        } else {
          break;
        }
      }
      alerts.push(
        `CRITICAL: Strait of Hormuz CLOSED for ${consecutiveClosed} consecutive day${consecutiveClosed !== 1 ? "s" : ""}`
      );
    }

    // TACO stress thresholds (check higher threshold first for ordering)
    if (data.taco_score !== null && data.taco_score > 9.0) {
      alerts.push("CRITICAL: TACO stress at extreme levels");
    } else if (data.taco_score !== null && data.taco_score > 7.0) {
      alerts.push("WARNING: TACO stress elevated");
    }

    return NextResponse.json(
      { status: "ok", data, alerts },
      { status: 200 }
    );
  } catch (error) {
    console.error("Report API error:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}
