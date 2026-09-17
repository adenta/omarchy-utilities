const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const history = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../History.js'), 'utf8'), history);
const parse = rows => history.parse(JSON.stringify({type: 'a(udu)', data: [rows]}));
const plain = value => JSON.parse(JSON.stringify(value));
assert.deepEqual(plain(parse([[300, 70, 2], [100, 90, 1]])).map(p => p.time), [100, 300]);
assert.equal(parse([[0, 20, 2], [100, -1, 2], [100, 101, 2], [100, 80, 99], ['100', 80, 2], [100, 80, 1.5], null]).length, 0);
assert.throws(() => history.parse('broken'));
assert.throws(() => history.parse('{}'));
assert.deepEqual(plain(parse([])), []);
const points = parse([[100, 90, 2], [200, 0, 0], [300, 70, 2]]);
const groups = history.segments(points, 50, 400);
assert.deepEqual(plain(groups).map(g => g.length), [1, 1]);
assert.equal(history.segments(points, 250, 400).length, 1);
assert.equal(history.nearest(groups, 280).time, 300);
assert.equal(history.nearest([], 200), null);
assert.equal(history.stateLabel(1), 'Charging');
assert.equal(history.stateLabel(2), 'Discharging');
const rate = rows => history.parse(JSON.stringify({type: 'a(udu)', data: [rows]}), 'rate');
assert.equal(rate([[100, 125, 2], [130, -1, 2]]).length, 1);
const watts = rate([[100, 8, 2], [130, 12, 2], [160, 40, 1], [190, 9, 2], [500, 7, 2], [530, 0, 0], [560, 6, 2]]);
const powerGroups = history.powerSegments(watts, 0, 600);
assert.deepEqual(plain(powerGroups).map(g => g.map(p => p.time)), [[100, 130], [190], [500], [560]]);
assert.equal(history.powerCeiling(powerGroups), 20);
assert.equal(history.powerCeiling([]), 10);
assert.equal(history.nearPower(powerGroups, 310), null);
assert.equal(history.nearPower(powerGroups, 128).value, 12);
assert.deepEqual(plain(history.powerSegments(rate([[100, 25, 1]]), 0, 200)), []);
assert.deepEqual(plain(history.powerSegments(rate([[100, 8, 2, false], [400, 10, 2, true]]), 0, 600, 300)).map(g => g.length), [1, 1]);
for (const interval of [300, 1800]) {
  const start = 100;
  const samples = rate([[start, 8, 2], [start + interval, 12, 2],
    [start + 2 * interval, 30, 1], [start + 3 * interval, 9, 2],
    [start + 6 * interval, 7, 2], [start + 7 * interval, 0, 0],
    [start + 8 * interval, 6, 2]]);
  const groups = history.powerSegments(samples, 0, start + 9 * interval, interval);
  assert.deepEqual(plain(groups).map(g => g.length), [2, 1, 1, 1]);
  assert.equal(history.nearPower(groups, start + interval / 2, interval).value, 8);
  assert.equal(history.nearPower(groups, start + 4.5 * interval, interval), null);
}
console.log('Battery history parsing, all-range gaps and hover selection passed.');
