// The element built from src/ must show exactly what the blog's calculator showed before the move
// (test/fixtures/zone-calculator.blog-1b330d9.js, cknlgs-blog at 1b330d9). When the plans or the text change on
// purpose, update the fixture or drop this comparison. White space is compared collapsed, as the browser renders it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const original = await readFile(new URL('./fixtures/zone-calculator.blog-1b330d9.js', import.meta.url), 'utf8');
const built = await readFile(new URL('../dist/zone-calculator.js', import.meta.url), 'utf8');

function page(script, attributes = '') {
	const dom = new JSDOM(`<!doctype html><html><head></head><body><zone-calculator${attributes}></zone-calculator></body></html>`, { url: 'https://cknlgs.cc/blog/time-crunched-training/', runScripts: 'outside-only' });
	dom.window.eval(script);
	return dom.window;
}

function snapshot(window, plan, week, values) {
	const doc = window.document;
	const el = doc.querySelector('zone-calculator');
	el.querySelector('input[name="ftp"]').value = values.ftp;
	el.querySelector('input[name="heart"]').value = values.heart;
	const select = el.querySelector('select');
	select.value = plan;
	select.dispatchEvent(new window.Event('change', { bubbles: true }));
	const chip = el.querySelector(`.zc-chips input[value="${week}"]`);
	chip.checked = true;
	chip.dispatchEvent(new window.Event('change', { bubbles: true }));
	el.querySelector('form').dispatchEvent(new window.Event('change', { bubbles: true }));
	let printed = '';
	window.print = () => (printed = doc.querySelector('.zc-print-root').innerHTML);
	el.querySelector('.zc-print').click();
	// Indentation inside the HTML templates changed with the move: runs of white space render the same
	const normalize = (html) => html.replace(/zc\d+/g, 'zc').replace(/\s+/g, ' ');
	return { html: normalize(el.innerHTML), printed: normalize(printed) };
}

test('same output as the blog calculator, every plan and week', () => {
	const before = page(original);
	const after = page(built);
	const plans = [...before.document.querySelectorAll('option')].map((o) => o.value);
	assert.equal(plans.length, 9);
	let compared = 0;
	for (const values of [{ ftp: '250', heart: '165' }, { ftp: '', heart: '' }]) {
		for (const plan of plans) {
			before.document.querySelector('select').value = plan;
			before.document.querySelector('select').dispatchEvent(new before.Event('change', { bubbles: true }));
			const weeks = [...before.document.querySelectorAll('.zc-chips input')].map((i) => i.value);
			for (const week of weeks) {
				assert.deepEqual(snapshot(after, plan, week, values), snapshot(before, plan, week, values), `${plan} ${week}`);
				compared++;
			}
		}
	}
	assert.equal(compared, 2 * (7 * 9 + 12 + 4)); // 7 plans with 9 week labels, Ultraendurance 12, Maintenance 4
});

test('data-downloads adds a .zwo link to each ride for the trainer', () => {
	const window = page(built, ' data-downloads="v1/"');
	const { document } = window;
	const select = document.querySelector('select');
	select.value = 'new-granfondo';
	select.dispatchEvent(new window.Event('change', { bubbles: true }));
	const chip = document.querySelector('.zc-chips input[value="3"]');
	chip.checked = true;
	chip.dispatchEvent(new window.Event('change', { bubbles: true }));
	const links = [...document.querySelectorAll('a.zc-zwo')].map((a) => a.getAttribute('href'));
	assert.deepEqual(links, ['v1/zwo/new-granfondo/w3-wed.zwo', 'v1/zwo/new-granfondo/w3-thu.zwo', 'v1/zwo/new-granfondo/w3-sat.zwo', 'v1/zwo/new-granfondo/w3-sun.zwo']);
});
