export default function Hero() {
	return (
		<section className="hero">
			<h1>Bet the yield. Keep the NEAR.</h1>
			<p>
				Pearn is a no-loss prediction market on NEAR. You stake stNEAR on YES or NO. When the market
				settles everyone gets their principal back, and the winning side splits the staking yield of
				the whole market, plus anything sponsors added.
			</p>
			<ol className="steps">
				<li>
					<b>Bet stNEAR</b> on an outcome. Its NEAR value is locked in as your principal.
				</li>
				<li>
					<b>Yield accrues</b> while the market runs. Earlier bets weigh more.
				</li>
				<li>
					<b>Claim</b> your principal, plus a share of the pot if you were right.
				</li>
			</ol>
		</section>
	);
}
