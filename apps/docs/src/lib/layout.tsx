import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";

export const APP_URL = "https://pearn.103.150.190.91.sslip.io";
export const REPO_URL = "https://github.com/pearn-protocol/pearn";

export const baseOptions: BaseLayoutProps = {
	nav: {
		title: (
			<>
				<Image alt="" height={24} src="/apple-touch-icon.png" width={24} />
				Pearn
			</>
		),
		url: "/docs/",
	},
	githubUrl: REPO_URL,
	links: [{ text: "App", url: APP_URL, external: true }],
};
