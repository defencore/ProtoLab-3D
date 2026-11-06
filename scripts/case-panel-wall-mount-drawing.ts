/** User-measured interior datums; exterior case corners are not the same datum. */
type Mount = {
  id: string;
  side: string;
  axisPoint: readonly number[];
  inwardAxis: readonly number[];
  cavityWallPoint: readonly number[];
  nominalGapMm: number;
};

export function caseWallMountDrawing(
  mounts: readonly Mount[],
  grooveFloorZ: number,
  codeSha256: string,
): string {
  const xml = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  const label = (x: number, y: number, s: string, size = 3) =>
    `<text x="${x}" y="${y}" font-size="${size}">${xml(s)}</text>`;
  const cross = (x: number, y: number) =>
    `<circle cx="${x}" cy="${y}" r="1.7" fill="white"/><path d="M${x - 3},${y}h6 M${x},${y - 3}v6"/>`;
  const sideName: Record<string, string> = {
    front: 'FRONT / toggle row',
    rear: 'REAR / batteries',
    left: 'LEFT / XT60',
    right: 'RIGHT / SP20',
  };
  const rise = (side: string) => {
    const mount = mounts.find((m) => m.side === side);
    if (!mount) throw new Error(`Missing wall mount: ${side}`);
    return (
      (Math.asin(mount.inwardAxis[2] / Math.hypot(...mount.inwardAxis)) * 180) /
      Math.PI
    ).toFixed(2);
  };
  const content = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="420mm" viewBox="0 0 297 420">',
    '<style>text{font-family:Arial,sans-serif;fill:#243748;stroke:none}path,rect,circle,line{stroke:#526c80;stroke-width:.3} .study{fill:#b34324}</style>',
    '<rect width="297" height="420" fill="white" stroke="none"/>',
    label(16, 13, 'BX-0151 / seven side mounts / INTERIOR DATUMS', 4),
    label(
      16,
      21,
      'User-confirmed clear locations. Transfer centres from the fitted print; check washer seating.',
    ),
    label(
      16,
      27,
      'Toggle row faces the handle; batteries face the hinges. Do not measure from exterior corners.',
    ),
    label(
      16,
      33,
      'All dimensions in mm. SVG scale 1:1 on A3 at 100%; verify the 50 mm scale below.',
    ),
    '<rect x="30" y="45" width="214" height="150" rx="6" fill="#eef3f6"/>',
    label(32, 43, 'Top cavity at groove floor: 214 x 150'),
    label(32, 207, 'Operator X increases right; Y increases toward batteries.'),
    label(32, 213, 'Dashed arrows: screw axes. Circles in wall projections: nominal Ø3.4 bore.'),
    label(32, 219, 'All seven centres: 20 mm BELOW the UPPER edge of the 2 mm groove.'),
    label(
      32,
      225,
      `XY projections. Drill normal to the fitted wall: inward rise ${rise('front')}° front/rear, ${rise('left')}° left/right.`,
      2.6,
    ),
  ];
  for (const mount of mounts) {
    const [x, y] = mount.axisPoint,
      horizontal = mount.side === 'front' || mount.side === 'rear',
      px = 30 + x,
      py = 195 - y,
      dx = horizontal ? 0 : mount.side === 'left' ? -8 : 8,
      dy = horizontal ? (mount.side === 'front' ? 8 : -8) : 0;
    content.push(
      `<path d="M${px - dx},${py - dy}L${px + dx},${py + dy}" stroke-dasharray="1 1"/>`,
      `<circle cx="${px}" cy="${py}" r="1.3" fill="#d47a42"/>`,
      label(
        px + (mount.side === 'right' ? -18 : 3),
        py - 4,
        `${mount.side.toUpperCase()} ${horizontal ? x : y}`,
        2.8,
      ),
    );
  }
  for (const [i, side] of ['front', 'rear', 'left', 'right'].entries()) {
    const pair = mounts.filter((m) => m.side === side);
    const expectedCount = side === 'left' ? 1 : 2;
    if (pair.length !== expectedCount)
      throw new Error(`Expected ${expectedCount} wall mounts: ${side}`);
    const y0 = 239 + i * 42,
      horizontal = side === 'front' || side === 'rear',
      length = horizontal ? 214 : 150,
      grooveUpperZ = grooveFloorZ + 2,
      positions = pair.map((m) => m.axisPoint[horizontal ? 0 : 1]).sort((a, b) => a - b),
      depth = grooveUpperZ - pair[0].axisPoint[2];
    content.push(
      label(
        16,
        y0 - 4,
        `${sideName[side]} / ${horizontal ? 'X' : 'Y'} = ${positions.join(' / ')} / ${positions[0]} from either inner corner${side === 'left' ? ' / one central screw' : ''}`,
      ),
      `<rect x="30" y="${y0}" width="${length}" height="32" fill="#f4f6f8"/>`,
      `<path d="M30,${y0}h${length}" stroke-width=".7"/>`,
      `<path d="M30,${y0 + 2}h${length}" stroke-dasharray="1 1"/>`,
      label(32, y0 + 5, `upper groove edge / Z${grooveUpperZ}; floor 2 below`, 2.4),
      label(
        32,
        y0 + 30,
        `${depth.toFixed(1)} below upper edge = ${(grooveFloorZ - pair[0].axisPoint[2]).toFixed(1)} below groove floor`,
        2.6,
      ),
    );
    for (const at of positions) {
      content.push(
        cross(30 + at, y0 + depth),
        `<path d="M${30 + at},${y0 + 7}v${depth - 10}" stroke-dasharray="1 1"/>`,
        label(33 + at, y0 + 17, '20', 2.6),
      );
    }
    const offset = positions[0];
    content.push(
      `<path d="M30,${y0 + 24}h${offset} M${30 + length - offset},${y0 + 24}h${offset}"/>`,
      label(30 + offset / 2 - 3, y0 + 23, String(offset), 2.4),
      label(30 + length - offset / 2 - 3, y0 + 23, String(offset), 2.4),
    );
  }
  content.push(
    '<path d="M16,406h50 M16,403v6 M66,403v6"/>',
    label(27, 403, '50 mm check', 2.5),
    label(77, 405, 'Nominal wall ~4; M3 x 11 effective; verify actual seal compression.', 2.7),
    label(
      16,
      415,
      `CAD source ${codeSha256.slice(0, 16)} / ${mounts.length} integral M3 mounts`,
      2.4,
    ),
    '</svg>',
  );
  return content.join('\n') + '\n';
}
