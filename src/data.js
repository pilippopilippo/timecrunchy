// timecrunchy: zones and plans of "The Time-Crunched Cyclist" (Chris Carmichael, 3rd edition), adapted to a
// ramp test FTP and threshold heart rate. MIT License, see LICENSE. Plans transcribed from the tables of the book.
// The book sets every target as a share of the power and heart rate of its own 8-minute field test, which are
// above threshold: threshold power is about 0.9 × the test power, threshold heart rate about 0.93 × the test
// heart rate. targets.js converts the shares so that they apply to an FTP and a threshold heart rate.

/**
 * Zones as in the book (Table 4.1): power and heart rate as a share of the field test values.
 * PI has no upper limit (power) or goes up to the maximum (heart rate).
 */
const ZONES = [
	{ id: 'EM', name: 'EnduranceMiles', power: [0.45, 0.73], heart: [0.5, 0.91] },
	{ id: 'T', name: 'Tempo', power: [0.8, 0.85], heart: [0.88, 0.9] },
	{ id: 'SS', name: 'SteadyState', power: [0.86, 0.9], heart: [0.92, 0.94] },
	{ id: 'CR', name: 'ClimbingRepeat', power: [0.95, 1], heart: [0.95, 0.97] },
	{ id: 'PI', name: 'PowerInterval', power: [1.01], heart: [1] },
];
/** Threshold values as a share of the field test values */
const FTP_SHARE = 0.9;
const THRESHOLD_HEART_SHARE = 0.93;
/** Accepted values */
const LIMITS = { ftp: [50, 1000], heart: [80, 220] };

// ---------------------------------------------------------------------------------------------
// Workouts. Durations in minutes: a number, or [from, to].
// A day is R (rest), a list of parts done one after the other, or { am, pm } (two rides in a day).
// ---------------------------------------------------------------------------------------------

const R = 'rest';
/** EnduranceMiles; extra: group (or a group ride), hilly, crossBike, upper (minutes at the upper end of EM) */
const em = (min, extra) => ({ kind: 'EM', min, ...extra });
/** Hours of EM; bike: 'road-mtb' or 'mtb'; terrain: 'climbing' or 'any' */
const emHours = (hours, bike, terrain) => ({ kind: 'EM', hours, bike, terrain });
const G = { group: true };
/** A group ride on its own; fast: a fast-paced one */
const groupRide = (extra) => ({ kind: 'GROUP', ...extra });
/** Commuting by bike: 'easy', or 'em' (an EnduranceMiles commute, optionally with its duration) */
const commute = (type, min) => ({ kind: 'COMMUTE', type, min });
/** Easy spinning */
const easy = (min) => ({ kind: 'EASY', min });
/** Very easy recovery ride */
const recovery = (min) => ({ kind: 'RECOVERY', min });
/** Recovery between two parts of a workout */
const pause = (min) => ({ kind: 'PAUSE', min });
const restOr = (...parts) => ({ kind: 'REST_OR', parts });
const optional = (...parts) => ({ kind: 'OPTIONAL', parts });
/** One workout or another: two lists of parts */
const either = (a, b) => ({ kind: 'EITHER', a, b });
/** Cyclocross skills practice */
const cross = (min, extra) => ({ kind: 'CROSS', min, ...extra });
const RACE = { kind: 'RACE' };
/** Minutes at SteadyState intensity, not as intervals */
const ssTime = (min) => ({ kind: 'SS_TIME', min });
/** Short efforts at PowerInterval intensity */
const piEfforts = (count) => ({ kind: 'PI_EFFORTS', count });
/** Easy spinning with a few accelerations, the day before a race */
const openers = (min, count) => ({ kind: 'OPENERS', min, count });
/** Gran Fondo weekend: Saturday (what to do if the event is on Sunday), Sunday */
const gfSaturday = (...instead) => ({ kind: 'GF_SAT', instead });
const GF_SUNDAY = { kind: 'GF_SUN' };
/**
 * Intervals: reps × duration, rbi = recovery between intervals. extra: sets, rbs (recovery between
 * sets, minutes), sec (durations in seconds), pattern (Over-Under: [under, over] minutes),
 * overFirst, ladder (ThresholdLadder minutes: [PI, CR, SS]), runUp (true or 'optional'), rpm
 */
const intervals = (kind) => (reps, min, rbi, extra) => ({ kind, reps, min, rbi, ...extra });
const ss = intervals('SS');
const ou = intervals('OU');
const pi = intervals('PI');
const sepi = intervals('SEPI');
const pfpi = intervals('PFPI');
const fp = intervals('FP');
const tl = intervals('TL');
const TL135 = { ladder: [1, 3, 5] };
const TL246 = { ladder: [2, 4, 6] };
/** Over-Under pattern: minutes Under, minutes Over */
const UO = (under, over) => ({ pattern: [under, over] });
/** The same pattern, starting with the Over part */
const OU_ = (over, under) => ({ pattern: [under, over], overFirst: true });

// ---------------------------------------------------------------------------------------------
// Plans, transcribed from the tables of the book. To add a plan, add an entry: its id (kept in the
// visitors' browsers: don't change it), group, name, week labels and weeks.
// ---------------------------------------------------------------------------------------------

/** Weeks 1 to 8, then a last row repeated from week 9 to week 11 */
const ELEVEN_WEEKS = ['1', '2', '3', '4', '5', '6', '7', '8', '9–11'];
const weekNumbers = (count) => Array.from({ length: count }, (_, i) => String(i + 1));

// Workouts repeated in several plans
const pfpiThenOu = (rbi) => [em([60, 90]), pfpi(4, 2, rbi), pause(8), ou(4, 3, 3, UO(2, 1))];
const cxPiRunUp = [em([60, 90]), pi(5, 2, 2), pause(8), pi(5, 1, 1, { runUp: true })];
const cxPiOu = [em([60, 90]), pi(5, 1, 1), pause(8), ou(3, 6, 3, OU_(1, 1))];
const cxRaceOr = (...parts) => [either([RACE], [cross([30, 45]), ...parts])];
const cxPractice = [cross([30, 45]), em([90, 120], G)];
const piCommutes = (am, pm) => ({ am: [commute('em', [45, 60]), ...am], pm: [commute('em', [45, 60]), ...pm] });
const thirtySeconds = pi(8, 30, 30, { sec: true, sets: 2, rbs: 5 });
const EASY_COMMUTE = [commute('easy')];
const EM_COMMUTE = [commute('em')];
const easyPm = (...am) => ({ am, pm: EASY_COMMUTE });

const PLANS = [
	{
		id: 'new-competitor',
		group: 'race',
		name: 'Race · Rookie',
		labels: ELEVEN_WEEKS,
		weeks: [
			[[em([45, 60])], [em([60, 90]), ss(3, 8, 5)], R, [em([60, 90]), ss(3, 8, 5)], R, [em([90, 120], G)], [em([90, 120], { hilly: true })]],
			[R, [em([75, 90]), ss(3, 10, 6)], R, [em([75, 90]), ss(3, 10, 6)], R, [em([90, 120], G)], [em([90, 120], G)]],
			[R, [em([60, 90]), sepi(3, 3, 3, { sets: 2, rbs: 8 })], R, [em([75, 90]), ou(3, 9, 6, UO(2, 1))], R, [em([90, 120]), ou(3, 9, 5, UO(2, 1))], [em([90, 150])]],
			[R, [restOr(easy(45))], R, [em([60, 90]), sepi(3, 3, 3, { sets: 2, rbs: 8 })], R, [em([90, 120]), sepi(3, 3, 2, { sets: 2, rbs: 6 })], [em([120, 150], G)]],
			[R, [em([60, 90]), sepi(3, 3, 3, { sets: 2, rbs: 6 })], [em([60, 90]), sepi(3, 3, 3, { sets: 2, rbs: 8 })], R, R, [em([90, 120]), ou(3, 10, 6, UO(3, 2))], [em([90, 150], G)]],
			[R, [em([60, 90]), sepi(5, 3, 3)], [em([60, 90]), pfpi(3, 2, 2, { sets: 3, rbs: 8 })], R, R, [em([90, 150]), ou(3, 12, 8, UO(2, 2))], [em([90, 150], G)]],
			[R, [em([60, 90]), pfpi(3, 2, 2, { sets: 3, rbs: 6 })], R, [em([60, 90]), pfpi(3, 2, 2, { sets: 3, rbs: 6 })], R, [em([90, 150]), ou(3, 12, 8, UO(2, 1))], [em([90, 150], G)]],
			[R, [em(60), fp(4, 3, 3)], R, pfpiThenOu(1), R, [em([90, 150], G)], [em([90, 150], G)]],
			[R, [em([60, 90]), sepi(6, 2, 2)], R, pfpiThenOu(1), R, [em([90, 150]), ou(3, 12, 8, UO(2, 2))], [em([90, 150], G)]],
		],
	},
	{
		id: 'experienced-competitor',
		group: 'race',
		name: 'Race · Expert',
		labels: ELEVEN_WEEKS,
		weeks: [
			[[em([45, 60])], [em([60, 90]), ss(3, 10, 5)], R, [em([60, 90]), ss(3, 10, 5)], R, [either([em(90), ss(3, 10, 5)], [groupRide({ min: [90, 120] })])], [em([90, 120])]],
			[R, [em([75, 90]), ss(3, 12, 6)], R, [em([75, 90]), ou(4, 6, 5, UO(2, 1))], R, [em([90, 120]), ou(4, 6, 5, UO(2, 1))], [em([90, 120])]],
			[R, [em([60, 90]), sepi(3, 3, 3, { sets: 2, rbs: 8 })], R, [em([60, 90]), sepi(3, 3, 3, { sets: 2, rbs: 8 })], R, [em([90, 120]), ou(3, 9, 6, UO(2, 1))], [em([90, 150], G)]],
			[R, [restOr(easy(45))], R, [em([60, 90]), sepi(3, 3, 3, { sets: 2, rbs: 8 })], R, [em(90), sepi(3, 3, 2, { sets: 2, rbs: 6 })], [em([120, 150], G)]],
			[R, [em([60, 90]), sepi(3, 3, 2, { sets: 2, rbs: 6 })], [em([60, 90]), sepi(3, 3, 2, { sets: 2, rbs: 6 })], R, R, [em([90, 120]), ou(3, 10, 6, UO(3, 2))], [em([90, 150], G)]],
			[R, [em([60, 90]), sepi(6, 3, 3)], [em([60, 90]), pfpi(3, 2, 1, { sets: 3, rbs: 6 })], R, R, [em([90, 150]), ou(3, 12, 8, UO(2, 2))], [em([90, 150], G)]],
			[R, [em([60, 90]), pfpi(3, 2, 2, { sets: 3, rbs: 6 })], R, [em([60, 90]), pfpi(3, 2, 2, { sets: 3, rbs: 6 })], R, [em([90, 120]), sepi(6, 3, 3)], [em([90, 150], G)]],
			[R, [em(60), fp(4, 3, 3)], R, pfpiThenOu(1), R, [em([90, 150], G)], [em([90, 150], G)]],
			[R, [em([60, 90]), sepi(6, 2, 2)], R, pfpiThenOu(1), R, [em([90, 150]), ou(3, 12, 8, UO(2, 2))], [em([90, 150], G)]],
		],
	},
	{
		id: 'cyclocross',
		group: 'race',
		name: 'Cyclocross',
		labels: ELEVEN_WEEKS,
		weeks: [
			[R, [em([60, 90]), ss(3, 8, 4)], R, [em([60, 90]), ss(3, 8, 4)], R, [em([90, 120], G)], [em([90, 120], { hilly: true })]],
			[R, [em([60, 90]), tl(3, 9, 5, TL135)], R, [em([75, 90]), ss(3, 10, 5)], R, cxPractice, [em([90, 120], G)]],
			[R, [em([60, 90]), tl(3, 9, 5, TL135)], R, [em([60, 90]), tl(3, 9, 5, TL135)], R, [em(90), ss(3, 12, 5)], cxPractice],
			[R, [restOr(cross(30, { easy: true }))], R, [em([60, 90]), pi(3, 2, 2)], R, cxRaceOr(em([60, 90]), pi(8, 2, 2)), [em([120, 150], G)]],
			[R, [em([60, 90]), pi(8, 2, 2)], [em([60, 90]), pi(15, 1, 1)], R, R, cxRaceOr(em(90), ou(3, 12, 6, OU_(1, 1))), [em([90, 150], G)]],
			[R, cxPiRunUp, [em([60, 90]), pi(15, 1, 1)], R, R, cxRaceOr(em([90, 120]), tl(3, 12, 6, TL246)), [em([90, 120], G)]],
			[R, [restOr(cross(30, { easy: true }))], R, cxPiRunUp, R, cxRaceOr(em([90, 120]), tl(3, 12, 6, TL246)), [em([120, 150], G)]],
			[R, [em([60, 90], { crossBike: true }), pi(10, 1, 1)], R, cxPiOu, R, [RACE], [em([120, 150]), ou(3, 12, 6, OU_(1, 1))]],
			[R, [em([60, 90]), pi(8, 1, 1, { runUp: 'optional' })], R, cxPiOu, R, [RACE], [em([90, 120]), tl(2, 12, 6, TL246)]],
		],
	},
	{
		id: 'new-granfondo',
		group: 'long',
		name: 'Granfondo · Rookie',
		labels: ELEVEN_WEEKS,
		weeks: [
			[[em([45, 60])], [em([60, 90]), ss(3, 8, 5)], R, [em([60, 90]), ss(3, 8, 5)], R, [em([90, 120])], [em([90, 120])]],
			[R, [em([60, 90]), ss(3, 10, 5)], R, [em([60, 90]), ss(3, 10, 5)], R, [em(90), sepi(3, 2, 3, { sets: 2, rbs: 8 })], [em([90, 120])]],
			[R, R, [em([75, 90]), ss(3, 12, 6)], [em([60, 90]), ss(3, 10, 5)], R, [em(90), sepi(4, 2, 3, { sets: 2, rbs: 8 })], [em([90, 120], G)]],
			[R, R, [restOr(easy(45))], [em([75, 90]), ss(3, 12, 6)], R, [em(120), ou(3, 9, 6, UO(2, 1))], [em([120, 150], G)]],
			[R, [em([60, 90]), ou(3, 9, 6, UO(2, 1))], [em([60, 90]), ss(3, 10, 5)], R, R, [em(90), sepi(4, 2, 2, { sets: 2, rbs: 8 })], [em([120, 150], G)]],
			[R, [em([60, 90]), ou(3, 12, 6, UO(2, 1))], [em([60, 90]), ou(3, 9, 6, UO(2, 1))], R, R, [em(90), sepi(4, 2, 2, { sets: 2, rbs: 8 })], [em([120, 150], G)]],
			[R, [em(90), ou(3, 12, 6, UO(2, 2))], R, [em(90), ou(3, 12, 6, UO(2, 2))], R, [em(120), sepi(4, 2, 2, { sets: 2, rbs: 8 })], [em(150, G)]],
			[R, [em(60), fp(4, 3, 3)], R, pfpiThenOu(2), R, [em([120, 180], G)], [em([90, 150], G)]],
			[R, [em([60, 90]), ou(3, 12, 8, UO(2, 2))], R, pfpiThenOu(2), R, [em([90, 150], G)], [em([90, 150], G)]],
		],
	},
	{
		id: 'comp-granfondo',
		group: 'long',
		name: 'Granfondo · Expert',
		labels: ELEVEN_WEEKS,
		weeks: [
			[R, [em([60, 90]), ss(4, 8, 5)], R, [em([60, 90]), ss(3, 10, 5)], R, [em(120)], [em(120)]],
			[R, [em([60, 90]), sepi(3, 2, 3, { sets: 2, rbs: 8 })], R, [em([60, 90]), ss(3, 12, 6)], R, [em(120), ss(3, 12, 6)], [em(120)]],
			[R, R, [em([60, 90]), sepi(4, 2, 3, { sets: 2, rbs: 8 })], [em([60, 90]), ss(3, 12, 6)], R, [em(120), ss(3, 12, 6)], [em(120, G)]],
			[R, R, [restOr(easy(45))], [em(90), ou(3, 9, 6, UO(2, 1))], R, [em(150), ss(3, 12, 6)], [em(120, G)]],
			[R, [em([60, 90]), sepi(8, 2, 2)], [em(90), ss(3, 15, 8)], R, R, [em(120), ou(3, 9, 6, UO(2, 1))], [em([120, 150], G)]],
			[R, [em(90), ou(3, 12, 6, UO(2, 1))], [em(90), ou(3, 12, 6, UO(2, 1))], R, R, [em(120), sepi(10, 2, 2)], [em([120, 150], G)]],
			[R, [em(90), sepi(10, 2, 2)], [em(90), sepi(10, 2, 2)], R, R, [em(180), ou(3, 12, 6, UO(1, 1))], [em(150, G)]],
			[R, [em([60, 90]), pfpi(10, 1, 1), pause(8), ou(4, 3, 3, UO(2, 1))], R, [em(60), pfpi(6, 1, 1)], R, [gfSaturday(em(60), fp(6, 1, 1))], [GF_SUNDAY]],
			[R, [em([60, 90]), sepi(10, 2, 2)], [em([60, 90]), ou(3, 12, 6, UO(1, 1))], R, R, [em([120, 150], G)], [em([120, 150], G)]],
		],
	},
	{
		id: 'ultraendurance',
		group: 'long',
		name: 'Ultraendurance',
		labels: weekNumbers(12),
		weeks: [
			[R, [em([60, 90]), ss(3, 8, 5)], [em([60, 90]), ss(3, 8, 5)], [optional(em([45, 60]))], R, [em([120, 150])], [em([120, 150])]],
			[R, [em([60, 90]), ss(3, 10, 5)], [em([60, 90]), ss(3, 10, 5)], [optional(em([45, 60]))], R, [em(150)], [em(150)]],
			[R, [recovery(45)], [em([75, 90]), ss(3, 12, 6)], [em([60, 90]), ss(3, 10, 5)], R, [em(180)], [em(150, G)]],
			[R, R, [optional(em([45, 60]))], [em([75, 90]), ss(3, 12, 6)], R, [em(150), ou(3, 12, 6, UO(2, 1))], [em(150, G)]],
			[R, [em([60, 90]), ou(3, 12, 6, UO(2, 1))], [em([60, 90]), ou(3, 12, 6, UO(2, 1))], [optional(recovery(45))], R, [em(180), ss(4, 15, 8)], [em(180, G)]],
			[R, [em([60, 90]), ou(3, 12, 6, UO(1, 1))], [em([60, 90]), ou(3, 12, 6, UO(1, 1))], [em([45, 60])], R, [emHours(4, 'road-mtb', 'climbing')], [em([120, 150], G)]],
			[R, [em([60, 90]), ou(3, 12, 6, UO(1, 1))], [em(90), ss(3, 12, 6)], [em([60, 90]), ss(3, 10, 5)], R, [emHours(4, 'road-mtb', 'climbing')], [em(180, G)]],
			[R, [recovery(60)], R, [em([60, 90]), tl(1, 9, 0, TL135)], R, [emHours(5, 'road-mtb', 'climbing')], [emHours(3, 'road-mtb', 'any')]],
			[R, [em([60, 90]), tl(3, 9, 5, TL135)], [em([60, 90]), tl(3, 9, 5, TL135)], [optional(em([45, 60]))], R, [emHours(5, 'road-mtb', 'climbing')], [emHours(4, 'road-mtb', 'any')]],
			[R, [em([60, 90]), tl(4, 9, 5, TL135)], [em([60, 90]), tl(4, 9, 5, TL135)], [em(90), ss(3, 12, 6)], R, [emHours(6, 'mtb', 'climbing')], [emHours(4, 'road-mtb', 'climbing')]],
			[R, R, [em([60, 90]), pi(8, 2, 2)], [em([60, 90]), pi(4, 2, 2), pause(8), ou(4, 3, 3, UO(2, 1))], R, [emHours(3, 'mtb', 'climbing')], [emHours(2, 'road-mtb', 'any')]],
			[R, [em([60, 90]), pi(4, 2, 2)], [recovery(60)], [em(60), pi(5, 1, 1)], [openers(30, [3, 5])], [RACE], R],
		],
	},
	{
		id: 'commuter-intermediate',
		group: 'commute',
		name: 'Commuter',
		labels: ELEVEN_WEEKS,
		weeks: [
			[EASY_COMMUTE, piCommutes([ss(2, 8, 4)], [ss(2, 8, 4)]), { am: [commute('em', [45, 60]), ss(3, 6, 3)], pm: EM_COMMUTE }, easyPm(commute('em', [45, 60]), ss(3, 6, 3)), EASY_COMMUTE, [em(120, G)], R],
			[EASY_COMMUTE, { am: [commute('em', 60), ss(2, 10, 4)], pm: [commute('em', [45, 60]), ss(2, 8, 4)] }, { am: [commute('em', [45, 60]), ss(2, 8, 4)], pm: EM_COMMUTE }, easyPm(commute('em', [45, 60]), ss(3, 6, 3)), EASY_COMMUTE, [em(120, G)], R],
			[EASY_COMMUTE, { am: [commute('em', 60), ss(2, 12, 5)], pm: [commute('em', [45, 60]), ss(2, 8, 4)] }, { am: [commute('em', 60), ss(2, 10, 4)], pm: EM_COMMUTE }, easyPm(commute('em', [45, 60]), ss(3, 6, 3)), R, [em(120, G)], R],
			[R, EASY_COMMUTE, easyPm(commute('em'), fp(3, 2, 2, { rpm: [100, 110] })), easyPm(commute('em')), R, [em([60, 90])], R],
			[EASY_COMMUTE, piCommutes([pi(5, 2, 2)], [pi(10, 1, 1)]), EASY_COMMUTE, piCommutes([pi(5, 2, 2)], [thirtySeconds]), EASY_COMMUTE, [em(120, G)], R],
			[EASY_COMMUTE, piCommutes([pi(6, 2, 2)], [pi(10, 1, 1)]), EASY_COMMUTE, piCommutes([pi(5, 2, 2)], [thirtySeconds]), EASY_COMMUTE, [em(120, G)], R],
			[EASY_COMMUTE, piCommutes([pi(7, 2, 2)], [pi(10, 1, 1)]), EASY_COMMUTE, piCommutes([pi(5, 2, 2)], [thirtySeconds]), EASY_COMMUTE, [either([em(150), tl(3, 12, 5, TL246)], [groupRide({ fast: true })])], R],
			[R, easyPm(commute('em', [40, 60])), easyPm(commute('easy'), fp(5, 2, 2)), easyPm(commute('em', [45, 60])), EASY_COMMUTE, [either([RACE], [groupRide({ fast: true })])], R],
			[EASY_COMMUTE, { am: [commute('em', 45), pi(5, 1, 1, { sets: 2, rbs: 5 })], pm: [commute('em', [45, 60])] }, easyPm(commute('em', 60), ss(3, 8, 4)), easyPm(commute('easy'), fp(3, 2, 2)), EASY_COMMUTE, [either([RACE], [groupRide({ fast: true })])], R],
		],
	},
	{
		id: 'commuter-advanced',
		group: 'commute',
		name: 'Commuter · Advanced',
		labels: ELEVEN_WEEKS,
		weeks: [
			[EASY_COMMUTE, { am: [commute('em', [45, 60]), ss(3, 8, 4)], pm: [commute('em', [45, 60]), ss(2, 8, 4)] }, { am: [commute('em', [45, 60]), ss(2, 10, 4)], pm: EM_COMMUTE }, easyPm(commute('em', [45, 60]), ss(2, 8, 4)), EASY_COMMUTE, [em(120, G)], R],
			[EASY_COMMUTE, { am: [commute('em', 60), ss(3, 10, 4)], pm: [commute('em', [45, 60]), ss(2, 8, 4)] }, { am: [commute('em', [45, 60]), ss(3, 8, 4)], pm: EM_COMMUTE }, easyPm(commute('em', [45, 60]), ss(2, 10, 4)), EASY_COMMUTE, [em(120, G)], R],
			[EASY_COMMUTE, { am: [commute('em', 60), ss(2, 15, 5)], pm: [commute('em', [45, 60]), ss(2, 8, 4)] }, { am: [commute('em', 60), ss(2, 12, 4)], pm: EM_COMMUTE }, easyPm(commute('em', [45, 60]), ss(2, 10, 4)), R, [em(120, G)], R],
			[R, EASY_COMMUTE, easyPm(commute('em'), fp(5, 2, 2, { rpm: [100, 110] })), easyPm(commute('em')), R, [em([60, 90])], R],
			[EASY_COMMUTE, piCommutes([pi(6, 2, 2)], [pi(10, 1, 1)]), easyPm(commute('em')), piCommutes([pi(6, 2, 2)], [thirtySeconds]), EASY_COMMUTE, [em(120, G)], R],
			[EASY_COMMUTE, piCommutes([pi(7, 2, 2)], [pi(10, 1, 1)]), easyPm(commute('em')), piCommutes([pi(7, 2, 2)], [thirtySeconds]), EASY_COMMUTE, [em(120, G)], R],
			[EASY_COMMUTE, piCommutes([pi(8, 2, 2)], [pi(10, 1, 1)]), EASY_COMMUTE, piCommutes([pi(8, 2, 2)], [thirtySeconds]), EASY_COMMUTE, [either([em(150), tl(3, 12, 5, TL246)], [groupRide({ fast: true })])], R],
			[R, EASY_COMMUTE, easyPm(commute('easy'), fp(3, 2, 2)), easyPm(commute('em', [45, 60]), pi(4, 1, 1), pause(6), tl(1, 9, 0, TL135)), EASY_COMMUTE, [either([RACE], [groupRide({ fast: true })])], R],
			[EASY_COMMUTE, { am: [commute('em', 45), pi(5, 1, 1, { sets: 2, rbs: 5 })], pm: [commute('em', [45, 60])] }, easyPm(commute('em', 60), ss(2, 12, 4)), easyPm(commute('easy'), fp(3, 2, 2)), EASY_COMMUTE, [either([RACE], [groupRide({ fast: true })])], R],
		],
	},
	{
		id: 'maintenance',
		group: 'between',
		name: 'Maintenance',
		labels: weekNumbers(4),
		weeks: [
			[R, R, R, [easy([45, 60])], R, [em([90, 120], G)], [em([90, 120], { hilly: true })]],
			[R, [em([60, 90])], R, [em([75, 90], { upper: 15 })], R, [either([groupRide()], [em([90, 120], { upper: [15, 20] })])], [em([90, 120], { hilly: true })]],
			[R, [em([60, 90])], R, [em([75, 90], { upper: 20 })], R, [either([groupRide()], [em([120, 150], { upper: [30, 40] })])], [em([90, 120], { hilly: true })]],
			[R, [em([60, 90]), ssTime([10, 20])], R, [em([60, 90]), piEfforts([6, 8])], R, [either([groupRide()], [em([120, 150], { upper: [30, 40] })])], [em([120, 150], G)]],
		],
	},
];
const DEFAULT_PLAN = 'new-granfondo';

export { ZONES, FTP_SHARE, THRESHOLD_HEART_SHARE, LIMITS, R, PLANS, DEFAULT_PLAN };
