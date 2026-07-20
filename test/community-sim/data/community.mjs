// DesiSquare 50-user community simulation corpus.
// Personas are pseudonymous by design (#-constraints): no real names, no emails
// beyond generated throwaways, no phone numbers anywhere. Dialogue bodies avoid
// personal portfolio currency amounts (percentages and ratios only) so the
// leak-scan phase can assert a clean surface.

export const CORRIDORS = ['US', 'CA', 'UK', 'AE', 'AU', 'SG'];

// 50 personas: 2 mavens, 1 moderator persona (created as regular user; promote
// manually if desired), 47 members across six corridors.
export const PERSONAS = [
  // — US (16)
  { u: 'nikhil_cfa',      corridor: 'US', maven: true,  bio: 'CFA, ex-Fidelity PM. Education, never advice. Rebalancing over conviction.' },
  { u: 'priya_ea',        corridor: 'US', maven: true,  bio: 'CPA / EA. Cross-border tax educator. FEMA & FBAR walkthroughs.' },
  { u: 'quiet_lotus',     corridor: 'US', bio: 'Index funds and chai. Slow money.' },
  { u: 'first_gen_saver', corridor: 'US', bio: 'First in my family to invest. Learning out loud.' },
  { u: 'roth_rookie',     corridor: 'US', bio: 'H-1B, figuring out retirement accounts one acronym at a time.' },
  { u: 'bogle_bhakt',     corridor: 'US', bio: 'Three-fund portfolio devotee.' },
  { u: 'masala_momentum', corridor: 'US', bio: 'Recovering stock picker.' },
  { u: 'fire_by_45',      corridor: 'US', bio: 'Coast FIRE dreaming, spreadsheet wielding.' },
  { u: 'chai_and_charts', corridor: 'US', bio: 'Weekend chart reader, weekday index buyer.' },
  { u: 'h1b_horizon',     corridor: 'US', bio: 'Visa timelines shape my asset location.' },
  { u: 'green_card_gains',corridor: 'US', bio: 'Recently past the visa cliff. Rebuilding the plan.' },
  { u: 'sip_and_chill',   corridor: 'US', bio: 'Automate, then ignore.' },
  { u: 'ledger_lakshmi',  corridor: 'US', bio: 'Tracks every basis point.' },
  { u: 'dosa_dividends',  corridor: 'US', bio: 'Dividend growth with extra sambar.' },
  { u: 'nri_numbers',     corridor: 'US', bio: 'NRE/NRO/FCNR alphabet soup survivor.' },
  { u: 'patient_paisa',   corridor: 'US', bio: 'Time in the market. Also in the kitchen.' },
  // — CA (8)
  { u: 'tfsa_tigress',    corridor: 'CA', bio: 'Maxing TFSA before anything else.' },
  { u: 'rrsp_raja',       corridor: 'CA', bio: 'RRSP match first, questions later.' },
  { u: 'maple_moong',     corridor: 'CA', bio: 'PR in Toronto, portfolio in transition.' },
  { u: 'prairie_paneer',  corridor: 'CA', bio: 'Calgary engineer, couch-potato investor.' },
  { u: 'loonie_lentils',  corridor: 'CA', bio: 'CAD/INR watcher.' },
  { u: 'vancouver_vada',  corridor: 'CA', bio: 'Housing-priced-out, index-fund-priced-in.' },
  { u: 'gst_gulab',       corridor: 'CA', bio: 'Small business, big TFSA plans.' },
  { u: 'toronto_totka',   corridor: 'CA', bio: 'Cross-border commuter, double-taxed once, never again.' },
  // — UK (8)
  { u: 'isa_investor',    corridor: 'UK', bio: 'S&S ISA every April 6th, like clockwork.' },
  { u: 'nri_in_london',   corridor: 'UK', bio: 'Tier 2 to ILR journey, LISA on the side.' },
  { u: 'thames_thali',    corridor: 'UK', bio: 'Global index, local biryani.' },
  { u: 'pension_pakora',  corridor: 'UK', bio: 'Salary sacrifice maximalist.' },
  { u: 'brum_bhel',       corridor: 'UK', bio: 'Birmingham NHS doc, deciphering the annual allowance.' },
  { u: 'gilts_and_ghee',  corridor: 'UK', bio: 'Boring bonds, brilliant breakfasts.' },
  { u: 'heathrow_hodl',   corridor: 'UK', bio: 'Long layovers, longer time horizons.' },
  { u: 'sterling_sabzi',  corridor: 'UK', bio: 'GBP earner, INR dreamer.' },
  // — AE (6)
  { u: 'dubai_dirhams',   corridor: 'AE', bio: 'Tax-free salary, self-imposed savings tax.' },
  { u: 'burj_budget',     corridor: 'AE', bio: 'Gratuity planner, remittance optimizer.' },
  { u: 'marina_moong',    corridor: 'AE', bio: 'DIFC analyst, index investor at home.' },
  { u: 'tax_free_tandoor',corridor: 'AE', bio: 'No income tax ≠ no plan.' },
  { u: 'sharjah_sip',     corridor: 'AE', bio: 'Monthly SIPs across two continents.' },
  { u: 'oud_and_etfs',    corridor: 'AE', bio: 'Fragrance collector, fee allergic.' },
  // — AU (6)
  { u: 'super_samosa',    corridor: 'AU', bio: 'Concessional cap chaser.' },
  { u: 'sydney_sipper',   corridor: 'AU', bio: 'Flat white budget, ETF autopilot.' },
  { u: 'asx_aloo',        corridor: 'AU', bio: 'Franking credits fan.' },
  { u: 'perth_paisa',     corridor: 'AU', bio: 'FIFO worker, LIC lover.' },
  { u: 'bondi_bhaji',     corridor: 'AU', bio: '482 to PR pipeline, portfolio on hold no more.' },
  { u: 'melbourne_moong', corridor: 'AU', bio: 'Renting by choice, investing by conviction.' },
  // — SG (6)
  { u: 'cpf_chai',        corridor: 'SG', bio: 'CPF SA top-up evangelist.' },
  { u: 'merlion_moolah',  corridor: 'SG', bio: 'New PR, decoding CPF vs SRS.' },
  { u: 'sgd_sambar',      corridor: 'SG', bio: 'Costs matter. So does cardamom.' },
  { u: 'orchard_oats',    corridor: 'SG', bio: 'Simple portfolio, complicated brunch orders.' },
  { u: 'kaya_compounder', corridor: 'SG', bio: 'Compounding since my first kaya toast.' },
  { u: 'jurong_jalebi',   corridor: 'SG', bio: 'Engineer, ETF enjoyer, jalebi judge.' },
];

// One deliberately non-compliant persona used ONLY to exercise the flag →
// review-queue flow (story 3.3/9.1). Created like the rest; its post gets flagged.
export const SPAMMER = { u: 'wealth_wizard_99', corridor: 'US', bio: 'Opportunities DM me' };

// Category → space structure the sim ensures exists (name, slug hint, description).
export const SPACES = [
  { name: 'Stocks & ETFs',      description: 'Broad-market investing, funds, single names — education only.' },
  { name: 'Taxes & FEMA',       description: 'Cross-border tax, remittances, FEMA/FBAR — not advice.' },
  { name: '401k & Retirement',  description: 'Retirement accounts across corridors.' },
  { name: 'Real Estate',        description: 'Property here vs back home.' },
  { name: 'Ask the community',  description: 'Questions welcome. Accepted answers on.' },
  { name: 'Insurance & Visas',  description: 'Coverage and status-linked planning.' },
  { name: 'Watercooler',        description: 'Everything else. Rituals live here.' },
];

// Label taxonomy the sim ensures exists (Epic 14): themes, format, tickers.
export const TAGS = ['fema', 'fcnr', '401k', 'roth', 'real-estate', 'insurance', 'isa', 'tfsa', 'cpf', 'super',
  'question', 'guide', 'discussion', 'poll', 'ama', 'weekly-watch',
  'nvda', 'vti', 'tsla', 'ibn', 'hdb'];

// Dialogue corpus: 15 topics, 59 replies, realistic multi-turn dialogues.
// r = [username, body]. like = usernames who like the post at that index
// (0 = topic post). accept = reply index to mark as accepted answer (Solved).
export const DIALOGUES = [
  {
    key: 'fema-repatriation', space: 'Taxes & FEMA', tags: ['fema', 'guide'], by: 'priya_ea',
    title: 'FEMA basics: repatriating sale proceeds from an inherited flat',
    body: `Selling inherited property in India and bringing the proceeds over comes up weekly, so here is the order of operations I teach:\n\n1. **Title first.** Mutation + legal heir certificate before any sale conversation.\n2. **The money lands in an NRO account.** Not NRE — sale proceeds of inherited property go to NRO.\n3. **The USD 1M scheme.** Repatriation out of NRO runs under the remittance scheme limit per financial year, with Form 15CA/CB sequencing.\n4. **CA certificate (15CB) before the bank will move anything.**\n5. **Capital gains are computed in India first** — indexation from the *original owner's* purchase date, not the inheritance date.\n\nThe most common mistake: wiring money to the NRE account "temporarily". Banks unwind that, painfully. Ask your bank for their remittance checklist *before* the sale closes.\n\n*Education, not advice — your CA owns your filing.*`,
    like: { 0: ['quiet_lotus', 'first_gen_saver', 'nri_numbers', 'h1b_horizon', 'toronto_totka', 'sterling_sabzi', 'dubai_dirhams', 'ledger_lakshmi'] },
    r: [
      ['nri_numbers', 'The indexation-from-original-purchase-date point saved my family real money. Our CA initially computed from the inheritance date; getting a second opinion was worth it.'],
      ['toronto_totka', 'Canada angle: remember the proceeds are also reportable here in the year of sale if you are a tax resident — the India-Canada treaty gives credit for Indian tax paid, but only if you actually claim it on Schedule T2209.'],
      ['priya_ea', 'Great addition @toronto_totka — same pattern in the US with Form 1116 foreign tax credit. The treaty saves you from double tax, but no form, no credit.'],
      ['first_gen_saver', 'For someone pre-sale: does the 15CA/CB dance happen per remittance or once per sale?'],
      ['priya_ea', 'Per remittance. If you move it in three tranches, that is three sets. Most people consolidate into one wire for exactly this reason.'],
      ['dubai_dirhams', 'UAE folks: no local tax on receipt, but the Indian side is identical. The NRO landing rule surprises everyone here too.'],
    ],
    likeReplies: { 1: ['priya_ea', 'quiet_lotus'], 2: ['priya_ea', 'maple_moong', 'rrsp_raja'], 4: ['first_gen_saver', 'nri_numbers'] },
  },
  {
    key: 'roth-h1b', space: '401k & Retirement', tags: ['401k', 'roth', 'question'], by: 'roth_rookie',
    title: 'Roth vs traditional 401k on H-1B — planning for a possible return to India',
    body: `My employer match just kicked in and I have to pick Roth vs traditional. The wrinkle: there is a real chance I return to India within 5-7 years.\n\nMy confusion: Roth means paying US tax now for tax-free growth later — but if I retire in India, how does India treat Roth withdrawals? Does the treaty even recognize Roth?\n\nWhat did others on a maybe-returning track actually do?`,
    like: { 0: ['h1b_horizon', 'first_gen_saver', 'sip_and_chill'] },
    r: [
      ['nikhil_cfa', `The honest answer: India does not recognize Roth's tax-free character. India taxes on residency, and a Roth withdrawal by an Indian tax resident is generally taxable there — the US-side tax freedom does not travel with you.\n\nSo the framework I teach: **traditional 401k dominates when return probability is high** — you defer US tax now, and the treaty gives relief on eventual withdrawal. Roth's edge needs decades of US residency to pay off.\n\nThree-bucket version: match money → traditional (free money either way) · high-conviction-stay money → Roth · unsure money → traditional. Past performance of any strategy ≠ future results, and your CPA should model your actual brackets.`],
      ['h1b_horizon', 'Went through exactly this in 2024. Chose traditional, and the deciding factor was RNOR — you get a 2-3 year window on return where foreign income has favorable treatment. Sequencing withdrawals into that window is the real game.'],
      ['priya_ea', 'Seconding the RNOR point — but note 401k distributions before 59½ still eat the 10% US early-withdrawal penalty regardless of Indian residency. The window helps with Indian tax, not the US penalty.'],
      ['roth_rookie', 'This is exactly what I needed — match into traditional, decide the rest when the visa picture clears. Marking the framework answer as accepted.'],
      ['bogle_bhakt', 'One more vote for not letting the Roth-vs-traditional decision delay enrollment. The match you skip while deciding is a guaranteed loss; the tax optimization is a maybe-gain.'],
    ],
    accept: 1,
    likeReplies: { 1: ['roth_rookie', 'h1b_horizon', 'first_gen_saver', 'sip_and_chill', 'quiet_lotus', 'fire_by_45'], 2: ['roth_rookie', 'nikhil_cfa'], 3: ['roth_rookie', 'h1b_horizon'], 5: ['roth_rookie', 'ledger_lakshmi'] },
  },
  {
    key: 'rebalancing-bands', space: 'Stocks & ETFs', tags: ['guide', 'discussion'], by: 'nikhil_cfa',
    title: 'My rebalancing bands: how I decide when to trim or add',
    body: `People ask how I decide when to rebalance. Not on a calendar — on **bands**: 5% absolute / 25% relative on every sleeve.\n\nExample: a 20% target sleeve rebalances at 15%/25% (absolute band binds) — a 4% sleeve at 3%/5% (relative band binds).\n\nWhy bands beat calendars:\n- They trade only when drift is meaningful, so costs stay near zero.\n- They are mechanical. No "feelings about the market" enter the decision.\n- Contributions do most of the work: I direct new money to the underweight sleeve first, and full rebalances become rare.\n\nTaxable-account caveat: I let winners drift wider before trimming because the tax drag of a trim can exceed the drift cost of waiting.\n\n*Education, not advice. My bands fit my plan — derive yours from your own volatility tolerance.*`,
    like: { 0: ['quiet_lotus', 'bogle_bhakt', 'fire_by_45', 'chai_and_charts', 'masala_momentum', 'sip_and_chill', 'ledger_lakshmi', 'isa_investor', 'super_samosa', 'cpf_chai', 'marina_moong'] },
    r: [
      ['masala_momentum', 'The "contributions do most of the work" point deserves its own post. I ran my history: with monthly contributions steering to the laggard, I would have triggered a full rebalance twice in six years.'],
      ['fire_by_45', 'How do you handle bands during a fast drawdown — March-2020 style — when everything blows through the bands in a week?'],
      ['nikhil_cfa', 'Great question. The bands do not know it is a crisis — and that is the feature. I rebalanced into the 2020 low because the mechanism said so, not because I was brave. The discipline you build in calm markets is the only one available in loud ones.'],
      ['gilts_and_ghee', 'UK version works identically inside an ISA where trims are tax-free — the taxable-caveat flips: rebalance freely inside the wrapper, let the GIA drift.'],
    ],
    likeReplies: { 1: ['nikhil_cfa', 'bogle_bhakt', 'fire_by_45'], 3: ['fire_by_45', 'masala_momentum', 'quiet_lotus', 'chai_and_charts', 'patient_paisa'] },
  },
  {
    key: 'nvda-trim', space: 'Stocks & ETFs', tags: ['nvda', 'discussion'], by: 'chai_and_charts',
    title: 'Trimming NVDA into strength — back to target weights',
    body: `$NVDA ran straight through my rebalancing band this quarter, so the decision was mechanical: trim back to target weight and rotate into the laggards.\n\nNot a view on the company — the band does not have opinions. Curious how others handle a single position that keeps punching through: wider bands for high-vol names, or same bands and more frequent trims?`,
    like: { 0: ['masala_momentum', 'nikhil_cfa', 'dosa_dividends', 'asx_aloo'] },
    r: [
      ['nikhil_cfa', 'Same bands, no exceptions — the moment you widen a band because a stock "keeps winning", you have re-introduced the opinion the band was built to remove. If the volatility genuinely justifies a wider band, that is a decision to make once, in the policy, not per rally.'],
      ['masala_momentum', 'I used to make the exception. Three exceptions later I was a concentrated portfolio with a rebalancing document nobody followed. The band is the strategy.'],
      ['dosa_dividends', 'Counterpoint worth stress-testing: in a taxable account each trim realizes gains. I handle single-name drift with contribution steering only — never sell, just stop feeding it.'],
      ['chai_and_charts', 'All three of these are internally consistent, which is the real lesson — pick a written policy and follow it. Thread delivered exactly what I hoped.'],
    ],
    likeReplies: { 1: ['chai_and_charts', 'masala_momentum', 'bogle_bhakt', 'quiet_lotus'], 2: ['nikhil_cfa', 'chai_and_charts'], 3: ['chai_and_charts', 'ledger_lakshmi'] },
  },
  {
    key: 'fcnr-rates', space: 'Ask the community', tags: ['fcnr', 'question'], by: 'quiet_lotus',
    title: 'Anyone compared FCNR rates at ICICI vs HDFC this month?',
    body: `FCNR(B) rates moved after the RBI announcement. Before I ladder this year's deposits: has anyone compared ICICI vs HDFC quotes this month? Interested in the 1-year and 3-year USD tenors, and whether either waived the remittance fee for larger tranches.\n\n(Percent quotes only please — this is a rate-shopping thread, not a balance-sharing thread 🙂)`,
    like: { 0: ['nri_numbers', 'sharjah_sip'] },
    r: [
      ['nri_numbers', 'Got quotes Friday: ICICI 1-yr USD at 5.15%, 3-yr at 4.80%. HDFC came in at 5.10% / 4.85% — so they split the tenors. Both waived the inward remittance fee above their premier thresholds; ask for the waiver explicitly, it is not automatic.'],
      ['sharjah_sip', 'Adding a data point from the UAE corridor: Axis quoted 5.20% on 1-yr USD this week for new-to-bank. The premier-tier fee waivers matter more than the headline rate once you annualize them.'],
      ['quiet_lotus', 'Both of these are exactly what I needed — accepting the first for the direct comparison. Laddering half at 1-yr, revisiting the 3-yr after the next policy meeting.'],
      ['patient_paisa', 'One structural reminder: FCNR removes currency risk on the principal, but the opportunity cost vs simply holding a USD treasury ladder is worth computing each year — some years the "NRI special" is not special.'],
    ],
    accept: 0,
    likeReplies: { 1: ['quiet_lotus', 'sharjah_sip', 'nri_numbers'], 3: ['quiet_lotus', 'nikhil_cfa', 'bogle_bhakt'] },
  },
  {
    key: 'isa-vs-pension', space: 'Ask the community', tags: ['isa', 'question'], by: 'nri_in_london',
    title: 'ISA vs pension top-up for an NRI on the ILR track — order of operations?',
    body: `Tier 2 → ILR route, four years in. After the workplace pension match, where does the next pound go: S&S ISA or extra pension via salary sacrifice?\n\nThe India wrinkle: if ILR falls through, pensions are locked until 57 while an ISA travels with me (taxably, but accessibly). How did other corridor folks sequence it?`,
    like: { 0: ['thames_thali', 'pension_pakora'] },
    r: [
      ['pension_pakora', `The framework that settled it for me:\n1. Match — always, it is a 100% return.\n2. Salary sacrifice into pension while in the 40% band — the NI saving stacks on the tax deferral.\n3. ISA with what is left, because *access is a real asset* on a visa track.\n\nIf your ILR probability feels below coin-flip, weight step 3 up. The pension lock-in is only a problem in the leave-early world — but that is exactly the world your ISA is for. Not advice; run your own bands.`],
      ['brum_bhel', 'NHS angle: the annual allowance taper makes "more pension" genuinely complicated at consultant grades — the ISA-first answer gets stronger there. Worth a dedicated thread.'],
      ['nri_in_london', 'Accepted — the "access is an asset on a visa track" framing is the piece I was missing. Match → sacrifice-in-the-40%-band → ISA it is.'],
      ['sterling_sabzi', 'Also check whether your employer allows sacrifice below the 40% threshold — mine does and the NI saving alone still beats a GIA, though not an ISA.'],
    ],
    accept: 0,
    likeReplies: { 1: ['nri_in_london', 'thames_thali', 'heathrow_hodl', 'isa_investor'], 2: ['pension_pakora', 'nri_in_london'] },
  },
  {
    key: 'tfsa-cross-border', space: 'Taxes & FEMA', tags: ['tfsa', 'question'], by: 'maple_moong',
    title: 'TFSA room after moving from the US — the cross-border gotchas nobody warned me about',
    body: `Moved from Seattle to Toronto last year. Two things I learned the hard way, posting so the next person doesn't:\n\n1. **TFSA room only accrues while you are a Canadian tax resident.** The "cumulative since 2009" number your bank shows assumes you were here the whole time. Contributing to that number = over-contribution penalty at 1% per month.\n2. **If you are still a US person (green card), the TFSA is not tax-free to the IRS.** It is a taxable foreign account with extra reporting. Many cross-border folks skip TFSA entirely until the US status resolves.\n\nQuestion for the corridor: anyone found a clean written explainer on the RRSP treaty deferral vs TFSA non-recognition asymmetry?`,
    like: { 0: ['rrsp_raja', 'toronto_totka', 'tfsa_tigress', 'prairie_paneer'] },
    r: [
      ['toronto_totka', 'The asymmetry in one line: the US-Canada treaty explicitly shelters RRSP growth (automatic deferral since 2014), but the TFSA is not mentioned in the treaty at all — so default US tax rules apply. That is the whole story: treaty silence, not treaty hostility.'],
      ['rrsp_raja', 'And the practical sequencing that falls out of it for dual-status folks: RRSP match → RRSP top-up → taxable — with TFSA re-entering the order only after US person status ends.'],
      ['maple_moong', 'Treaty-silence framing accepted. Painful but clean.'],
      ['tfsa_tigress', 'For pure Canadian residents reading this: none of the above applies to you — max the TFSA first. This thread is a cross-border special.'],
    ],
    accept: 0,
    likeReplies: { 1: ['maple_moong', 'rrsp_raja', 'tfsa_tigress'], 3: ['prairie_paneer', 'vancouver_vada'] },
  },
  {
    key: 'gratuity-plan', space: 'Ask the community', tags: ['discussion'], by: 'burj_budget',
    title: 'DIFC end-of-service gratuity — invest the lump or park it?',
    body: `Leaving my DIFC employer next quarter; the end-of-service gratuity is the largest single sum I have ever handled. The classic dilemma: lump it into the long-term portfolio on day one, or phase it in?\n\nThe math says lump sum wins on average. My sleep says otherwise. How did other Gulf folks actually behave when the theory met their own money?`,
    like: { 0: ['marina_moong', 'tax_free_tandoor'] },
    r: [
      ['marina_moong', 'Phased mine over six months, one tranche a month, automated the day the calendar turned. Knowing the schedule was fixed removed the "is today the day" agony. The expected-value cost of phasing is real but small; the behavioral insurance was worth it to me.'],
      ['nikhil_cfa', 'The evidence: lump sum beats phasing roughly two times in three, by a modest margin. But the right question is not "which wins on average" — it is "which one will you actually complete". An abandoned lump-sum plan (panic-sold in the first drawdown) underperforms every phased plan ever finished.'],
      ['oud_and_etfs', 'Phased, and I put the waiting tranches in a money-market fund rather than the current account — the parking spot yield made patience cheaper.'],
      ['burj_budget', 'Consensus heard: fixed written schedule, automated, waiting cash parked productively. Exactly the accountability I posted for.'],
    ],
    likeReplies: { 1: ['burj_budget', 'oud_and_etfs'], 2: ['burj_budget', 'marina_moong', 'quiet_lotus', 'fire_by_45'], 3: ['burj_budget'] },
  },
  {
    key: 'cpf-vs-srs', space: 'Ask the community', tags: ['cpf', 'question'], by: 'merlion_moolah',
    title: 'CPF top-ups vs SRS for a new PR — what did you actually choose?',
    body: `First full tax year as a Singapore PR. The two tax-advantaged levers seem to be CPF cash top-ups (SA) and SRS contributions. The relief math looks similar at my bracket, so the tiebreakers must be liquidity and what happens if I ever leave SG.\n\nCorridor veterans: what did you pick and what would you change?`,
    like: { 0: ['cpf_chai', 'kaya_compounder'] },
    r: [
      ['cpf_chai', `Did both eventually, but ordered: **SRS first for the first few PR years, CPF SA top-ups after the stay felt permanent.**\n\nReasoning: SRS has a defined exit — leave Singapore and you can withdraw (with tax treatment, but accessible). CPF SA top-ups are one-way until retirement age. Same tax relief today, very different optionality if your PR story changes. Once we bought the flat and the kids started school, the calculus flipped and SA's guaranteed floor rate became the attraction.`],
      ['kaya_compounder', 'Same order, one addition: invest the SRS balance — the default idle rate is negligible, and people forget the account is an investing account, not a savings account.'],
      ['merlion_moolah', 'The optionality framing decides it — SRS first while the roots are shallow. Accepted.'],
      ['jurong_jalebi', 'And mark January, not December, in your calendar: contributing early in the year adds a full year of compounding to the same relief.'],
    ],
    accept: 0,
    likeReplies: { 1: ['merlion_moolah', 'kaya_compounder', 'sgd_sambar', 'orchard_oats'], 3: ['cpf_chai', 'merlion_moolah'] },
  },
  {
    key: 'super-482', space: 'Ask the community', tags: ['super', 'question'], by: 'bondi_bhaji',
    title: 'Super concessional cap strategy on a 482 visa — worth maxing before PR?',
    body: `On a 482 with PR lodged. Everyone says "max concessional super, free tax arbitrage" — but if PR falls through and I leave, the DASP exit tax takes a serious bite on the way out.\n\nIs maxing the cap still right when the leave-probability is real? Anyone modeled the break-even?`,
    like: { 0: ['super_samosa', 'sydney_sipper'] },
    r: [
      ['super_samosa', 'Modeled exactly this before my PR came through. Rough shape: the contribution-tax saving vs marginal rate is large enough that even a DASP exit only claws back part of it — the break-even leave-probability was surprisingly high in my spreadsheet. But the modelling assumption that matters most is your marginal bracket, not the exit tax.'],
      ['melbourne_moong', 'The behavioral point cuts the other way here though: super is locked to preservation age if you *stay*. On a maybe-leaving track you get the odd combo of DASP-accessible-if-you-go, locked-if-you-stay. Make sure the outside-super emergency fund is genuinely funded first.'],
      ['bondi_bhaji', 'Both angles noted — running my bracket through the spreadsheet tonight. This community is the accountability I hoped for.'],
    ],
    likeReplies: { 1: ['bondi_bhaji', 'melbourne_moong', 'perth_paisa'], 2: ['bondi_bhaji', 'super_samosa'] },
  },
  {
    key: 'buy-vs-remit', space: 'Real Estate', tags: ['real-estate', 'guide'], by: 'h1b_horizon',
    title: 'Buying in the US vs remitting to buy in India — how we finally decided',
    body: `Five years of "we should buy somewhere" ended last month. Posting the framework because the *decision structure* generalizes even though our answer will not:\n\n**1. Decide where you will grow old before deciding where you buy.** Every spreadsheet we built was secretly this question wearing a disguise.\n**2. Price the visa risk explicitly.** A US home on a temporary visa is a leveraged, illiquid, USD-denominated bet on your own immigration outcome. Naming that changed the conversation.\n**3. The India purchase is not an investment — it's family infrastructure.** Once we stopped forcing it to "compete" with index funds on IRR, the decision got honest.\n**4. Renting is a position, not a failure.** The rent-vs-buy spreadsheets all showed the suburbs winning only if we stayed 7+ years. Our median stay estimate was 4.\n\nWe rented in the US, bought a modest place near family in India, and sleep fine. Your numbers will differ — but I promise the four questions transfer.`,
    like: { 0: ['first_gen_saver', 'green_card_gains', 'quiet_lotus', 'nri_numbers', 'vancouver_vada', 'dubai_dirhams', 'patient_paisa', 'fire_by_45'] },
    r: [
      ['green_card_gains', 'The "family infrastructure, not investment" reframe is the healthiest thing I have read on this topic. We made the India purchase compete with VTI for years and it poisoned every family conversation.'],
      ['vancouver_vada', 'Vancouver corridor checking in: replace "visa risk" with "affordability risk" and the framework holds perfectly. We are renting-by-the-numbers too.'],
      ['h1b_horizon', 'That generalization is exactly why I posted the structure and not the spreadsheet. The constraint differs by corridor; the four questions do not.'],
    ],
    likeReplies: { 1: ['h1b_horizon', 'quiet_lotus', 'masala_momentum'], 2: ['h1b_horizon', 'melbourne_moong'] },
  },
  {
    key: 'weekly-watch', space: 'Watercooler', tags: ['weekly-watch', 'poll'], by: 'chai_and_charts',
    title: '📈 US Market Week — what are you watching?',
    body: `Weekly ritual thread — what is on your radar this week? Earnings, data prints, or just your rebalancing bands doing their quiet work.\n\n[poll type=regular results=always public=false]\n* Mostly earnings season\n* The rate decision\n* My own contribution schedule, as always\n* Not watching — that's the whole strategy\n[/poll]\n\n*Education and entertainment — nobody here is telling you to trade anything.*`,
    like: { 0: ['sip_and_chill', 'quiet_lotus'] },
    r: [
      ['sip_and_chill', 'Voted "not watching" with pride. The automation watches for me.'],
      ['masala_momentum', 'Earnings season, but strictly as a spectator sport now. Recovering picker, 14 months clean.'],
      ['ledger_lakshmi', 'The rate decision — not to act, but because my bond sleeve has enough duration that I like to know *why* it moved.'],
    ],
    likeReplies: { 1: ['quiet_lotus', 'bogle_bhakt', 'patient_paisa'], 2: ['chai_and_charts', 'sip_and_chill'] },
  },
  {
    key: 'ama-rollovers', space: 'Ask the community', tags: ['ama', '401k'], by: 'nikhil_cfa',
    title: 'AMA: 401k rollovers for H-1B holders — Thursday 8pm ET',
    body: `Running a structured AMA this Thursday on 401k rollovers for visa holders: old-employer plans, rollover IRAs vs staying put, the return-to-India sequencing, and the paperwork that goes wrong.\n\nDrop questions below all week — I'll answer live Thursday and we'll pin a recap afterwards.\n\n*Standing reminder: education from one CFA's experience, never individual advice. Past performance ≠ future results.*`,
    like: { 0: ['roth_rookie', 'h1b_horizon', 'first_gen_saver', 'green_card_gains', 'sip_and_chill'] },
    r: [
      ['first_gen_saver', 'Question for Thursday: two old 401ks at previous employers, both small. Consolidate into the current plan or a rollover IRA — and does visa status change the default answer?'],
      ['green_card_gains', 'Mine: the "pro-rata rule" keeps getting cited as a reason NOT to roll old 401ks into an IRA if you ever want backdoor Roth. How real is that constraint in practice?'],
      ['h1b_horizon', 'Adding: what actually happens to a 401k if you leave the US permanently and just… leave it there? Custodian behavior, force-outs, address requirements — the mechanical stuff nobody documents.'],
      ['nikhil_cfa', `**Recap (pinned):** Thursday's themes —\n1. *Consolidation:* fewer accounts almost always wins for visa holders; the tiebreak is plan quality, and the pro-rata rule (great question @green_card_gains) is the one real reason to prefer plan-to-plan over IRA.\n2. *Leaving the US:* plans can force out small balances and most custodians require a US address — set up the receiving structure *before* the move, not after.\n3. *Sequencing a return:* the RNOR window discussion from the Roth thread applies identically here.\n\nFull thread stays open — thank you all, this was exactly what a corridor AMA should be.`],
    ],
    likeReplies: { 1: ['nikhil_cfa', 'roth_rookie'], 2: ['nikhil_cfa', 'priya_ea', 'bogle_bhakt'], 3: ['nikhil_cfa', 'nri_numbers'], 4: ['first_gen_saver', 'green_card_gains', 'h1b_horizon', 'roth_rookie', 'quiet_lotus', 'fire_by_45', 'sip_and_chill'] },
  },
  {
    key: 'term-insurance', space: 'Insurance & Visas', tags: ['insurance', 'question'], by: 'first_gen_saver',
    title: 'Term insurance on H-1B: US policy, Indian policy, or both?',
    body: `Starting a family, need real coverage. Three options I keep hearing:\n1. US term policy (cheap at my age, but does it pay out if I later move back?)\n2. Indian term policy (INR cover for INR obligations — parents, property)\n3. Both, sized to the respective obligations\n\nThe "does a US policy pay a claim if you die as an Indian resident" question gets very hand-wavy answers. Anyone actually read their policy on this?`,
    like: { 0: ['patient_paisa', 'roth_rookie'] },
    r: [
      ['patient_paisa', 'Read mine (large US carrier): worldwide coverage, claims payable regardless of residence at death — but the *application* required US residency and truthful disclosure of travel plans. The residency question lives at purchase time, not claim time. Lying on the application is the thing that voids policies.'],
      ['priya_ea', 'The two-policy structure maps cleanly to the two balance sheets: USD obligations (US spouse, mortgage) → US policy; INR obligations (parents, India property) → Indian policy. The FX risk of covering INR obligations with a USD payout is real over a 30-year horizon in both directions.'],
      ['first_gen_saver', 'Accepting the balance-sheet mapping — sizing each policy to its own currency\'s obligations. And yes, reading the actual policy document this weekend.'],
      ['nri_numbers', 'Buy the Indian policy on your next India trip — medicals and issuance are dramatically easier in person, and premiums lock younger.'],
    ],
    accept: 1,
    likeReplies: { 1: ['first_gen_saver', 'priya_ea', 'quiet_lotus'], 2: ['first_gen_saver', 'patient_paisa', 'roth_rookie', 'h1b_horizon'] },
  },
  {
    key: 'gift-city', space: 'Taxes & FEMA', tags: ['fcnr', 'guide'], by: 'priya_ea',
    title: 'GIFT City FDs: what the brochures skip about residency and TDS',
    body: `GIFT City USD deposits are the shiny new object in every NRI WhatsApp group, so let us do the unglamorous parts:\n\n1. **Who can invest:** NRIs and OCIs under LRS-adjacent routes — but your *tax residency* decides the treatment, and returning to India changes it mid-tenure.\n2. **The "tax-free" headline:** interest is exempt from Indian tax for non-residents — the exemption does NOT extend to your resident country. US persons: this is fully taxable interest to the IRS, and the FD is a foreign account for FBAR/8938. "Tax-free" means "India will not tax it", nothing more.\n3. **TDS:** no TDS for non-residents is a cash-flow convenience, not an exemption — your liability lives wherever you are resident.\n4. **Premature withdrawal and repatriation** are smoother than legacy FCNR — that part of the brochure is fair.\n\nGood instrument, honest fine print. *Education, not advice — your cross-border CPA earns their fee here.*`,
    like: { 0: ['nri_numbers', 'dubai_dirhams', 'sharjah_sip', 'quiet_lotus', 'sterling_sabzi', 'merlion_moolah'] },
    r: [
      ['dubai_dirhams', 'UAE residents genuinely are the clean case here — no local income tax, so the India-side exemption is the whole story. For once the brochure and my situation agree.'],
      ['sterling_sabzi', 'UK folks: the interest is taxable here on the arising basis for most of us — and the remittance-basis era is over. Same "check your own side" rule.'],
      ['priya_ea', 'Both corridor addenda correct — this is exactly why "is GIFT City tax-free?" has six different true answers in this community.'],
    ],
    likeReplies: { 1: ['priya_ea', 'burj_budget', 'tax_free_tandoor'], 2: ['priya_ea', 'nri_in_london'] },
  },
];

// The flag-flow exercise (3.3/9.1): SPAMMER posts this; two members flag it.
export const SPAM_POST = {
  space: 'Watercooler', tags: ['discussion'], by: SPAMMER.u,
  title: 'Turn every salary into guaranteed monthly returns — proven desi method',
  body: 'I turned my savings into guaranteed monthly returns with a proven method. Serious people only — DM me or join my private Telegram for the exact trades. Limited spots!',
  flaggedBy: ['quiet_lotus', 'bogle_bhakt'],
};

export const LOW_EFFORT_POST = {
  space: 'Stocks & ETFs', tags: ['discussion'], by: 'wealth_wizard_99',
  title: 'best stock rn??',
  body: 'which stock is best to buy right now? need to double fast',
  flaggedBy: ['ledger_lakshmi'],
};
