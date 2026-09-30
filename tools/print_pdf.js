// Print an HTML file to an A4 PDF with Microsoft Edge.  usage: node tools/print_pdf.js <in.html> <out.pdf>
const path = require('path');
const { chromium } = require(process.env.PW || 'X:/CLPHP_Project/frontend/node_modules/playwright');
(async () => {
  const [inp, out] = process.argv.slice(2);
  const b = await chromium.launch({ channel: 'msedge' });
  const p = await b.newPage();
  await p.goto('file:///' + path.resolve(inp).replace(/\\/g, '/'), { waitUntil: 'load' });
  await p.pdf({ path: out, format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
