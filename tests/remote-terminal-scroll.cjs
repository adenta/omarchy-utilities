const {spawn, execFileSync} = require('node:child_process');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const quote = s => "'" + s.replaceAll("'", "'\\''") + "'";
const delay = ms => new Promise(r => setTimeout(r, ms));
const remote = process.argv[2] === 'love';
const localConfig = process.argv[3];
const id = `codex-scroll-test-${process.pid}-${Date.now()}`;
const config = remote ? `/tmp/${id}.conf` : localConfig;
const sshArgs = ['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UpdateHostKeys=no','-o','ConnectTimeout=10','love'];
const env = {...process.env, TERM:'xterm-256color', HISTFILE:'/dev/null', PS1:'SCROLL_TEST> '};
function command(args) {
  return remote ? execFileSync('ssh',[...sshArgs,args.map(quote).join(' ')],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
    : execFileSync(args[0],args.slice(1),{env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
}
function tmux(...args) {return command(['/usr/bin/tmux','-L',id,...args]);}
function state() {return tmux('display-message','-p','#{pane_in_mode}|#{scroll_position}|#{selection_present}|#{pane_current_command}');}
async function until(test, desc) {
  for(let i=0;i<40;i++){try{if(test())return;}catch{}await delay(100);}
  throw Error(`Timed out: ${desc}; state=${state()}`);
}
let client;
(async()=>{
  if(remote)execFileSync('ssh',[...sshArgs,`umask 077; cat > ${quote(config)}`],{input:fs.readFileSync(localConfig)});
  const inner=`stty rows 24 cols 100; exec /usr/bin/tmux -L ${quote(id)} -f ${quote(config)} new-session '/bin/bash --noprofile --norc'`;
  client=remote ? spawn('/usr/bin/script',['-q','-e','-c', ['ssh','-tt',...sshArgs,inner].map(quote).join(' '),'/dev/null'],{env})
    : spawn('/usr/bin/script',['-q','-e','-c',inner,'/dev/null'],{env});
  let output='';client.stdout.on('data',d=>output+=d);client.stderr.on('data',d=>output+=d);
  await until(()=>tmux('list-clients','-F','#{client_pid}').length>0,'client attachment');
  assert.equal(tmux('show-options','-gv','mouse'),'on');
  // Replace the clipboard sink only in this isolated test server.
  if(!remote)tmux('set-option','-s','copy-command','cat >/dev/null');
  await delay(5500);
  client.stdin.write("printf 'SCROLL_ROW_%03d\\n' {1..200}\r");
  await until(()=>tmux('capture-pane','-p').includes('SCROLL_ROW_200'),'generated output');
  client.stdin.write('echo SCROLL_PENDING_INPUT');
  await delay(200);
  client.stdin.write('\x1b[<64;10;10M');
  await until(()=>state().startsWith('1|'),'wheel enters history');
  for(let i=0;i<6;i++)client.stdin.write('\x1b[<64;10;10M');
  await until(()=>Number(state().split('|')[1])>0,'wheel scrolls older output');
  const position=Number(state().split('|')[1]);
  assert(tmux('capture-pane','-p').includes('SCROLL_ROW_200'));
  client.stdin.write('\x1b');
  await until(()=>state().startsWith('0|'),'Escape returns to prompt');
  assert(tmux('capture-pane','-p').includes('echo SCROLL_PENDING_INPUT'));
  // Clear only the disposable shell's pending command.
  client.stdin.write('\x15');await delay(200);
  const before=tmux('list-buffers');
  // Press, drag, release over generated output, in SGR mouse protocol.
  client.stdin.write('\x1b[<0;1;5M\x1b[<32;12;5M\x1b[<0;12;5m');
  await until(()=>state().split('|')[2]==='1','drag selection survives release');
  assert.equal(tmux('list-buffers'),before,'drag must not copy automatically');
  client.stdin.write('\x03');
  await until(()=>state().startsWith('0|'),'Ctrl+C copies selection and exits');
  assert(tmux('show-buffer').includes('SCROLL_ROW_'));
  client.stdin.write('\x01');
  await until(()=>state().split('|')[2]==='1','Ctrl+A still selects history');
  client.stdin.write('\x03');
  await until(()=>state().startsWith('0|'),'Ctrl+C after Ctrl+A');
  assert(tmux('show-buffer').includes('SCROLL_ROW_001'));
  assert(tmux('show-buffer').includes('SCROLL_ROW_200'));
  client.stdin.write('sleep 30\r');
  await until(()=>state().endsWith('|sleep'),'sleep started');
  client.stdin.write('\x03');
  await until(()=>state().endsWith('|bash'),'Ctrl+C still interrupts');
  console.log(JSON.stringify({host:require('node:os').hostname(),passed:true,scrollPosition:position,checks:['wheel enters and scrolls history','Escape restores pending command unchanged','drag release selects without copying','Ctrl+C copies dragged selection','Ctrl+A/C copy retained transcript','Ctrl+C interrupts without selection']}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>{
  try{tmux('kill-server');}catch{}
  if(client){client.stdin.end();client.kill();}
  if(remote)try{command(['/bin/rm','-f',config]);}catch{}
});
