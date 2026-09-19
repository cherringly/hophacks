# NavAssist — voice + camera navigation helper

Open the site, hold the button, ask something like "where is the door?" —
it takes a photo, sends it + your question to Grok, and speaks the answer
back to you.

## How it works
- `pages/index.js` — camera preview, push-to-talk (Web Speech API for
  speech-to-text), captures a frame to a canvas, POSTs it to `/api/ask`,
  then speaks the response with `speechSynthesis`.
- `pages/api/ask.js` — server-side route that calls Grok's vision model
  (`api.x.ai/v1/chat/completions`) so your API key never reaches the browser.

## 1. Local setup (5 min)
```bash
npm install
cp .env.local.example .env.local
# edit .env.local and paste your real xAI key
npm run dev
```
Open http://localhost:3000. Note: camera + mic require **HTTPS or
localhost** — plain `http://<lan-ip>` won't work on a phone.

## 2. Get an xAI (Grok) API key
https://console.x.ai → API Keys → create one, paste into `.env.local` as
`GROK_API_KEY`.

## 3. Deploy to Vercel (free, gives you HTTPS on a real phone)
```bash
npm i -g vercel
vercel login
vercel
```
When it asks, link/create a new project. Then set the env var:
```bash
vercel env add GROK_API_KEY
vercel env add GROK_MODEL   # value: grok-4.5
vercel --prod
```
Vercel gives you a `https://your-app.vercel.app` URL — open that on your
phone, allow camera + mic permissions, and test.

## 4. Push to your GitHub repo
```bash
git init
git add .
git commit -m "NavAssist: camera + voice navigation assistant"
git branch -M main
git remote add origin <your-empty-repo-url>
git push -u origin main
```
(You can also connect the GitHub repo directly in the Vercel dashboard for
auto-deploys on every push, instead of running `vercel` from the CLI.)

## Notes / limitations
- **Browser support**: `SpeechRecognition` (voice-to-text) works in Chrome
  (desktop + Android) but **not in Safari/iOS**. The app falls back to a
  text input box automatically if it's unsupported — still fully usable,
  just typed instead of spoken.
- **Model**: defaults to `grok-4.5` (vision-capable). If you want something
  cheaper/faster, swap `GROK_MODEL` to `grok-2-vision-1212` in your env vars.
- The answer is capped to ~1 short spoken sentence via the system prompt in
  `pages/api/ask.js` — tune that prompt to change tone/length.
