# Demo video shot list (#53)

Target: **2:45** (limit 3:00). Record on the hosted URL, `https://fitter-n3x3h3wroq-lz.a.run.app`,
at 1440×900. Every persona below was run end to end on prod (`3cda7e4`) on Sat 21:20 EET.

**Before you record**
- **No merges to `main` while recording.** Every merge redeploys prod and wipes open sessions
  (memory store); a session dies mid-take.
- Use the scripted engine (personas default to it): same flow every take, no model cost.
- Fresh tab per persona. Keep the **"Simulated golfer"** badge visible: all data is synthetic (L6).
- Numbers below are what prod showed. The meter can differ by ±0.02 between takes (Monte Carlo seed per session).

| # | Time | Screen / action | Hold on | Voice-over |
|---|---|---|---|---|
| 1 | 0:00–0:12 | Landing → studio start, the "Try as" row | Four personas + "Start my own fitting" | "An AI iron fitter that runs Takomo's own fitting rules, and is honest about how sure it is." |
| 2 | 0:12–0:25 | **Try as Mikko**. Opening chat | Meter **~65–70%, provisional**, flex **stiff** | "Mikko says his 7-iron goes 160 yards. From his answers alone, this is a provisional fit." |
| 3 | 0:25–0:45 | `data_import` → one-tap sample **own 7-iron** CSV | Meter jumps to **~86%, confident**; flex **regular** | "Ten TrackMan shots. Measured speed replaces the guess, and the confidence meter shows it." |
| 4 | 0:45–1:00 | `outlier_review` card | **"160 claimed vs 124.7 measured"**. Tap **Use measured** | "He carries 125, not 160. We show both numbers and let him choose. No flattery." |
| 5 | 1:00–1:15 | Precision offer → result | Recommendation card **201T MKII**, runner-up 201 MKII, lie **+3** | "Every spec comes from Takomo's rules, with the reason one tap away." |
| 6 | 1:15–1:35 | New tab: **Try as Hannu**. `data_import` → one-tap **ball-line** readings | Lie stays **0**, gate **provisional**; text recommends a simulator | "Hannu's at-home ball-line test is rough. Rather than sell a non-returnable custom set on it, the fitter sends him to a simulator." |
| 7 | 1:35–1:55 | New tab: **Try as Lars** | Result **301 CB vs 301 MB** close call with trade-offs | "When two heads are this close, we say so, and show the trade-off instead of a fake winner." |
| 8 | 1:55–2:20 | New tab: **Try as Anders**. `data_import` → one-tap **201 MKII test-club** CSV | Meter **~77% → ~94%**; lie **+1**; **stock vs custom** card | "One degree of lie from his test-club shots. Stock comes with 30-day returns, custom doesn't. His call." |
| 9 | 2:20–2:35 | Back to Mikko's tab: result → **Save** | Saved / resume link | "Save, come back, or take it to a simulator." |
| 10 | 2:35–2:45 | Closing frame | Logo / URL | "Takomo Fitter Studio. Honest at a cost to the sale." |

**If something goes wrong**
- A 404 or empty chat mid-take: a deploy happened. Open a fresh tab and restart that persona.
- A 429: too many turns per minute. Wait a few seconds between taps.
- Skipping an import keeps the fit on the questionnaire (provisional). That's correct, but not the story: re-take.
