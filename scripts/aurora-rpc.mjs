// Local JSON-RPC proxy for Aurora. Foundry passes a block hash as a bare string
// ("0x…64 hex"), which Aurora rejects as malformed; Aurora only takes the EIP-1898
// object form. This rewrites that one parameter and forwards everything else unchanged.
//
//   node scripts/aurora-rpc.mjs testnet 8546   →  forge … --fork-url http://127.0.0.1:8546
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const UPSTREAM = {
	mainnet: "https://mainnet.aurora.dev",
	testnet: "https://testnet.aurora.dev",
};
const BLOCK_HASH = /^0x[0-9a-fA-F]{64}$/;

/** Rewrites a trailing bare block-hash parameter into `{ blockHash }`. */
export function fixRequest(request) {
	const params = request.params;
	if (!Array.isArray(params) || params.length < 2) return request;
	const last = params.at(-1);
	if (typeof last !== "string" || !BLOCK_HASH.test(last)) return request;
	return { ...request, params: [...params.slice(0, -1), { blockHash: last }] };
}

/** Serves the proxy for `network` on 127.0.0.1:`port`. */
export function serve(network, port) {
	const upstream = UPSTREAM[network];
	if (!upstream) {
		throw new Error(`unknown network "${network}", expected: ${Object.keys(UPSTREAM).join(", ")}`);
	}
	const server = createServer(async (req, res) => {
		const chunks = [];
		for await (const chunk of req) chunks.push(chunk);
		const body = JSON.parse(Buffer.concat(chunks).toString());
		const fixed = Array.isArray(body) ? body.map(fixRequest) : fixRequest(body);
		const reply = await fetch(upstream, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(fixed),
		});
		res.writeHead(reply.status, { "content-type": "application/json" });
		res.end(await reply.text());
	});
	server.listen(Number(port), "127.0.0.1", () => {
		console.log(`aurora ${network} rpc on http://127.0.0.1:${port} → ${upstream}`);
	});
	return server;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	const [network = "testnet", port = "8546"] = process.argv.slice(2);
	serve(network, port);
}
