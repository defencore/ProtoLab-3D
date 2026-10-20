import assert from 'node:assert/strict';
import test from 'node:test';
import machine, {
  millingComponents,
  millingLayout,
  millingPieces,
} from '../src/parts/cnc-milling-machine/part';

test('CNC table actually covers all spindle tool axes over the complete XY travel', () => {
  for (const option of machine.parameters.find((p) => p.key === 'spindle')!.options!) {
    const parameters = { ...machine.defaults, spindle: option.value };
    const layout = millingLayout(parameters),
      parts = millingComponents(parameters);
    const slats = parts.filter((p) => p.component.id.startsWith('aluminium-table-slat-'));
    assert.equal(slats.length, 10);
    const first = slats[0].component;
    const tableY = first.placement.translation[1],
      length = Number(first.parameters.length);
    assert.equal(length, layout.tableLength);
    for (const yPosition of [0, 100]) {
      const posed = millingPieces({ ...parameters, yPosition }, 'assembled');
      const spindle = posed.find((p) => p.component.id === 'cutting-spindle')!;
      const toolY = spindle.component.placement.translation[1] + spindle.position![1];
      assert.ok(
        toolY >= tableY - length / 2 && toolY <= tableY + length / 2,
        `${option.value}: tool axis ${toolY} is outside actual table ${tableY - length / 2}..${tableY + length / 2}`,
      );
    }
    const minX = Math.min(
      ...slats.map(
        (p) => p.component.placement.translation[0] - Number(p.component.parameters.width) / 2,
      ),
    );
    const maxX = Math.max(
      ...slats.map(
        (p) => p.component.placement.translation[0] + Number(p.component.parameters.width) / 2,
      ),
    );
    for (const xPosition of [0, 100]) {
      const spindle = millingPieces({ ...parameters, xPosition }, 'assembled').find(
        (p) => p.component.id === 'cutting-spindle',
      )!;
      const toolX = spindle.component.placement.translation[0] + spindle.position![0];
      assert.ok(
        toolX >= minX && toolX <= maxX,
        `${option.value}: tool X${toolX} is outside actual table ${minX}..${maxX}`,
      );
    }
  }
});

test('CNC fixed Z plate clears200 mm stock while each selected tool projection reaches table and stock top', () => {
  for (const option of machine.parameters.find((p) => p.key === 'spindle')!.options!) {
    for (const tableHeight of [700, 800, 950]) {
      for (const toolProjection of [20, 25, 50]) {
        const parameters = {
          ...machine.defaults,
          spindle: option.value,
          tableHeight,
          toolProjection,
        };
        const layout = millingLayout(parameters),
          parts = millingComponents(parameters);
        const plate = parts.find((p) => p.component.id === 'x-z-fixed-saddle')!.component;
        const bottom = plate.placement.translation[2] - Number(plate.parameters.sizeZ) / 2;
        assert.ok(
          bottom >= tableHeight + 220,
          `${option.value}: fixed plate bottom ${bottom} cannot clear stock top ${tableHeight + 200}`,
        );
        const tips = [0, 100].map((zPosition) => {
          const spindle = millingPieces({ ...parameters, zPosition }, 'assembled').find(
            (p) => p.component.id === 'cutting-spindle',
          )!;
          return spindle.component.placement.translation[2] + spindle.position![2] - toolProjection;
        });
        assert.deepEqual(tips, [tableHeight, tableHeight + 200]);
        assert.equal(tips[1] - tips[0], layout.workZ);
      }
    }
  }
});
