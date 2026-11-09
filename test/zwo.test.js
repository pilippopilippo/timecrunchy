import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { PLANS, buildLibrary, rideToZwo, rideFile, isTrainerRide, ERG_RANGE } from '../src/index.js';

const { DOMParser } = new JSDOM('').window;
const library = buildLibrary();
const rides = library.flatMap((plan) => plan.rides.map((ride) => ({ plan, ride })));
const trainer = rides.filter(({ ride }) => ride.trainer);

/** Seconds of a .zwo, read back from its steps */
function zwoSeconds(text) {
	const doc = new DOMParser().parseFromString(text, 'application/xml');
	assert.equal(doc.querySelector('parsererror'), null, 'well-formed XML');
	let seconds = 0;
	for (const step of doc.querySelector('workout').children) {
		if (step.tagName === 'IntervalsT') seconds += Number(step.getAttribute('Repeat')) * (Number(step.getAttribute('OnDuration')) + Number(step.getAttribute('OffDuration')));
		else seconds += Number(step.getAttribute('Duration'));
	}
	return seconds;
}

test('every plan, week and day is there', () => {
	assert.equal(library.length, 9);
	for (const plan of PLANS) assert.ok(plan.weeks.every((week) => week.length === 7), plan.name);
	assert.equal(rides.length, 402);
	assert.equal(trainer.length, 256);
});

test('every ride for the trainer is a well-formed .zwo as long as it says', () => {
	for (const { plan, ride } of trainer) {
		assert.equal(zwoSeconds(ride.zwo), ride.minutes * 60, `${plan.name} ${ride.id}`);
		assert.ok(ride.minutes >= 30 && ride.minutes <= 360, ride.id);
	}
});

test('the length of a ride is inside its EM range when the intervals fit', () => {
	const ride = trainer.find(({ ride }) => ride.id === 'new-granfondo-w3-sat').ride;
	assert.equal(ride.minutes, 90);
	assert.equal(ride.title, '90 min EM + 2×[4×2 min] SEPI');
	const wed = trainer.find(({ ride }) => ride.id === 'new-granfondo-w3-wed').ride;
	assert.equal(wed.minutes, 75); // 75–90 min with 3×12 SS: 48 min of work + 15 fits in 75
});

test('Over-Unders end with an Over unless the plan starts them with the Over', () => {
	const ou = rideToZwo([{ kind: 'EM', min: [60, 90] }, { kind: 'OU', reps: 3, min: 9, rbi: 6, pattern: [2, 1] }]).xml;
	assert.match(ou, /<IntervalsT Repeat="3" OnDuration="120" OffDuration="60" OnPower="0.98" OffPower="1.08"/);
});

test('Peak-and-Fade PowerIntervals use a slope, not ERG alone', () => {
	const pfpi = rideToZwo([{ kind: 'EM', min: 60 }, { kind: 'PFPI', reps: 3, min: 2, rbi: 2 }]).xml;
	assert.match(pfpi, /Power="1.2" Cadence="95" Slope="6"/);
});

test('outdoor rides have no file, the trainer option of a choice is used', () => {
	assert.equal(isTrainerRide([{ kind: 'COMMUTE', type: 'easy' }]), false);
	assert.equal(isTrainerRide([{ kind: 'EITHER', a: [{ kind: 'RACE' }], b: [{ kind: 'GROUP', fast: true }] }]), false);
	assert.equal(isTrainerRide([{ kind: 'EITHER', a: [{ kind: 'EM', min: 90 }], b: [{ kind: 'GROUP' }] }]), true);
});

test('file names', () => {
	assert.equal(rideFile('3', 5), 'w3-sat.zwo');
	assert.equal(rideFile('9–11', 0, 'am'), 'w9-11-mon-am.zwo');
});

test('intervals carry their zone as a range around the ERG target', () => {
	assert.deepEqual(ERG_RANGE, { EM: [0.5, 0.811], SS: [0.956, 1], CR: [1.056, 1.111], PI: [1.122, 1.3] });
	const ss = rideToZwo([{ kind: 'EM', min: 60 }, { kind: 'SS', reps: 2, min: 10, rbi: 5 }]).xml;
	assert.match(ss, /Power="0.98" PowerRangeLow="0.956" PowerRangeHigh="1"/);
	assert.match(ss, /Power="0.65" PowerRangeLow="0.5" PowerRangeHigh="0.811"/);
	const ou = rideToZwo([{ kind: 'EM', min: 60 }, { kind: 'OU', reps: 1, min: 9, rbi: 0, pattern: [2, 1] }]).xml;
	assert.match(ou, /OnPower="0.98" OffPower="1.08" OnPowerRangeLow="0.956" OnPowerRangeHigh="1" OffPowerRangeLow="1.056" OffPowerRangeHigh="1.111"/);
	// recoveries, warm-up and cool-down stay fixed
	assert.doesNotMatch(ss, /Power="0.55" PowerRange/);
	// every range contains its ERG target
	for (const { ride } of trainer) {
		for (const m of ride.zwo.matchAll(/ Power="([\d.]+)" PowerRangeLow="([\d.]+)" PowerRangeHigh="([\d.]+)"/g)) {
			const [, power, low, high] = m.map(Number);
			assert.ok(low <= power && power <= high, `${ride.id}: ${m[0]}`);
		}
	}
});
