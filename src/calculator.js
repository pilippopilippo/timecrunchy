// <zone-calculator>: zones for an FTP and/or threshold heart rate, and the plans week by week.
// Built into dist/zone-calculator.js, a classic script the blog inlines in <head> so the element is ready before the
// browser reaches it. With data-downloads (the base url of the API, default "v1/") every ride for the trainer gets a
// link to its .zwo file.
import { ZONES, LIMITS, R, PLANS, DEFAULT_PLAN } from './data.js';
import { TEXT } from './text.js';
import { round, powerTarget, heartTarget, dayLines } from './targets.js';
import { dayRides, isTrainerRide, rideFile } from './zwo.js';

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
					const rides = this.dataset.downloads === undefined ? [] : dayRides(day);
					dayLines(day, base, t).forEach((line, r) => {
						const text = document.createElement('span');
						text.className = 'zc-ride';
						text.textContent = line;
						const ride = rides[r];
						if (ride && isTrainerRide(ride.parts)) {
							const link = document.createElement('a');
							link.className = 'zc-zwo';
							link.href = `${this.dataset.downloads || 'v1/'}zwo/${plan.id}/${rideFile(week, i, ride.slot)}`;
							link.download = '';
							link.textContent = '.zwo';
							link.setAttribute('aria-label', `Download the ${t.days[i]}${ride.slot ? ` ${ride.slot === 'am' ? t.am : t.pm}` : ''} workout as .zwo`);
							text.append(' ', link);
						}
						workout.append(text);
					});
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

if (!customElements.get('zone-calculator')) customElements.define('zone-calculator', ZoneCalculator);
