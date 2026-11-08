// Targets: zone shares → % of FTP and threshold heart rate, watts and bpm, and the text of each part of a ride.
import { ZONES, FTP_SHARE, THRESHOLD_HEART_SHARE, R } from './data.js';

const zone = Object.fromEntries(ZONES.map((z) => [z.id, z]));
/** Rounds like a spreadsheet: 235 ÷ 0.9 × 0.45 is 117.5, not the 117.4999… of floating point math */
const round = (value) => Math.round(Number(value.toFixed(6)));
const percent = (share) => round(share * 100);
const powerShare = (share) => share / FTP_SHARE;
const heartShare = (share) => share / THRESHOLD_HEART_SHARE;
const range = (value) => (Array.isArray(value) ? value.join('–') : String(value));

/** A zone's power: watts with an FTP, otherwise the share of FTP ("225–235 W", ">264 W", "96–100% FTP") */
function powerTarget(id, ftp) {
	const [from, to] = zone[id].power.map(powerShare);
	const value = (share) => (ftp ? round(ftp * share) : percent(share));
	const unit = ftp ? ' W' : '% FTP';
	return to ? `${value(from)}–${value(to)}${unit}` : `>${value(from)}${unit}`;
}

/** A zone's heart rate: bpm with a threshold heart rate, otherwise its share ("165–169 bpm", "99–101% LTHR") */
function heartTarget(id, heart) {
	const [from, to] = zone[id].heart.map(heartShare);
	const value = (share) => (heart ? round(heart * share) : percent(share));
	const unit = heart ? ' bpm' : '% LTHR';
	return to ? `${value(from)}–${value(to)}${unit}` : `${value(from)}${unit}–max`;
}

/** A zone for the workouts: power and/or heart rate, whichever the visitor entered (power share without either) */
function target(id, base) {
	const parts = [base?.ftp && powerTarget(id, base.ftp), base?.heart && heartTarget(id, base.heart)].filter(Boolean);
	return parts.length ? parts.join(' · ') : powerTarget(id);
}

/** The top of the EM zone, for rides at its upper end */
function emTop(base) {
	const [, ftpShare] = zone.EM.power.map(powerShare);
	const [, heartTop] = zone.EM.heart.map(heartShare);
	const parts = [base?.ftp && `${round(base.ftp * ftpShare)} W`, base?.heart && `${round(base.heart * heartTop)} bpm`].filter(Boolean);
	return parts.length ? parts.join(' · ') : `${percent(ftpShare)}% FTP`;
}

function intervalTarget(part, base, t) {
	switch (part.kind) {
		case 'OU': {
			const [under, over] = part.pattern ?? [];
			const pattern = part.pattern
				? part.overFirst
					? `, ${over} min. O + ${under} min. U`
					: `, ${under} min. U + ${over} min. O`
				: '';
			return `U ${target('SS', base)} / O ${target('CR', base)}${pattern}`;
		}
		case 'TL': {
			const [high, climbing, steady] = part.ladder;
			return `${high} min. PI ${target('PI', base)} + ${climbing} min. CR ${target('CR', base)} + ${steady} min. SS ${target('SS', base)}`;
		}
		case 'PI':
		case 'SEPI':
			return target('PI', base);
		case 'PFPI':
			return `${t.max}, ${target('PI', base)}`;
		case 'FP':
			return part.rpm ? `${range(part.rpm)} rpm` : t.noWatts;
		default:
			return target(part.kind, base);
	}
}

const partsText = (parts, base, t) => parts.map((part) => partText(part, base, t)).join(' + ');

function partText(part, base, t) {
	switch (part.kind) {
		case 'EM': {
			const amount = part.hours ? `${part.hours} h` : `${range(part.min)} min.`;
			const where = part.hours ? `${t.bike[part.bike]}${t.terrain[part.terrain]}` : '';
			const upper = part.upper ? t.upper(range(part.upper), emTop(base)) : '';
			return `${amount} EM (${target('EM', base)})${where}${part.crossBike ? t.crossBike : ''}${upper}${part.group ? t.group : ''}${part.hilly ? t.hilly : ''}`;
		}
		case 'GROUP':
			return `${part.min ? `${range(part.min)} min. ` : ''}${part.fast ? t.fastGroupRide : t.groupRide}`;
		case 'COMMUTE':
			if (part.type === 'easy') return t.commuteEasy;
			return part.min ? t.commuteEmMin(range(part.min), target('EM', base)) : t.commuteEm(target('EM', base));
		case 'EASY':
			return t.easy(range(part.min));
		case 'RECOVERY':
			return t.recovery(range(part.min));
		case 'PAUSE':
			return t.pause(range(part.min));
		case 'REST_OR':
			return `${t.restOr} ${partsText(part.parts, base, t)}`;
		case 'OPTIONAL':
			return `${t.optional} ${partsText(part.parts, base, t)}`;
		case 'EITHER':
			return `${partsText(part.a, base, t)}, ${t.or} ${partsText(part.b, base, t)}`;
		case 'CROSS':
			return t.cross(range(part.min), part.easy);
		case 'RACE':
			return t.race;
		case 'SS_TIME':
			return t.ssTime(range(part.min), target('SS', base));
		case 'PI_EFFORTS':
			return t.piEfforts(range(part.count), target('PI', base));
		case 'OPENERS':
			return t.openers(range(part.min), range(part.count));
		case 'GF_SAT':
			return t.gfSaturday(partsText(part.instead, base, t));
		case 'GF_SUN':
			return t.gfSunday;
		default: {
			const unit = part.sec ? 'sec.' : 'min.';
			const reps = `${part.reps}×${part.min} ${unit}`;
			const name = part.sets ? `${part.sets}×[${reps}] ${part.kind}` : `${reps} ${part.kind}`;
			const runUp = part.runUp === 'optional' ? t.runUpOptional : part.runUp ? t.runUp : '';
			const recovery = [part.rbi && `RBI ${part.rbi} ${unit}`, part.rbs && `RBS ${part.rbs} min.`].filter(Boolean);
			return `${name} (${intervalTarget(part, base, t)}${runUp})${recovery.length ? ` [${recovery.join(' / ')}]` : ''}`;
		}
	}
}

/** A day's workouts, one line per ride: rest, the parts joined with "+", or morning and evening */
function dayLines(day, base, t) {
	if (day === R) return [t.rest];
	if (!Array.isArray(day)) return [`${t.am}: ${partsText(day.am, base, t)}`, `${t.pm}: ${partsText(day.pm ?? day.am, base, t)}`];
	return [partsText(day, base, t)];
}

export { zone, round, percent, powerShare, heartShare, range, powerTarget, heartTarget, target, emTop, intervalTarget, partsText, partText, dayLines };
