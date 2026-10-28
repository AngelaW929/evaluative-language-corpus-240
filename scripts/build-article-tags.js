const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const inputPath = path.resolve(process.argv[2] || path.join(projectRoot, '.annotation-work/article-tags-annotated.jsonl'));
const outputPath = path.resolve(process.argv[3] || path.join(projectRoot, 'article-tags.js'));

const profiles = new Set(['evidence_validation', 'effect_comparison', 'mechanism_explanation', 'application_implication', 'exploratory_description', 'limitation_reflection']);
const dimensions = new Set(['importance', 'significance', 'validity', 'quality', 'expectedness']);
const functions = new Set(['hedging', 'boosting', 'comparison', 'limitation', 'implication', 'recommendation']);
const dimensionFallbacks = {
  evidence_validation: ['validity', 'quality'], effect_comparison: ['significance', 'validity'], mechanism_explanation: ['validity', 'significance'],
  application_implication: ['importance', 'quality'], exploratory_description: ['significance', 'importance'], limitation_reflection: ['validity', 'quality']
};
const functionFallbacks = {
  evidence_validation: ['boosting', 'comparison'], effect_comparison: ['comparison', 'hedging'], mechanism_explanation: ['implication', 'comparison'],
  application_implication: ['implication', 'recommendation'], exploratory_description: ['comparison', 'hedging'], limitation_reflection: ['limitation', 'hedging']
};
const rows = fs.readFileSync(inputPath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);

if (rows.length !== 240) throw new Error(`Expected 240 annotation rows, received ${rows.length}.`);
const tags = {};
let assistantReviewed = 0;
for (const row of rows) {
  if (row.status !== 'done' || !row.annotation) throw new Error(`Incomplete annotation: ${row.source_id}`);
  const annotation = row.annotation;
  if (annotation.annotation_source === 'assistant_review_after_rate_limit') assistantReviewed += 1;
  if (!profiles.has(annotation.label)) throw new Error(`Invalid profile for ${row.source_id}: ${annotation.label}`);
  const evaluationDimensions = [...new Set(annotation.evaluation_dimensions || [])].filter(tag => dimensions.has(tag)).slice(0, 3);
  const discourseFunctions = [...new Set(annotation.discourse_functions || [])].filter(tag => functions.has(tag)).slice(0, 4);
  const topicTags = [...new Set(annotation.topic_tags || [])].map(String).map(tag => tag.trim()).filter(Boolean).slice(0, 4);
  tags[row.source_id] = {
    label: annotation.label,
    evaluation_dimensions: evaluationDimensions.length ? evaluationDimensions : dimensionFallbacks[annotation.label],
    discourse_functions: discourseFunctions.length ? discourseFunctions : functionFallbacks[annotation.label],
    topic_tags: topicTags,
    confidence: Math.min(1, Math.max(0, Number(annotation.confidence) || 0)),
    reason: String(annotation.reason || '').trim()
  };
}

if (Object.keys(tags).length !== 240) throw new Error('Document IDs are not unique.');
const payload = `window.ARTICLE_TAGS = ${JSON.stringify(tags)};\nwindow.ARTICLE_TAG_META = ${JSON.stringify({ documents: 240, method: 'machine_assisted_document_features', prompt_version: 'article-tags-v1', model_annotated: 240 - assistantReviewed, assistant_reviewed: assistantReviewed, review_status: 'provisional' })};\n`;
fs.writeFileSync(outputPath, payload);
console.log(JSON.stringify({ input: inputPath, output: outputPath, documents: Object.keys(tags).length }, null, 2));
