import assert from 'node:assert/strict';
import test from 'node:test';
import { preservedStudySource } from './helpers/study-source-baselines';

const before =
  "const part = { ...definition, id: 'tr8-quad-actuator' };\nexport default { part };\n";
const block = `// Execution catalog metadata.
part.browseFamily = { id: 'screw-rotary-actuators', label: 'Screw-driven rotary mechanisms' };
part.mechanismExecution = {
  outputs: 4, construction: 'Laser frame', description: 'Existing assembly',
  screws: [{ designation: 'TR8×8(P2)', kind: 'lead-screw', lead: 8, pitch: 2, starts: 4 }],
  motors: [{ model: 'GMP16T-TEC1636' }],
  bearings: [{ model: 'F686-2RS', when: { bearingKit: 'reference' } }],
  materials: ['Steel'], processes: ['Laser cutting'], travelDegrees: 20,
};
// End execution catalog metadata.
`;
const source = (metadata = block) => before.replace('export default', metadata + 'export default');
const project = (metadata = block) =>
  preservedStudySource('tr8-quad-actuator/index.ts', Buffer.from(source(metadata))).toString();

test('reviewed literal bearing metadata projects out without changing any physical source bytes', () => {
  assert.equal(project(), before);
  assert.equal(project(block.replace(", when: { bearingKit: 'reference' }", '')), before);
  const physicalChange = source() + '\npart.python = changedGeometry;\n';
  assert.notEqual(
    preservedStudySource('tr8-quad-actuator/index.ts', Buffer.from(physicalChange)).toString(),
    before,
    'physical edits outside the metadata remain protected by historical hashes',
  );
});

test('bearing source projection rejects executable values, unknown fields and malformed conditions', () => {
  for (const changed of [
    block.replace("model: 'F686-2RS'", 'model: readBearing()'),
    block.replace("model: 'F686-2RS'", "model: 'F686-2RS', python: 'unreviewed geometry'"),
    block.replace("when: { bearingKit: 'reference' }", 'when: {}'),
    block.replace(
      "when: { bearingKit: 'reference' }",
      "when: { bearingKit: { selected: 'reference' } }",
    ),
    block.replace("model: 'F686-2RS'", "model: ''"),
  ]) {
    assert.throws(() => project(changed), changed);
  }
});
