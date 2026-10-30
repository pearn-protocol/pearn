import type { Metadata } from "next";
import CreateForm from "@/components/create/CreateForm";

export const metadata: Metadata = { title: "Create a market" };

export default function CreatePage() {
	return (
		<main className="page narrow">
			<h1>Create a market</h1>
			<p className="muted">
				Anyone can create a market. Pick a resolver you trust to report the outcome, ideally a DAO.
				The guardian can still turn a wrong outcome into Invalid for 24 hours.
			</p>
			<CreateForm />
		</main>
	);
}
