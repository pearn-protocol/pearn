import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { client, graphql } from "ponder";

const app = new Hono();

// Read-only public data; the web app is a static site on another origin.
app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST"] }));
app.use("/sql/*", client({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

export default app;
