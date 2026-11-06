/** Generate independently configured native/preview cases for the complete quad. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Box3, Mesh, Vector3 } from 'three';
import part, { quadPieces } from '../src/parts/tr8-quad-actuator/part';
import { channels } from '../src/parts/tr8-quad-actuator/lib/placement';
import { mechanismPieces, libraries } from '../src/parts/tr8-quad-actuator/lib/mechanism';
import { actuatorNativeSource } from '../src/parts/tr8-compact-actuator/part';
import { mechanismLayout, nativeThreadLayout } from '../src/parts/tr8-quad-actuator/lib/layout';
import { withGeometryMode } from '../src/core/geometry-mode';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';

const directory = resolve(process.argv[2] ?? 'test-results/tr8-quad-actuator');
mkdirSync(directory, { recursive: true });
const commands = [[0, 0, 0, 0], [-20, 20, -20, 20], [20, -20, 20, -20]];
const cases = (['simple', 'full'] as const).flatMap((mode) => (mode === 'simple' ? commands.slice(0, 1) : commands).map((angles, pose) => withGeometryMode(mode, () => {
  const parameters = { ...part.defaults, ...Object.fromEntries(angles.map((angle, i) => ['angle' + 'ABCD'[i], angle])) };
  const errors = part.validate(parameters, 'assembled');
  if (errors.length) throw new Error(errors.join('; '));
  const occurrences = quadPieces(parameters), model = part.buildGeometry(parameters, 'assembled');
  model.updateMatrixWorld(true);
  try {
    const expected = model.children.map((child, index) => {
      const box = new Box3().setFromObject(child, true);
      let volume = 0;
      child.traverse((mesh) => {
        if (!(mesh instanceof Mesh)) return;
        const position = mesh.geometry.getAttribute('position'), indices = mesh.geometry.index;
        for (let triangle = 0; triangle < (indices?.count ?? position.count); triangle += 3) {
          const [a, b, c] = [0, 1, 2].map((offset) => new Vector3().fromBufferAttribute(position,
            indices ? indices.getX(triangle + offset) : triangle + offset).applyMatrix4(mesh.matrixWorld));
          volume += a.dot(b.clone().cross(c)) / 6;
        }
      });
      return { id: occurrences[index].component.id, libraryId: occurrences[index].component.libraryId,
        label: occurrences[index].label, min: box.min.toArray(), max: box.max.toArray(), volume };
    });
    const name = 'quad-' + mode + '-' + (pose === 0 ? 'neutral' : 'mixed-' + pose);
    const source = part.python(parameters, 'assembled'), script = generateScript(part, parameters, 'assembled', undefined, undefined, mode);
    writeFileSync(resolve(directory, name + '.FCMacro'), script);
    const mounts = channels(parameters);
    return { name, id: part.id, mode, state: 'assembled', export: true, parameters, expected, script, source,
      nominalSource: mode === 'full' ? withGeometryMode('simple', () => part.python(parameters, 'assembled')) : undefined,
      dimensions: new Box3().setFromObject(model, true).getSize(new Vector3()).toArray(),
      channelPlacements: mounts,
      crossChannelStockProof: { report: 'channel/swept-stock.json', cases: 'channel/cases.json', audit: 'channel/native-report.json' },
      kinematics: { crankRadius: mechanismLayout.radius, pivot: [mechanismLayout.outputX, 0, 0],
        screwAxisZ: mechanismLayout.screwZ, screwLead: 8 },
      prototypeAudit: mode === 'full' ? { cases: 'channel/cases.json', report: 'channel/native-report.json',
        channels: mounts.map((channel) => ({ id: channel.id, angle: channel.angle,
          source: actuatorNativeSource(mechanismPieces(parameters, channel.angle), mechanismLayout.radius * Math.tan(channel.angle * Math.PI / 180), nativeThreadLayout, libraries) })) } : undefined,
      driveAxes: mounts.map((channel) => ({ screw: channel.id + '-lead-screw', nut: channel.id + '-lead-nut',
        origin: [channel.origin[0], channel.origin[1] - mechanismLayout.screwZ * Math.sin(channel.clock * Math.PI / 180), channel.origin[2] + mechanismLayout.screwZ * Math.cos(channel.clock * Math.PI / 180)], axis: [1, 0, 0] })),
      billOfMaterials: part.composition!(parameters) };
  } finally { disposeModel(model); }
})));
writeFileSync(resolve(directory, 'cases.json'), JSON.stringify(cases));
for (const file of part.fabricationFiles!(part.defaults)) writeFileSync(resolve(directory, file.name), file.content);
console.log(JSON.stringify({ cases: cases.length, occurrences: cases[0].expected.length, dimensions: cases[0].dimensions, directory }));
