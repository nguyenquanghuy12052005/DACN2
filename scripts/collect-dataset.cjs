'use strict';
const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {setTimeout:delay}=require('node:timers/promises');
const {CLASSES,prepareTraining}=require('./lib/training-data.cjs');
const root=path.resolve(__dirname,'..');
function parse(args) {
  const options={};
  for(const arg of args) {
    const match=/^--(sessions|seconds|seed)=(\d+)$/.exec(arg);
    if(!match||Object.hasOwn(options,match[1]))throw Error('Use --sessions=N --seconds=N [--seed=N]');
    options[match[1]]=Number(match[2]);
  }
  options.seed??=1;
  if(!Number.isSafeInteger(options.sessions)||options.sessions<1||options.sessions>30||
     !Number.isSafeInteger(options.seconds)||options.seconds<10||options.seconds>300||
     !Number.isSafeInteger(options.seed)||options.seed<1||options.seed>1000000)
    throw Error('sessions=1..30 and seconds=10..300 are required; seed=1..1000000');
  return options;
}
async function main() {
  const options=parse(process.argv.slice(2));
  const lockFile=path.join(root,'.local-backups/ui-live/session.lock');
  if(fs.existsSync(lockFile))throw Error('A Live session exists. Stop it first: node scripts/dashboard-live.cjs stop --team-db');
  for(const port of [5173,13001,18444]) await new Promise((resolve,reject)=>{
    const s=net.createServer();s.once('error',reject);s.listen(port,'127.0.0.1',()=>s.close(resolve));
  });
  const out=path.join(root,'.local-backups/traffic-batches','batch-'+randomUUID());fs.mkdirSync(out,{recursive:true});
  const report={started_at:new Date().toISOString(),options,sessions:[],state:'running'};
  const save=()=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));
  let stopped=false,live,generator;
  const requestStop=(file,pid,kind)=>{
    if(!fs.existsSync(file))return;
    const lock=JSON.parse(fs.readFileSync(file,'utf8'));
    if(lock.pid!==pid)throw Error('Refuse to stop a session owned by another process');
    const id=kind==='live'?lock.sessionId:lock.id;
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw Error('Invalid owned lock');
    fs.writeFileSync(path.join(path.dirname(file),id,'stop.request'),'');
  };
  const launch=(args,file)=>{
    const fd=fs.openSync(path.join(out,file),'a');
    const processHandle=spawn(process.execPath,args,{cwd:root,env:process.env,windowsHide:true,stdio:['ignore',fd,fd]});
    let ended=false;
    const closed=new Promise((resolve,reject)=>{
      processHandle.once('error',reject);
      processHandle.once('close',code=>{ended=true;fs.closeSync(fd);resolve(code);});
    });
    return {child:processHandle,closed,ended:()=>ended};
  };
  const signal=()=>{stopped=true;};
  const stopLive=async owned=>{
    requestStop(lockFile,owned.child.pid,'live');
    const deadline=Date.now()+15000;
    while(!owned.ended()) {
      // A runner can retain an idle library handle after fully completing its
      // explicit shutdown. Only our own, confirmed-clean Node child may exit.
      const id=owned.sessionId;
      const file=id?path.join(root,'.local-backups/ui-live',id,'result.json'):null;
      if(file&&fs.existsSync(file)) {
        const status=JSON.parse(fs.readFileSync(file,'utf8'));
        if(status.cleanup===true&&status.stoppedAt) {owned.child.kill();break;}
      }
      if(Date.now()>deadline)throw Error('Live cleanup timed out; manual recovery required');
      await delay(100);
    }
    const code=await owned.closed;
    const id=owned.sessionId;
    const status=JSON.parse(fs.readFileSync(path.join(root,'.local-backups/ui-live',id,'result.json'),'utf8'));
    if(!status.cleanup||status.error||status.collectorError)throw Error('Live cleanup/capture not confirmed healthy');
    return code;
  };
  process.on('SIGINT',signal);process.on('SIGTERM',signal);
  save();
  try {
    for(let round=0;round<options.sessions&&!stopped;round++) {
      console.log(`Gateway session ${round+1}/${options.sessions}: 4 scenarios x ${options.seconds}s; max20 actions/s,4 clients.`);
      live=launch(['scripts/dashboard-live.cjs','--team-db','--test-db','--traffic-lab','--no-browser'],`live-${round}.log`);
      let own;
      const deadline=Date.now()+90000;
      while(Date.now()<deadline&&!live.ended()&&!stopped) {
        if(fs.existsSync(lockFile)) {
          const lock=JSON.parse(fs.readFileSync(lockFile,'utf8'));
          if(lock.pid!==live.child.pid)throw Error('Unexpected Live lock owner');
          live.sessionId=lock.sessionId;
          const file=path.join(path.dirname(lockFile),lock.sessionId,'result.json');
          if(fs.existsSync(file)) {const status=JSON.parse(fs.readFileSync(file,'utf8'));if(status.readyAt){own=lock;break;}}
        }
        await delay(250);
      }
      if(!own)throw Error('Owned test Live did not become ready; inspect batch log');
      report.sessions.push(own.sessionId);save();
      for(let index=0;index<CLASSES.length&&!stopped;index++) {
        generator=launch(['scripts/generate-traffic.cjs',CLASSES[index],`--seconds=${options.seconds}`,`--seed=${options.seed+round*4+index}`,'--engine=mixed'],`generator-${round}-${index}.log`);
        const timeout=Date.now()+(options.seconds+60)*1000;
        while(!generator.ended()) {
          if(stopped)requestStop(path.join(root,'.local-backups/traffic/session.lock'),generator.child.pid,'generator');
          if(Date.now()>timeout)throw Error('Generator deadline exceeded; retain logs for recovery');
          await delay(250);
        }
        if(await generator.closed!==0)throw Error('Generator failed; inspect its batch log');
        generator=null;
      }
      await stopLive(live);
      const result=JSON.parse(fs.readFileSync(path.join(path.dirname(lockFile),own.sessionId,'result.json'),'utf8'));
      if(!result.cleanup)throw Error('Test fixture cleanup not confirmed');
      live=null;
    }
    report.state=stopped?'interrupted':'completed';
    if(!stopped) {
      report.training=await prepareTraining(path.join(root,'.local-backups/traffic'),path.join(out,'training'));
      if(!report.training.ready)process.exitCode=1;
    }
  } catch(error) {report.state='failed';report.error=error.message;process.exitCode=1;}
  finally {
    // Request graceful cleanup only from children whose lock PID still matches.
    if(generator&&!generator.ended()) {
      requestStop(path.join(root,'.local-backups/traffic/session.lock'),generator.child.pid,'generator');
      await generator.closed;
    }
    if(live&&!live.ended()) await stopLive(live);
    report.ended_at=new Date().toISOString();save();
    process.off('SIGINT',signal);process.off('SIGTERM',signal);
    console.log(JSON.stringify({state:report.state,ready:report.training?.ready??false,out,error:report.error??null}));
  }
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={parse};
