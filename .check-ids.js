const fs=require('fs');
const h=fs.readFileSync('D:/auto claw/finance-app/index.html','utf8');
const j=fs.readFileSync('D:/auto claw/finance-app/js/app.js','utf8');

// Extract IDs from HTML
const hIdSet = new Set();
const hRe = /id="([^"]+)"/g;
let hm;
while((hm=hRe.exec(h))!==null) hIdSet.add(hm[1]);

// Extract getElementById calls from JS
const jIdSet = new Set();
const jRe = /getElementById\('([^']+)'\)/g;
let jm;
while((jm=jRe.exec(j))!==null) jIdSet.add(jm[1]);

// Also check querySelector with #id
const qRe = /querySelector\('([^']+)'\)/g;
let qm;
while((qm=qRe.exec(j))!==null){const s=qm[1];if(s.startsWith('#')) jIdSet.add(s.substring(1));}

const missing = [...jIdSet].filter(id => !hIdSet.has(id));
if(missing.length) {
  console.log('MISSING HTML IDs:');
  missing.forEach(id => console.log('  - '+id));
} else {
  console.log('All IDs OK - '+hIdSet.size+' in HTML, '+jIdSet.size+' referenced in JS');
}

// Check for common issues in onclick handlers
const onclickPatterns = j.match(/onclick="[^"]*"/g) || [];
console.log('\nOnclick handlers found: '+onclickPatterns.length);
onclickPatterns.forEach(o => console.log('  '+o.substring(0,120)));
