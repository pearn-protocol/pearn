"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "./ConnectButton";

const NAV = [
	{ href: "/", label: "Markets" },
	{ href: "/create/", label: "Create" },
	{ href: "/portfolio/", label: "Portfolio" },
];

export default function Topbar() {
	const path = usePathname();
	return (
		<header className="topbar">
			<Link className="brand" href="/">
				<Image alt="" height={32} priority src="/apple-touch-icon.png" width={32} />
				Pearn
			</Link>
			<nav>
				{NAV.map((n) => (
					<Link aria-current={path === n.href ? "page" : undefined} href={n.href} key={n.href}>
						{n.label}
					</Link>
				))}
			</nav>
			<ConnectButton />
		</header>
	);
}
