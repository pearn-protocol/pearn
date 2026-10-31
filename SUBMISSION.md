# Submission

Drafts for the NEAR HACKATHON submission (https://nearhackathon.com/HACKATHON.md). Every sentence must stay true of `main` and the live demo. Personal details are never committed: the payload is built from the human's answers at submit time.

## Decided by the human (not filled in here)

Project name, team lead's name, contact email, team size, mainnet NEAR payout account, demo post URL, consent to the contact notice. Repository: `https://github.com/pearn-protocol/pearn` (public).

Suggested tracks: `defi` (yield-backed markets), `social` (DAO-resolved, community-sponsored markets), `open`.

## What they built (paste as `idea`, ≤ 2000 characters)

<!-- IDEA START -->
Problem: in a prediction market the loser loses everything, which keeps most people out.

Pearn is a no-loss prediction market on NEAR. You bet stNEAR (Meta Pool liquid-staked NEAR) on YES or NO. When the market settles, everyone gets their principal's NEAR value back, and the winning side splits the staking yield the whole market earned, plus anything sponsors added. Bet the interest, keep the money.

How NEAR fits in:
- Contracts are Solidity on Aurora, NEAR's EVM.
- The yield is NEAR staking: stNEAR's NEAR value rises every epoch.
- The rate comes from NEAR itself: StNearRateOracle calls get_st_near_price on the Meta Pool contract through Aurora's cross-contract-call precompile and receives the answer in a Solidity callback. No off-chain price feed. The rate never decreases, which keeps principal safe.
- We deployed and run everything without Aurora ETH: transactions are signed at gas price 0 and submitted to the Aurora engine's submit method from a NEAR account. The keeper syncs the rate every 12 hours the same way, with a function-call key limited to aurora.submit.

Design: principal is fixed in NEAR at bet time; winnings are weighted by principal × time left, so late whales can't take early bettors' yield. Each market names its resolver (ideally a DAO); a guardian can only turn an outcome into Invalid within 24 h; anyone can void after 7 days. No owner, no upgrades, rounding can never pay out more than the contract holds.

Live on Aurora testnet, verified on Blockscout: PearnMarkets 0x4659f0d99587D4fA396840d982a4215FcFe8a557, oracle 0xA8adEFE2C8f0F71a585a73c1259997f593F9e463. App: https://pearn.103.150.190.91.sslip.io. Tests: unit, integration, fuzz, forks of real stNEAR, and browser end-to-end bet → resolve → claim.
<!-- IDEA END -->

## Demo post draft (the human posts it)

> Lose a prediction market bet and you lose your money. On Pearn you only bet the staking yield; your NEAR comes back either way.
>
> Built at #NEARHackathon on @NEARProtocol: stNEAR bets on Aurora, with the rate read from Meta Pool on NEAR by a Solidity contract through cross-contract calls. No price feed.
>
> Try it on testnet: https://pearn.103.150.190.91.sslip.io
> Code: https://github.com/pearn-protocol/pearn
>
> Which market would you bet your yield on?

Attach the demo video: open a market → bet stNEAR → see "principal safe, projected winnings" → a settled market → claim principal + winnings.
