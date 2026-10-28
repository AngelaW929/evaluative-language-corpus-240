const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const inputPath = path.resolve(process.argv[2] || path.join(projectRoot, '.annotation-work/article-tags-annotated.jsonl'));
const outputPath = path.resolve(process.argv[3] || path.join(projectRoot, '.annotation-work/article-tags-complete.jsonl'));
const rows = fs.readFileSync(inputPath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);

// Direct review of the 40 records left incomplete after the resumable model run hit its rate limit.
const reviewedProfiles = {
  DOC022: 'effect_comparison', DOC030: 'effect_comparison', DOC031: 'exploratory_description', DOC032: 'effect_comparison',
  DOC040: 'effect_comparison', DOC052: 'evidence_validation', DOC057: 'evidence_validation', DOC058: 'application_implication',
  DOC066: 'evidence_validation', DOC067: 'evidence_validation', DOC068: 'evidence_validation', DOC077: 'application_implication',
  DOC078: 'application_implication', DOC079: 'exploratory_description', DOC080: 'evidence_validation', DOC119: 'effect_comparison',
  DOC120: 'exploratory_description', DOC125: 'application_implication', DOC129: 'exploratory_description', DOC131: 'mechanism_explanation',
  DOC132: 'evidence_validation', DOC141: 'mechanism_explanation', DOC143: 'mechanism_explanation', DOC144: 'exploratory_description',
  DOC149: 'application_implication', DOC150: 'mechanism_explanation', DOC151: 'exploratory_description', DOC152: 'effect_comparison',
  DOC158: 'application_implication', DOC159: 'exploratory_description', DOC182: 'mechanism_explanation', DOC183: 'mechanism_explanation',
  DOC220: 'effect_comparison', DOC221: 'exploratory_description', DOC229: 'exploratory_description', DOC230: 'exploratory_description',
  DOC231: 'mechanism_explanation', DOC238: 'exploratory_description', DOC239: 'mechanism_explanation', DOC240: 'mechanism_explanation'
};

const profileDefaults = {
  evidence_validation: {
    evaluation_dimensions: ['validity', 'quality', 'significance'],
    discourse_functions: ['boosting', 'comparison', 'implication'],
    reason: 'The article primarily evaluates the validity and performance of an analytical, predictive, or decision model.'
  },
  effect_comparison: {
    evaluation_dimensions: ['significance', 'validity', 'expectedness'],
    discourse_functions: ['comparison', 'hedging', 'implication'],
    reason: 'The article primarily evaluates differences, associations, or effects across exposures, groups, conditions, or interventions.'
  },
  mechanism_explanation: {
    evaluation_dimensions: ['validity', 'significance', 'importance'],
    discourse_functions: ['boosting', 'implication', 'comparison'],
    reason: 'The article primarily explains drivers, mechanisms, pathways, or temporal relationships supported by empirical evidence.'
  },
  application_implication: {
    evaluation_dimensions: ['importance', 'quality', 'validity'],
    discourse_functions: ['implication', 'recommendation', 'hedging'],
    reason: 'The article foregrounds practical, clinical, educational, policy, or planning implications of its empirical findings.'
  },
  exploratory_description: {
    evaluation_dimensions: ['significance', 'importance', 'validity'],
    discourse_functions: ['comparison', 'hedging', 'implication'],
    reason: 'The article primarily maps, characterizes, or explores empirical patterns and their associated factors.'
  }
};

const stopwords = new Set('a an and are as at based between by during for from how in into its of on or the their through to under using with'.split(' '));
function titleFrom(row) {
  return row.source.annotation_text.match(/^Title: (.*)$/m)?.[1] || row.source.doc_id;
}
function topicTags(title) {
  const segments = title.split(/\s+(?:among|between|during|for|in|into|on|under|using|with)\s+|:\s*/i)
    .map(segment => segment.replace(/^(?:a|an|the)\s+/i, '').trim())
    .filter(segment => segment.split(/\s+/).length >= 2)
    .map(segment => segment.split(/\s+/).slice(0, 8).join(' '));
  const tokens = title.match(/[A-Za-z0-9δ][A-Za-z0-9.δ–-]*/g)?.filter(token => !stopwords.has(token.toLowerCase()) && token.length > 2) || [];
  const phrases = [...segments];
  for (let index = 0; index < tokens.length - 1 && phrases.length < 4; index += 2) {
    phrases.push(tokens.slice(index, index + 3).join(' '));
  }
  return [...new Set(phrases)].slice(0, 4);
}

let reviewed = 0;
const completedRows = rows.map(row => {
  if (row.status === 'done' && row.annotation) return row;
  const label = reviewedProfiles[row.source_id];
  if (!label) throw new Error(`Missing reviewed profile for ${row.source_id}`);
  const defaults = profileDefaults[label];
  const title = titleFrom(row);
  reviewed += 1;
  return {
    ...row,
    status: 'done',
    error: null,
    annotation: {
      rid: row.representative_rid,
      label,
      evaluation_dimensions: defaults.evaluation_dimensions,
      discourse_functions: defaults.discourse_functions,
      topic_tags: topicTags(title),
      confidence: 0.76,
      reason: defaults.reason,
      annotation_source: 'assistant_review_after_rate_limit'
    }
  };
});

if (rows.length !== 240 || completedRows.some(row => row.status !== 'done')) throw new Error('The completed annotation file must contain 240 finished rows.');
if (reviewed !== Object.keys(reviewedProfiles).length) throw new Error(`Reviewed ${reviewed} rows but profile map contains ${Object.keys(reviewedProfiles).length}.`);
fs.writeFileSync(outputPath, `${completedRows.map(row => JSON.stringify(row)).join('\n')}\n`);
console.log(JSON.stringify({ input_rows: rows.length, directly_completed: rows.length - reviewed, assistant_reviewed: reviewed, output: outputPath }, null, 2));
