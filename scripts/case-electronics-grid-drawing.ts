import type { caseModularElectronics } from '../src/parts/servo-toggle-actuator/lib/case-electronics-grid';
import { caseLowerFloorFootprint } from '../src/parts/servo-toggle-actuator/lib/case-lower-split';

/** A dimensioned interface drawing; coloured anchor connections are not part outlines. */
export function caseElectronicsGridDrawing(
  data: ReturnType<typeof caseModularElectronics>,
): string {
  const g = data.grid,
    [cx, cy] = caseLowerFloorFootprint.centre,
    [width, height] = caseLowerFloorFootprint.size,
    x0 = cx - width / 2,
    [x1, y1] = [cx + width / 2, cy + height / 2],
    palette = ['#1261a0', '#7a39a8', '#a55c00', '#a22727', '#008269', '#3156bb', '#b24280'],
    esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    point = ([x, y]: readonly number[]) => [10 + x, 180 - y],
    text = (x: number, y: number, s: string, size = 2.6, color = '#182b3b') =>
      `<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${esc(s)}</text>`,
    [left, top] = point([x0, y1]),
    parts = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 297 210">',
      '<rect width="297" height="210" fill="white"/>',
      '<g font-family="Arial,sans-serif">',
      text(10, 11, `Universal M3 mounting grid · ${g.pitchMm} mm`, 5),
      text(
        10,
        18,
        'Top view. Board-specific seats and tie ports belong to the small removable adapters.',
      ),
      `<rect x="${left}" y="${top}" width="${width}" height="${height}" rx="${caseLowerFloorFootprint.cornerRadius}" fill="#f3f6f8" stroke="#243b4d" stroke-width="0.35"/>`,
    ];
  const bank = g.reservedRegions.batteryBank,
    [bx, by] = point([bank.min[0], bank.max[1]]);
  parts.push(
    `<rect x="${bx}" y="${by}" width="${bank.max[0] - bank.min[0]}" height="${bank.max[1] - bank.min[1]}" fill="#f3e8cb" stroke="#b29a68" stroke-width="0.2"/>`,
  );
  parts.push(text(bx + 12, by + 28, 'Fixed battery pockets', 3));
  for (let x = g.origin[0]; x <= x1; x += g.pitchMm) {
    const [px] = point([x, 0]);
    parts.push(
      `<path d="M${px},${top} V${top + height}" stroke="#b9c6d1" stroke-width="0.12" stroke-dasharray="1,1"/>`,
    );
    parts.push(text(px - 2, top + height + 4, String(x), 2.3));
  }
  for (let y = g.origin[1]; y <= y1; y += g.pitchMm) {
    const [, py] = point([0, y]);
    parts.push(
      `<path d="M${left},${py} H${left + width}" stroke="#b9c6d1" stroke-width="0.12" stroke-dasharray="1,1"/>`,
    );
    parts.push(text(5, py + 0.8, String(y), 2.3));
  }
  for (const node of g.nodes) {
    const [x, y] = point(node.centre);
    parts.push(
      `<circle cx="${x}" cy="${y}" r="${g.nodeDiameterMm / 2}" fill="white" stroke="#aab6c0" stroke-width="0.18"/>`,
    );
    parts.push(
      `<circle cx="${x}" cy="${y}" r="${g.boreDiameterMm / 2}" fill="white" stroke="#1a3043" stroke-width="0.28"/>`,
    );
  }
  parts.push(text(231, 35, 'Adapter mounting axes', 3.1));
  parts.push(text(231, 41, `${g.nodeCount} identical M3 nodes`));
  data.adapters.forEach((adapter, index) => {
    const color = palette[index],
      points = adapter.anchors.map((a) => point(a.axisPoint)),
      xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]),
      centreX = xs.reduce((sum, x) => sum + x, 0) / xs.length,
      centreY = ys.reduce((sum, y) => sum + y, 0) / ys.length;
    if (points.length === 2)
      parts.push(
        `<path d="M${points[0].join(',')} L${points[1].join(',')}" fill="none" stroke="${color}" stroke-width="0.6" stroke-dasharray="2,1"/>`,
      );
    else
      parts.push(
        `<polygon points="${[...points]
          .sort(
            (a, b) =>
              Math.atan2(a[1] - centreY, a[0] - centreX) -
              Math.atan2(b[1] - centreY, b[0] - centreX),
          )
          .map((p) => p.join(','))
          .join(' ')}" fill="none" stroke="${color}" stroke-width="0.6" stroke-dasharray="2,1"/>`,
      );
    points.forEach(([x, y]) => {
      parts.push(
        `<circle cx="${x}" cy="${y}" r="2.4" fill="white" stroke="${color}" stroke-width="0.55"/>`,
      );
      parts.push(text(x - 0.8, y + 0.9, String(index + 1), 2.8, color));
    });
    const y = 51 + index * 14;
    parts.push(text(231, y, `${index + 1}. ${adapter.label}`, 2.9, color));
    parts.push(text(231, y + 4, `${adapter.anchors.length} × M3 · ${adapter.orientation}`, 2.3));
  });
  parts.push(
    text(
      10,
      190,
      `Base: ${width} × ${height} mm R${caseLowerFloorFootprint.cornerRadius}. Grid origin: [${g.origin.join(', ')}] mm. Through holes: Ø${g.boreDiameterMm} mm.`,
    ),
  );
  parts.push(
    text(
      10,
      195,
      `Node top Z${g.nodeTopZ} mm. Underside head recess: Ø${g.headRecessDiameterMm} mm. M3 × 8 from below; AF5.5 × 2.4 nuts in adapters.`,
    ),
  );
  parts.push(
    text(
      10,
      200,
      'Coloured connections show mounting axes only. Check 3D clearance before moving a board. Dimensions in mm; print at 100%.',
    ),
  );
  parts.push('</g></svg>');
  return parts.join('\n');
}
