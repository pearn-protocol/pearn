import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

// Built once into a static index for the static export.
export const revalidate = false;
export const { staticGET: GET } = createFromSource(source);
