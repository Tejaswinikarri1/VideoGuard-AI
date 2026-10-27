# Design QA harness (development tool, not part of the product)
Renders every screen at the mockups' size (1672x941) with headless Chromium, answering `/api/v1/*` inside the browser with fixture data
shaped like the mockups, so you can compare the UI against your screenshots without a backend.
```
cd design-qa && npm init -y && npm i puppeteer-core @sparticuz/chromium
# terminal 1: cd ../frontend && npm run dev      terminal 2:
node shots.mjs '[{"name":"dashboard","path":"/dashboard"},{"name":"login","path":"/login","auth":false}]'
```
`shots.mjs` expects `/home/claude/samples/bus.jpg` and `/home/claude/qa/clip.webm`; edit those two paths (any JPEG + short WebM).
`screenshots/` holds the last renders produced by the author.
