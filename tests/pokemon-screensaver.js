#!/usr/bin/env node
// Isolated HOME and command stubs: never opens windows or touches live state.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const repo = path.resolve(__dirname, '..');
const files = path.join(repo, 'files');
const names = ['001-bulbasaur.txt', '002-ivysaur.txt', '003-venusaur.txt', '004-charmander.txt'];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function fixture(extra = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pokemon-test-'));
  const bin = path.join(home, 'bin');
  const config = path.join(home, '.config/omarchy/screensaver');
  const art = path.join(home, '.local/share/omarchy-pokemon-screensaver/art');
  const state = path.join(home, '.local/state/omarchy-pokemon-screensaver/cycle-state');
  for (const dir of [bin, config, path.dirname(art), path.dirname(state), path.join(home, '.local/bin')]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.cpSync(path.join(files, '.local/share/omarchy-pokemon-screensaver/art'), art, { recursive: true });
  fs.writeFileSync(state, names.join('\n') + '\n');
  for (const rel of ['.config/omarchy/screensaver/launch', '.config/omarchy/screensaver/render', '.config/omarchy/screensaver/check-upstream', '.config/omarchy/screensaver/upstream.sha256',
    '.local/bin/omarchy-pokemon-select', '.local/bin/omarchy-pokemon-screensaver']) {
    fs.copyFileSync(path.join(files, rel), path.join(home, rel));
  }
  function stub(name, body) {
    fs.writeFileSync(path.join(bin, name), '#!/bin/bash\n' + body + '\n', { mode: 0o755 });
  }
  stub('stty', 'echo "${TEST_ROWS:-60} 160"');
  stub('hyprctl', `printf '%s\\n' "$*" >> "$HOME/hypr.log"
case $1 in
  activewindow) printf '{"class":"%s"}\\n' "\${TEST_FOCUS:-org.omarchy.screensaver}" ;;
  monitors)
    if [[ -n \${TEST_MONITORS:-} ]]; then
      printf '%s\\n' "$TEST_MONITORS"
    else
      echo '[{"name":"monitor-one","width":2560,"height":1600,"scale":2},{"name":"monitor-two","width":3840,"height":2160,"scale":3}]'
    fi ;;
esac`);
  stub('pkill', 'printf "%s\\n" "$*" >> "$HOME/cleanup.log"');
  stub('pgrep', '[[ ${TEST_RUNNING:-0} == 1 ]]');
  stub('omarchy-cmd-missing', '[[ ${TEST_MISSING:-0} == 1 ]]');
  stub('omarchy-toggle-enabled', '[[ ${TEST_DISABLED:-0} == 1 ]]');
  stub('omarchy-hyprland-monitor-focused', 'echo monitor-one');
  stub('xdg-terminal-exec', 'echo "${TEST_TERMINAL:-foot.desktop}"');
  stub('omarchy-notification-send', 'exit 0');
  stub('omarchy', 'exit 0');
  stub('socat', `printf 'openwindow>>one,org.omarchy.screensaver,title\\nopenwindow>>two,org.omarchy.screensaver,title\\n'`);
  stub('shuf', `# Artwork shuffling still uses the real command.
if [[ $1 != -n || $2 != 1 || $3 != -e ]]; then exec /usr/bin/shuf "$@"; fi
shift 3
printf '%s\\n' "$*" >> "$HOME/pools-$TEST_ID.log"
count=$(wc -l < "$HOME/pools-$TEST_ID.log")
((count == \${TEST_SHUFFLE_FAIL_AT:-0})) && exit 24
IFS=, read -r -a choices <<< "\${TEST_EFFECT_CHOICES:-}"
wanted=\${choices[count-1]:-beams}
for candidate in "$@"; do
  if [[ $candidate == "$wanted" ]]; then printf '%s\\n' "$candidate"; exit 0; fi
done
printf '%s\\n' "$1"`);
  stub('ttfx', `printf '%s\\n' "$2" >> "$HOME/effects-$TEST_ID.log"
printf '%s\\n' "$*" >> "$HOME/arguments-$TEST_ID.log"
printf '%s %s\\n' "\${COLUMNS-unset}" "\${LINES-unset}" >> "$HOME/dimensions-$TEST_ID.log"
count=$(wc -l < "$HOME/effects-$TEST_ID.log")
# Simulate another monitor replacing the shared branding file.
mkdir -p "$HOME/.config/omarchy/branding"
echo other-monitor > "$HOME/.config/omarchy/branding/screensaver.txt"
[[ -r $2 ]] || exit 22
[[ \${TEST_SLOW:-0} == 1 ]] && exec sleep 30
((count == \${TEST_FAIL_AT:-8})) && exit 23
sleep 0.04`);
  const env = { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}`,
    XDG_RUNTIME_DIR: home, HYPRLAND_INSTANCE_SIGNATURE: 'test', OMARCHY_PATH: '/unused', TEST_ID: 'one', ...extra };
  const effects = id => {
    const log = path.join(home, `effects-${id || env.TEST_ID}.log`);
    return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : [];
  };
  const readState = () => fs.readFileSync(state, 'utf8');
  function start(command, args = [], overrides = {}) {
    const child = spawn(command, args, { env: { ...env, ...overrides }, stdio: ['pipe', 'ignore', 'pipe'] });
    let errors = '';
    child.stderr.on('data', chunk => errors += chunk);
    const timer = setTimeout(() => child.kill('SIGTERM'), 12000);
    const done = new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal, errors });
      });
    });
    return { child, done };
  }
  return { home, config, art, state, effects, readState, start,
    render: (overrides = {}) => start(path.join(config, 'render'), [path.join(art, names[0])], overrides),
    launch: (args = []) => start(path.join(home, '.local/bin/omarchy-pokemon-screensaver'), args),
    cleanup: () => fs.rmSync(home, { recursive: true, force: true }) };
}

async function test(label, extra, run) {
  const f = fixture(extra);
  try {
    await run(f);
    console.log(`PASS ${label}`);
  } finally {
    f.cleanup();
  }
}

async function waitForEffect(f, count = 1) {
  for (let attempt = 0; attempt < 500; attempt++) {
    if (f.effects().length >= count) return;
    await delay(10);
  }
  throw new Error('Timed out waiting for effect');
}

async function main() {
  for (const rows of [25, 26, 27, 28]) {
    await test(`terminal with ${rows} rows uses its real canvas and excludes Rings`,
      { TEST_ROWS: String(rows), TEST_FAIL_AT: '1', COLUMNS: '7', LINES: '9' }, async f => {
        assert.equal((await f.render().done).code, 23);
        const args = fs.readFileSync(path.join(f.home, 'arguments-one.log'), 'utf8');
        assert.match(args, /--canvas-width 0 --canvas-height 0 /);
        assert.match(args, /--no-eol --no-restore-cursor beams\n/);
        assert.doesNotMatch(args, /--random-effect/);
        assert.ok(!fs.readFileSync(path.join(f.home, 'pools-one.log'), 'utf8').split(/\s+/).includes('rings'));
        assert.equal(fs.readFileSync(path.join(f.home, 'dimensions-one.log'), 'utf8'), 'unset unset\n');
      });
  }
  await test('three completed effects per artwork; immutable input', {}, async f => {
    const result = await f.render().done;
    assert.equal(result.code, 23, result.errors);
    assert.deepEqual(f.effects().slice(0, 7).map(p => path.basename(p)),
      [names[0], names[0], names[0], names[1], names[1], names[1], names[2]]);
    assert.equal(f.effects().length, 8);
    assert.equal(f.readState(), `${names[2]}\n${names[3]}\n`);
    assert.match(fs.readFileSync(path.join(f.home, 'hypr.log'), 'utf8'), /invisible = false/);
  });
  await test('entrances for each group; visible effects within groups; no adjacent repeats', {
    TEST_EFFECT_CHOICES: 'beams,burn,beams,beams,highlight,highlight,beams,colorshift',
  }, async f => {
    assert.equal((await f.render().done).code, 23);
    const selected = fs.readFileSync(path.join(f.home, 'arguments-one.log'), 'utf8')
      .trim().split('\n').map(line => line.split(' ').at(-1));
    assert.deepEqual(selected, ['beams', 'burn', 'beams', 'binarypath', 'highlight', 'beams', 'binarypath', 'colorshift']);
    const pools = fs.readFileSync(path.join(f.home, 'pools-one.log'), 'utf8').trim().split('\n').map(line => line.split(' '));
    const visible = ['burn', 'colorshift', 'crumble', 'errorcorrect', 'highlight', 'smoke', 'spotlights', 'thunderstorm', 'unstable', 'vhstape'];
    assert.deepEqual(pools.map(pool => pool.length), [26, 35, 35, 25, 35, 35, 25, 35]);
    for (const [index, pool] of pools.entries()) {
      assert.equal(new Set(pool).size, pool.length, 'no duplicate candidates');
      assert.ok(!pool.includes('rings'));
      assert.ok(!pool.includes(selected[index - 1]), 'exclude previous effect, including group boundaries');
      for (const effect of visible) {
        assert.equal(pool.includes(effect), index % 3 !== 0 && effect !== selected[index - 1], `${effect} eligibility at cycle ${index + 1}`);
      }
    }
  });
  await test('effect selection failure stops without advancing artwork', { TEST_SHUFFLE_FAIL_AT: '2' }, async f => {
    const before = f.readState();
    assert.equal((await f.render().done).code, 1);
    assert.equal(f.effects().length, 1);
    assert.equal(f.readState(), before);
    assert.match(fs.readFileSync(path.join(f.home, 'hypr.log'), 'utf8'), /invisible = false/);
  });
  await test('failed third effect does not advance', { TEST_FAIL_AT: '3' }, async f => {
    const before = f.readState();
    assert.equal((await f.render().done).code, 23);
    assert.equal(f.effects().length, 3);
    assert.equal(f.readState(), before);
  });
  await test('selection failure stops after three effects', { TEST_FAIL_AT: '99' }, async f => {
    fs.writeFileSync(f.state, 'invalid-artwork.txt\n');
    const result = await f.render().done;
    assert.equal(result.code, 1);
    assert.match(result.errors, /Unknown artwork/);
    assert.equal(f.effects().length, 3);
    assert.equal(f.readState(), 'invalid-artwork.txt\n');
  });
  for (const action of ['signal', 'keyboard', 'focus']) {
    await test(`${action} dismissal cleans up without selection`, { TEST_SLOW: '1',
      ...(action === 'focus' ? { TEST_FOCUS: 'another-app' } : {}) }, async f => {
      const before = f.readState();
      const running = f.render();
      await waitForEffect(f);
      if (action === 'signal') running.child.kill('SIGTERM');
      if (action === 'keyboard') running.child.stdin.write('x');
      assert.equal((await running.done).code, 0);
      assert.equal(f.effects().length, 1);
      assert.equal(f.readState(), before);
      assert.match(fs.readFileSync(path.join(f.home, 'hypr.log'), 'utf8'), /invisible = false/);
    });
  }
  await test('two monitors use separate paths and serialized selections', { TEST_FAIL_AT: '4' }, async f => {
    const results = await Promise.all([f.render({ TEST_ID: 'one' }).done, f.render({ TEST_ID: 'two' }).done]);
    assert.deepEqual(results.map(r => r.code), [23, 23]);
    const one = f.effects('one').map(p => path.basename(p));
    const two = f.effects('two').map(p => path.basename(p));
    assert.deepEqual(one.slice(0, 3), [names[0], names[0], names[0]]);
    assert.deepEqual(two.slice(0, 3), [names[0], names[0], names[0]]);
    assert.deepEqual([one[3], two[3]].sort(), [names[1], names[2]]);
  });
  for (const [label, extra, code] of [
    ['already running', { TEST_RUNNING: '1' }, 0],
    ['disabled', { TEST_DISABLED: '1' }, 1],
    ['missing ttfx', { TEST_MISSING: '1' }, 1],
    ['unsupported terminal', { TEST_TERMINAL: 'unsupported.desktop' }, 1],
  ]) {
    await test(`${label} launch does not select`, extra, async f => {
      const before = f.readState();
      assert.equal((await f.launch().done).code, code);
      assert.equal(f.readState(), before);
    });
  }
  for (const terminal of ['foot.desktop', 'com.mitchellh.ghostty.desktop', 'Alacritty.desktop', 'kitty.desktop']) {
    await test(`${terminal}: forced launch passes same artwork to both monitors`,
      { TEST_DISABLED: '1', TEST_TERMINAL: terminal }, async f => {
        assert.equal((await f.launch(['force']).done).code, 0);
        const commands = fs.readFileSync(path.join(f.home, 'hypr.log'), 'utf8').split('\n').filter(s => s.includes('exec_cmd'));
        assert.equal(commands.length, 2);
        for (const command of commands) {
          assert.ok(command.includes(`${f.config}/render ${f.art}/${names[1]}`), command);
        }
        const fontKey = terminal.includes('foot') ? 'size=' : terminal.includes('ghostty') ? '--font-size=' :
          terminal.includes('Alacritty') ? 'font.size=' : 'font_size=';
        assert.ok(commands[0].includes(`${fontKey}17.3`), commands[0]);
        assert.ok(commands[1].includes(`${fontKey}15.6`), commands[1]);
        if (terminal.includes('ghostty')) {
          for (const command of commands) assert.ok(command.includes('--window-padding-balance=true'), command);
          for (const command of commands) assert.ok(command.includes('--window-inherit-font-size=false'), command);
          for (const command of commands) assert.ok(command.includes('--fullscreen=true'), command);
        }
        if (terminal.includes('foot')) {
          for (const command of commands) {
            assert.ok(command.includes('--override=pad=0x0\\ center'), command);
            assert.ok(command.includes('--fullscreen'), command);
          }
        }
        assert.equal(f.readState(), names.slice(1).join('\n') + '\n');
      });
  }
  await test('portrait and very small displays use bounded font sizes', {
    TEST_MONITORS: JSON.stringify([
      { name: 'portrait', width: 1080, height: 1920, scale: 1, transform: 1 },
      { name: 'small', width: 480, height: 320, scale: 1 },
    ]),
  }, async f => {
    assert.equal((await f.launch(['force']).done).code, 0);
    const commands = fs.readFileSync(path.join(f.home, 'hypr.log'), 'utf8').split('\n').filter(s => s.includes('exec_cmd'));
    assert.ok(commands[0].includes('size=18'), commands[0]);
    assert.ok(commands[1].includes('size=8'), commands[1]);
  });
  await test('--pick-only still selects without launching', {}, async f => {
    assert.equal((await f.launch(['--pick-only']).done).code, 0);
    assert.equal(f.readState(), names.slice(1).join('\n') + '\n');
    assert.equal(fs.existsSync(path.join(f.home, 'hypr.log')), false);
  });
}

main().catch(error => { console.error(error); process.exitCode = 1; });
