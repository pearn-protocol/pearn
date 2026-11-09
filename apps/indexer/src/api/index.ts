import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { graphql } from "ponder";

const app = new Hono();

// Read-only public data; the web app is a static site on another origin. GraphQL only: Ponder's
// /sql client lets anyone run arbitrary joins against the in-process PGlite, which stalls indexing.
app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST"] }));
// The host nginx already sends HSTS and nosniff; the rest comes from here. Other sites read this
// API, so resources stay cross-origin.
app.use(
	"*",
	secureHeaders({
		strictTransportSecurity: false,
		xContentTypeOptions: false,
		xFrameOptions: "DENY",
		crossOriginResourcePolicy: "cross-origin",
		crossOriginEmbedderPolicy: false,
	}),
);
app.use("/graphql", graphql({ db, schema }));

export default app;
