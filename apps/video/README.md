# @pearn/video

The demo video at https://pearn.site/pitch/ (89 s, voiced). Every frame of product is a real headless-Chrome recording; the only drawn frames are the opening and closing cards and the caption bands.

```sh
pnpm --filter @pearn/video capture   # footage/*.mp4: live pearn.site, the app on a local chain, live testnet proof (~2 min)
pnpm --filter @pearn/video voice     # voice/*.mp3: ElevenLabs voiceover per shot (ELEVENLABS_API_KEY in .env)
pnpm --filter @pearn/video render    # out/pearn-demo.mp4, 1920×1230, hard cuts, voiceover from voice/ when present
cp apps/video/out/pearn-demo.mp4 apps/landing/src/assets/pitch.mp4   # publish it on /pitch/
```

- `src/cut.mjs` is the whole cut: shot order, captions, cards. Every caption must stay true of `main` and the live deployment.
- Each caption band says where its shot was recorded: **Live · Aurora testnet** or **Local chain · the same app**. A live bet needs Aurora ETH and a funded wallet, so bet → resolve → claim is recorded on the e2e stack (anvil + DevChain + the real app build, `apps/web/e2e/stack.mjs`); the same lifecycle on testnet is shown by its claim transaction on Blockscout.
- Bands and cards are HTML rendered by Chrome in the sites' type and colours (`packages/brand/tokens.css`, JetBrains Mono); ffmpeg only stacks and joins, so no ffmpeg text filters are needed.
- Needs Foundry, Chrome and ffmpeg. `footage/` and `out/` are gitignored.

## Hook video (30 s)

`hook/` is a short hook film for the X post, made with [HyperFrames](https://hyperframes.heygen.com) (HTML rendered to MP4): hook → the old way → the real app (home, market grid, the Fed market, its bet panel) → how settlement pays → end card. The app screens in `hook/assets/` are 2× captures of app.pearn.site on 2026-11-14; the payout diagram is drawn because it has no screen of its own. Voice, effects and the music bed are ElevenLabs (voice "George", sound generation).

```sh
cd apps/video/hook
npm run check    # lint, layout, motion, contrast
npm run render   # out/pearn-hook.mp4, 1920×1080, 30 fps, loudness-normalised to -15 LUFS
```
