# Freeze-Night Checklist

- Freeze merges to `main` at Sun 05:00 EET.
- Manual bug bash on prod: 4 personas + 2 own fittings (one scripted, one live).
- Tag the final revision `demo-final`.
- Set `DEPLOY_ENABLED=false` at 06:00 EET.
- Run `just smoke <prod-url>` on the tagged revision.
- Note: every push to main redeploys and wipes memory sessions and the daily-cap counter.
