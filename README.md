# Chúc mừng Ngày Phụ nữ Việt Nam 20/10

React/TypeScript recreation of Google Stitch project `9241271036716160551`. The single Stitch screen contains a nine-step interactive greeting, recipient personalization, audio controls, falling petals, and celebration effects.

## Run locally

```sh
npm install
npm run dev
```

## Checks

```sh
npm run build
npm run lint
```

## Audio

Narration uses the browser's Speech Synthesis API; available Vietnamese voices depend on the user's browser and operating system. Step 1 plays `chao.mp3` followed by `xinphep.mp3`; after both finish, press the share button to open the browser's screen-sharing dialog and grant microphone access, or close the prompt with X to continue without sharing. Browser security requires an explicit click before screen capture can start. The Next button remains disabled until the user either grants screen/microphone access or dismisses the prompt. Recording continues across the story steps; stop sharing in the browser or press "Dừng và lưu" to download a WebM copy and save another copy into the project root's `assets/output` folder through the Vite dev/preview server. The browser cannot guarantee saving or downloading an unfinished recording after its tab is closed, so stop sharing before leaving the page. Step 2 uses `huongdan.mp3`; step 3 plays `gioithieu.mp3`, `gioithieu2.mp3`, then `bamten.mp3`, and shows the full `long.jpg` or `tuan.jpg` image when the matching name is selected; step 4 uses `nhapten.mp3`; step 5 plays `mohopqua.mp3` and lets the recipient open the gift; step 6 uses `loichucai.mp3`; step 7 uses `luachon.mp3` while choosing between Long's and Tuấn's letters; step 8 asks with `hoitamthu.mp3` whether to play the selected letter, then plays `long.mp3` or `tuan.mp3` when requested; step 9 shows the birthday and optional feedback form as soon as `end.mp3` finishes, while `nhacend.mp3` plays afterward. Form responses remain in browser memory and are not sent to a backend. Background music uses looping `nhacnen.mp3` at low volume across pages and continues during narration; it restarts when one second remains in the track. Browser autoplay policy may require the user to start the music manually. Each letter also has an attached video (`x1.mp4` for Long and `x2.mp4` for Tuấn) that opens in an autoplaying modal and closes when playback ends or the close button is clicked. Opening the gift plays a short synthesized pop sound and advances to the greeting. Selecting a founder avatar plays `layanh.mp3` once after a short delay, with a replay button on the avatar.

Step 4 currently accepts `Nguyên` (case-insensitive, but accents are significant). Entering `Long` or `Tuấn` plays `lailamay.mp3` and does not continue the flow; other names outside the list play `saiten.mp3`.
