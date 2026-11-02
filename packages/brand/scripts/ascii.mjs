// Renders the white burst of the logo as ASCII glyphs into mark.txt (the landing's hero).
// Each cell's glyph is picked by how much of it the burst covers. Run after the logo changes:
//   node packages/brand/scripts/ascii.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const SRC = new URL("../android-chrome-512x512.png", import.meta.url);
const OUT = new URL("../mark.txt", import.meta.url);
/** Glyph cells are 2:3 like the monospace font, so the mark keeps its proportions. */
const CELL_W = 4;
const CELL_H = 6;
const RAMP = " .:-=+*xXNMB";
/**
 * The burst is translucent white, so near the pale bottom of the tile it is only a little
 * lighter than its surroundings: a pixel is part of it when it is CONTRAST brighter than the
 * mean of the BOX × BOX square around it.
 */
const BOX = 61;
const CONTRAST = 14;
/** The burst sits inside this inset; outside it the tile's rounded edge would read as contrast. */
const INSET = 72;

/** The PNG's size and its concatenated IDAT stream; we ship one 8-bit RGBA, non-interlaced PNG. */
function readChunks(buf) {
	let pos = 8;
	let width = 0;
	let height = 0;
	const idat = [];
	while (pos < buf.length) {
		const len = buf.readUInt32BE(pos);
		const type = buf.toString("ascii", pos + 4, pos + 8);
		const data = buf.subarray(pos + 8, pos + 8 + len);
		if (type === "IHDR") {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);
			if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error("need 8-bit RGBA");
		} else if (type === "IDAT") idat.push(data);
		pos += 12 + len;
	}
	return { width, height, raw: inflateSync(Buffer.concat(idat)) };
}

const paeth = (a, b, c) => {
	const p = a + b - c;
	const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
	return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Undoes the per-row PNG filters (4 bytes per pixel). */
function decodePng(buf) {
	const { width, height, raw } = readChunks(buf);
	const stride = width * 4;
	const px = Buffer.alloc(stride * height);
	for (let y = 0; y < height; y++) {
		const filter = raw[y * (stride + 1)];
		for (let x = 0; x < stride; x++) {
			const a = x >= 4 ? px[y * stride + x - 4] : 0;
			const b = y > 0 ? px[(y - 1) * stride + x] : 0;
			const c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4] : 0;
			const pred = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter];
			px[y * stride + x] = (raw[y * (stride + 1) + 1 + x] + pred) & 0xff;
		}
	}
	return { width, height, px };
}

const { width, height, px } = decodePng(readFileSync(SRC));
const lum = new Float64Array(width * height);
for (let i = 0; i < lum.length; i++) lum[i] = (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3;
// Summed-area table, so each box mean is four lookups.
const sat = new Float64Array((width + 1) * (height + 1));
for (let y = 0; y < height; y++)
	for (let x = 0; x < width; x++)
		sat[(y + 1) * (width + 1) + x + 1] =
			lum[y * width + x] +
			sat[y * (width + 1) + x + 1] +
			sat[(y + 1) * (width + 1) + x] -
			sat[y * (width + 1) + x];
const boxMean = (x, y) => {
	const r = BOX >> 1;
	const [x0, y0] = [Math.max(0, x - r), Math.max(0, y - r)];
	const [x1, y1] = [Math.min(width, x + r + 1), Math.min(height, y + r + 1)];
	const w = width + 1;
	const sum = sat[y1 * w + x1] - sat[y0 * w + x1] - sat[y1 * w + x0] + sat[y0 * w + x0];
	return sum / ((x1 - x0) * (y1 - y0));
};
const isMark = (x, y) =>
	x >= INSET &&
	y >= INSET &&
	x < width - INSET &&
	y < height - INSET &&
	lum[y * width + x] - boxMean(x, y) > CONTRAST;

const rows = [];
for (let cy = 0; cy + CELL_H <= height; cy += CELL_H) {
	let row = "";
	for (let cx = 0; cx + CELL_W <= width; cx += CELL_W) {
		let hit = 0;
		for (let y = cy; y < cy + CELL_H; y++)
			for (let x = cx; x < cx + CELL_W; x++) hit += +isMark(x, y);
		row += RAMP[Math.round((hit / (CELL_W * CELL_H)) * (RAMP.length - 1))];
	}
	rows.push(row);
}

// Crop to the burst.
const used = rows.map((r) => r.trim() !== "");
const top = used.indexOf(true);
const bottom = used.lastIndexOf(true);
const lefts = rows.filter((r) => r.trim()).map((r) => r.search(/\S/));
const left = Math.min(...lefts);
const right = Math.max(...rows.map((r) => r.trimEnd().length));
const art = rows.slice(top, bottom + 1).map((r) => r.slice(left, right).trimEnd());
writeFileSync(OUT, `${art.join("\n")}\n`);
console.log(`mark.txt: ${right - left} × ${art.length} glyphs`);
