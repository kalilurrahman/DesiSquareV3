/**
 * gf-stats reference serializer — constraint #8 enforcement pattern.
 *
 * The single rule that makes the %-only guarantee unfalsifiable from the client:
 * output is CONSTRUCTED from explicit picks — upstream objects are never spread,
 * merged, or passed through. A new currency field in a future Ghostfolio release
 * cannot reach the output because nothing here copies unknown fields.
 */

const MIN_MONTHS_REQUIRED = 6;

const compound = (pcts) => (pcts.reduce((acc, p) => acc * (1 + p / 100), 1) - 1) * 100;

const maxDrawdown = (pcts) => {
  let nav = 100, peak = 100, dd = 0;
  for (const p of pcts) {
    nav *= 1 + p / 100;
    if (nav > peak) peak = nav;
    dd = Math.min(dd, (nav / peak - 1) * 100);
  }
  return dd;
};

const stdev = (pcts) => {
  const mu = pcts.reduce((s, v) => s + v, 0) / pcts.length;
  return Math.sqrt(pcts.reduce((s, v) => s + (v - mu) ** 2, 0) / pcts.length);
};

const r2 = (v) => Math.round(v * 100) / 100;

/**
 * @param upstream — Ghostfolio-shaped input, e.g.:
 *   {
 *     monthlyPerformance: [{ date:"2024-09", netPerformanceInPercentage: 4.67,
 *                            netPerformance: 4012.55, currentValue: 91230.10, currency:"USD" }, …],
 *     holdings: [{ symbol, name, allocationInPercentage: 0.221, netPerformancePercent: 0.112,
 *                  quantity: 412, marketValue: 28376.44, currency:"USD" }, …],
 *     allocations: [{ label:"US Equity", allocationInPercentage: 0.58, valueInBaseCurrency: 74472 }, …]
 *   }
 *   (currency fields shown to make the point: they exist upstream and are never picked.)
 * @param meta — { pseudonym, linkedSince, lastVerifiedAt, benchmark:{id,label,monthly:[{month,pct}]} }
 */
export function toMavenStats(upstream, meta) {
  // ---- returns.monthly: pick exactly (date → month, percentage → pct). Nothing else. ----
  const monthly = upstream.monthlyPerformance.map((m) => ({
    month: m.date,
    pct: r2(m.netPerformanceInPercentage),
  }));

  const pcts = monthly.map((m) => m.pct);
  const months = monthly.length;
  const year = monthly[months - 1].month.slice(0, 4);
  const ytdPcts = monthly.filter((m) => m.month.startsWith(year)).map((m) => m.pct);

  const kpis = {
    ytd_pct: r2(compound(ytdPcts)),
    one_year_pct: months >= 12 ? r2(compound(pcts.slice(-12))) : null,
    two_year_annualised_pct:
      months >= 18
        ? r2((Math.pow(1 + compound(pcts.slice(-24)) / 100, 12 / Math.min(months, 24)) - 1) * 100)
        : null,
    max_drawdown_pct: r2(maxDrawdown(pcts)),
    profitable_months_pct: r2((pcts.filter((p) => p > 0).length / months) * 100),
  };

  const sd = stdev(pcts);

  return {
    schema_version: "1.0",
    pseudonym: meta.pseudonym,
    verified: {
      source: "ghostfolio",
      linked_since: meta.linkedSince,
      last_verified_at: meta.lastVerifiedAt,
      refresh: "daily",
    },
    track_record: {
      start: monthly[0].month,
      months,
      sufficient_history: months >= MIN_MONTHS_REQUIRED,
      min_months_required: MIN_MONTHS_REQUIRED,
    },
    returns: { monthly, kpis },
    benchmark: {
      id: meta.benchmark.id,
      label: meta.benchmark.label,
      monthly: meta.benchmark.monthly.map((m) => ({ month: m.month, pct: r2(m.pct) })),
    },
    risk: {
      band: sd < 3 ? "Low" : sd < 6 ? "Medium" : "High",
      method: "stdev_monthly_returns",
      stdev_monthly_pct: r2(sd),
    },
    allocation: upstream.allocations.map((a) => ({
      label: a.label,
      pct: r2(a.allocationInPercentage * 100),
    })),
    top_positions: [...upstream.holdings]
      .sort((a, b) => b.allocationInPercentage - a.allocationInPercentage)
      .slice(0, 10)
      .map((h) => ({
        symbol: h.symbol,
        name: h.name,
        weight_pct: r2(h.allocationInPercentage * 100),
        return_pct: r2(h.netPerformancePercent * 100),
      })),
  };
}
