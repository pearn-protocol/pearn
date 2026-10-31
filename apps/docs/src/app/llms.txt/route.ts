import { source } from "@/lib/source";

export const revalidate = false;

/** Every page as Markdown in one file, for LLM readers and the hackathon's screeners. */
export async function GET() {
	const pages = await Promise.all(
		source.getPages().map(async (page) => {
			const markdown = await page.data.getText("processed");
			return `# ${page.data.title} (${page.url})\n\n${page.data.description ?? ""}\n\n${markdown}`;
		}),
	);
	return new Response(pages.join("\n\n"), {
		headers: { "content-type": "text/plain; charset=utf-8" },
	});
}
