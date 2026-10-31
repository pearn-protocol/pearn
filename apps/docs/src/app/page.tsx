import { redirect } from "next/navigation";

/** Readers come for the docs; the root lands on the first page. */
export default function Home() {
	redirect("/docs/");
}
