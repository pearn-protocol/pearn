# Submission

Drafts for the NEAR HACKATHON submission (https://nearhackathon.com/HACKATHON.md). Every sentence must stay true of `main` and the live demo. Personal details are never committed: the payload is built from the human's answers at submit time.

## Decided by the human (not filled in here)

Project name, team lead's name, contact email, team size, mainnet NEAR payout account, demo post URL, consent to the contact notice. Repository: `https://github.com/pearn-protocol/pearn` (public).

Suggested tracks: `defi` (yield-backed markets), `social` (DAO-resolved, community-sponsored markets), `open`.

## What they built (paste as `idea`, ≤ 2000 characters)

<!-- IDEA START -->
Problem: in a prediction market the loser loses everything, which keeps most people out.

Pearn is the no-loss prediction market on NEAR: win or lose, your stake comes back. You bet stNEAR (Meta Pool liquid-staked NEAR) on YES or NO, including live Polymarket questions mirrored on testnet. When the market settles, everyone gets their principal's NEAR value back, and the winning side splits the staking yield the whole market earned, plus anything sponsors added.

How NEAR fits in:
- Contracts are Solidity on Aurora, NEAR's EVM.
- The yield is NEAR staking: stNEAR's NEAR value rises every epoch.
- The rate comes from NEAR itself: StNearRateOracle calls get_st_near_price on the Meta Pool contract through Aurora's cross-contract-call precompile and receives the answer in a Solidity callback. No off-chain price feed. The oracle never accepts a lower rate, so payouts never exceed holdings.
- We deployed and run everything without Aurora ETH: transactions are signed at gas price 0 and submitted to the Aurora engine's submit method from a NEAR account. The keeper syncs the rate every 12 hours the same way, with a function-call key limited to aurora.submit.

Design: principal is fixed in NEAR at bet time; winnings are weighted by principal × time left, so late whales can't take early bettors' yield. Each market names its resolver (ideally a DAO); a guardian can only turn an outcome into Invalid within 24 h; anyone can void after 7 days. No owner, no upgrades, rounding can never pay out more than the contract holds.

Live on Aurora testnet, verified on Blockscout: PearnMarkets 0x4659f0d99587D4fA396840d982a4215FcFe8a557, oracle 0xA8adEFE2C8f0F71a585a73c1259997f593F9e463. Site: https://pearn.site, app: https://app.pearn.site, docs: https://docs.pearn.site, plus a Ponder indexer for activity. One demo market ran bet → resolve → claim on testnet. Tests: unit, integration, fuzz, forks of real stNEAR, indexer integration, browser end-to-end bet → resolve → claim.
<!-- IDEA END -->

## Demo post draft (the human posts it)

Attach `apps/video/out/pearn-hook.mp4` (30 s, `apps/video/hook`; the 89 s walkthrough `pearn-demo.mp4` stays on https://pearn.site/pitch/). The post fits X's 280 characters (links count as 23); the reply carries the NEAR details and the code link.

> In most prediction markets the loser loses everything. Pearn is a no-loss one: win or lose, your stake comes back, and winners split the staking yield.
>
> Built at NEAR HACKATHON @NEARProtocol #NEARHackathon
>
> Try it: https://app.pearn.site
>
> What question should we list next?

Reply:

> How NEAR makes it work: bets are stNEAR (Meta Pool's staked NEAR) on Aurora. A Solidity contract reads stNEAR's rate from Meta Pool on NEAR via cross-contract calls, so the yield that pays winners needs no price feed.
>
> Code: https://github.com/pearn-protocol/pearn @NearLegion @NearBuilders
