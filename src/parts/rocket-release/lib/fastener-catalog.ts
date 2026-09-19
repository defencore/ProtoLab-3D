import type { Shape } from './shapes';

export function fastener(shape: Shape): Extract<Shape, { kind: 'fastener' }> | undefined {
  if (shape.kind === 'fastener') return shape;
  if (shape.kind === 'transform' || shape.kind === 'rotate') return fastener(shape.child);
}
const stockLengths = [3, 4, 5, 6, 8, 10, 12, 14, 16, 20];
/** Classification is based on the actual geometry, not a descriptive label. */
export function fastenerCatalog(shape: Shape, label = '') {
  const f = fastener(shape);
  if (!f) return undefined;
  const p = f.parameters;
  const dimensions = `M${p.diameter}×${p.length}; pitch ${p.pitch} mm RH`;
  if (label.includes('WING MINI supplied top screw'))
    return {
      standard: 'OEM SpeedyBee hardware kit',
      designation: `M2×3.5; pitch 0.4 mm; cross pan head`,
      procurement: 'OEM_INCLUDED',
      source: 'https://support.speedybee.cn/?a=p&d=SBFWC2&l=en&s=1000',
      note: 'Included with F405 WING MINI; head is a fit-reference envelope, no ISO equivalence asserted.',
    };
  const cap =
    +p.diameter === 2 ? [3.8, 2, 1.5, 1] : +p.diameter === 3 ? [5.5, 3, 2.5, 1.3] : undefined;
  const match = (head: string, dims: number[]) =>
    p.head === head &&
    [p.headSize, p.headHeight, p.driveWidth, p.driveDepth].every((v, i) => +v === dims[i]) &&
    p.drive === 'hex' &&
    p.handedness === 'right' &&
    +p.pitch === (+p.diameter === 2 ? 0.4 : 0.5) &&
    p.threadSpan === 'full' &&
    +p.shankDiameter === +p.diameter &&
    stockLengths.includes(+p.length);
  const isCap = cap && match('socket-cap', cap);
  const isFlat = +p.diameter === 2 && match('countersunk', [4.7, 1.35, 1.3, 0.75]);
  if (+p.diameter === 3 && +p.length === 8 && match('countersunk', [6, 1.7, 2, 1.2]))
    return {
      standard: 'DIN 7991 (Bossard BN 4719 envelope)',
      designation: `${dimensions}; head D6 x 1.7; hex 2 mm; A4; Bossard 1019163`,
      procurement: 'BUY_STANDARD',
      source: 'https://www.tme.com/Document/66de287134764435c21ce37255cb401b/BN4719.pdf',
      note: 'Overall length includes head. Order the D6 DIN envelope, not the larger ISO 10642 head. Strength class and tightening torque require load validation.',
    };
  const isButton =
    +p.diameter === 3 && [8, 12].includes(+p.length) && match('button', [5.7, 1.65, 2, 1.04]);
  if (isCap || isFlat || isButton) {
    const code = `${isCap ? 'SSCF' : isFlat ? 'SSK' : 'SSB'}-M${p.diameter}-${p.length}-A2${isButton ? '-BL' : ''}`;
    const source =
      isFlat && +p.length === 4
        ? 'https://www.accu.co.uk/countersunk-socket-head-screws/5404-SSK-M2-4-A2'
        : isFlat && +p.length === 5
          ? 'https://www.accu.co.uk/countersunk-socket-head-screws/5405-SSK-M2-5-A2'
          : isFlat && +p.length === 6
            ? 'https://www.accu.co.uk/countersunk-socket-head-screws/5406-SSK-M2-6-A2'
            : isCap && +p.diameter === 2 && +p.length === 6
              ? 'https://www.accu.co.uk/metric-cap-head-screws/3792-SSCF-M2-6-A2'
              : isCap && +p.diameter === 2 && +p.length === 8
                ? 'https://www.accu.co.uk/metric-cap-head-screws/3793-SSCF-M2-8-A2'
                : isCap && +p.diameter === 3 && +p.length === 12
                  ? 'https://www.accu.co.uk/metric-cap-head-screws/3820-SSCF-M3-12-A2'
                  : isCap && +p.diameter === 2 && +p.length === 14
                    ? 'https://www.accu.co.uk/metric-cap-head-screws/3796-SSCF-M2-14-A2'
                    : isButton
                      ? +p.length === 8
                        ? 'https://www.accu.co.uk/socket-button-screws/155051-SSB-M3-8-A2-BL'
                        : 'https://www.accu.co.uk/socket-button-screws'
                      : isFlat
                        ? 'https://www.accu.co.uk/countersunk-socket-head-screws'
                        : 'https://www.accu.co.uk/metric-cap-head-screws';
    return {
      standard: isCap ? 'ISO 4762' : isFlat ? 'ISO 10642 (Accu M2 envelope)' : 'ISO 7380-1',
      designation: `${dimensions}; hex ${p.driveWidth} mm; A2; ${code}`,
      procurement: label.includes('verify OEM thread') ? 'BUY_VERIFY_INTERFACE' : 'BUY_STANDARD',
      source,
      note: `${isFlat ? 'Overall length includes head.' : 'Length under head.'} Supplier A2 grade; strength class and tightening torque require load validation.${label.includes('verify OEM thread') ? ' Confirm servo output thread/depth on the delivered servo before purchase.' : ''}`,
    };
  }
  return {
    standard: 'CUSTOM - no catalog equivalence',
    designation: `${dimensions}; head ${p.headSize}×${p.headHeight}; ${p.head}`,
    procurement: 'MAKE_CUSTOM_FASTENER',
    source: '',
    note: 'Turn to part drawing; do not order as a standard shoulder screw. Strength/material heat treatment require drawing release.',
  };
}
