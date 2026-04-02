import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";

export async function GET(request: NextRequest) {
  // Validate CRON_SECRET from Authorization header
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runPipeline();
    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown pipeline error";
    return NextResponse.json(
      { success: false, summary: `Pipeline crashed: ${message}` },
      { status: 500 }
    );
  }
}
