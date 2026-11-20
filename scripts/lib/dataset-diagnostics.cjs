'use strict';

const {FEATURES} = require('./feature-window.cjs');

function diagnose(rows, sessions, split) {
  const classes = [...new Set(rows.map(row => row.window_label))].sort();
  const ranges = {};
  const warnings = [];
  const vectors = new Map();
  for (const row of rows) {
    const key = JSON.stringify(FEATURES.map(feature => row[feature]));
    if (!vectors.has(key)) vectors.set(key, {count: 0, partitions: new Set(), labels: new Set()});
    const vector = vectors.get(key);
    vector.count++;
    vector.partitions.add(split.get(row.split_group_id));
    vector.labels.add(row.window_label);
  }
  for (const label of classes) {
    const selected = rows.filter(row => row.window_label === label);
    ranges[label] = {};
    for (const feature of FEATURES) {
      const values = selected.map(row => row[feature]).sort((a, b) => a - b);
      ranges[label][feature] = {
        min: values[0], median: values[Math.floor(values.length / 2)],
        max: values.at(-1), distinct: new Set(values).size,
      };
    }
  }
  const constants = [];
  for (const feature of FEATURES) {
    const constantClasses = classes.filter(label => ranges[label][feature].distinct === 1);
    if (constantClasses.length >= 2 && new Set(constantClasses.map(label => ranges[label][feature].min)).size > 1) {
      constants.push({feature, values: Object.fromEntries(constantClasses.map(label => [label, ranges[label][feature].min]))});
      warnings.push(`${feature}: class-dependent constants; inspect generator shortcuts before interpreting model scores`);
    }
  }
  const crossPartition = [...vectors.values()].filter(vector => vector.partitions.size > 1).length;
  if (crossPartition) warnings.push(`${crossPartition} exact feature vectors occur across partitions; inspect shared workload patterns`);
  const versions = {};
  for (const session of sessions) {
    const version = session.manifest.generator_version ?? 'traffic-behavior.v2/unspecified';
    versions[version] = (versions[version] ?? 0) + 1;
  }
  if (Object.keys(versions).length > 1) warnings.push('Multiple generator versions are combined; evaluate each version separately as well');
  return {
    scope: 'Descriptive shortcut checks; absence of warnings does not establish generalization',
    generator_versions: versions, class_feature_ranges: ranges,
    class_dependent_constants: constants,
    duplicates: {
      within_corpus_extra_rows: [...vectors.values()].reduce((sum, vector) => sum + vector.count - 1, 0),
      distinct_vectors_across_partitions: crossPartition,
      distinct_vectors_with_conflicting_labels: [...vectors.values()].filter(vector => vector.labels.size > 1).length,
    },
    warnings,
  };
}

module.exports = {diagnose};
