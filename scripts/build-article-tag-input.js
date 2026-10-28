const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const outputPath = path.resolve(process.argv[2] || path.join(projectRoot, '.annotation-work/article-inputs.jsonl'));
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(projectRoot, 'corpus-data.js'), 'utf8'), sandbox);

const corpus = sandbox.window.CORPUS_DATA;
if (!corpus?.documents?.length) throw new Error('Corpus data is unavailable.');

function representativeSentences(section) {
  const sentences = section.p.flat();
  if (sentences.length <= 9) return sentences;
  const middle = Math.max(3, Math.floor(sentences.length / 2) - 1);
  return [...sentences.slice(0, 3), ...sentences.slice(middle, middle + 3), ...sentences.slice(-3)];
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const rows = corpus.documents.map(doc => {
  const excerpts = doc.c.map(section => `${section.t}: ${representativeSentences(section).join(' ')}`).join('\n');
  return {
    doc_id: doc.id,
    subject: doc.s,
    journal: doc.j,
    year: doc.y,
    study_method: doc.m,
    annotation_text: [
      `Title: ${doc.t}`,
      `Subject: ${doc.s}`,
      `Study method: ${doc.m}`,
      `Abstract: ${doc.ab || ''}`,
      `Representative Results/Discussion excerpts:\n${excerpts}`
    ].join('\n')
  };
});

fs.writeFileSync(outputPath, `${rows.map(row => JSON.stringify(row)).join('\n')}\n`);
console.log(JSON.stringify({ output: outputPath, rows: rows.length }, null, 2));
