import { LAYOUTS } from './src/utils/keyboardLayouts.js';
import assert from 'node:assert';

console.log('🧪 Testing Keyboard Layouts and Navigation Mapping...');

const qwerty = LAYOUTS.QWERTY;
assert(qwerty.length === 4, 'QWERTY should have 4 rows');

const flatList = [];
qwerty.forEach(row => {
  row.forEach(k => {
    if (typeof k === 'string') {
      flatList.push({ id: k, label: k, action: 'type', value: k });
    } else {
      flatList.push(k);
    }
  });
});

console.log(`✓ Total QWERTY keys: ${flatList.length}`);
assert(flatList.length === 32, 'Expected 32 keys in QWERTY layout');

// Test navigation wrapping:
let active = 0; // starts at 'Q'
assert(flatList[active].id === 'Q');

// Left wink wraps to last key (SEND)
active = (active - 1 + flatList.length) % flatList.length;
assert(flatList[active].id === 'SEND', 'Wrapping left from 0 should land on SEND');
console.log(`✓ Wrap left from 0 -> ${flatList[active].id}`);

// Right wink steps to 0 ('Q')
active = (active + 1) % flatList.length;
assert(flatList[active].id === 'Q', 'Wrapping right from last should land on Q');
console.log(`✓ Wrap right from last -> ${flatList[active].id}`);

// Right wink steps to 'W'
active = (active + 1) % flatList.length;
assert(flatList[active].id === 'W', 'Right wink should step to W');
console.log(`✓ Step right -> ${flatList[active].id}`);

// Test Alphabetical Layout
const alpha = LAYOUTS.ALPHABETICAL;
const alphaFlat = [];
alpha.forEach(row => {
  row.forEach(k => {
    alphaFlat.push(typeof k === 'string' ? { id: k } : k);
  });
});
console.log(`✓ Total Alphabetical keys: ${alphaFlat.length}`);
assert(alphaFlat[0].id === 'A', 'First key in Alphabetical must be A');
assert(alphaFlat[alphaFlat.length - 1].id === 'SEND', 'Last key must be SEND');

console.log('\n🎉 ALL KEYBOARD NAVIGATION TESTS PASSED SUCCESSFULLY!');
