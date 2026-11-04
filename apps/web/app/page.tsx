import { readFileSync } from "node:fs";
import { join } from "node:path";
import Home from "@/components/markets/Home";

// The ASCII mark is read at build time (static export), so it is in the HTML, not the bundle.
// Builds run in apps/web.
const mark = readFileSync(join(process.cwd(), "../../packages/brand/mark.txt"), "utf8");

export default function Page() {
	return (
		<main className="page home">
			<Home mark={mark} />
		</main>
	);
}
