// Voices every shot's `say` line with ElevenLabs into voice/<name>.mp3, for scripts/render.mjs.
// A line is only sent again when its text, voice or model changed (voice/<name>.json records them).
// Usage: pnpm voice   (ELEVENLABS_API_KEY in the repo's .env; ELEVENLABS_VOICE_ID picks the voice)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cut } from "../src/cut.mjs";

const VOICE = fileURLToPath(new URL("../voice/", import.meta.url));
const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error("ELEVENLABS_API_KEY is not set (put it in the repo's .env)");
const spec = {
	voice: process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb", // "George", a premade voice
	model: "eleven_multilingual_v2",
};

mkdirSync(VOICE, { recursive: true });
for (const shot of cut.filter((s) => s.say)) {
	const want = JSON.stringify({ ...spec, text: shot.say });
	const meta = join(VOICE, `${shot.name}.json`);
	if (existsSync(meta) && readFileSync(meta, "utf8") === want) {
		console.log(`${shot.name}: cached`);
		continue;
	}
	const r = await fetch(
		`https://api.elevenlabs.io/v1/text-to-speech/${spec.voice}?output_format=mp3_44100_128`,
		{
			method: "POST",
			headers: { "xi-api-key": key, "content-type": "application/json" },
			body: JSON.stringify({ text: shot.say, model_id: spec.model }),
		},
	);
	if (!r.ok) throw new Error(`${shot.name}: ElevenLabs answered ${r.status} ${await r.text()}`);
	writeFileSync(join(VOICE, `${shot.name}.mp3`), Buffer.from(await r.arrayBuffer()));
	writeFileSync(meta, want);
	console.log(`${shot.name}: voiced`);
}
