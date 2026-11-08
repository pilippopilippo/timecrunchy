// Training zone calculator, shown in a post where it contains <zone-calculator></zone-calculator>.
// Zones and plans follow "The Time-Crunched Cyclist" (Chris Carmichael, 3rd edition). The book sets every
// target as a share of the power and heart rate of its own 8-minute field test, which are above threshold:
// threshold power is about 0.9 × the test power, threshold heart rate about 0.93 × the test heart rate.
// Here the shares are converted so that they apply to the visitor's FTP and threshold heart rate.
// The text is in English, whatever the language of the post.
// This file is inlined in the <head> of the posts that use it (src/components/ZoneCalculator.astro):
// the calculator is drawn while the page loads, so the text below it doesn't jump.
(() => {
	if (customElements.get('zone-calculator')) return;

	// ---------------------------------------------------------------------------------------------
	// Zones (Table 4.1 of the book)
	// ---------------------------------------------------------------------------------------------

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

	// ---------------------------------------------------------------------------------------------
	// Text
	// ---------------------------------------------------------------------------------------------

	const TEXT = {
		ftp: 'Ramp test FTP',
		heart: 'Threshold heart rate',
		hint: 'Fill in one or both. Threshold heart rate (LTHR) is the average heart rate of the last 20 minutes of a 30-minute all-out effort; a ramp test doesn’t measure it.',
		errors: {
			ftp: `Enter a number of watts between ${LIMITS.ftp[0]} and ${LIMITS.ftp[1]}.`,
			heart: `Enter a heart rate between ${LIMITS.heart[0]} and ${LIMITS.heart[1]} bpm.`,
		},
		base: ({ ftp, heart }) => `Zones for ${[ftp && `an FTP of ${round(ftp)} W`, heart && `a threshold heart rate of ${round(heart)} bpm`].filter(Boolean).join(' and ')}.`,
		noBase: 'Enter your FTP or threshold heart rate: until then, the zones and workouts show percentages.',
		zones: 'Training zones',
		zone: 'Zone',
		power: 'Power',
		heartRate: 'Heart rate',
		descriptions: {
			EM: 'Aerobic base',
			T: 'Improved aerobic endurance',
			SS: 'Lactate threshold power',
			CR: 'Threshold power (climbing)',
			PI: 'VO2max',
		},
		plan: 'Plan',
		groups: { race: 'Racing', long: 'Gran Fondo and long distance', commute: 'Commuting', between: 'Between plans' },
		week: 'Week',
		weekLabel: (week) => (week.includes('–') ? `Weeks ${week}` : `Week ${week}`),
		days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
		am: 'Morning',
		pm: 'Evening',
		rest: 'Rest',
		or: 'or',
		restOr: 'Rest or',
		optional: 'Optional:',
		group: ' or Group Ride',
		groupRide: 'Group Ride',
		fastGroupRide: 'Fast-paced Group Ride',
		hilly: ' on a hilly route',
		crossBike: ' on the cyclocross bike',
		upper: (min, top) => `, including ${min} min. at the upper end of EM (up to ${top})`,
		bike: { 'road-mtb': ' on the road or MTB', mtb: ' on the MTB' },
		terrain: { climbing: ', with climbing', any: ', any terrain' },
		commuteEasy: 'Easy commute',
		commuteEm: (target) => `EM commute (${target})`,
		commuteEmMin: (min, target) => `${min} min. EM commute (${target})`,
		easy: (min) => `${min} min. easy spinning`,
		recovery: (min) => `${min} min. recovery ride, very easy`,
		pause: (min) => `${min} min. recovery`,
		cross: (min, easy) => `${min} min.${easy ? ' easy' : ''} cyclocross practice`,
		race: 'Race',
		ssTime: (min, target) => `${min} min. at SS intensity (${target})`,
		piEfforts: (count, target) => `${count} PI-type efforts (${target})`,
		openers: (min, count) => `${min} min. easy spinning with ${count} accelerations to loosen up`,
		gfSaturday: (instead) => `Gran Fondo! If the event is on Sunday: ${instead}`,
		gfSunday: 'Gran Fondo! If the event was on Saturday, today is optional',
		max: 'all out',
		noWatts: 'no power target, high cadence',
		runUp: ', with run-up',
		runUpOptional: ', run-up optional',
		legend: 'Abbreviations',
		print: 'Print or save as PDF',
		printTitle: (plan) => `Training plan ${plan}`,
		terms: [
			['EM', 'EnduranceMiles: endurance riding at a moderate pace.'],
			['T', 'Tempo: a sustained pace, below threshold.'],
			['SS', 'SteadyState: steady intervals just below threshold.'],
			['CR', 'ClimbingRepeat: intervals at threshold, best done uphill.'],
			['PI', 'PowerInterval: short, maximal intervals.'],
			['OU', 'Over-Under: intervals alternating stretches below threshold (U, Under, SS zone) and above it (O, Over, CR zone), always ending with an Over.'],
			['SEPI', 'Steady Effort PowerInterval: a PowerInterval at a high, steady power from start to finish.'],
			['PFPI', 'Peak-and-Fade PowerInterval: start all out, then hold the hardest effort you can as the power fades.'],
			['TL', 'ThresholdLadder: an all-out PI, then straight into the CR zone and finally the SS zone.'],
			['FP', 'FastPedal: high-cadence spinning with little resistance; cadence matters, not watts.'],
			['Run-up', 'In the last seconds of the interval, get off the bike, run up a hill or stairs and get back on to finish.'],
			['RBI', 'Recovery Between Intervals: easy riding between intervals.'],
			['RBS', 'Recovery Between Sets: easy riding between sets.'],
			['2×[3×2 min.]', '2 sets of 3 intervals of 2 minutes.'],
			['Group Ride', 'A ride with a group.'],
		],
	};

	// ---------------------------------------------------------------------------------------------
	// Calculations
	// ---------------------------------------------------------------------------------------------

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

	/** A value typed by the visitor: null when empty, NaN when not valid */
	function parseValue(value, [min, max]) {
		const text = value.trim().replace(',', '.');
		if (!text) return null;
		const number = /^\d+(\.\d+)?$/.test(text) ? Number(text) : NaN;
		return number >= min && number <= max ? number : NaN;
	}

	// ---------------------------------------------------------------------------------------------
	// The element
	// ---------------------------------------------------------------------------------------------

	const STORAGE_KEY = 'zone-calculator';
	const load = () => {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
			return saved && typeof saved === 'object' ? saved : {};
		} catch {
			return {};
		}
	};
	const save = (state) => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		} catch {
			// Storage blocked (e.g. private mode): the calculator works the same, it just doesn't remember
		}
	};
	const escapeHtml = (text) => text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);
	const findPlan = (id) => PLANS.find((p) => p.id === id) ?? PLANS.find((p) => p.id === DEFAULT_PLAN);

	let instances = 0;

	class ZoneCalculator extends HTMLElement {
		connectedCallback() {
			if (this.dataset.ready) return;
			this.dataset.ready = '';
			// English even inside a post in another language: screen readers pronounce it correctly
			this.lang = 'en';
			const t = TEXT;
			const id = `zc${++instances}`;
			const saved = load();
			const startPlan = findPlan(saved.plan);
			const field = (name, label, unit) => `
				<div class="zc-field">
					<label for="${id}-${name}">${label}</label>
					<span class="zc-input">
						<input id="${id}-${name}" name="${name}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-describedby="${id}-hint">
						<span aria-hidden="true">${unit}</span>
					</span>
					<p class="zc-error" id="${id}-${name}-error" hidden>${t.errors[name]}</p>
				</div>`;
			/** A zone table cell: the value (or a dash) and, below it, the share */
			const zoneCell = (value, share) => `<span class="zc-zone-value">${value ?? '–'}</span><span class="zc-zone-share">${share}</span>`;
			const groups = [...new Set(PLANS.map((p) => p.group))];

			this.innerHTML = `
				<div class="zc">
					<form class="zc-inputs" novalidate>
						${field('ftp', t.ftp, 'W')}
						${field('heart', t.heart, 'bpm')}
						<p class="zc-hint" id="${id}-hint">${t.hint}</p>
					</form>
					<p class="zc-base" role="status"></p>
					<table class="zc-zones">
						<caption>${t.zones}</caption>
						<thead><tr><th scope="col">${t.zone}</th><th scope="col">${t.power}</th><th scope="col">${t.heartRate}</th></tr></thead>
						<tbody>
							${ZONES.map(
								(z) => `<tr data-zone="${z.id}">
									<th scope="row"><span class="zc-zone-name"><strong class="zc-zone-id">${z.id}</strong> ${z.name}</span><span class="zc-zone-description">${t.descriptions[z.id]}</span></th>
									<td class="zc-zone-power"></td>
									<td class="zc-zone-heart"></td>
								</tr>`,
							).join('')}
						</tbody>
					</table>
					<div class="zc-plan">
						<div class="zc-field">
							<label for="${id}-plan">${t.plan}</label>
							<select id="${id}-plan" name="plan">
								${groups
									.map(
										(group) => `<optgroup label="${t.groups[group]}">${PLANS.filter((p) => p.group === group)
											.map((p) => `<option value="${p.id}"${p === startPlan ? ' selected' : ''}>${p.name}</option>`)
											.join('')}</optgroup>`,
									)
									.join('')}
							</select>
						</div>
						<fieldset class="zc-weeks">
							<legend>${t.week}</legend>
							<div class="zc-chips"></div>
						</fieldset>
						<ol class="zc-days"></ol>
						<button type="button" class="zc-print">${t.print}</button>
					</div>
				</div>`;

			const form = this.querySelector('form');
			const inputs = { ftp: form.elements.namedItem('ftp'), heart: form.elements.namedItem('heart') };
			const planSelect = this.querySelector('select');
			const chips = this.querySelector('.zc-chips');
			const days = this.querySelector('.zc-days');
			const status = this.querySelector('.zc-base');
			for (const name of ['ftp', 'heart']) inputs[name].value = typeof saved[name] === 'string' ? saved[name] : '';

			/** The week buttons of a plan, keeping the chosen week when the new plan has it */
			const showWeeks = (plan, week) => {
				const selected = plan.labels.includes(week) ? week : plan.labels[0];
				chips.innerHTML = plan.labels
					.map((w) => `<label class="zc-chip"><input type="radio" name="${id}-week" value="${w}"${w === selected ? ' checked' : ''}><span>${w}</span></label>`)
					.join('');
			};
			showWeeks(startPlan, saved.week);

			/** Shows or hides a field's error message; returns the value (null when empty or not valid) */
			const check = (name, showError) => {
				const input = inputs[name];
				const value = parseValue(input.value, LIMITS[name]);
				const error = this.querySelector(`#${id}-${name}-error`);
				if (showError || !error.hidden) {
					const invalid = Number.isNaN(value);
					error.hidden = !invalid;
					input.toggleAttribute('aria-invalid', invalid);
					input.setAttribute('aria-describedby', invalid ? `${error.id} ${id}-hint` : `${id}-hint`);
				}
				return Number.isNaN(value) ? null : value;
			};

			/** What the calculator shows now, for printing */
			let current;

			const update = (showErrors = false) => {
				const ftp = check('ftp', showErrors);
				const heart = check('heart', showErrors);
				const base = ftp || heart ? { ftp, heart } : null;
				status.textContent = base ? t.base(base) : t.noBase;
				for (const row of this.querySelectorAll('tr[data-zone]')) {
					const { zone: zoneId } = row.dataset;
					row.querySelector('.zc-zone-power').innerHTML = zoneCell(ftp && powerTarget(zoneId, ftp), powerTarget(zoneId));
					row.querySelector('.zc-zone-heart').innerHTML = zoneCell(heart && heartTarget(zoneId, heart), heartTarget(zoneId));
				}
				const plan = findPlan(planSelect.value);
				const week = this.querySelector(`input[name="${id}-week"]:checked`)?.value ?? plan.labels[0];
				days.setAttribute('aria-label', `${plan.name}, ${t.weekLabel(week).toLowerCase()}`);
				days.replaceChildren(
					...plan.weeks[plan.labels.indexOf(week)].map((day, i) => {
						const item = document.createElement('li');
						item.classList.toggle('zc-rest', day === R);
						const name = document.createElement('span');
						name.className = 'zc-day';
						name.textContent = t.days[i];
						const workout = document.createElement('span');
						for (const line of dayLines(day, base, t)) {
							const text = document.createElement('span');
							text.className = 'zc-ride';
							text.textContent = line;
							workout.append(text);
						}
						item.append(name, workout);
						return item;
					}),
				);
				current = { base, plan };
				save({ ftp: inputs.ftp.value, heart: inputs.heart.value, plan: plan.id, week });
			};

			// Print or save as PDF: the whole plan (every week), with the zones and the abbreviations.
			// A printable copy is added to the page and, while printing, it's the only thing printed.
			const printPlan = () => {
				const { base, plan } = current;
				const html = document.documentElement;
				const root = document.createElement('div');
				root.className = 'zc-print-root';
				root.lang = 'en';
				root.innerHTML = `
					<h1>${t.printTitle(plan.name)}</h1>
					<p>${base ? t.base(base) : t.noBase}</p>
					<table class="zc-print-zones">
						<thead><tr><th scope="col">${t.zone}</th><th scope="col">${t.power}</th><th scope="col">${t.heartRate}</th></tr></thead>
						<tbody>${ZONES.map(
							(z) =>
								`<tr><th scope="row">${z.id} ${z.name}</th><td>${base?.ftp ? `${powerTarget(z.id, base.ftp)} (${powerTarget(z.id)})` : powerTarget(z.id)}</td><td>${base?.heart ? `${heartTarget(z.id, base.heart)} (${heartTarget(z.id)})` : heartTarget(z.id)}</td></tr>`,
						).join('')}</tbody>
					</table>
					${plan.weeks
						.map(
							(workouts, w) => `
							<section class="zc-print-week">
								<h2>${t.weekLabel(plan.labels[w])}</h2>
								<table><tbody>${workouts
									.map(
										(day, i) =>
											`<tr${day === R ? ' class="zc-rest"' : ''}><th scope="row">${t.days[i]}</th><td>${dayLines(day, base, t).map(escapeHtml).join('<br>')}</td></tr>`,
									)
									.join('')}</tbody></table>
							</section>`,
						)
						.join('')}
					<section class="zc-print-legend">
						<h2>${t.legend}</h2>
						<dl>${t.terms.map(([term, meaning]) => `<div><dt>${term}</dt><dd>${meaning}</dd></div>`).join('')}</dl>
					</section>
					<p class="zc-print-source">${escapeHtml(location.host + location.pathname)}</p>`;
				document.querySelector('.zc-print-root')?.remove();
				document.body.append(root);
				html.classList.add('zc-printing');
				// The title is the suggested name of the PDF file
				const title = document.title;
				document.title = `${t.printTitle(plan.name)}${base?.ftp ? ` – FTP ${round(base.ftp)} W` : ''}`;
				// Back to normal at the first click or key press after printing (some phones report the end
				// of printing before the page has been captured, so not right away)
				const restore = () => {
					document.title = title;
					html.classList.remove('zc-printing');
					root.remove();
				};
				window.addEventListener(
					'afterprint',
					() => {
						for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, restore, { once: true, capture: true });
					},
					{ once: true },
				);
				window.print();
			};
			this.querySelector('.zc-print').addEventListener('click', printPlan);

			// While typing, values update live and an error disappears as soon as it's fixed;
			// a new error is shown when leaving the field, not halfway through typing a number
			form.addEventListener('input', () => update());
			form.addEventListener('change', () => update(true));
			form.addEventListener('submit', (event) => event.preventDefault());
			planSelect.addEventListener('change', () => {
				showWeeks(findPlan(planSelect.value), this.querySelector(`input[name="${id}-week"]:checked`)?.value);
				update();
			});
			chips.addEventListener('change', () => update());
			update(Boolean(inputs.ftp.value || inputs.heart.value));
		}
	}

	customElements.define('zone-calculator', ZoneCalculator);
})();
