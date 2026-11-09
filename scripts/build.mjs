// Builds dist/: the library (timecrunchy.js), the <zone-calculator> element as a classic script, the standalone page
// and the static API (v1/*.json and v1/zwo/<plan>/<ride>.zwo).
import { build } from 'esbuild';
import { mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const banner = `/*! timecrunchy ${pkg.version} · ${pkg.homepage} · MIT License · generated, do not edit */`;

await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'v1', 'plans'), { recursive: true });

await build({ entryPoints: [join(root, 'src/index.js')], bundle: true, format: 'esm', target: 'es2022', outfile: join(out, 'timecrunchy.js'), banner: { js: banner }, legalComments: 'none' });
await build({ entryPoints: [join(root, 'src/calculator.js')], bundle: true, format: 'iife', target: 'es2022', outfile: join(out, 'zone-calculator.js'), banner: { js: banner }, legalComments: 'none' });
const css = await readFile(join(root, 'src/zone-calculator.css'), 'utf8');
await writeFile(join(out, 'zone-calculator.css'), `/*! timecrunchy ${pkg.version} · generated, do not edit */\n${css}`);
await copyFile(join(root, 'site/site.css'), join(out, 'site.css'));
const page = await readFile(join(root, 'site/index.html'), 'utf8');
await writeFile(join(out, 'index.html'), page.replace('<span id="version"></span>', `<span id="version">version ${pkg.version}</span>`));

// API
const lib = await import(join(root, 'src/index.js'));
const { ZONES, FTP_SHARE, THRESHOLD_HEART_SHARE, powerShare, heartShare, buildLibrary, ERG, ERG_RANGE, CADENCE, PFPI_SLOPE } = lib;
const json = (value) => `${JSON.stringify(value, null, '\t')}\n`;
const meta = { version: pkg.version, api: 'v1', source: pkg.homepage };
await writeFile(
	join(out, 'v1', 'zones.json'),
	json({
		...meta,
		note: 'power and heart: share of FTP and of threshold heart rate; PI has no upper limit. book: shares of the book’s 8-minute test.',
		zones: ZONES.map((z) => ({ id: z.id, name: z.name, power: z.power.map((s) => Number(powerShare(s).toFixed(4))), heart: z.heart.map((s) => Number(heartShare(s).toFixed(4))), book: { power: z.power, heart: z.heart } })),
		ftpShare: FTP_SHARE,
		thresholdHeartShare: THRESHOLD_HEART_SHARE,
		erg: ERG,
		ergRange: ERG_RANGE,
		cadence: CADENCE,
		pfpiSlope: PFPI_SLOPE,
	}),
);
const library = buildLibrary();
const index = [];
let files = 0;
for (const plan of library) {
	await mkdir(join(out, 'v1', 'zwo', plan.id), { recursive: true });
	const rides = [];
	for (const ride of plan.rides) {
		const { zwo, ...rest } = ride;
		if (zwo) {
			await writeFile(join(out, 'v1', 'zwo', plan.id, ride.file), zwo);
			files++;
			rides.push({ ...rest, url: `zwo/${plan.id}/${ride.file}` });
		} else rides.push(rest);
	}
	await writeFile(join(out, 'v1', 'plans', `${plan.id}.json`), json({ ...meta, id: plan.id, name: plan.name, group: plan.group, labels: plan.labels, rides }));
	index.push({ id: plan.id, name: plan.name, group: plan.group, weeks: plan.labels, rides: rides.length, trainerRides: rides.filter((r) => r.trainer).length, url: `plans/${plan.id}.json` });
}
await writeFile(join(out, 'v1', 'plans.json'), json({ ...meta, plans: index }));
await writeFile(join(out, 'VERSION'), `${pkg.version}\n`);
console.log(`timecrunchy ${pkg.version}: ${library.length} plans, ${files} .zwo files`);
