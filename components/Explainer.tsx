export default function Explainer() {
  return (
    <section className="rounded-lg bg-surface border border-border px-6 py-10 lg:px-12 lg:py-14">
      <div className="max-w-3xl mx-auto space-y-12">
        {/* Title */}
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Why These Two Numbers Matter
        </h2>

        {/* Section 1: The Philosophy */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">The Philosophy</h3>
          <div className="space-y-3 text-[#a1a1aa] text-sm leading-relaxed">
            <p>
              In a world drowning in information noise, only two bottom-level data points
              tell you the truth about the Iran crisis.
            </p>
            <p>
              <strong className="text-white">Are ships actually moving through the Strait of Hormuz?</strong>{" "}
              This is the physical and economic heartbeat of global energy. When tankers
              transit, the world economy has a pulse. When they stop, something fundamental
              has changed.
            </p>
            <p>
              <strong className="text-white">Is the TACO pattern holding?</strong>{" "}
              Will political leaders back down under domestic pressure, or is this time
              different? The stress index tells you whether the safety net the market
              relies on is still intact.
            </p>
            <p>
              The key insight: don&apos;t listen to politicians, analysts, or media.
              Watch the ships. Watch the stress index. When ships move and stress is low,
              the crisis is managed. When ships stop and stress is high, the world has a
              real problem.
            </p>
          </div>
        </div>

        <hr className="border-border" />

        {/* Section 2: What is the Strait of Hormuz? */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">What is the Strait of Hormuz?</h3>
          <div className="space-y-3 text-[#a1a1aa] text-sm leading-relaxed">
            <p>
              Twenty percent of global oil transits this narrow waterway between Iran and
              Oman. When it closes&mdash;economically or physically&mdash;global supply
              chains break. Energy prices spike. Downstream industries seize up. It is the
              single most important chokepoint in the global economy.
            </p>
            <p>
              This dashboard tracks <strong className="text-white">tanker traffic specifically</strong>,
              not just total vessel counts. Tankers carry the oil. That is the signal that
              matters. We also break down vessel types&mdash;tankers, containers, dry bulk,
              cargo&mdash;so you can see exactly what is moving and what is not.
            </p>
            <p>
              The strait status uses a 4-state system sourced from IMF PortWatch data:{" "}
              <span className="text-green-400 font-semibold">OPEN</span> means tankers are
              flowing.{" "}
              <span className="text-yellow-400 font-semibold">RESTRICTED</span> means ships
              move but tankers do not&mdash;this is the economic closure, the one that
              matters for oil.{" "}
              <span className="text-red-400 font-semibold">CLOSED</span> means no vessels
              at all.{" "}
              <span className="text-zinc-400 font-semibold">UNKNOWN</span> means data is
              unavailable.
            </p>
            <p>
              The Brent crude oil price overlay completes the picture. If tankers are moving
              and oil prices are stable, the crisis is priced in. If tankers stop and oil
              spikes, the market is behind the curve.
            </p>
          </div>
        </div>

        <hr className="border-border" />

        {/* Section 3: What is the TACO Stress Index? */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">What is the TACO Stress Index?</h3>
          <div className="space-y-3 text-[#a1a1aa] text-sm leading-relaxed">
            <p>
              TACO stands for &ldquo;Trump Always Caves/Chickens Out.&rdquo; Deutsche
              Bank&apos;s Maximilian Uleer created this index to measure domestic political
              pressure: approval ratings, stock market pain, inflation fears, and bond
              yields.
            </p>
            <p>
              The thesis is simple. When domestic pressure gets high enough, policy
              reversals become likely. Tariffs get delayed. Threats get walked back.
              Markets recover.
            </p>
            <p>
              The index tracks whether the &ldquo;buy the dip&rdquo; assumption&mdash;that
              politicians will always back down&mdash;still holds. When that assumption
              breaks, the market&apos;s safety net disappears. That is when real risk
              begins.
            </p>
          </div>
        </div>

        <hr className="border-border" />

        {/* Section 4: How to Use This Dashboard */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">How to Use This Dashboard</h3>
          <div className="space-y-3 text-[#a1a1aa] text-sm leading-relaxed">
            <p>Check once a day. Ten seconds. That is all you need.</p>
            <ul className="space-y-2 list-none pl-0">
              <li>
                <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2 align-middle" />
                <strong className="text-white">GREEN</strong> &mdash; Tankers flowing, TACO low. Managed crisis. Move on with your day.
              </li>
              <li>
                <span className="inline-block w-3 h-3 rounded-full bg-yellow-500 mr-2 align-middle" />
                <strong className="text-white">YELLOW</strong> &mdash; Tanker traffic restricted OR TACO elevated. One signal is stressed. Pay attention.
              </li>
              <li>
                <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-2 align-middle" />
                <strong className="text-white">RED</strong> &mdash; Tankers stopped AND TACO breaking. Both signals alarming. Prepare for disruption.
              </li>
            </ul>
            <p>
              Use the time range filter (7D / 30D / 90D / 1Y / ALL) to zoom in on recent
              moves or zoom out for the full picture.
            </p>
            <p>
              Don&apos;t trade on this. Don&apos;t panic. Just stay informed.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
