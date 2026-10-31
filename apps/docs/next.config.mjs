import { createMDX } from "fumadocs-mdx/next";

/** @type {import('next').NextConfig} */
const config = {
	// Static export served by Caddy like apps/web; search runs from a prebuilt index.
	output: "export",
	trailingSlash: true,
	images: { unoptimized: true },
	devIndicators: false,
};

export default createMDX()(config);
