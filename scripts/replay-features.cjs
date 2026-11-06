'use strict';
const path = require('node:path');
const fs = require('node:fs');
const {replay} = require('./lib/feature-window.cjs');
const [directory,end,markovFile] = process.argv.slice(2);
if (!directory || !end) {
  console.error('Usage: node scripts/replay-features.cjs SESSION_DATASET_DIR END_UTC [MARKOV_JSON]');
  process.exitCode = 1;
} else {
  const model = markovFile ? JSON.parse(fs.readFileSync(markovFile,'utf8')) : null;
  replay(path.resolve(directory),end,model).then(result => {
    console.log(JSON.stringify({rows:result.rows,duplicates:result.duplicates,malformed_lines:result.malformed_lines,csv_sha256:result.csv_sha256}));
  }).catch(error => { console.error(error.message); process.exitCode=1; });
}
