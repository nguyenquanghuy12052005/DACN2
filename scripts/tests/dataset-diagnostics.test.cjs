const {test} = require('node:test');
const assert = require('node:assert/strict');
const {diagnose} = require('../lib/dataset-diagnostics.cjs');
const {FEATURES} = require('../lib/feature-window.cjs');

test('diagnostics expose class constants, duplicate vectors and mixed generator provenance', () => {
  const base = Object.fromEntries(FEATURES.map(feature => [feature, 0]));
  const rows = [
    {...base, window_label: 'Normal', split_group_id: 'a', rho_ja4: 1},
    {...base, window_label: 'Normal', split_group_id: 'b', rho_ja4: 1},
    {...base, window_label: 'Flash_Crowd', split_group_id: 'c', rho_ja4: .5},
  ];
  const result = diagnose(rows, [{manifest: {}}, {manifest: {generator_version: 'traffic-behavior.v3'}}],
    new Map([['a', 'train'], ['b', 'test'], ['c', 'validation']]));
  assert.equal(result.duplicates.distinct_vectors_across_partitions, 1);
  assert.equal(result.class_dependent_constants[0].feature, 'rho_ja4');
  assert.equal(result.class_feature_ranges.Normal.rho_ja4.median, 1);
  assert.equal(result.warnings.length, 3);
  assert.deepEqual(diagnose([], [], new Map()).warnings, []);
});
