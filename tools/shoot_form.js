// Screenshots of the Aura-Slide form with sample answers, for the guide. Uses the installed Microsoft Edge.
// usage: node tools/shoot_form.js <outDir>   (the form server must be running on 127.0.0.1:8765)
const { chromium } = require(process.env.PW || 'playwright-core');
const out = process.argv[2] || 'docs/screenshots/raw';
(async () => {
  const b = await chromium.launch({ channel: 'msedge' });
  const p = await b.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1.5 });
  await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(800);
  const shot = async n => { await p.waitForTimeout(350); await p.screenshot({ path: `${out}/form_${n}.png` }); console.log('form_' + n); };
  const pick = v => p.check(`input[value="${v}"]`, { force: true });
  const next = async () => { await p.click('#next'); await p.waitForTimeout(400); };
  // 1 basics
  await pick('Project presentation'); await p.fill('#title', 'Solar-powered drip irrigation for small farms');
  await p.fill('#event', 'ME 400 Project and Thesis'); await shot('1_basics');
  await next();
  // 2 people
  await p.fill('[data-r=presenters][data-c=name]', 'Your Name'); await p.fill('[data-r=presenters][data-c=id]', '2110000');
  await p.fill('#sup', 'Dr. Supervisor Name'); await p.fill('#supT', 'Professor, Dept. of Mechanical Engineering');
  await p.fill('#inst', 'Your University'); await shot('2_people');
  await next();
  // 3 audience
  await pick('Examiners / teachers'); await pick('Classmates'); await pick('Some background');
  await p.fill('#min', '10'); await p.fill('#qa', '5'); await shot('3_audience');
  await next();
  // 4 work
  await p.fill('#field', 'Renewable energy, agriculture');
  await p.fill('#sum', 'We built a solar-powered pump that waters crops drop by drop, using 60% less water.');
  await p.fill('[data-r=results][data-c=what]', 'Water saved'); await p.fill('[data-r=results][data-c=value]', '60 %');
  await shot('4_work');
  await next();
  // 5 plan (switch off auto to show the rows)
  await p.click('#auto'); await p.waitForTimeout(300);
  const t = await p.$$('[data-r=plan][data-c=title]'), c = await p.$$('[data-r=plan][data-c=covers]');
  await t[0].fill('The problem'); await c[0].fill('Farms waste water; grid power is far away');
  await t[1].fill('Our design'); await c[1].fill('Solar panel, pump and drip lines');
  await t[2].fill('Results'); await c[2].fill('Water saved and cost per season');
  await shot('5_plan');
  await p.click('#auto');
  await next();
  // 6 files
  await p.waitForTimeout(700); await shot('6_files');
  await next(); await shot('7_content'); await next(); await shot('8_day'); await next(); await next();
  await shot('9_review');
  await next(); await shot('10_saved');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
