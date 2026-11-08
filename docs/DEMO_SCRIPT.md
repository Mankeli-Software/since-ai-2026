# Demo script and submission checklist (#127)

How we submit on Sunday 8 Nov, following plan **L28** and the client's c14 request. The per-take
screens and voice-over are in [`video_script.md`](video_script.md) (the 90-second cut, #53). This file
adds the **access, ZIP and video steps** and the **fitter review** post.

Deadlines (L4): code freeze **06:00**, everything submitted by **08:00**, hard cutoff **10:00** EET.

---

## 1. Checklist

Tick each box in #127 as it is done. The issue is done when every box is ticked.

**Tonight (Sat)**
- [ ] **Lead confirms the repo rule** on the hackathon platform. The organiser rules say public;
      Takomo asked for private (c14 L174). L28 assumes private unless the platform says otherwise.
- [ ] **Invite Jonas's GitHub user** (posted on Discord) as a **read** collaborator:
      repo Settings → Collaborators → Add people → role *Read*. The repo is already private; today
      its only collaborators are `harmittaa` and `Juhok1`.
- [ ] **Post the four persona results** to Jonas and the fitter on Discord (section 4). Quote the
      reply in the write-up.

**At the freeze (Sun 06:00)**
- [ ] No more merges to `main` (each merge redeploys prod and wipes open sessions).
- [ ] Tag the freeze commit and push the tag: `git tag demo-final origin/main && git push origin demo-final`.
- [ ] Build the ZIP (section 3). Open it and check that `data/` is missing and the predictions CSV is there.

**Video (Sun 06:00–07:30)**
- [ ] Re-walk the newcomer and Mikko segments of [`video_script.md`](video_script.md) on prod and
      correct anything that changed.
- [ ] Record against [`video_script.md`](video_script.md) (section 2), at 1440×900, on the hosted URL.
- [ ] Upload to YouTube as **Unlisted**, link it from the README, and open the link in a
      logged-out private window.

**Submit (by 08:00)**
- [ ] Platform entry: repo link, ZIP, video link, predictions CSV, slides and the write-up (L19).
- [ ] Jonas can open the repo (ask him on Discord, or check the invite shows *accepted*).

---

## 2. Video cut: 90 seconds

The cut, shot by shot, is in [`video_script.md`](video_script.md): a newcomer's own fitting and Mikko,
then the roadmap. It replaces the earlier 2:30 plan (Mikko, Hannu, Anders) and the old shot list.

- Keep the **"Simulated golfer"** badge in frame; all data is synthetic (L6). Don't call the fit
  "validated by Takomo" unless the fitter review in section 4 says so.

---

## 3. ZIP

Build it from the freeze tag so it matches the code in the video:

```sh
git fetch origin --tags
git archive --format=zip -o mankeli-takomo-fitter-studio.zip demo-final -- . ':(exclude)data' ':(exclude)generated'
unzip -l mankeli-takomo-fitter-studio.zip | grep -c ' data/'   # must print 0
```

- `data/` is the organiser pack and stays out (licences). `generated/` is gitignored anyway.
- The predictions CSV `mankeli_takomo_test_predictions.csv` (5,000 rows) is tracked at the repo
  root, so it is in the ZIP. Upload it on its own as well.
- Expect about **70 MB**, mostly the product videos in `web/public/takomo/video/`. If the platform
  has a size limit, also exclude `web/public/takomo/video` and say so in the README.

---

## 4. Fitter review post (Discord, tonight)

Send this to Jonas and the fitter with screenshots of each persona's R1 result. Edit the numbers if
the re-walk changes them.

> Hi Jonas! Here are our four simulated golfers and what the studio recommends. All the shot data is
> synthetic: we had no real TrackMan sessions.
>
> - **Mikko**: claims 160 yd with his 7-iron, measures 124.7 yd → regular flex, 201T MKII (runner-up 201 MKII, same shaft), lie +3 from test-club shots.
> - **Hannu**: only an at-home ball-line test → lie is a close call, so we send him to a simulator instead of selling custom.
> - **Lars**: 301 CB vs 301 MB is a close call; we show both with the trade-off.
> - **Anders**: +1° lie from test-club shots → we show stock (30-day return) next to custom (no return).
>
> Three questions:
> 1. Would a fitter agree with these?
> 2. What is your real rule for recommending stock over custom?
> 3. Is there a real "most sold" fact we may quote?

Paste the reply (or a short quote, with permission) into the write-up.
