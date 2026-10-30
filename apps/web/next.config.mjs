/** @type {import('next').NextConfig} */
export default {
	// Static export: the browser talks to Aurora RPC and the wallet directly, no Next server.
	output: "export",
	trailingSlash: true,
	images: { unoptimized: true },
	devIndicators: false,
};
