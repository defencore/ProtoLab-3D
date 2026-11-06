import type { caseFitLayout } from '../src/parts/servo-toggle-actuator/lib/case-fit';

/** Ring interface drawing. The radial section is a labelled schematic, not a CAD view. */
export function caseSeatRingDrawing(data: ReturnType<typeof caseFitLayout>): string {
  const mounts = data.ringWallMounting,
    [width, height] = data.ringOuterSize,
    [cx, cy] = data.ringCentre,
    [left, top] = [12 + cx - width / 2, 181.3 - cy - height / 2],
    [right, bottom] = [left + width, top + height],
    point = ([x, y]: readonly number[]) => [12 + x, 181.3 - y],
    number = (value: number) => String(Number(value.toFixed(2))),
    esc = (value: string) =>
      value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    text = (x: number, y: number, value: string, size = 2.5, color = '#223747', extra = '') =>
      `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${esc(value)}</text>`,
    line = (x1: number, y1: number, x2: number, y2: number, extra = '') =>
      `<path d="M${x1},${y1} L${x2},${y2}" fill="none" stroke="#5c6d7a" stroke-width="0.2" ${extra}/>`,
    parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 297 210" data-ring-size="${data.ringOuterSize.join(',')}" data-ring-centre="${data.ringCentre.join(',')}" data-front-extension-mm="${data.ringFrontExtensionMm}">`,
      '<title>BX-0151 seat ring: horizontal wall fixings and fixed M3 axes</title>',
      '<defs><marker id="ring-outward" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="3" markerHeight="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#1768a1"/></marker>',
      '<marker id="ring-dim" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="2.5" markerHeight="2.5" orient="auto-start-reverse"><path d="M6,0 L0,3 L6,6" fill="none" stroke="#5c6d7a" stroke-width="0.7"/></marker></defs>',
      '<rect width="297" height="210" fill="white"/><g font-family="Arial,sans-serif">',
      text(10, 9, 'BX-0151 seat ring · horizontal wall fixings', 4.5),
      text(
        10,
        16,
        'Flange outline and projected axes in operator XY. Front / handle is −Y. Dimensions in mm.',
      ),
      `<rect x="${left}" y="${top}" width="${width}" height="${height}" rx="${data.ringCornerRadius}" fill="#e8eef2" stroke="#243b4d" stroke-width="0.4"/>`,
    ];
  const [openingLeft, openingTop] = point([
    data.centre[0] - data.ringInnerOpening[0] / 2,
    data.centre[1] + data.ringInnerOpening[1] / 2,
  ]);
  parts.push(
    `<rect x="${openingLeft}" y="${openingTop}" width="${data.ringInnerOpening[0]}" height="${data.ringInnerOpening[1]}" rx="4" fill="white" stroke="#8b9aa6" stroke-width="0.2"/>`,
  );
  const oldBottom = point([
    data.workingRingFit.referenceCentre[0],
    data.workingRingFit.referenceCentre[1] - data.referenceRingOuterSize[1] / 2,
  ])[1];
  parts.push(
    `<rect x="${left + data.ringCornerRadius}" y="${oldBottom}" width="${width - 2 * data.ringCornerRadius}" height="${data.ringFrontExtensionMm}" fill="#d44d71" opacity="0.55"/>`,
    `<path d="M${left},${oldBottom - data.ringCornerRadius} A${data.ringCornerRadius},${data.ringCornerRadius} 0 0 0 ${left + data.ringCornerRadius},${oldBottom} H${right - data.ringCornerRadius} A${data.ringCornerRadius},${data.ringCornerRadius} 0 0 0 ${right},${oldBottom - data.ringCornerRadius}" fill="none" stroke="#ad4260" stroke-width="0.25" stroke-dasharray="1,0.7"/>`,
    line(left, top - 1, left, 23),
    line(right, top - 1, right, 23),
    line(left, 24, right, 24, 'marker-start="url(#ring-dim)" marker-end="url(#ring-dim)"'),
    text((left + right) / 2, 22.5, number(width), 2.8, '#223747', 'text-anchor="middle"'),
    line(right + 1, top, 235, top),
    line(right + 1, bottom, 235, bottom),
    line(234, top, 234, bottom, 'marker-start="url(#ring-dim)" marker-end="url(#ring-dim)"'),
    text(
      232.8,
      (top + bottom) / 2,
      number(height),
      2.8,
      '#223747',
      `text-anchor="middle" transform="rotate(-90 232.8 ${(top + bottom) / 2})"`,
    ),
  );
  for (const [x, y] of data.mountingAxes) {
    const [px, py] = point([x, y]);
    parts.push(
      `<g data-m3-axis="${x},${y}"><circle cx="${px}" cy="${py}" r="${data.mountingBore / 2}" fill="white" stroke="#a66c00" stroke-width="0.4"/>`,
      `<path d="M${px - 3},${py} H${px + 3} M${px},${py - 3} V${py + 3}" stroke="#a66c00" stroke-width="0.2"/></g>`,
    );
  }
  mounts.holes.forEach((hole, index) => {
    const [hx, hy] = point(hole.headFace),
      [ex, ey] = point(hole.wallPoint.map((v, axis) => v + hole.outward[axis] * 4)),
      [lx, ly] = point(hole.headFace.map((v, axis) => v - hole.outward[axis] * 6));
    parts.push(
      `<g data-axis-id="${hole.id}" data-wall-point="${hole.wallPoint.join(',')}" data-outward="${hole.outward.join(',')}">`,
      line(
        hx,
        hy,
        ex,
        ey,
        'style="stroke:#1768a1;stroke-width:0.45" marker-end="url(#ring-outward)"',
      ),
      `<circle cx="${hx}" cy="${hy}" r="0.8" fill="white" stroke="#1768a1" stroke-width="0.3"/>`,
      `<circle cx="${lx}" cy="${ly}" r="2.3" fill="white" stroke="#1768a1" stroke-width="0.3"/>`,
      text(lx, ly + 0.9, String(index + 1), 2.7, '#1768a1', 'text-anchor="middle"'),
      '</g>',
    );
  });

  parts.push(
    text(242, 32, `${mounts.holes.length} horizontal axes`, 3),
    text(242, 38, `All Z = ${number(mounts.holes[0].wallPoint[2])}`),
    text(242, 44, '# / side', 2.2),
    text(270, 44, 'X', 2.2, '#223747', 'text-anchor="end"'),
    text(289, 44, 'Y', 2.2, '#223747', 'text-anchor="end"'),
  );
  const sideNames = { left: 'L', right: 'R', front: 'F', rear: 'B' } as const;
  mounts.holes.forEach((hole, index) => {
    const y = 50 + index * 4.8;
    parts.push(
      text(242, y, `${index + 1} / ${sideNames[hole.side]}`),
      text(270, y, number(hole.wallPoint[0]), 2.5, '#223747', 'text-anchor="end"'),
      text(289, y, number(hole.wallPoint[1]), 2.5, '#223747', 'text-anchor="end"'),
    );
  });
  parts.push(
    line(241, 93, 290, 93),
    text(242, 99, 'L/R = left/right; F/B = front/rear', 2.2),
    text(242, 105, `Through bore Ø${mounts.boreDiameterMm}`),
    text(242, 110, `CS Ø${mounts.countersinkDiameterMm} × ${mounts.countersinkAngleDegrees}°`),
    text(242, 115, `Depth ${mounts.countersinkDepthMm}; radial pad ${mounts.padThicknessMm}`),
    text(242, 120, `Cylindrical web ≥${mounts.minimumCylindricalWebMm}`),
    text(242, 127, 'Fixed M3: X7/207, Y7/143', 2.3, '#a66c00'),
    text(242, 136, 'Compact driver envelope', 2.8),
    text(
      242,
      142,
      `Shaft Ø${mounts.installation.shaftDiameterMm} × ${mounts.installation.shaftLengthMm}`,
    ),
    text(
      242,
      147,
      `Handle Ø${mounts.installation.handleDiameterMm} × ${mounts.installation.handleLengthMm}`,
    ),
    text(242, 152, `Axial engagement: ${mounts.installation.engagementTravelMm}`),
    text(242, 158, 'Both batteries removed.'),
    text(242, 163, 'Controls fitted; ARM1 closed.', 2.3),
    text(242, 169, 'Screw length / drive: unselected.', 2.2),
    text(242, 175, 'Tool envelope excludes hand access.', 2.1),
    text(242, 181, 'Prototype fit; check actual case.', 2.2),
  );

  // Enlarged uniform-scale radial section; horizontal screw axis is +u in this inset.
  const scale = 5,
    u0 = 95,
    axisY = 105,
    u1 = u0 + mounts.padThicknessMm * scale,
    csEnd = u0 + mounts.countersinkDepthMm * scale,
    csRadius = (mounts.countersinkDiameterMm / 2) * scale,
    boreRadius = (mounts.boreDiameterMm / 2) * scale,
    axisZ = mounts.holes[0].wallPoint[2],
    zTop = axisY - (mounts.padTopZ - axisZ) * scale,
    zBottom = axisY + (axisZ - mounts.padBottomZ) * scale;
  parts.push(
    '<rect x="50" y="58" width="137" height="105" rx="2" fill="#fafcfd" stroke="#cad4dc" stroke-width="0.2"/>',
    text(57, 67, 'RADIAL SECTION · enlarged schematic', 3),
    text(57, 74, `Interior head face → case side · CS depth ${mounts.countersinkDepthMm}`),
    `<rect x="${u0}" y="${zTop}" width="${u1 - u0}" height="${zBottom - zTop}" fill="#dfe8ee" stroke="#3c5365" stroke-width="0.3"/>`,
    `<path d="M${u0},${axisY - csRadius} L${csEnd},${axisY - boreRadius} H${u1} V${axisY + boreRadius} H${csEnd} L${u0},${axisY + csRadius} Z" fill="white" stroke="#1768a1" stroke-width="0.3"/>`,
    line(
      75,
      axisY,
      139,
      axisY,
      'style="stroke:#1768a1" stroke-dasharray="2,1" marker-end="url(#ring-outward)"',
    ),
    text(60, 98, 'Interior', 2.5),
    text(143, 106, 'Outward', 2.5, '#1768a1'),
    text(128, zTop + 1, `Z${mounts.padTopZ}`, 2.4),
    text(128, zBottom, `Z${mounts.padBottomZ}`, 2.4),
    line(u1, axisY - boreRadius, 127, 96),
    text(129, 96, `Ø${mounts.boreDiameterMm}`, 2.7, '#1768a1'),
    text(
      58,
      83,
      `Ø${mounts.countersinkDiameterMm} / ${mounts.countersinkAngleDegrees}°`,
      2.7,
      '#1768a1',
    ),
    line(82, 84, u0, axisY - csRadius),
    text(58, 132, 'Head face', 2.4),
    line(78, 130, u0, axisY + csRadius),
    line(u0, zBottom + 2, u0, 154),
    line(u1, zBottom + 2, u1, 154),
    line(u0, 153, u1, 153, 'marker-start="url(#ring-dim)" marker-end="url(#ring-dim)"'),
    text(
      (u0 + u1) / 2,
      158,
      `${mounts.padThicknessMm} mm pad`,
      2.4,
      '#223747',
      'text-anchor="middle"',
    ),
    text(58, 154, `Axis Z${axisZ}`, 2.7),
    line(104, zTop + 3, 127, 89),
    text(129, 90, `Top land ≥${mounts.minimumTopEdgeLandMm}`, 2.2),
  );
  parts.push(
    text(80, 176, 'FRONT / HANDLE  −Y', 2.6, '#ad4260'),
    text(
      10,
      191,
      'Scale 1:1 at 100% on A4 landscape; section enlarged. XY table gives wall-side axis intersections.',
      2.4,
    ),
    text(
      10,
      196,
      'Blue arrows: from open interior toward case wall. Orange crosses: four existing M3 axes, unchanged in XYZ.',
      2.4,
    ),
    text(
      10,
      201,
      `Pink / dashed front edge: +${data.ringFrontExtensionMm} mm toward −Y, with matching TPU. Rear/side edges and M3 seats are fixed.`,
      2.4,
    ),
    text(
      10,
      206,
      'Finite fit prototype only; the earlier case groove/taper dimensions are reference data, not a re-measured envelope.',
      2.4,
    ),
    '</g></svg>',
  );
  return parts.join('\n');
}
