import { getLatestIndicator, getIndicatorHistory, getEventAnnotations } from "@/lib/db";
import RiskBadge from "@/components/RiskBadge";
import EmptyState from "@/components/EmptyState";
import Explainer from "@/components/Explainer";
import DashboardClient from "@/components/DashboardClient";

export const revalidate = 3600; // ISR: revalidate every hour

export default async function Dashboard() {
  let latest;
  let history;
  let events;

  try {
    [latest, history, events] = await Promise.all([
      getLatestIndicator(),
      getIndicatorHistory(365),
      getEventAnnotations(),
    ]);
  } catch {
    return (
      <main className="max-w-screen-2xl w-full mx-auto px-6 lg:px-12 py-8">
        <h1 className="text-2xl font-bold mb-4">Iranian War Indicators</h1>
        <EmptyState message="Database not connected. Set DATABASE_URL and run the schema migration." />
      </main>
    );
  }

  if (!latest) {
    return (
      <main className="max-w-screen-2xl w-full mx-auto px-6 lg:px-12 py-8">
        <h1 className="text-2xl font-bold mb-4">Iranian War Indicators</h1>
        <EmptyState message="Awaiting first data run. Trigger the pipeline via /api/cron or run the backfill script." />
      </main>
    );
  }

  const reversedHistory = [...history].reverse();

  return (
    <main className="max-w-screen-2xl w-full mx-auto px-6 lg:px-12 py-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Iranian War Indicators</h1>
        <RiskBadge
          badge={latest.risk_badge ?? "UNKNOWN"}
          date={latest.date}
          dataQuality={latest.data_quality}
        />
      </div>

      <DashboardClient latest={latest} history={reversedHistory} events={events} />

      <Explainer />

      <footer className="text-center text-sm text-[var(--muted)]">
        Pipeline last ran: {new Date(latest.pipeline_run_at).toLocaleString()} · Data quality: {latest.data_quality}
      </footer>
    </main>
  );
}
