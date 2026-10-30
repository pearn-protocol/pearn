import { chain } from "@/lib/config";

export default function NotDeployed() {
	return (
		<div className="card notice">
			<h2>Contracts not deployed yet</h2>
			<p className="muted">
				Pearn's contracts are not live on {chain.name} yet. This page fills in as soon as they are.
			</p>
		</div>
	);
}
