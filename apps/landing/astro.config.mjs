import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://pearn.103.150.190.91.sslip.io",
	devToolbar: { enabled: false },
	// One page: inline its CSS so first paint needs no second round trip. The CSP allows it by hash.
	build: { inlineStylesheets: "always" },
});
