const path=require('node:path');
const {prepareTraining}=require('./lib/training-data.cjs');
const args=process.argv.slice(2);
if(args.length!==2) { console.error('Usage: node scripts/prepare-training.cjs TRAFFIC_DIRECTORY NEW_OUTPUT_DIRECTORY'); process.exitCode=1; }
else prepareTraining(path.resolve(args[0]),path.resolve(args[1])).then(report=>{
  console.log(JSON.stringify({ready:report.ready,windows:report.eligible_windows,groups:report.independent_groups,issues:report.issues,
    report:path.resolve(args[1],'quality-report.json')}));
  if(!report.ready) process.exitCode=1;
}).catch(error=>{console.error(error.message);process.exitCode=1;});
