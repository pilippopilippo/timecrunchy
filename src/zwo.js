// The plans as .zwo workouts for a smart trainer (ERG mode): one file per ride.
//
// Rules, so that the result is predictable:
// - EM time is the length of the whole ride, the intervals are inside it: 10 min. warm-up, the intervals in order,
//   EM up to the length, 5 min. cool-down. With a range of minutes, the shortest that fits the intervals.
// - ERG targets are the middle of each zone (ERG below); PowerIntervals have no upper limit: 120% FTP. Each
//   interval also carries its zone as PowerRangeLow/PowerRangeHigh (ERG_RANGE), for apps that hold it inside the range.
// - Peak-and-Fade PowerIntervals start all out and fade: not something ERG can do, they use a slope instead.
// - Group rides, commutes, races, cyclocross practice and Gran Fondo days are outdoors: no file. Of two options
//   (EITHER) the first one without outdoor parts is used.
import { R, PLANS, ZONES } from './data.js';
import { TEXT } from './text.js';
import { partsText, powerShare } from './targets.js';

/** ERG targets, share of FTP */
const ERG = { EM: 0.65, EM_UPPER: 0.8, SS: 0.98, CR: 1.08, PI: 1.2, FP: 0.55, RECOVERY: 0.55, EASY: 0.5, VERY_EASY: 0.45 };
const round3 = (x) => Math.round(x * 1000) / 1000;
const zonePower = (id) => ZONES.find((z) => z.id === id).power.map(powerShare);
/**
 * ERG ranges, share of FTP: the zone of each interval. ERG holds one power at a time (Power, the middle); an app
 * that reads PowerRangeLow/PowerRangeHigh may move it inside the range. PowerIntervals have no upper limit: 130%.
 */
const ERG_RANGE = {
	EM: zonePower('EM').map(round3),
	SS: zonePower('SS').map(round3),
	CR: zonePower('CR').map(round3),
	PI: [round3(zonePower('PI')[0]), 1.3],
};
/** Target cadences, rpm */
const CADENCE = { EM: 90, SS: 90, CR: 78, PI: 105, PFPI: 95, FP: 112 };
/** Slope for Peak-and-Fade PowerIntervals, % */
const PFPI_SLOPE = 6;
const WARM_UP = 10;
const COOL_DOWN = 5;
const AUTHOR = 'pilippopilippo';

const OUTDOOR = new Set(['GROUP', 'COMMUTE', 'CROSS', 'RACE', 'GF_SAT', 'GF_SUN']);
const INTERVALS = new Set(['SS', 'OU', 'PI', 'SEPI', 'PFPI', 'FP', 'TL', 'SS_TIME', 'PI_EFFORTS']);
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const TERMS = Object.fromEntries(TEXT.terms);

const lo = (value) => (Array.isArray(value) ? value[0] : value);
const hi = (value) => (Array.isArray(value) ? value[1] : value);
const xml = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The rides of a day: none on rest days, one, or morning and evening ({ slot, parts }) */
function dayRides(day) {
	if (day === R) return [];
	if (!Array.isArray(day)) return [{ slot: 'am', parts: day.am }, { slot: 'pm', parts: day.pm ?? day.am }];
	return [{ slot: '', parts: day }];
}

/** The parts to ride on the trainer, or null when the ride is outdoors */
function trainerParts(parts) {
	const out = [];
	for (const part of parts) {
		if (OUTDOOR.has(part.kind)) return null;
		if (part.kind === 'EITHER') {
			const pick = [part.a, part.b].map(trainerParts).find(Boolean);
			if (!pick) return null;
			out.push(...pick);
		} else if (part.kind === 'REST_OR' || part.kind === 'OPTIONAL') {
			const inner = trainerParts(part.parts);
			if (!inner) return null;
			out.push(...inner);
		} else out.push(part);
	}
	return out.length ? out : null;
}
const isTrainerRide = (parts) => Boolean(trainerParts(parts));

/** Seconds of an interval block, recoveries between intervals and sets included */
function blockSeconds(part) {
	if (part.kind === 'SS_TIME') return lo(part.min) * 60;
	if (part.kind === 'PI_EFFORTS') return lo(part.count) * 60 + (lo(part.count) - 1) * 120;
	const unit = part.sec ? 1 : 60;
	const one = part.reps * part.min * unit + (part.reps - 1) * (part.rbi ?? 0) * unit;
	const sets = part.sets ?? 1;
	return sets * one + (sets - 1) * (part.rbs ?? 0) * 60;
}

const rangeAttributes = (range, prefix = '') => (range ? ` ${prefix}PowerRangeLow="${range[0]}" ${prefix}PowerRangeHigh="${range[1]}"` : '');
const steady = (seconds, power, { cadence, slope, message, range } = {}) =>
	`<SteadyState Duration="${Math.round(seconds)}" Power="${power}"${rangeAttributes(range)}${cadence ? ` Cadence="${cadence}"` : ''}${slope !== undefined ? ` Slope="${slope}"` : ''}${
		message ? `><textevent timeoffset="0" message="${xml(message)}"/></SteadyState>` : '/>'
	}`;
const ramp = (tag, seconds, from, to) => `<${tag} Duration="${seconds}" PowerLow="${from}" PowerHigh="${to}"/>`;

/** The steps of an interval block */
function intervalSteps(part) {
	const unit = part.sec ? 1 : 60;
	const steps = [];
	const message = TERMS[part.kind] ? `${part.kind} · ${TERMS[part.kind]}` : undefined;
	if (part.kind === 'SS_TIME') return [steady(lo(part.min) * 60, ERG.SS, { cadence: CADENCE.SS, range: ERG_RANGE.SS, message: `SS · ${TERMS.SS}` })];
	if (part.kind === 'PI_EFFORTS') {
		for (let i = 0; i < lo(part.count); i++) {
			steps.push(steady(60, ERG.PI, { cadence: CADENCE.PI, range: ERG_RANGE.PI, message: i === 0 ? `PI · ${TERMS.PI}` : undefined }));
			if (i < lo(part.count) - 1) steps.push(steady(120, ERG.RECOVERY));
		}
		return steps;
	}
	const sets = part.sets ?? 1;
	for (let s = 0; s < sets; s++) {
		for (let r = 0; r < part.reps; r++) {
			const first = s === 0 && r === 0;
			const seconds = part.min * unit;
			switch (part.kind) {
				case 'SS':
					steps.push(steady(seconds, ERG.SS, { cadence: CADENCE.SS, range: ERG_RANGE.SS, message: first ? message : undefined }));
					break;
				case 'PI':
				case 'SEPI':
					steps.push(steady(seconds, ERG.PI, { cadence: CADENCE.PI, range: ERG_RANGE.PI, message: first ? message ?? `PI · ${TERMS.PI}` : undefined }));
					break;
				case 'PFPI':
					steps.push(steady(seconds, ERG.PI, { cadence: CADENCE.PFPI, slope: PFPI_SLOPE, message: first ? message : undefined }));
					break;
				case 'FP': {
					const rpm = part.rpm ? Math.round((lo(part.rpm) + hi(part.rpm)) / 2) : CADENCE.FP;
					steps.push(steady(seconds, ERG.FP, { cadence: rpm, message: first ? message : undefined }));
					break;
				}
				case 'TL': {
					const [high, climbing, steadyMin] = part.ladder;
					steps.push(
						steady(high * 60, ERG.PI, { cadence: CADENCE.PI, range: ERG_RANGE.PI, message: first ? message : undefined }),
						steady(climbing * 60, ERG.CR, { cadence: CADENCE.CR, range: ERG_RANGE.CR }),
						steady(steadyMin * 60, ERG.SS, { cadence: CADENCE.SS, range: ERG_RANGE.SS }),
					);
					break;
				}
				case 'OU': {
					// IntervalsT: "on" first, then "off", repeated; Under first unless overFirst
					const [under, over] = part.pattern;
					const repeat = part.min / (under + over);
					const on = part.overFirst ? [over, ERG.CR, CADENCE.CR, ERG_RANGE.CR] : [under, ERG.SS, CADENCE.SS, ERG_RANGE.SS];
					const off = part.overFirst ? [under, ERG.SS, CADENCE.SS, ERG_RANGE.SS] : [over, ERG.CR, CADENCE.CR, ERG_RANGE.CR];
					const text = first ? `<textevent timeoffset="0" message="${xml(message)}"/>` : '';
					steps.push(
						`<IntervalsT Repeat="${repeat}" OnDuration="${on[0] * 60}" OffDuration="${off[0] * 60}" OnPower="${on[1]}" OffPower="${off[1]}"${rangeAttributes(on[3], 'On')}${rangeAttributes(off[3], 'Off')} Cadence="${on[2]}" CadenceResting="${off[2]}"${text ? `>${text}</IntervalsT>` : '/>'}`,
					);
					break;
				}
			}
			if (r < part.reps - 1 && part.rbi) steps.push(steady(part.rbi * unit, ERG.RECOVERY));
		}
		if (s < sets - 1 && part.rbs) steps.push(steady(part.rbs * 60, ERG.RECOVERY));
	}
	return steps;
}

/** A short title for a ride: "90 min EM + 2×[4×2 min SEPI]" */
function rideTitle(parts, emMinutes) {
	const unit = (part) => (part.sec ? 's' : 'min');
	return parts
		.map((part) => {
			switch (part.kind) {
				case 'EM':
					return `${emMinutes ?? lo(part.min ?? part.hours * 60)} min EM`;
				case 'EASY':
					return `${lo(part.min)} min easy`;
				case 'RECOVERY':
					return `${lo(part.min)} min recovery`;
				case 'SS_TIME':
					return `${lo(part.min)} min SS`;
				case 'PI_EFFORTS':
					return `${lo(part.count)} PI efforts`;
				case 'OPENERS':
					return `${lo(part.min)} min openers`;
				case 'PAUSE':
					return null;
				case 'TL':
					return `${part.reps}×TL ${part.ladder.join('/')}`;
				case 'OU':
					return `${part.reps}×${part.min} min OU (${part.pattern[0]}U, ${part.pattern[1]}O)`;
				default: {
					const reps = `${part.reps}×${part.min} ${unit(part)}`;
					return part.sets ? `${part.sets}×[${reps}] ${part.kind}` : `${reps} ${part.kind}`;
				}
			}
		})
		.filter(Boolean)
		.join(' + ');
}

/**
 * A ride as a .zwo workout. meta: name prefix, description, category.
 * Returns { xml, seconds, minutes, title, outdoorSuggested } or null when the ride is outdoors.
 */
function rideToZwo(parts, meta = {}) {
	const ride = trainerParts(parts);
	if (!ride) return null;
	const em = ride.find((p) => p.kind === 'EM');
	const work =
		ride.filter((p) => INTERVALS.has(p.kind)).reduce((sum, p) => sum + blockSeconds(p), 0) +
		ride.filter((p) => p.kind === 'PAUSE').reduce((sum, p) => sum + lo(p.min) * 60, 0);
	const body = [];
	let seconds = 0;
	let emMinutes;
	if (em || work) {
		const [from] = em ? (em.hours ? [em.hours * 60] : [lo(em.min)]) : [0];
		const need = Math.ceil((work / 60 + WARM_UP + COOL_DOWN) / 5) * 5;
		emMinutes = Math.max(from, need);
		seconds = emMinutes * 60;
		body.push(ramp('Warmup', WARM_UP * 60, ERG.VERY_EASY, ERG.EM));
		for (const part of ride) {
			if (INTERVALS.has(part.kind)) body.push(...intervalSteps(part));
			else if (part.kind === 'PAUSE') body.push(steady(lo(part.min) * 60, ERG.RECOVERY));
		}
		let fill = seconds - (WARM_UP + COOL_DOWN) * 60 - work;
		const upper = em?.upper ? lo(em.upper) * 60 : 0;
		if (upper && fill >= upper) {
			body.push(steady(upper, ERG.EM_UPPER, { cadence: CADENCE.EM, message: 'EM at its upper end' }));
			fill -= upper;
		}
		if (fill > 0) body.push(steady(fill, ERG.EM, { cadence: CADENCE.EM, range: ERG_RANGE.EM }));
		body.push(ramp('Cooldown', COOL_DOWN * 60, 0.6, ERG.VERY_EASY));
	} else {
		for (const part of ride) {
			if (part.kind === 'EASY') body.push(steady(lo(part.min) * 60, ERG.EASY));
			else if (part.kind === 'RECOVERY') body.push(steady(lo(part.min) * 60, ERG.VERY_EASY));
			else if (part.kind === 'OPENERS') {
				const count = lo(part.count);
				body.push(steady(10 * 60, ERG.EASY));
				for (let i = 0; i < count; i++) body.push(steady(15, ERG.PI, { cadence: CADENCE.PI }), steady(105, ERG.EASY));
				const rest = lo(part.min) * 60 - 600 - count * 120;
				if (rest > 0) body.push(steady(rest, ERG.EASY));
			}
			seconds += part.kind === 'OPENERS' ? Math.max(lo(part.min) * 60, 600 + lo(part.count) * 120) : lo(part.min) * 60;
		}
	}
	const title = rideTitle(ride, emMinutes);
	const outdoorSuggested = Boolean(em && (em.group || em.hilly || em.crossBike || em.hours)) || seconds >= 180 * 60;
	const name = meta.name ? `${meta.name} · ${title}` : title;
	const description = [meta.description ?? partsText(parts, null, TEXT), 'ERG: middle of each zone (range in PowerRangeLow/PowerRangeHigh), PowerIntervals 120% FTP, Peak-and-Fade on a slope.']
		.filter(Boolean)
		.join(' ');
	const file = `<workout_file>
    <author>${AUTHOR}</author>
    <name>${xml(name)}</name>
    <description>${xml(description)}</description>
    <sportType>bike</sportType>
    <category>${xml(meta.category ?? 'timecrunchy')}</category>
    <tags></tags>
    <workout>
        ${body.join('\n        ')}
    </workout>
</workout_file>
`;
	return { xml: file, seconds, minutes: seconds / 60, title, outdoorSuggested };
}

const weekKey = (label) => `w${String(label).replace('–', '-')}`;
/** File name of a ride: w3-sat.zwo, w9-11-mon-am.zwo */
const rideFile = (label, dayIndex, slot = '') => `${weekKey(label)}-${DAY_KEYS[dayIndex]}${slot ? `-${slot}` : ''}.zwo`;
const rideId = (plan, label, dayIndex, slot = '') => `${plan.id}-${rideFile(label, dayIndex, slot).replace(/\.zwo$/, '')}`;

/** Every ride of a plan, in order, with its .zwo when it's for the trainer */
function planRides(plan) {
	const rides = [];
	plan.weeks.forEach((week, w) => {
		const label = plan.labels[w];
		week.forEach((day, d) => {
			for (const { slot, parts } of dayRides(day)) {
				const prefix = `W${label} ${TEXT.days[d].slice(0, 3)}${slot ? ` ${slot}` : ''}`;
				const zwo = rideToZwo(parts, { name: prefix, category: plan.name });
				rides.push({
					id: rideId(plan, label, d, slot),
					file: rideFile(label, d, slot),
					week: label,
					day: d,
					dayName: TEXT.days[d],
					slot,
					text: partsText(parts, null, TEXT),
					trainer: Boolean(zwo),
					...(zwo && { title: zwo.title, minutes: zwo.minutes, outdoorSuggested: zwo.outdoorSuggested, zwo: zwo.xml }),
				});
			}
		});
	});
	return rides;
}

/** All plans with their rides */
const buildLibrary = (plans = PLANS) => plans.map((plan) => ({ id: plan.id, name: plan.name, group: plan.group, labels: plan.labels, rides: planRides(plan) }));

export { ERG, ERG_RANGE, CADENCE, PFPI_SLOPE, dayRides, trainerParts, isTrainerRide, blockSeconds, rideTitle, rideToZwo, rideFile, rideId, planRides, buildLibrary };
