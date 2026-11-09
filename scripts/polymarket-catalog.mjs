// Picks Polymarket markets to mirror as Pearn markets and writes them to packages/catalog:
// markets.json (question, topic, Polymarket slug, close time) and images/<conditionId prefix>.jpg (112 px,
// served from our own origin). Entries already in the catalog are kept as they are; new ones get
// `id: null` until scripts/polymarket-seed.mjs creates them on chain.
//
//   node scripts/polymarket-catalog.mjs [count]   (default 12 new markets; macOS: needs sips)
//
// Picks: open markets with outcomes exactly ["Yes", "No"], ending between 3 days from now and
// the end of 2027, Yes between 4% and 96%, one per event and at most 2 per topic, no death or
// violence markets. Betting here closes at Polymarket's end date; the keeper resolves the
// market once Polymarket (UMA) has settled it (scripts/polymarket-resolve.mjs).
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const GAMMA = "https://gamma-api.polymarket.com";
const root = new URL("../packages/catalog/", import.meta.url).pathname;
const FILE = join(root, "markets.json");
const COUNT = Number(process.argv[2] ?? 12);
/** PearnMarkets.MAX_QUESTION_LENGTH. */
const MAX_QUESTION = 280;

const SKIP =
	/\b(die|dies|death|dead|kill|killed|assassinat\w*|war|invade\w*|invasion|strikes?|military|clash|attack\w*|nuclear|bomb\w*|missile|hostage|ceasefire|disarm|out as|out before|out by|regime|leader|jesus|pandemic)\b/i;
const TOPICS = [
	["Crypto", /^(crypto|bitcoin|ethereum)$/i],
	["Sports", /^sports$/i],
	["Economy", /^(economy|fed|finance|business)$/i],
	["Tech", /^(tech|ai|big tech)$/i],
	["Science", /^(science|climate & science|weather)$/i],
	["Culture", /^culture$/i],
	["World", /^(geopolitics|world)$/i],
	["Politics", /^politics$/i],
];
const topic = (tags) => TOPICS.find(([, re]) => tags.some((t) => re.test(t.label)))?.[0];

async function json(url) {
	const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
	if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
	return r.json();
}

const list = (s) => JSON.parse(s ?? "[]");
const binary = (m) => JSON.stringify(list(m.outcomes)) === '["Yes","No"]';
const yes = (m) => Number(list(m.outcomePrices)[0]);

/** The first paragraph of a Polymarket description, up to ~400 characters. */
function rules(m) {
	const first = (m.description ?? "").split(/\n+/).map((s) => s.replace(/\s+/g, " ").trim())[0];
	if (first.length <= 400) return first;
	// Cut at the last space before 397 characters, so no word is split.
	const cut = first.slice(0, 397);
	const space = cut.lastIndexOf(" ");
	return `${space > 0 ? cut.slice(0, space) : cut}…`;
}

/** Downloads, crops to a 112 px square JPEG with sips. */
function image(buf, id) {
	const dir = mkdtempSync(join(tmpdir(), "pearn-img-"));
	const src = join(dir, "src");
	writeFileSync(src, buf);
	const size = (k) =>
		Number(execFileSync("sips", ["-g", k, src], { encoding: "utf8" }).match(/: (\d+)/)[1]);
	const side = size("pixelWidth") > size("pixelHeight") ? "--resampleHeight" : "--resampleWidth";
	const name = `${id.slice(2, 12)}.jpg`;
	execFileSync("sips", [side, "112", src, "--out", join(dir, "r.png")], { stdio: "ignore" });
	execFileSync(
		"sips",
		[
			"-c",
			"112",
			"112",
			"-s",
			"format",
			"jpeg",
			"-s",
			"formatOptions",
			"75",
			join(dir, "r.png"),
		].concat(["--out", join(root, "images", name)]),
		{ stdio: "ignore" },
	);
	return name;
}

const catalog = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : [];
const have = new Set(catalog.map((c) => c.slug));
const now = Date.now();
const min = new Date(now + 3 * 86_400e3).toISOString();
const max = "2027-12-31T23:59:59Z";
const events = [];
for (let offset = 0; offset < 300; offset += 100)
	events.push(
		...(await json(
			`${GAMMA}/events?active=true&closed=false&order=volume&ascending=false&limit=100&offset=${offset}&end_date_min=${min}&end_date_max=${max}`,
		)),
	);

const perTopic = new Map();
for (const c of catalog) perTopic.set(c.topic, (perTopic.get(c.topic) ?? 0) + 1);
let added = 0;
for (const e of events) {
	if (added >= COUNT) break;
	const t = topic(e.tags ?? []);
	if (!t || (perTopic.get(t) ?? 0) >= 2) continue;
	if (SKIP.test(e.title) || (e.tags ?? []).some((x) => SKIP.test(x.label))) continue;
	const m = (e.markets ?? [])
		.filter((x) => !x.closed && binary(x) && x.endDate && x.question.length <= MAX_QUESTION)
		.filter((x) => yes(x) >= 0.04 && yes(x) <= 0.96 && !SKIP.test(x.question))
		.filter((x) => x.endDate >= min && x.endDate <= max && !have.has(x.slug))
		.sort((a, b) => b.volumeNum - a.volumeNum)[0];
	if (!m) continue;
	const r = await fetch(m.image || m.icon || e.image, { signal: AbortSignal.timeout(20_000) });
	if (!r.ok) continue;
	catalog.push({
		id: null,
		slug: m.slug,
		conditionId: m.conditionId,
		question: m.question,
		topic: t,
		image: image(Buffer.from(await r.arrayBuffer()), m.conditionId),
		closeTime: Math.floor(Date.parse(m.endDate) / 1000),
		rules: rules(m),
	});
	perTopic.set(t, (perTopic.get(t) ?? 0) + 1);
	added++;
	console.log(`${t}: ${m.question} (${(yes(m) * 100).toFixed(0)}% Yes, ends ${m.endDate})`);
}
writeFileSync(FILE, `${JSON.stringify(catalog, null, "\t")}\n`);
console.log(`${added} added, ${catalog.length} in the catalog`);
