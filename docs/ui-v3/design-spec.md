# Takomo Fitter Studio, Flow v3: implementation spec

Source: static design mockups in `artifact-files/241ba94e-.../project/` (Main, V3-C1..C6, V3-R1..R5, R1b, K0..K7). All boards are 1440 px wide; chat screens 900 px tall, R1/R1b 1240 px, K boards 1080–1860 px. Every V3/K file shares one identical `<helmet>` stylesheet (section 1.4). Main uses a slightly older variant of the same classes (section 1.5).

Brand idea (Main): "Dark studio. Light talk." The stage is a midnight-black simulator bay, the fitter's conversation is on washed-white cards, orange means "you" (your fit, your measured shots, the next action). Colour ratio 60 / 30 / 10: black / white / orange. Solid = measured, hollow/dashed = guess, grey = from chart.

---

## 1. Design tokens

### 1.1 Fonts

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@500;600;700;800&display=swap" rel="stylesheet">
```

- Body / UI: `'Barlow', system-ui, sans-serif`, `-webkit-font-smoothing: antialiased`.
- Display / labels / numbers / buttons: `'Barlow Condensed', 'Barlow', sans-serif`.
- Code labels (only in K boards): `ui-monospace, Menlo, monospace` 500 12–13px, colour #FFB078 (K0/K1) or #A3A3A3 (K3–K7).
- Numbers: `font-variant-numeric: tabular-nums` (`.num`). Units are rendered at roughly half size in #555555 (on light) / #A3A3A3 or #8F8F8F (on dark), e.g. `142<span 20px #555> m</span>`.

### 1.2 Colours

Core brand
| Token | Hex | Use |
|---|---|---|
| midnight | #0B0B0B | stage bg, text on light, dark buttons. Never pure #000 |
| washed-white | #F8F8F8 | conversation cards, text on dark |
| white | #FFFFFF | option tiles, inputs on light cards |
| tiger-orange | #FF6E01 | primary CTA, "you", measured, selected, avatar |
| orange-hover / orange text on dark | #FF8A33 | `.bp:hover`, links + eyebrows on dark |
| orange-300 | #FFB078 | code labels, light accents |
| orange-tint | #FFE6D3 | callout bg on light (missing data, outlier, measured pill) |
| orange-text-on-light | #C24F00 | orange text on white/light (numbers, links, step digits) |
| orange-deep-text | #7A3300 | text on #FFE6D3 "Measured" pill (Main) |
| selected-dark-card | #1A140F | bg of orange-bordered selected card on dark |

Dark greys (stage)
| Hex | Use |
|---|---|
| #0E0E0E | buy bar bg |
| #0F0F0F | results "Your fitter" aside bg |
| #121212 | cards/panels on dark, nav-card bg |
| #141414 | chat composer bg (dark), swatch |
| #161616 | recap chip bg, aside composer bg, map bg |
| #1A1A1A | icon tiles, back pill, map tiles |
| #1F1F1F | aside left border, inactive flex band, seg bg in confidence update |
| #262626 | borders on dark, Say-it button bg, mic button bg, phone bezel |
| #2A2A2A | composer border, dashed range line, faint chart lines |
| #3D3D3D | header rule, off segments/step bars, outlines on dark, send button bg |
| #5F5F5F | "You told me" label, inactive tab numbers, dashed trajectory, hollow level dot |

Light greys (talk)
| Hex | Use |
|---|---|
| #EDEDED | `.kbd` bg, segmented-control track, placeholder pills, illustration panels |
| #E4E4E4 | dividers/borders on light cards |
| #D9D9D9 | option/tile border (unselected) |
| #CFCFCF | Main `.kbd` border |
| #C8C8C8 | `.bo` outline, input border, guess marker, secondary text on dark |
| #A3A3A3 | secondary text on dark |
| #8F8F8F | tertiary text, dashed "guess" borders, units |
| #6B6B6B | lightest allowed grey on white |
| #555555 | secondary text on white (7.4:1) |
| #444444, #333333 | body-secondary on light |

Status
| Hex | Use |
|---|---|
| #3FB950 | green dot: in stock / stock build / 30-day returns icon |
| #E3B341 | amber: sold out, custom build, not returnable, "Only shown when custom is earned" badge |
| #DDE8DD | green "green" fill in landing rings |

Contrast rules (Main): text on white #0B0B0B, secondary #555555, never lighter than #6B6B6B. Text on black #F8F8F8, secondary #A3A3A3. On orange always black text (white on orange fails). Orange text on white uses #C24F00.

### 1.3 Stage background, type scale, radii, spacing, motion

Stage background (every V3 screen + K boards):
```css
background-color:#0B0B0B;
background-image:linear-gradient(rgba(255,255,255,.028) 1px,transparent 1px),
                 linear-gradient(90deg,rgba(255,255,255,.028) 1px,transparent 1px);
background-size:56px 56px; color:#F8F8F8;
```
Hero glow: `radial-gradient(ellipse at 50% 60%, rgba(255,110,1,.14), transparent 65%)` (welcome: `.2`, `transparent 62%`). Hero club image: `filter:drop-shadow(0 30px 40px rgba(0,0,0,.7))` (welcome `0 40px 50px rgba(0,0,0,.75)`).

Type scale (all observed)
| Role | Spec |
|---|---|
| Welcome hero | Barlow Condensed 800, 150px, line-height .84, uppercase, max-width 820 |
| Result head name (R1) | BC 800 104px / .84 uppercase |
| Display (Main) | BC 800 88px / .9 ; 64px / .92 |
| Big number input | BC 800 88–96px / .9 (carry, height) ; 64px for confidence |
| AR title | BC 800 72px / .86 |
| K board title | BC 800 64px / .9 |
| R5 title | BC 800 56px / .88 |
| R2 spec title | BC 800 44px / .9 |
| Section title | BC 700 26–30px uppercase |
| Card title | BC 700 22px uppercase |
| Fitter voice (chat) | Barlow 500 24px / 1.45 #F8F8F8 |
| Fitter voice (aside) | Barlow 400 18px / 1.5 |
| Mad-lib sentence | Barlow 500 34px / 1.7 |
| Body | Barlow 15–21px / 1.45–1.55 |
| Eyebrow `.eb` | BC 600 13px, letter-spacing .16em, uppercase (Main: 12px, .14em) |
| Small eyebrow | `.eb` at 11px |
| Data stat | BC 700 21–28px tabular |

Radii: 3–4 px labels/tags (3D badge 3px, change labels 4px), 6 px buttons/inputs, 8 px kbd/small tiles/segmented thumb, 10 px segmented track/inputs/stat tiles, 12 px cards/opt tiles, 14 px source tiles/nav cards/callouts, 16 px fork cards/K cards, 18 px stage panels, 20 px conversation card, 40 px phone mock, 999 px chips/pills/composer.

Spacing: 4-pt grid. Cards pad 20 (Main), conversation card 26px 30px 28px, stage gutter 40, header padding 28px 56px 0.

Motion (Main): 240 ms ease-out for UI; camera moves 600 ms. Icons: 1.75 px stroke, round caps/joins (some icons 1.6 / 1.7 / 2 / 2.4).

Shadows: conversation card `0 30px 60px rgba(0,0,0,.5)`; phone `0 40px 80px rgba(0,0,0,.6)`; segmented active thumb `0 1px 2px rgba(0,0,0,.12)`.

### 1.4 Shared CSS (canonical, from every V3/K file)

```css
body{margin:0;background:#0B0B0B}
a{color:inherit}a:hover{color:#FF8A33}
.tk{font-family:'Barlow',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.c{font-family:'Barlow Condensed','Barlow',sans-serif}
.eb{font-family:'Barlow Condensed','Barlow',sans-serif;font-weight:600;font-size:13px;letter-spacing:.16em;text-transform:uppercase}
.num{font-variant-numeric:tabular-nums}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;padding:0 22px;border-radius:6px;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:18px;letter-spacing:.04em;text-transform:uppercase;text-decoration:none;border:0;cursor:pointer}
.bp{background:#FF6E01;color:#0B0B0B}.bp:hover{background:#FF8A33;color:#0B0B0B}
.bd{background:#0B0B0B;color:#F8F8F8}.bd:hover{color:#FFFFFF}
.bo{background:transparent;color:#0B0B0B;box-shadow:inset 0 0 0 1px #C8C8C8}
.seg{width:10px;height:5px;border-radius:1px;background:#3D3D3D}
.seg.on{background:#FF6E01}
.kbd{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;padding:0 6px;border-radius:6px;background:#EDEDED;font:600 14px 'Barlow',sans-serif;color:#333333}
.opt{display:flex;align-items:center;gap:16px;min-height:60px;padding:0 18px;border-radius:12px;border:1px solid #D9D9D9;background:#FFFFFF;color:#0B0B0B;font:500 19px 'Barlow',sans-serif;cursor:pointer;text-align:left}
.opt.on{border:2px solid #0B0B0B}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#FF6E01}
.ring{display:inline-block;width:8px;height:8px;border-radius:50%;box-sizing:border-box;border:1.5px solid currentColor}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
input[type=range]{accent-color:#FF6E01;width:100%;margin:0}
```

Button variants used inline:
- Light-on-dark button: `.btn` + `background:#F8F8F8;color:#0B0B0B` (R2 "See regular vs stiff fly", R1b "Save fit and pick a simulator" at min-height 46 / 17px).
- Ghost-on-dark: `.btn` + `color:#F8F8F8;box-shadow:inset 0 0 0 1px #3D3D3D`.
- Big CTA: `.btn.bp` min-height 58–64, padding 0 28–32, font 22–24px.
- Small inline buttons in cards: `.btn.bo` / `.btn.bd` at min-height 40, 15px; mini (K boards) 32px tall, padding 0 12, radius 5, BC 700 13px.
- Rule: one orange button per view.

### 1.5 Main-board variants (older, keep only if needed)

`.eb` 12px/.14em; `.btn` min-height 44, padding 0 20, gap 8, 16px; `.bo` inset #0B0B0B; `.chip` (pill 44px, padding 0 16, radius 999, border 1px #D9D9D9, bg #FFF, 500 15px; `.chip.on` bg/border #0B0B0B text #F8F8F8, kbd inside on-state border #555 text #C8C8C8); `.kbd` 20px, padding 0 5, radius 4, border 1px #CFCFCF, 600 11px #555; `.seg` 14x6 gap 3. Main body bg #F8F8F8, `a{color:#C24F00}a:hover{color:#0B0B0B}`.

### 1.6 Recurring atoms

- **Logo mark** (SVG, viewBox `0 0 40 36`, fill none, stroke-width 3.4, round caps/joins): paths `M3 15 C 14 13 26 8 38 3`, `M27 2 L 14.5 33`, `M3 15 C 10 16 14 22 14.5 33`. Sizes: 34x31 header, 30x27 K header, 24x22 in 44px avatar, 20x18 in 36px avatar, 16x14 in 28px avatar. Stroke #F8F8F8 on dark, #0B0B0B inside orange avatar.
- **Wordmark**: "TAKOMO" Barlow 600 19px letter-spacing .3em.
- **Fitter avatar**: circle #FF6E01 (44 / 36 / 28 px) with logo mark in #0B0B0B.
- **Provenance pills** (Main): Measured = `.eb` 26px pill bg #FFE6D3 color #7A3300 with `.dot`; Your guess = border 1px dashed #8F8F8F color #444 with `.ring`; From chart = bg #EDEDED color #444 with dotted `.ring`. In chat: "Your guess" pill 28px, padding 0 12, dashed #8F8F8F.
- **Change labels on stage** (Main): `.eb` 28px tall radius 4, 13px: filled #FF6E01/#0B0B0B = what you changed ("+2° upright"), outline inset 1px #F8F8F8 ("+0.5 in"), #1F1F1F/#A3A3A3 ("Your fit"). Recommended club stays as a 20% ghost.
- **Confidence segments**: 10 `.seg`, gap 2, on-count = round(confidence/10). Main explains ticks at 30 (result) and 70 (sure) gates.
- **Close-call bar**: labels BC 700 18px, bar 10px tall radius 2–3, left flex = winner % #FF6E01, 2px separator (#FFFFFF / #F8F8F8), right flex = rest #C8C8C8.
- **Icons**: arrow `M5 12h14M13 6l6 6-6 6`; mic `rect x9 y3 w6 h11 rx3` + `M5 11a7 7 0 0 0 14 0M12 18v3` (stroke #FF6E01 2); user `circle 12,8 r4` + `M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6`; check `M4 12.5 L9.5 18 L20 6` (#FF6E01 2.4) or `M5 12l5 5 9-10` (in 18px black circle, #F8F8F8 3.5); play `M7 4l13 8-13 8z`; external `M14 4h6v6M20 4l-9 9` + box. Spec-part icons (20px, stroke 1.6): head `M3 15 Q3 9 9 8.5 L19 11 L21 5 M19 11 L18 17 L6 17 Q3 17 3 15 Z`; shaft `M5 20 L19 4` + `M9.5 15.5 L12.5 12.5` w4; length `M3 12 H21 ...arrows... M8 9 V15 M12 9.5 V14.5 M16 9 V15`; lie `M3 20 H21 M7 20 L17 4` + arc `M12 20 A5 5 0 0 0 10.3 16.2`; grip `rect 8,3 8x18 rx3` + `M8 8 H16 M8 12 H16 M8 16 H16`. Active part icon stroke #FF6E01, others #C8C8C8.

---

## 2. Layout shells

### 2.1 Chat-phase shell (C2..C6)

```
.tk root: width 100%, min-height 900, position relative, overflow hidden, flex column, stage bg
├─ glow div (absolute, aria-hidden)  right:-90 top:190, ~408x442 (or 384x416 / 396x429)
├─ hero club <img> (absolute, alt="")  right:-30 top:230, height 320–340, opacity rises with progress
├─ <header>  flex, align center, gap 20, padding 28px 56px 0
│   ├─ <a href=Welcome aria-label="Takomo Fitter Studio, start"> logo 34x31 + "TAKOMO"  (gap 14)
│   ├─ .eb "Fitter Studio" #F8F8F8
│   ├─ flex:1 rule, 1px #3D3D3D
│   ├─ Step: .eb "Step N of 4" #A3A3A3 + 4 bars 24x4 r2, gap 10 (#FF6E01 for 1..N, #3D3D3D rest)
│   ├─ Confidence (aria-label "Fit confidence NN percent"): .eb "Fit confidence" #A3A3A3 + 10 .seg (gap 2) + BC 700 20px "NN%"
│   └─ Save button: 44h, padding 0 14, r6, inset 1px #3D3D3D, transparent, user icon 18 (stroke 1.75)
│        + two-line label: "Save to" Barlow 500 11px #A3A3A3 / "myTakomo" 600 15px
└─ <main> flex 1, width 100%, max-width 960 (C2: 1060), margin 0 auto, padding 32px 40px 28px (C2: 44/40/40), flex column, gap 22 (C2: 24)
    ├─ Recap row "You told me" (not on C2/C2b)
    ├─ Fitter message (avatar 44 + text)
    ├─ Conversation card (the one input component)
    └─ Composer wrapper `margin-top:auto` (persistent, bottom)
```

Hero club image progression (club "materialises" as data comes in): C2 opacity .28, C3a/C3b .22 (uses the 201 MkII image 22fc…), C4a .30, C4b .32, C4c .34, C5 .45, C6a .55, C6b .60, C6 .65, C2b .50. Heights: 340 (C2, C2b, C6a/b, C6), 320 (C3a–C4c), 330 (C5).

**Recap row "You told me"**: flex wrap, gap 8. Label `.eb` color #5F5F5F margin-right 6. Chips: `inline-flex; gap 8; height 34; padding 0 14; radius 999; bg #161616; border 1px #262626; 15px #C8C8C8`, `title` = the question it answered (e.g. title="7-iron carry?"). Measured values get a leading orange `.dot` at 7x7. Rolling window of the last ~3 answers (earliest drop off).

**Fitter message**: `display:flex; gap 16; align-items:flex-start`. Avatar 44 orange + `<p>` margin 6px 0 0, 24px/1.45, 500, #F8F8F8, key facts in `<b>`. A second fitter paragraph (C2) is `margin:-8px 0 0 60px` (indented to the text column).

**Conversation card**: `<section>` bg #F8F8F8, color #0B0B0B, radius 20, padding 26px 30px 28px, flex column gap 18, shadow `0 30px 60px rgba(0,0,0,.5)`. Exactly one question/input per card. Optional helper line at top 16px #333 ("Tap the words to change them").

**User bubble** (C2b): right-aligned (`align-self:flex-end`), max-width 78%, bg #F8F8F8, color #0B0B0B, padding 16px 20px, radius `20px 20px 4px 20px`, 18px/1.5.

**Persistent bottom composer (dark)**:
- `<form>` flex, center, gap 10, height 60, padding 0 8 0 22, radius 999, bg #141414, border 1px #2A2A2A.
- `<label class="sr">Message the fitter</label>` + input: flex 1, transparent, no border/outline, Barlow 400 17px #F8F8F8. Placeholder "Or ask the fitter anything…" (C2b: "Or keep talking…").
- "Say it" button: inline-flex gap 8, height 44, padding 0 16 0 12, radius 999, bg #262626, color #F8F8F8, BC 700 15px, letter-spacing .05em, uppercase; mic icon 18 stroke #FF6E01 width 2.
- Send (`type=submit`, aria-label "Send"): 44 circle bg #3D3D3D, arrow 18 stroke #F8F8F8.

**In-card light composer** (C2 only, first question): divider `padding-top 16; border-top 1px #E4E4E4`, helper "Not sure, or easier to explain? Type or say it" 16px #333; form height 64, padding 0 10 0 26, radius 999, bg #FFF, border 1px #C8C8C8; input Barlow 400 20px, placeholder "Type or say it: about 8 years, twice a month, mostly weekends…" (label sr "Tell the fitter about yourself"); Say it 52h, padding 0 22 0 18, bg #0B0B0B, BC 700 18px .04em uppercase, mic 20 #FF6E01; Send 52 circle #FF6E01 with arrow 22 #0B0B0B.

Step mapping observed: Step 1 = C2, C3a, C3b (you + scoring); Step 2 = C4a, C4b, C4c, C5 (swing/evidence); Step 3 = C6a, C6b, C6 (body); C2b shows Step 4 of 4 (everything answered).

### 2.2 Results-phase shell (R1..R5, R1b)

Note v3 title: "Summary first, every detail one tap away, Add to cart always visible."

```
.tk root: width 100%, height 900 (R1/R1b: 1240), overflow hidden, flex column, stage bg (no hero image)
├─ <header> same as chat, BUT: eyebrow "Your fit" (not "Fitter Studio"), NO step indicator,
│   confidence directly followed by Save button (82% / 8 segs; R1b 68% / 7 segs)
└─ body row: flex 1, min-height 0, display flex
    ├─ left column: flex 1, min-width 0, flex column
    │   ├─ <nav aria-label="Dig into your fit"> (R2..R5 only; R1/R1b have none)
    │   ├─ <main> flex 1, min-height 0, padding 18px 40px, flex column, gap 16
    │   └─ Buy bar (flex none, always visible)
    └─ <aside aria-label="Your fitter"> width 380, flex none
```

**Detail nav** (R2–R5): flex, center, gap 8, padding 16px 40px 0.
- Back pill: `<a href=R1>` inline-flex gap 8, height 40, padding 0 14 0 10, margin-right 8, radius 999, bg #1A1A1A, #F8F8F8, Barlow 600 15px, club thumbnail 30px tall + "← Your fit".
- Tabs (3): `<a>` flex gap 8, height 40, padding 0 14, radius 999, number BC 800 16px + label Barlow 600 15px nowrap.
  - Active (`aria-current="page"`): bg #F8F8F8, color #0B0B0B, number #C24F00.
  - Inactive: color #A3A3A3, `box-shadow: inset 0 0 0 1px #262626`, number #5F5F5F.
  - 1 "Why each part" → R2; 2 "Compare heads, see it fly" → R3; 3 "In your hands" → R4. (R5 shows all three inactive.)

**Buy bar** (on every results screen): flex, center, gap 16, padding 12px 40px, border-top 1px #262626, bg #0E0E0E.
- Club image 52px tall.
- Title BC 700 20px uppercase nowrap: "201T MkII, KBS Tour Lite Regular" (R5 custom: "201T MkII, KBS Tour Regular, +1° upright").
- Status 14px #A3A3A3 with 8px status dot: green #3FB950 "Stock build, in stock, ships in 2–3 days. 30-day returns." / amber #E3B341 "Custom build, ships in about 2 weeks. Built for you, not returnable."
- Right group (margin-left auto, gap 18): optional "Next: … →" link (BC 700 16px .04em uppercase #FF8A33, margin-right 8; R2 "Next: Compare heads →" → R3, R3 "Next: In your hands →" → R4); price "€679" BC 800 32px; `.btn.bp` "Add to cart" min-height 54, padding 0 28, 21px.
- Buy bar reflects the current choice (R5: "The buy bar below follows your choice").

**"Your fitter" aside**: 380 wide, border-left 1px #1F1F1F, bg #0F0F0F, padding 24, flex column, gap 16.
- Header: avatar 36 + "Your fitter" Barlow 600 16px (gap 12).
- Message `<p>` 18px/1.5 #F8F8F8 (contextual per screen).
- Optional embedded component (light close-call card, video tile, confirm-with-sim section).
- Suggested question chips: wrap, gap 8; each `<button>` height 38, padding 0 14, radius 999, border 1px #3D3D3D, transparent, #F8F8F8, Barlow 500 14px.
- Composer (margin-top auto): height 54, padding 0 6 0 18, radius 999, bg #161616, border 1px #2A2A2A; input Barlow 400 16px placeholder "Ask about your fit…" (sr label "Ask the fitter"); mic button 42 circle bg #262626 with mic 18 #FF6E01 (aria-label "Say it"). No send button.

**Stage panels** (3D placeholders): radius 16–18, border 1px #262626, bg `radial-gradient(ellipse 80% 60% at 50% 65%, rgba(255,110,1,.22), #121212 70%)` (R2: `ellipse 70% 50% at 50% 62%, rgba(255,110,1,.16), #121212 72%`; R3: `.18 … 60%`). "3D" badge: `.eb` absolute left/top 10, padding 2px 7px, radius 3, bg #F8F8F8, #0B0B0B.

**Dark stat tiles**: padding 10px 14px, radius 12, bg #121212, border 1px #262626; label `.eb` 11px #8F8F8F; value BC 700 21–22px. Compare variant: yours in #FF8A33 then `vs X` in #8F8F8F 16px.

---

## 3. Screens

Persona in main path: man, 31, right-handed, 8 years, 2–3 rounds a month, handicap 12, 10-year-old cavity backs, fades it a bit low, wants higher; guessed 165 m 7-iron, measured 142 m / 76 mph on TrackMan; 181 cm, wrist-to-floor 86 cm, glove L. Recommendation: Takomo 201T MkII 7-iron, KBS Tour Lite Regular, standard length/lie/grip, €679.

Intended path: C1 → C2 → C3a (→ C3b fallback) → C4a → C4b → C4c → C5 → C6a → C6b → C6 → R1 → R2/R3/R4. Shortcut: C2 typed-everything → C2b → R1. Conditional: R1b (no sim data), R5 (custom earned).

Link notes from the files: many mock buttons are `type="button"` with no href (C3a source tiles, C3b, C4b tiles, C4c "Bring them in", C5). Logo link on C2b, C6a, C6b, C6, all R screens points to stale `V2-01-Welcome.dc.html`; treat as Welcome (C1). C4a "I'll answer myself" links to `V3-C6-Body` (glove); logically it continues the by-hand path (likely C6a Height).

### C1 Welcome (`V3-C1-Welcome`)
- Purpose: entry; set expectations.
- Layout: stage root min-height 900. Glow right:-80 top:60 760x760 `rgba(255,110,1,.2)` → transparent 62%. Hero image 201T MkII (alt "Takomo 201T MkII iron") absolute right:110 top:150 height 470.
- Header: logo + TAKOMO, `.eb` "Fitter Studio", rule #3D3D3D, right `.eb` #A3A3A3 "Honestly better golf". (No step/confidence/save.)
- Main padding 64px 56px 56px, gap 30: eyebrow #FF8A33 "Welcome to the studio"; H1 "Let's find your fit." (150px); paragraph 21px #C8C8C8 max 640: "This is a fitter's first ten minutes, online. You talk, we measure what we can, and you see the reason for every part of your club before you decide anything."
- CTA row (gap 22): `.btn.bp` min-height 64, padding 0 32, 24px "I'm ready. Let's start" + arrow 22 → **C2**; note 16px #A3A3A3 "About 4 minutes. Save any time."
- Bottom 4-step list (`margin-top:auto`, grid 4 cols, gap 28): each li padding-top 20, border-top 2px (step 1 #FF6E01, others #3D3D3D); number BC 700 18px (#FF8A33 / #8F8F8F); title BC 700 28px uppercase; text 15px #C8C8C8.
  01 Talk: "How's your game? Type, tap or just say it." · 02 Bring proof: "TrackMan shots, a screenshot, or your honest guess." · 03 See it fly: "Your club in 3D, your carry, your dispersion." · 04 Decide: "Every reason shown, close calls included."

### C2 Chat starts: background (`V3-C2-Start`)
- Step 1 of 4, confidence 0%. Main max-width 1060.
- Fitter: "Hey, welcome to the studio. Pull up a chair, this takes about as long as a slow par 3." then (indented) "Let's start with you. How long have you been at this game?"
- Card = **Sentence builder** (full size): helper "Tap the words to change them"; sentence 34px/1.7: "I've played golf for [how long ▾], about [how often ▾], and I'm a [right ▾] handed [man or woman ▾] aged [age ▾]". Pills: inline-flex height 52, padding 0 22, radius 999, Barlow 500 32px, vertical-align middle. Active token: bg #0B0B0B text #F8F8F8; unfilled tokens: bg #EDEDED text #8F8F8F.
- Below: option grid for the active token, 4 cols gap 12, `.opt` + `.kbd`: "Just started" 1, "1–3 years" 2, "3–10 years" 3, "10+ years" 4.
- In-card light composer (section 2.1).
- Below card (not in card): **Sim shortcut link** → **C4a**: `<a>` flex gap 20, padding 12px 22px 12px 14px, radius 14, border 1px #262626, bg rgba(20,20,20,.85), align-self flex-start. Thumbnail SVG 132x60 (rx 8, #0B0B0B; dashed grey arc #5F5F5F, orange ellipse stroke-opacity .6, 10 orange dots r2.6, label "142 M" #A3A3A3 BC 700 11). Text: "Hit in a simulator lately?" 600 17px / "Bring your TrackMan shots. Real numbers beat any guess." 14px #A3A3A3; CTA BC 700 16px uppercase #FF8A33 "Bring shots →".
- No bottom dark composer on this screen.

### C2b Typed it all at once: skip ahead (`V3-C2b-Skip`)
- Step 4 of 4, confidence 78%. Hero opacity .5.
- User bubble: "31, right-handed, playing 8 years, handicap 12. My 7-iron goes 142 on TrackMan, club speed 76. I fade it and want it higher. 181 cm, glove L. Show my fit."
- Fitter: "You know your game. That's almost everything I need."
- Card = **Here's what I heard** (`heard_summary`): `.eb` #555 "Here's what I heard"; chips (height 42, padding 0 16, radius 999, bg #FFF, border 1px #D9D9D9, Barlow 600 16px, gap 8): typed facts get an 18px black check circle (check 10px #F8F8F8); measured facts get orange `.dot`. Chips: ✓ Man, 31 · ✓ Right-handed · ✓ 8 years, handicap 12 · ● 142 m carry · ● 76 mph · ✓ Fade, wants higher · ✓ 181 cm · ✓ Glove L.
- Missing-data callout: flex gap 16, padding 14px 16px, radius 12, bg #FFE6D3: "**One thing would sharpen it:** wrist to floor. Skip it and I'll use your height." + input (aria "Wrist to floor in cm", placeholder "cm", 90x44, radius 8, border #C8C8C8, BC 700 20px).
- Footer row (border-top #E4E4E4, padding-top 6, space-between): "I skipped 7 questions you already answered." 15px #555; `.btn.bp` 58h 22px "Show my fit →" → **R1**.
- Dark composer, placeholder "Or keep talking…".

### C3a Import your rounds (`V3-C3a-Rounds`)
- Step 1, confidence 12%. Hero = 201 MkII image, opacity .22.
- Recap: "8 years, 2–3 rounds a month, man, 31, right-handed".
- Fitter: "Eight years, nice. Do you track your rounds? An app like GameBook knows your game better than any question I could ask."
- Card: **value preview strip** (flex gap 20, padding 14px 18px, radius 14, bg #0B0B0B): "From your app I get your real scoring, not last week's best round:" 15px #C8C8C8 + 3 stats (BC 800 30px + 13px #8F8F8F): "86" avg score, last 20 · "31%" greens hit · "Short" most misses.
- **Source picker** grid 3 cols gap 12; tiles min-height 110, padding 18, radius 14, bg #FFF, border 1px #D9D9D9 (selected: 2px #0B0B0B), name BC 800 26px letter-spacing .02em, sub 14px #555: GameBook (selected) "Connect or share a stats screenshot" · 18Birdies "Stats screenshot" · Arccos "Connect your account" · Garmin Golf "Connect your account" · Handicap ID "GHIN or your federation number" · fallback tile (dashed 1px #C8C8C8, bg #F8F8F8) "I'll just tell you" / "A few quick questions instead" → **C3b**.

### C3b Your game by hand (fallback) (`V3-C3b-Carry`)
- Step 1, confidence 31%. Recap: "8 years, 2–3 rounds a month, man, 31, right-handed" · "Mostly a fade, a bit low" (title "How do your irons usually go?") · "10-year-old cavity backs" (title "What's in the bag?").
- Fitter: "Used cavity backs, respect. How far does your 7-iron **carry**? A normal one, not your best."
- Card = **Slider with guess toggle** (`slider_guess`): header row label "7-iron carry" 600 18px + "Your guess" pill (dashed #8F8F8F, `.ring`). Value BC 800 88px "165" + " m" 36px #555. `<input type=range min=100 max=200 value=165>`. Scale 14px #555: "100 m" / "150" / "200 m". Bottom row: segmented control (`role=group` aria "Where this number came from"; track padding 4 radius 10 #EDEDED; buttons 46h radius 8; active bg #FFF shadow `0 1px 2px rgba(0,0,0,.12)` 600 16px, inactive transparent 500 16px #333; `aria-pressed`): "It's a guess" / "I measured it"; then `.btn.bo` "Not sure", `.btn.bd` "That's it".

### C4a Sim data or answer yourself? (`V3-C4a-Sim`)
- Step 2, confidence 34%. Recap: "Mostly a fade, a bit low" · "10-year-old cavity backs" · "7-iron about 165 m".
- Fitter: "Noted, as a guess. Have you hit in a simulator lately? You can keep answering by hand, or we can sharpen your fit with real shots."
- Card = **Visual fork** (`yes_no_fork`), grid 2 cols gap 14; each `<a>` flex column gap 14, padding 20, radius 16, bg #FFF.
  - Yes (border 2px #0B0B0B) → **C4b**: SVG 300x110 on #0B0B0B r10: dashed grey arc, orange ellipse (fill-opacity .1), 10 orange dots r4, "142 M" #F8F8F8 BC 700 20, "MEASURED" #FF8A33 BC 600 13 ls 1.5. Title BC 700 26px uppercase "Yes, I have sim data"; text 15px #555 "Bring real shots in. It's the biggest upgrade to your fit, and you'll see confidence jump."
  - No (border 1px #D9D9D9) → `V3-C6-Body`: SVG on #EDEDED: white pill "About 165, I think", black pill "Mostly a fade, a bit low", dashed "?" circle. Title "I'll answer myself"; text "No problem. A few more questions instead. Guesses are marked as guesses, and you can add shots later."
- Footer link 15px #333 underline "Never hit in one? There are 3 simulators near Turku" (href #).

### C4b Which simulator? (`V3-C4b-Which-sim`)
- Step 2, 34%. Recap: "10-year-old cavity backs" · "7-iron about 165 m" · "Has sim data".
- Fitter: "Nice. Which simulator was it? I'll show you exactly how to get the shots out."
- Card = **Source picker** 3x2, tiles min-height 118, padding 18, radius 14, name BC 800 28px: TrackMan (selected, 2px #0B0B0B) "Share link from the app" · Foresight "GCQuad, GC3: CSV export" · Garmin "Approach R10: Garmin Golf app" · Uneekor "EYE XO, QED: CSV export" · Something else "Any launch monitor CSV" · dashed tile (bg #F8F8F8) camera icon 30px + "Just a photo of the screen". Selecting TrackMan → C4c.

### C4c TrackMan import (`V3-C4c-TrackMan`)
- Step 2, 34%. Recap: "7-iron about 165 m" · "Has sim data" · "Used TrackMan".
- Fitter: "TrackMan, perfect. Three taps and your shots are in."
- Card = **Guided import** (`data_import`): 3 cols gap 16; each = 120px illustration panel (radius 12, bg #0B0B0B; phone mock SVGs, active row #FF6E01) + step row (BC 800 22px #C24F00 number + 15px/1.4 text): 1 "Open the TrackMan Golf app and pick your session" · 2 "Tap Share and copy the report link" · 3 "Paste it here. We pull every 7-iron shot" (illustration: pill "trackman.com/report/…" + orange cursor).
- Field row (gap 10): url input (sr "TrackMan report link") height 58, padding 0 18, radius 10, border 2px #0B0B0B, 18px, placeholder "Paste your TrackMan share link"; `.btn.bp` min-height 58 "Bring them in" (→ C5).
- Footnote 14px #555: "Only played on a range bay? The session email has the same link. " + link 600 #C24F00 "Use a photo instead".

### C5 Shots in (`V3-C5-Shots-in`)
- Step 2, 68%. Hero opacity .45. Recap: "10-year-old cavity backs" · "7-iron about 165 m" · "● 24 TrackMan shots" (title "Real shots?").
- Fitter: "Got 24 shots. You carry it **142 m**, not 165. That's the ego tax, and everyone pays it. It also means **regular flex**, not stiff."
- Card:
  - Row (gap 28): **Dispersion vs guess chart** SVG viewBox 560x170 (rect r10 #0B0B0B; dashed centre line #2A2A2A at y80; orange ellipse cx298 cy82 rx62 ry52 fill-opacity .1 stroke 1.5; 22 orange dots r4 around it; solid orange vertical line x=298 + label "142 M MEASURED" #FF8A33 BC 700 15; dashed #C8C8C8 line x=460 + "165 GUESS"). aria-label "22 shots landing around 142 metres, drifting right. Your guess of 165 metres is past the group." Right: **Confidence update** `.eb` #555 "Fit confidence" + BC 800 64px "<34 → in #8F8F8F 36px> 68%".
  - 4 stat tiles (light: padding 12px 14px, radius 10, bg #FFF, border #E4E4E4; label `.eb` 11px #555; value BC 700 28px): Club speed 76 mph · Launch 18.2° · Side spread ±9 m · Shape Fade.
  - **Outlier callout** (`outlier_review`): flex gap 14, padding 12px 16px, radius 10, bg #FFE6D3: "**Shot 7 went 191 m.** You're in the 0.003% there. Tailwind, or have you been hiding something?" + `.btn.bo` "Keep it" + `.btn.bd` "Drop it" (min-height 40, 15px).
- (Data note: header says 24 shots, chart draws 22; the K4 card says "22 other shots stay in" i.e. 24 minus outlier(s).)

### C6a Height (`V3-C6a-Height`)
- Step 3, 74%. Recap: "8 years, man, 31, right-handed" · "Fade, a bit low" · "● 142 m carry, measured".
- Fitter: "Last three, and they're quick. Your body sets the length and lie. How tall are you?"
- Card = **Body measure**: grid 2 equal cols gap 24. Left: illustration panel radius 14 bg #EDEDED min-height 300; SVG 240x280 stick figure (#0B0B0B 2.5) with orange vertical measure line + arrowheads, grey ticks, dashed orange line at head height. Right (flex column gap 16, centered): label "Your height" 600 18px; value BC 800 96px "181" + " cm" 36px #555; range 150–210 value 181; scale "150 / 180 / 210 cm"; unit segmented (cm active 64x40 / "ft / in"); row: `.btn.bo` "Not sure" + `.btn.bd` "Next →" (min-height 52, padding 0 24) → **C6b**.

### C6b Wrist to floor (`V3-C6b-Wrist`)
- Step 3, 78%. Recap: "Fade, a bit low" · "● 142 m carry, measured" · "181 cm".
- Fitter: "Now wrist-to-floor. Grab someone, or a wall and a tape measure."
- Card: same 2-col. Illustration: figure with orange dot at wrist (126,150), orange measure line wrist→floor, label "86 CM" #C24F00. Right: numbered steps (28px black circles, white BC 700 15px; text 16px): 1 "Shoes on, stand tall" · 2 "Let your arms hang loose" · 3 "Measure wrist crease to floor". Input "Wrist to floor" (label 600 16px) 64h, radius 10, border 2px #0B0B0B, BC 800 36px, value 86, inputmode numeric, unit "cm" 18px #555. Link 600 15px #C24F00 "Measure with my camera instead". Row "Not sure" / "Next →" → **C6**.

### C6 Glove size, show my fit (`V3-C6-Body`)
- Step 3, 80%. Recap: "● 142 m carry, measured" · "181 cm" · "86 cm".
- Fitter: "Last one. What glove size do you wear? It sets your grip."
- Card: illustration = open hand outline with orange measure wrist→middle fingertip, "19 CM". Right: "Glove size" 600 18px; **size tiles** grid 5 gap 8, each 72h radius 12 (unselected border 1px #D9D9D9, selected 2px #0B0B0B `aria-pressed=true`), letter BC 800 28px + cm 12px #555: S 17 cm · M 18 cm · ML 18.5 cm · **L 19 cm** · XL 20 cm. Dashed helper button 48h radius 12 border 1px dashed #8F8F8F 500 15px #333 "Don't know? Measure wrist crease to middle fingertip". Footer (border-top #E4E4E4): "That's everything." 15px #555 + `.btn.bp` 58h 22px "Show my fit →" → **R1**.

### R1 Your fit: summary first (`V3-R1-Overview`, 1240 tall)
- Header "Your fit", 82%. No detail nav.
- Main:
  1. Hero grid `270px 1fr`, gap 36, margin-top 8: stage panel 270x270 radius 18 with 201T image 236px (alt "Takomo 201T MkII 7-iron, 3D view") + "3D" badge. Right: H1 "201T MkII" (104px); p 20px max 640 "Built for what you asked: **higher, softer iron shots** that hold the green. Regular flex, because your swing is 76 mph."; 3 ticks (orange check 16 + 15px): "Stock build fits you" · "Ships in 2–3 days" · "30-day returns".
  2. "Your two best heads, same shaft" (`.eb` #8F8F8F, margin-top 28). Two head cards (flex 1, gap 12, padding 12px 16px, radius 14, img 62px) → **R3**: 1st (border 2px #FF6E01, bg #1A140F) `.eb` #FF8A33 "1st, your fit", BC 700 22px "201T MkII", 14px #C8C8C8 "Higher and softer, more workable", score BC 800 28px #FF8A33 "84". 2nd (border 1px #262626, bg #121212) "2nd, close behind", "201 MkII", "+3 m, a bit more forgiving", score #C8C8C8 "80".
  3. Three drill-down cards (grid 3 gap 16, margin-top 20; padding 14, radius 16, bg #121212, border #262626): 112px preview (bg #0B0B0B r10) + number BC 800 18px #C24F00 + title BC 700 22px + text 14px #C8C8C8 + CTA BC 700 15px #FF8A33.
     - 1 "Why each part" — preview: 5 spec icons in 38px tiles (#1A1A1A r8; head+shaft orange) — "Every spec with its reason. Shaft and head come from your shots." — "See the reasons →" → R2.
     - 2 "Compare heads" — preview: both heads + two arcs (white thin, orange thick) — "Swap the head and watch your flight change." — "Compare →" → R3.
     - 3 "In your hands" — preview: phone 58x92 with brown room gradient (#6B6157→#4E4236) and club rotated -14° — "Your club on your floor at real size." — "Open AR →" → R4.
  4. "See it hit" (margin-top 36): BC 800 26px title + `.eb` #8F8F8F "4 videos of the 201T MkII" + 13px #A3A3A3 "Picked for you: On the range". 4 **video tiles** (flex 1, gap 14): thumb 150h radius 12 bg `radial-gradient(ellipse at 70% 40%, #2A2A2A, #0B0B0B 70%)`, club image right 8 top 6 h136 opacity .85, play button 40 circle top-left (first: #FF6E01 + inset 2px #FF6E01 ring on tile = recommended; others #F8F8F8 + inset 1px #262626), duration chip bottom-left (600 12px, bg rgba(0,0,0,.7), padding 2px 6px, r4); caption 600 15px ellipsis. Videos: "On the range" 0:42 · "Face and sole up close" 0:28 (img 7e44…) · "Sound at impact" 0:15 · "201T vs 201" 1:10 (img 22fc…). aria-label "Play <title>, <duration>".
- Buy bar: stock, €679, Add to cart (no Next link).
- Aside: "That's your fit. The short version is above. Every detail is one tap away when you want it." Chips: "Why regular, not stiff?" · "Is the 201 better for me?" · "How does it sound?".

### R2 Why each part (`V3-R2-Why`)
- Nav tab 1 active. Main grid `200px 1fr 270px`, gap 28.
- Left: **spec part list** (buttons, gap 4, padding 10px 12px, radius 12): icon tile 34px r8 (#1A1A1A; active #0B0B0B with orange icon) + `.eb` 11px part + BC 700 17px value. Head "201T MkII" · **Shaft "Regular"** (active: bg #F8F8F8 color #0B0B0B, `aria-current`) · Length "Standard" · Lie "Standard 0°" · Grip "Standard".
- Centre: `.eb` #FF8A33 with `.dot` "Shaft, from your shots"; H1 44px "KBS Tour Lite, Regular"; p 19px #C8C8C8 "Your swing speed sits in the regular band. Stiff would launch the ball lower, and you already fly it low."
  - **Flex band chart** panel (bg #121212, border #262626, r16, padding 18px 22px), `.eb` #A3A3A3 "Flex by 7-iron club speed"; SVG 760x150: 4 bands L/R/S/X (176x46 r6, inactive #1F1F1F text #8F8F8F; R = orange fill-opacity .22 stroke #FF6E01 text #FF8A33), axis "70 / 80 / 90 mph", solid orange marker at 308 + dot, label "YOU, 76 MPH MEASURED"; dashed #C8C8C8 ghost at 452 "WHAT 165 M WOULD HAVE MEANT".
  - 4 dark stat tiles: Club speed 76 mph · Carry 142 m · Launch 18.2° · Wants Higher.
  - Stock/custom note (dark callout with green dot): "**Stock or custom?** Your only possible tweak is +0.25 in length, and you're right on the line. Stock, with returns, is the better deal."
  - Actions: light button "See regular vs stiff fly" → R3; ghost "Compare heads" → R3; external link #FF8A33 "Go deeper in The Forge: what flex really changes" (new tab, sr "(opens in a new tab)").
- Right: 3D focus panel, badge "3D" + "Focus: shaft"; club image dimmed (opacity .35, grayscale .3), shaft highlighted (10px bar, metallic gradient, orange glow `0 0 0 3px rgba(255,110,1,.55), 0 0 28px rgba(255,110,1,.6)`), callout "Regular" / "Mid launch"; footer 12px #8F8F8F "Rest of the club dimmed. Drag to rotate."
- Buy bar Next: "Next: Compare heads →". Aside: "Stiff was only the 165 talking. At 76 mph, regular gets the ball up and lets it land softer, which is what you asked for." Chips: "What would stiff do?" · "Next: the head".

### R3 Compare heads, see it fly (`V3-R3-Compare`)
- Nav tab 2 active. Title row: BC 700 26px "Swap the head, keep your shaft" + 15px #A3A3A3 "Both on KBS Tour Lite Regular. Only the head changes."
- Grid `230px 1fr` gap 16: stage panel with 201T (alt "201T MkII, 3D view", 210px) over faint 201 (opacity .16, offset), caption "Faint head is the 201 for comparison".
- **Flight compare** panel `.eb` "Your swing, side view", SVG 900x200: ground line, axis 0/50/100/150 m; 201 path white 2px `M40 184 C 310 52 660 42 749 184`; 201T path orange 4px `M40 184 C 300 18 640 10 734 184`; landing dots; labels "201T: APEX 27 M, LANDS 47°" (#FF8A33), "201: 24 M, 44°" (#C8C8C8). aria-label "201T carries 144 metres, apex 27, lands at 47 degrees. 201 carries 147, flies lower and lands flatter."
- 4 compare tiles: Carry **144** vs 147 m · Landing **47°** vs 44° · Side spread **±9** vs ±11 m · Holds a 30 m green **Yes** vs Often.
- Head selector (`.eb` "Tap a head to see it fly" + link 14px #A3A3A3 "Show all five heads"): two toggle buttons (`aria-pressed`), img 70px: 1st selected (2px #FF6E01, #1A140F) "1st, your fit" / "201T MkII 84" / green dot "In stock, ships in 2–3 days"; 2nd (1px #3D3D3D, #121212) "2nd, close behind" / "201 MkII 80" / amber dot "Tour Lite R sold out until Dec. In stock with KBS Tour R (120 g)".
- Buy bar Next: "Next: In your hands →" → R4. Aside: "I kept your shaft and only swapped the head. That's how a fitter does it at the range: one change at a time." + light **close-call card** (bg #F8F8F8 r14 padding 16): `.eb` #555 "Close call", bar 201T 53 / 201 47, text 14px "The 201 gives you **+3 m** but lands flatter and runs out. For holding greens, the 201T wins." + **video tile** 120h "Video" / "201T MkII on the range" (orange 46 play). Chips: "What about the 101?" · "Why not the 301?".

### R4 In your hands (AR) (`V3-R4-AR`)
- Nav tab 3 active. Grid `1fr 340px` gap 40, centered.
- Left: `.eb` #FF8A33 "See it in your hands"; H1 72px "Put it on your carpet."; p 20px #C8C8C8 max 520 "Scan with your phone. The 201T appears at real size, so you can check how the topline and offset look at address." QR block (white tile padding 14 radius 16, 200x200 QR, aria "QR code that opens the club in AR on your phone") + list 15px #C8C8C8: "iPhone: opens in AR Quick Look" · "Android: opens in Scene Viewer" · link #FF8A33 "Send the link to my phone".
- Right: phone mock 300x500, radius 40, border 8px #262626, room gradient (`#6B6157 → #8C7E6E 45% → #5B4F43`; floor from 52% with stripe pattern), club image rotated -14° h250 (alt "201T MkII placed in a room in AR"), notch 90x24, bottom pill `.eb` "201T MkII, actual size" (bg rgba(11,11,11,.75), 40h).
- Buy bar (no Next). Aside: "Hold your phone where the ball would be. Check how the topline looks to you at address." Chips: "Show the 201 in AR too" · "How much offset is that?".

### R5 Conditional: custom is earned (`V3-R5-Stock`)
- Only for a low-handicap persona: amber badge `.eb` (26h, bg #E3B341, #0B0B0B) "Only shown when custom is earned" + 14px #8F8F8F "Anders, handicap 4, two TrackMan sessions". Nav visible, no tab active.
- H1 56px "+1° upright is worth it for you."
- **Stock vs custom** radiogroup (`role=radiogroup` aria "Stock or custom"), two `role=radio` cards flex 1 gap 14, padding 16px 18px, radius 16:
  - Stock (unchecked: border 1px #3D3D3D, bg #121212, radio ring 24px 2px #5F5F5F): "Stock, 0°"; "Your strikes" face SVG with 8 grey (#C8C8C8 r6) dots on the toe; "Start line" SVG grey line angled right; "Toe strikes, starts 4 m right" 600 15px #C8C8C8; footer: green icons "Returns / 30 days", "Delivery / 2–3 days".
  - Custom (checked: border 2px #FF6E01, bg #1A140F, radio 24px border 7px #FF6E01 centre #0B0B0B): "Custom, +1° upright" + badge `.eb` bg #FF6E01 "Recommended"; 8 orange dots centred; start line straight; "Centred, starts on line" #FF6E01; footer amber icons "Returns / Not returnable", "Delivery / About 2 weeks".
- Note 15px #A3A3A3: "Pick one. The buy bar below follows your choice. Not sure? Stock still plays fine for you."
- Buy bar (custom state, amber dot). Aside: "You're a 4 and your shots agree twice over. This is exactly when custom pays off." Chips: "Show me the toe strikes" · "What if I buy stock?".

### R1b Conditional: no simulator shots yet (`V3-R1b-No-sim`, 1240 tall)
- Same as R1, with: confidence 68% (7 segs); p "…Regular flex, because a 150 m carry usually means a swing around 76 mph."; card 1 text "Every spec with its reason, and how sure I am of each."
- Aside message: "This fit is built on what you told me, and it's a solid start. Want to be sure before you buy? Hit a few shots in a simulator and I'll confirm it."
- Embedded **Confirm with real shots** section (padding 16, radius 14, bg #121212, border #2A2A2A, gap 12): `.eb` #FF8A33 "Confirm it with real shots"; map SVG 330x130 (bg #161616, roads #262626/#1F1F1F, you = white dot r7 with halo, 3 orange numbered pins r11); list rows (border-top #262626, 20px orange number circle, 14px name, distance 13px #A3A3A3): 1 [SIMULATOR 1] 1.4 km · 2 [SIMULATOR 2] 3.8 km · 3 [SIMULATOR 3] 5.2 km (names are placeholders in the mock); text 14px #C8C8C8 "10 shots with a 7-iron, about 15 minutes. I check the shaft and head against what you really hit."; **projected-confidence bar**: "68%" #A3A3A3 + 6px track #262626 with solid orange 0–68% and striped orange (repeating 4px/3px, opacity .6) 68–92% + "~92%"; light button "Save fit and pick a simulator"; link "Just save it to myTakomo".
- Chips: "What changes with real shots?" · "Buy it now anyway". Buy bar unchanged (buying is never blocked).

---

## 4. Component catalog (K0–K7)

### 4.1 Decision logic (K0 "How the chat decides", K2 "Tap, type or talk")

Lead: "One question at a time, in a logical order. The fitter asks like a person at the range: who you are, how you score, how you swing, what you want, what hurts, then your body. Every step is one card. Anything the golfer already told us, or that data already shows, is skipped."

Five rules:
1. **One question per turn.** Never more than one input on screen.
2. **Ask only what data can't tell us.** Imports first, questions fill gaps. Body measurements last, when the golfer is invested.
3. **Every closed question is tappable.** Whole fitting possible without typing; typing and voice always work.
4. **Follow how they answer.** Tappers get full cards; typers get text-first replies with small inline chips; talkers get a live transcript and the same chips.
5. **Stop at enough confidence.** Once confident, show the fit. More data is an optional way to sharpen, never a gate.

Question order + skip rules:
| # | Topic | Asks | Component | Skip rule |
|---|---|---|---|---|
| 1 | About you | Sex, age, hand, how often | `sentence_builder` | Skipped if already typed |
| 2 | Your scoring | Import GameBook etc., or pick a score range | `source_picker` / `choice_chips` | Import replaces the question |
| 3 | Your swing | Sim import, or 7-iron speed or carry | `source_picker` / `slider_guess` | Measured beats guessed: confidence jumps |
| 4 | What you want | Top 3 characteristics, then ball flight | `multi_pick` / `flight_picker` | Beginners get 3 plain-language options |
| 5 | Anything that hurts | Hands, wrists, back, or nothing | `pain_check` | One tap "Nothing" and move on |
| 6 | Your body | Height, wrist to floor, glove | `body_measure` x3 | One measurement per card |
| → | **Show my fit** | as soon as confidence is high enough, even mid-list | | |

Answer modes (switched automatically):
- **Tap** (default; first card is always a full component).
- **Type**: 2 free-text answers in a row → replies lead with text, cards shrink to inline confirm chips.
- **Talk**: mic used → live transcript, fitter can read reply aloud, same chips.
- A card is always one tap away: "Show options" under any text question brings the full card back.
- Free text is parsed for every field at once; one long message can skip several cards (C2b). Confidence gates (Main): 30% = can show a result, 70% = "sure".

K2 visual for the same question ("How far does your 7-iron carry? A normal one."):
- Tap: full `slider_guess` card.
- Type: user bubble dark (bg #262626, radius 16 16 4 16, 15px) "about 150 i guess, maybe less into wind"; fitter text 16px "Got it, 150 m as a guess. Most people remember their best one, so I'll check it against real shots if you have them."; **confirm chip** (34h, padding 0 12, radius 999, bg #F8F8F8, 600 14px) with 10px dashed ring + "150 m, a guess" + underlined 13px #A3A3A3 "Edit".
- Talk: orange waveform (9 bars 4px wide, heights 8–30, radius 2) above italic transcript bubble (#262626, #C8C8C8) "…like a hundred and fifty, I think"; fitter "Hundred and fifty, noted as a guess."; same confirm chip.

### 4.2 Who asks what (K1)

Answer depth follows golfer level (personas from participant pack). Question → component:

- **Starting out** (Aino 29, Emma 33, Marja 66): wants direction and reassurance, plain words, one recommendation, true social proof.
  "Which irons should I even get?" → `recommendation_card` (one head, one sentence why) · "What is flex? Do I need to care?" → `explainer` (picture, no numbers) · "Will these stop my slice?" → `landing_rings` · "Do I need all these clubs?" → `set_builder` · "Can I send them back?" → `stock_vs_custom` (30-day returns badge).
- **Getting serious** (Mikko 46, Kaisa 48, Tom 35, Pekka 74): reason per spec, compare two options, numbers on request.
  "Why regular and not stiff?" → `flex_band` · "201 or 201T for me?" → `club_compare + flight_compare` · "How far will my 7-iron go?" → `flight_compare` · "My knuckles ache" → `pain_check` (grip size and graphite) · "I guessed my glove size" → `body_measure (glove)`.
- **Low handicap** (Lars 38, Hannu 60, Anders 44, Ben 31, Noora 24): evidence, real numbers, honest trade-offs.
  "CB or MB? Talk me through it" → `close_call` · "Does my lie really need to change?" → `strike_map + lie_test` · "Show me spin and landing angle" → `numbers_table` · "+1° custom: worth losing the return?" → `stock_vs_custom` · "Gap my lofts against my set" → `set_gapping` (carry gaps 5 to PW).

K1 visuals: 3 columns of dark cards (r18, padding 22, bg #121212); question bubbles light (#F8F8F8, radius 16 16 16 4, 15px) then "→ `code` description".

### 4.3 Catalog card format (K3–K7)

Each component is documented as an `<article>` (padding 18, radius 16, bg #121212, border #262626, gap 12): type tag `.eb` 11px (Input = bg #FF6E01; Answer = bg #F8F8F8), name BC 700 22px, status `.eb` 11px ("New" #FF8A33 / "In plan" #8F8F8F), code name, 244px preview on #0B0B0B (light mini-card inside: bg #F8F8F8 r12 padding 14 gap 10), "Use when", "If they type instead", and level dots (filled orange = shown to that level; hollow #5F5F5F = not). Mini-card atoms: option chip 34h padding 0 12 radius 8 border 1px #D9D9D9 (selected 2px #0B0B0B) 500 14px with 18px kbd (#EDEDED, 600 11px); mini buttons 32h radius 5 BC 700 13px.

Levels key below: S = Starting out, G = Getting serious, L = Low handicap.

### 4.4 Input components: "Ask about you" (K3)

| Component (code) | Status | Visual structure & states | Use when | Typed equivalent | Levels |
|---|---|---|---|---|---|
| Sentence builder (`sentence_builder`) | New | Helper "Tap the words to change them"; sentence with token pills ("I've played [8 years ▾], I'm a [man ▾] aged [31 ▾]"). Active token: black pill/white text; unfilled: #EDEDED/#8F8F8F. Below: option chips for the active token with number keys (New 1, 1–3 2, 3–10 3 selected, 10+ 4). Full size in C2. | Opening background: several short facts that read as one sentence | All tokens filled from one typed sentence | S G L |
| Choice chips (`choice_chips`) | In plan | Question 600 14px "How often do you play?"; 2-col chips with kbd: Every week 1, 2–3 a month 2 (selected), A few a season 3, Just starting 4; underlined "Not sure". Full-size = `.opt` grid (C2). "Not sure" always offered. | One closed question, 2–6 answers; number keys pick | Free text mapped to closest option, shown as confirm chip | S G L |
| Pick your top 3 (`multi_pick`) | New | "Pick three, most important first"; 4-col icon tiles (icon 22 + label 12px); picked tiles 2px #0B0B0B with orange 16px rank badge (1,2,3) top-left: Control 1, Workable 2, Forgiving 3, Distance (unpicked). Note "Beginners see 3 plain options instead of 7." | Ranking priorities (current tool's characteristics step) | "Mostly control and some workability" ranks two, asks for a third | G L |
| Number with guess toggle (`slider_guess`) | In plan | Label + provenance pill ("Your guess" dashed); big number; range track (orange fill to value, #C8C8C8 rest); segmented "It's a guess" / "I measured it"; buttons "Not sure" (bo) / "That's it" (bd). Switching to measured swaps pill to Measured (solid orange). | Numbers people misremember: carry, speed, loft | "About 150, maybe" → 150 m, a guess | G L |
| Visual fork (`yes_no_fork`) | New | Two illustrated tiles; selected 2px black. "Hit in a simulator lately?": "Yes, I have data" (dark thumb, orange bar-chart icon) "Real shots, big upgrade" / "I'll answer myself" (grey thumb, pencil icon) "A few more questions". | A branch that changes the path: sim data or not, own clubs or not | "No sim" / "yes TrackMan" picks branch and skips the next card | S G L |
| Body measure (`body_measure`) | In plan | Grey illustration panel (figure silhouette, orange measure line + dot + value) + label + boxed input (2px black, BC 800 24px "86 cm") + link #C24F00 "Measure with camera". | Height, wrist-to-floor, hand length. One measurement per card, with a drawing | "181, wrist 86" fills two cards at once | S G L |
| Glove sizer (`body_measure (glove)`) | In plan | 5 size tiles S 17 / M 18 / ML 18.5 / L 19 (selected) / XL 20 (cm); dashed helper "Don't know? Measure wrist to fingertip". | Grip size; shows hand length per size so a guess becomes a measurement | "Large, I think" sets L, marked as guess | S G |
| Anything that hurts (`pain_check`) | New | "Anything that hurts when you play?" chips: Nothing (selected), Hands or knuckles, Wrists, Elbow, Back, Shoulder. Footnote "Used for grip size and shaft weight. Never stored as health data." | Always, once, one quick card ("The old form never asked; a fitter would") | "Bit of elbow pain" ticks Elbow, asks nothing more | S G L |
| Ball flight picker (`flight_picker`) | New | "How do you want it to fly?"; SVG: today's flight dashed #8F8F8F low arc vs desired orange high arc; slider (orange 70%); labels Low / Medium / High. | What they want the ball to do, drawn against today's flight | "Higher, it stops on the green" sets the flight | S G L |

### 4.5 Input components: "Bring evidence" (K4)

Lead: "Data replaces guesses. Each import is a short branch: pick the source, follow that source's steps, confirm what was read." All are G + L only (not shown to Starting out).

| Component | Status | Visual structure & states | Use when | Typed equivalent |
|---|---|---|---|---|
| Source picker (`source_picker`) | New | 3-col tiles: name BC 800 + small hint; selected 2px black. Example: TrackMan (Share link), Foresight (CSV), Garmin (R10 app), GameBook (Stats), Arccos (Connect), Photo (Of the screen). Full-size versions C3a/C4b include a dashed fallback tile. | Choosing where data comes from: simulators, round trackers, handicap | "I used TrackMan at the range" picks it and goes to its import |
| Guided import (`data_import`) | In plan | 3 illustrated steps (dark thumbs with phone glyph) "1 Open the app", "2 Tap Share", "3 Paste here" (step numbers #C24F00) + one field "Paste your share link" + orange "Bring them in". | After a source is picked: 3 steps for that exact app, then one field | Pasting a link into chat imports it, no steps shown |
| Screenshot check (`extraction_review`) | In plan | Photo thumbnail (84x120, "IMG_2041") + read values table: Club speed 76 mph, Carry "14.2 m ?" (uncertain cell highlighted bg #FFE6D3), Launch 18.2°, Spin 6240. | Photo/screenshot read by vision: show what was read, flag unsure cells | "Carry looks wrong, it was 142" fixes the cell |
| Here's what I heard (`heard_summary`) | New | Eyebrow; fact chips (measured with orange dot); orange-tint callout "One thing missing: wrist to floor"; orange "Show my fit →". Full size = C2b. | After a long typed/spoken message: confirm everything at once, ask only what's missing | This is the typed path; the card only confirms |
| Odd shot check (`outlier_review`) | In plan | Big number "191 m" + "Shot 7. You're in the 0.003% there. Tailwind?" + Keep it (bo) / Drop it (bd) + "22 other shots stay in." | Import has a shot far outside the rest; one shot per card, light humour if true | "Drop the weird ones" drops all flagged |
| Your current clubs (`bag_check`) | New | "What 7-iron do you play now?" chips: Cavity back (selected), Blade, Hybrid set, No set yet; loft slider showing "31°"; note "Not sure of the loft? Pick the model and we look it up." | Checking whether they need new irons at all; feeds "your clubs are fine" | "Old Ping G400s, 7-iron is 30.5°" fills model and loft |

### 4.6 Answer components: "Explain" (K5)

Lead: "The fitter answers in plain text first. A component only comes in when a picture makes the reason clearer than words."

| Component | Status | Visual structure | Use when | Typed | Levels |
|---|---|---|---|---|---|
| Your fit, short version (`recommendation_card`) | In plan | Club image 76px + BC 800 28px "201T MkII" + 12px "Higher, softer iron shots. Regular flex for your 76 mph." + green dot "Stock fits you". Full size = R1 hero. | First answer after the chat; "which club should I get?" | Sentence first, card under it | S G L |
| Why each part (`why_panel`) | In plan | Rows (border-bottom #E4E4E4): 24px black icon tile + part label 11px uppercase + value BC 700 15px + source tag: Head 201T MkII "Your shots" (#C24F00), Shaft Regular "76 mph" (#C24F00), Length Standard "Close call" (#555), Lie 0° "From chart" (#555). Orange icons = from your data. Full size = R2. | "Why this spec?" One row per part, tap to open evidence | "Why that shaft?" opens straight to shaft row | G L |
| Flex in bands (`flex_band`) | New | L/R/S/X bands, active band #FFE6D3 + orange stroke, solid orange marker "YOU, 76 MPH", dashed grey ghost "your guess said stiff". | Any flex question, "why not stiff?"; guess shows as ghost | Beginners get picture + one sentence, no mph | S G L |
| Close call (`close_call`) | In plan | Eyebrow "Close call: head"; split bar 301 CB 51 / 301 MB 49; trade-off text "MB: more feel and shaping. CB: a little help on thin ones. Both suit your strike."; outline button "Hit both in a bay". | Two options near-tied. Show split and trade-off, not a winner | Same; low handicappers get score numbers | G L |
| Plain explainer (`explainer`) | New | Line drawing (lie angle, orange accents) + BC 800 20px term "Lie angle" + one sentence "How the club sits on the ground. If the toe sticks up, shots go left." + external link #C24F00 "More in The Forge". | Beginner terms: flex, lie, offset, forgiveness. One picture, one sentence | Text with picture inline | S |
| Numbers table (`numbers_table`) | New | Table "Your swing / 201T (orange) / 201": Carry 144 / 147 m, Apex 27 / 24 m, Landing 47° / 44°, Spin 6240 / 5810, Side ±9 / ±11 m. Yours bold #C24F00. | "Show me the numbers"; per head, from own shots | Ask for any one number, get just that | L |
| Confidence update (`confidence_update`) | New | "34 → 68%" (old #8F8F8F) + 10 flex segments 8px (orange / #C8C8C8) + chips with orange dot "Shaft: now measured", "Head: now measured" + "2 things left that would help". Full size in C5. | After any answer that moves confidence; small, inline | One line under reply | S G L |
| Golfers like you (`social_proof`) | New | Mini bar chart (first bar orange 70px, others #C8C8C8) + "Most golfers who start out like you get the **101 MkII**." + grey tag "Example figures". | Beginners wanting reassurance; always labelled example data until Takomo supplies real figures | One sentence with label | S |
| Fitter says (`text`) | In plan | Plain fitter line on dark with 28px avatar: "Honestly? With your strike, the 201 would be fine too. You'd just lose a bit of stopping power." | Opinion, small talk, follow-ups | Default for typers | S G L |

### 4.7 Answer components: "Compare and see" (K6)

Lead: "Visual proof. Swapping the head (never free configuration) and seeing the flight change is how the golfer tests the recommendation."

| Component | Type / status | Visual | Use when | Typed | Levels |
|---|---|---|---|---|---|
| Flight compare (`flight_compare`) | Answer, In plan | Side-view arcs: alt grey 2px, yours orange 3px with landing dot; labels "201T: 144 M, APEX 27" (#C24F00), "201: 147 M". Full size R3. | "How far / how high?" and any head comparison | Beginners: two arcs + "lands softer"; numbers on tap | S G L |
| Landing rings (`landing_rings`) | Answer, New | Green ellipse #DDE8DD; dashed grey ring offset right = "your current clubs"; orange ring (fill .15, stroke 2.5) tighter and centred = new club. | "Will it go straighter?", "will it hold the green?" | Same picture, one sentence above | S G L |
| 1st vs 2nd head (`club_compare`) | Input, In plan | Two tiles: 1st (2px orange) img + "1st" #C24F00 + "201T MkII" + "In stock"; 2nd (1px #D9D9D9) "201 MkII" + "Alt shaft in stock"; note "Both on KBS Tour Lite R. Show all five heads". Full size R3 selector / R1 head cards. | Choosing between the two recommendations; same shaft, only head swaps | "What about the 201?" swaps and redraws flight | G L |
| Strike map (`strike_map`) | Answer, New | Iron face outline (#EDEDED, stroke #8F8F8F), groove ticks, dashed centre line, orange impact dots clustered toward toe, labels heel/toe. | Lie/head questions with impact data | "Where do I hit it?" shows map + one line | L |
| Ball-line lie test (`lie_test`) | Answer, New | Ground line, grey sole bar, orange tilted line, "TOE UP, -2° NEEDED" (#C24F00), "5 ball-line marks, average tilt". | "Does my lie need to change?" with marker-line tests | Angle stated first | L |
| Set and gapping (`set_gapping`) | Answer, New | Bars 5,6,7,8,9,PW descending heights (90→50px), 7 orange, rest black; "8 m gaps, no overlap with your hybrid". | "Which irons do I need?" and gaps vs current set | Beginners: which clubs they'll use; low hcp: yards | S L |

(`set_builder` is referenced in K1 for beginners but has no card of its own; `set_gapping` covers it.)

### 4.8 Answer components: "Decide" (K7)

Lead: "Help them decide, honestly. One buy bar stays on screen; these cards only answer the questions that come before buying."

| Component | Type / status | Visual | Use when | Typed | Levels |
|---|---|---|---|---|---|
| Stock or custom (`stock_vs_custom`) | Input, In plan | Two radio tiles with mini strike maps: Stock (grey dots on toe, "30-day returns") vs Custom +1° (orange border, 4px orange radio, orange centred dots, "Not returnable"). Full size R5. | Only when fit really points to custom, or golfer asks. Radio drives buy bar | "Should I go custom?" gets honest answer first, card second | G L |
| Availability (`availability`) | Answer, New | Status rows: amber "KBS Tour Lite R sold out until Dec", green "KBS Tour R in stock, ships in 2–3 days", grey "Custom with Tour Lite R, about 3 weeks"; buttons "Take the in-stock one" (bd) / "Wait" (bo). | Recommended build out of stock; offer in-stock alternative + delivery times | One line in buy bar and reply | S G L |
| Product video (`product_video`) | Answer, In plan | 150h tile, radial dark bg, club image, orange play 40px, caption "201T MkII on the range". | A clip answers better ("how does it sound?"). Up to 4 per head on fit page; chat plays the one that fits | Linked inline. Beginners see strip open; low hcp get it folded to a "4 videos" chip | S G L |
| Simulators near you (`simulator_map`) | Answer, In plan | 120x120 dark map: white "you" dot, 3 orange numbered pins; list "1 [SIMULATOR], 1.4 km", "2 … 3.8 km", "3 … 5.2 km". Full size R1b aside. | Any fit built without simulator shots: preloaded in fit-page chat, with saving to myTakomo first. Also settles close calls | Text list with distances, map on tap | S G L |
| Your clubs are fine (`dont_buy_yet`) | Answer, In plan | BC 800 26px "Your clubs are fine." + "Our best fit would gain you about 2 m. Come back in a year." + "Tell me at next launch" / "Keep fitting" (bo). | Current set already fits. Honest, even when it costs a sale | Said plainly; card adds comparison | G L |
| Save to myTakomo (`save_fitting`) | Input, In plan | Dark summary chip "MIKKO'S FITTING, 7 NOV" (#FF8A33 10px) / "201T MkII Regular"; email input "Email for myTakomo (optional)"; black "Save". Triggered by header Save button. | Any time they want to stop. Never required to see a result | "Save this" saves, confirms in one line | S G L |

### 4.9 Full component index (code names)

Inputs: `sentence_builder`, `choice_chips`, `multi_pick`, `slider_guess`, `yes_no_fork`, `body_measure` (height / wrist-to-floor / glove), `pain_check`, `flight_picker`, `source_picker`, `data_import`, `extraction_review`, `heard_summary`, `outlier_review`, `bag_check`, `club_compare`, `stock_vs_custom`, `save_fitting`.
Answers: `recommendation_card`, `why_panel`, `flex_band`, `close_call`, `explainer`, `numbers_table`, `confidence_update`, `social_proof`, `text`, `flight_compare`, `landing_rings`, `strike_map`, `lie_test`, `set_gapping` (+ `set_builder` mention), `availability`, `product_video`, `simulator_map`, `dont_buy_yet`.
Plus: inline confirm chip (type/talk modes), "Show options" link, recap chip, provenance pills.

---

## 5. Image assets

| Asset | Depicts (from alt/context) | Where |
|---|---|---|
| `/_blob/a662f59b74c03bb070ca6f49f1829f14` | Takomo **201T MkII** 7-iron, transparent product cut-out (alts: "Takomo 201T MkII iron", "Takomo 201T MkII 7-iron, 3D view", "201T MkII, 3D view", "201T MkII placed in a room in AR") | C1 hero; chat hero ghost (C2, C2b, C4a–C6); R1/R1b hero, head card 1, drill-down previews, video thumbs; buy bar; nav back pill; R2 dimmed 3D; R3 stage; R4 phone; K5/K6/K7 mini cards. ~40 uses |
| `/_blob/22fc9d1615b873a216948eb7c4850ff2` | Takomo **201 MkII** iron (2nd recommendation, alt empty) | C3a/C3b hero ghost; R1/R1b head card 2 + compare preview (opacity .5) + "201T vs 201" video thumb; R3 faint comparison head (opacity .16) and selector; K6 club_compare |
| `/_blob/7e440162413775672cfe97e431db6437` | Club close-up for the "Face and sole up close" video thumbnail (alt empty) | R1, R1b video strip tile 2 |

All other graphics are inline SVG/CSS (logo, icons, charts, illustrations, QR placeholder, AR room, phone mocks). The 3D club, AR and videos are placeholders for real 3D/AR/video assets. Simulator names are literal placeholders "[SIMULATOR 1..3]".

---

## 6. R2 "Why each part": one screen per part (added 2026-11-07, design rev 1794072467)

Mockups: `V3-R2-Head`, `V3-R2-Why` (shaft), `V3-R2-Length`, `V3-R2-Lie`, `V3-R2-Grip`. All five share the R2 layout from §3:
- grid `200px 1fr 270px`
- left: the spec-part list, with the active part highlighted
- centre: the reason
- right: a 3D focus panel
- the results shell (nav tab 1 active, buy bar, "Your fitter" aside)

Only the centre content, the 3D focus label, the buy bar's "Next:" link and the aside change.

**Shared centre structure:**
1. Eyebrow (`.eb` #FF8A33 + `.dot` when the part is measured, else a hollow ring) with the provenance line.
2. H1 BC 800 44px with the value.
3. Reason paragraph, 19px #C8C8C8.
4. **A chart panel specific to the part** (bg #121212, border #262626, r16, padding 18px 22px, `.eb` #A3A3A3 title).
5. Dark stat tiles.
6. An optional callout.
7. Actions, plus the external link "Go deeper in The Forge: …" (new tab, sr "(opens in a new tab)").

**The "Next:" chain in the buy bar:** Head → Shaft → Length → Lie → Grip → "Next: Compare heads" (R3).

| Part | Provenance eyebrow | H1 | Reason | Chart panel | Stat tiles | Callout / actions | 3D focus label | Aside message + chips |
|---|---|---|---|---|---|---|---|---|
| **Head** | "From your strike pattern and what you want" | 201T MkII | "You asked for higher, softer shots with some shape. The 201T gives you that and still forgives the thin ones you hit now and then." | **"Where it sits in the range"**: the 5 heads on one scale, 101 · 201 · 201T · 301 CB · 301 MB, from "More forgiving" to "More workable". Yours is highlighted orange | Peak height 27 m · Lands at 47° · Side spread ±9 m · Fit score 84 | Button "Compare with the 201" (→ R3); Forge "cavity back or blade?" | "Focus: head", callouts "201T MkII" / "Thin topline"; "Shaft and grip dimmed. Drag to rotate." | "Two heads were close. I picked the 201T because you want the ball higher and to land soft. The 201 is 3 m longer but flatter." Chips: "Why not the 201?" · "Show me the 301" |
| **Shaft** | "From 24 TrackMan shots" | KBS Tour Lite, Regular | "Your swing speed sits in the regular band. Stiff would launch the ball lower, and you already fly it low." | **"Flex by 7-iron club speed"**: L/R/S/X bands, marker "YOU, 76 MPH", ghost "YOUR 165 M GUESS", axis 70/80/90 mph (`flex_band`) | Club speed 76 mph · Carry 142 m · Launch 18.2° · You want Higher | Button "See regular vs stiff fly" (→ R3); Forge "what flex really changes" | "Focus: shaft", "Regular" / "Mid launch" | "Stiff was only the 165 talking. At 76 mph, regular gets the ball up and lets it land softer, which is what you asked for." Chips: "What would stiff do?" · "Is regular less accurate?" |
| **Length** | "From your height and wrist to floor, both measured" | Standard | "You're 181 cm with an 86 cm wrist to floor. That lands right between standard and +0.25 in, so the shorter one wins: easier to control." | **"Length from your height and wrist to floor"**: steps −0.5 in · Standard · +0.25 in · +0.5 in, marker "YOU, RIGHT ON THE LINE" between Standard and +0.25 | Height 181 cm · Wrist to floor 86 cm · Gap to +0.25: 1 mm | Callout **"Why not +0.25?"**: "It would make the set custom, and custom can't be returned. When you're on the line, stock with 30-day returns is the better deal." Button "Show me +0.25 anyway"; Forge "what length really changes" | "Focus: length", "Standard" / "7-iron"; "Full club, measured from the sole to the end of the grip." | "This one's a close call, so I went with standard. You keep your returns, and a quarter inch is hard to feel." Chips: "Will I feel the difference?" · "What if I grow into it?" |
| **Lie** | "From a fitting chart, no strike data yet" (hollow, chart provenance) | Standard 0° | "Your height and wrist to floor point to a standard lie. Your shots start fairly straight, which agrees, but this is the least measured part of your fit." | **"How the sole meets the ground at impact"**: 3 sole diagrams, "2° flat, toe down" · "0°, sole flat" (yours) · "2° up, toe up" | Lie 0° · Start line Straight · Based on Chart | Callout **"Want to be sure?"**: "Draw a line on a ball, hit 5 shots off a mat and photo the marks. Takes 5 minutes." Button "Do the ball-line test" (→ a chat turn that opens `data_import` with the `ball_line` source); Forge "why lie angle matters" | "Focus: lie", "Standard" / "Sole flat"; "Club at address, seen from the front." | "Lie is from the chart, not your shots. If you want, the ball-line test checks it at home in five minutes." Chips: "What does lie change?" · "How do I do the test?" |
| **Grip** | "From your glove size, measured" | Standard size | "A large glove fits a standard grip. Nothing hurts when you play, so there's no reason to go bigger." | **"Glove size to grip size"**: glove tiles S 17 / M 18 / ML 18.5 / L 19 / XL 20 cm, mapped to the bands Undersize · Standard · Midsize; yours (L) highlighted | Glove L · Hand length 19 cm · Anything hurts: Nothing | Forge "grip size and your hands" | "Focus: grip", "Standard" / "Round, no rib"; "Head and shaft dimmed. Drag to rotate." | "Standard grip for a large glove. If your hands ever ache, a midsize takes pressure off. Tell me and I'll swap it." Chips: "What about midsize?" · "Can I pick the colour?" |

**Data mapping:**
- Value, provenance and close-call come from the `why_panel` items and `state.per_part` for the part.
- Stat numbers come from state and evidence (measured shots, body fields), or else from fixtures labelled example.
- The 3D focus uses the existing `ClubStage` `focus` / `highlight` for the part. Without WebGL, fall back to a dimmed `ClubImage`.
