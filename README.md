# Chúc mừng Ngày Phụ nữ Việt Nam 20/10

React/TypeScript recreation of Google Stitch project `9241271036716160551`. The single Stitch screen contains a nine-step interactive greeting, recipient personalization, audio controls, falling petals, and celebration effects.

## Run locally

```sh
npm install
npm run build
cp -n .env.example .env
# Replace all placeholder secrets, then load the environment and start the API server:
set -a; . ./.env; set +a
npm start
# In a second terminal, from the same project directory:
npm run dev
```

The local API expects PostgreSQL at `POSTGRES_HOST`/`POSTGRES_PORT` (default `127.0.0.1:5432`). Start a PostgreSQL 18.4 instance first, or use the Docker deployment below. Vite proxies `/api` to the Node API server on port `4173`.

## Checks

```sh
npm run build
npm run lint
```

## Docker deployment

Create a private environment file from the template and replace every placeholder with a different strong secret (passwords can be generated with `openssl rand -hex 32`; keep `ADMIN_PASSWORD` at least 16 characters and `SESSION_SECRET` at least 32):

```sh
cp .env.example .env
```

Build and run the production container:

```sh
docker compose up --build -d
```

The site is served on port `8080` by default (`WEB_PORT=8081 docker compose up --build -d` changes the host port). PostgreSQL 18.4 data, including visitor events and screen video large objects, is persisted in the private `postgres-data` Docker volume; PostgreSQL is not published on a host port. Check status and logs with `docker compose ps` and `docker compose logs -f web`; stop the service with `docker compose down`. Do not use `docker compose down -v` unless you intend to permanently delete the database.

Visit `/admin` and sign in with `ADMIN_PASSWORD` from `.env` to view/delete events and play/delete stored recordings. Visitor events and screen capture are recorded only after the visitor grants explicit data-consent; screen/microphone access requires a separate browser permission. Events include page, interaction target, selection and submitted form values; form values are recorded on submit, not per keystroke. The app does not intentionally record password fields. Data is retained until deleted by an authenticated administrator. The endpoint enforces same-origin requests, a signed consent cookie, per-IP rate limits, and a 1 GB maximum recording size.

For internet deployment, place the container behind an HTTPS reverse proxy and point a domain to the host. Browser screen capture and microphone permissions require a secure context (HTTPS, or localhost during development). Configure proxy request-size limits and timeouts for large video uploads. If requests pass through a reverse proxy, set `TRUST_PROXY=true` only when that proxy overwrites `X-Forwarded-For`; otherwise leave it false. The production image includes a Node HTTP server for SPA/static delivery, consent-gated event collection, PostgreSQL-backed WebM storage, and authenticated administration.

## Audio

Narration uses the browser's Speech Synthesis API; available Vietnamese voices depend on the user's browser and operating system. Step 1 plays `chao.mp3` followed by `xinphep.mp3`; after both finish, press the share button to open the browser's screen-sharing dialog and grant microphone access, or close the prompt with X to continue without sharing. Browser security requires an explicit click before screen capture can start. The Next button remains disabled until the user either grants screen/microphone access or dismisses the prompt. Recording continues across the story steps; stop sharing in the browser or press "Dừng và lưu" to download a WebM copy and save it in PostgreSQL. The browser cannot guarantee saving or downloading an unfinished recording after its tab is closed, so stop sharing before leaving the page. Step 2 uses `huongdan.mp3`; step 3 plays `gioithieu.mp3`, `gioithieu2.mp3`, then `bamten.mp3`, and shows the full `long.jpg` or `tuan.jpg` image when the matching name is selected; step 4 uses `nhapten.mp3`; step 5 plays `mohopqua.mp3` and lets the recipient open the gift; step 6 uses `loichucai.mp3`; step 7 uses `luachon.mp3` while choosing between Long's and Tuấn's letters; step 8 asks with `hoitamthu.mp3` whether to play the selected letter, then plays `long.mp3` or `tuan.mp3` when requested; step 9 shows the birthday and optional feedback form as soon as `end.mp3` finishes, while `nhacend.mp3` plays afterward. Submitted form responses are saved to PostgreSQL only after the visitor consents. Background music uses looping `nhacnen.mp3` at low volume across pages and continues during narration; it restarts when one second remains in the track. Browser autoplay policy may require the user to start the music manually. Each letter also has an attached video (`x1.mp4` for Long and `x2.mp4` for Tuấn) that opens in an autoplaying modal and closes when playback ends or the close button is clicked. Opening the gift plays a short synthesized pop sound and advances to the greeting. Selecting a founder avatar plays `layanh.mp3` once after a short delay, with a replay button on the avatar.

Step 4 currently accepts `Nguyên` (case-insensitive, but accents are significant). Entering `Long` or `Tuấn` plays `lailamay.mp3` and does not continue the flow; other names outside the list play `saiten.mp3`.
