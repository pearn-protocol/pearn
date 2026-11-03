# @pearn/video

The demo video at https://pearn.site/pitch/ (83 s). Every frame of product is a real headless-Chrome recording; the only drawn frames are the opening and closing cards and the caption bands.

```sh
pnpm --filter @pearn/video capture   # footage/*.mp4: live pearn.site, the app on a local chain, live testnet proof (~2 min)
pnpm --filter @pearn/video render    # out/pearn-demo.mp4, 1920×1230, hard cuts, no audio
cp apps/video/out/pearn-demo.mp4 apps/landing/src/assets/pitch.mp4   # publish it on /pitch/
```

- `src/cut.mjs` is the whole cut: shot order, captions, cards. Every caption must stay true of `main` and the live deployment.
- Each caption band says where its shot was recorded: **Live · Aurora testnet** or **Local chain · the same app**. A live bet needs Aurora ETH and a funded wallet, so bet → resolve → claim is recorded on the e2e stack (anvil + DevChain + the real app build, `apps/web/e2e/stack.mjs`); the same lifecycle on testnet is shown by its claim transaction on Blockscout.
- Bands and cards are HTML rendered by Chrome in the sites' type and colours (`packages/brand/tokens.css`, JetBrains Mono); ffmpeg only stacks and joins, so no ffmpeg text filters are needed.
- Needs Foundry, Chrome and ffmpeg. `footage/` and `out/` are gitignored.
