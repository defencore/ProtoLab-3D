import { Group, Mesh, MeshStandardMaterial } from 'three';
import type { Parameters, Preset } from '../../../core/types';
import type { Shape, Vec } from '../../../core/assembly/boundary/shapes';
import { nativeThreadDepth } from '../../../core/thread-native';
import { currentGeometryMode } from '../../../core/geometry-mode';
import { threadMetadata } from '../../../core/thread-callouts';
import { boundaryThreadCallouts } from '../../../core/assembly/boundary/shapes';
import * as assembly from '../../../core/assembly/boundary/assembly';

type Side = 'A' | 'B';
const sides: Side[] = ['A', 'B'];
const ends = ['plain', 'female', 'male', 'self-tapping'];
const appearances = [
  'neutral',
  'brass',
  'nickel',
  'aluminium',
  'steel',
  'nylon-black',
  'nylon-white',
];
const numericKeys = [
  'bodyLength',
  'bodyWidth',
  'cornerDiameter',
  'boreDiameter',
  ...sides.flatMap((side) =>
    [
      'threadDiameter',
      'threadPitch',
      'threadRootDiameter',
      'maleLength',
      'maleEnvelopeLength',
      'femaleDepth',
      'femaleEnvelopeDepth',
    ].map((key) => key + side),
  ),
];
const value = (p: Parameters, key: string) => Number(p[key]);
const studSpan = (p: Parameters, side: Side) =>
  Math.max(value(p, 'maleLength' + side), value(p, 'maleEnvelopeLength' + side));
const openingSpan = (p: Parameters, side: Side) =>
  Math.max(value(p, 'femaleDepth' + side), value(p, 'femaleEnvelopeDepth' + side));

export function validateStandoff(p: Parameters, presets: Preset[], composite = false): string[] {
  const errors: string[] = [];
  for (const key of [
    ...numericKeys,
    ...(composite ? ['insertOuterDiameter', 'insertLengthA', 'insertLengthB'] : []),
  ])
    if (
      typeof p[key] !== 'number' ||
      !Number.isFinite(p[key]) ||
      value(p, key) < 0 ||
      value(p, key) > 1000
    )
      errors.push(key + ' must be a finite nonnegative dimension no greater than 1000 mm.');
  if (errors.length) return errors;
  if (
    !['round', 'hex'].includes(String(p.profile)) ||
    !ends.includes(String(p.endA)) ||
    !ends.includes(String(p.endB))
  )
    errors.push('Choose supported body and end forms.');
  if (!appearances.includes(String(p.appearance))) errors.push('Choose an illustrative finish.');
  for (const key of ['catalogItem', 'threadDesignationA', 'threadDesignationB'])
    if (typeof p[key] !== 'string' || String(p[key]).length > 512)
      errors.push(key + ' must be a short text value.');
  for (const key of [
    'throughBore',
    'threadedThrough',
    'meetingFemaleBores',
    ...(composite ? ['insertThrough'] : []),
  ])
    if (typeof p[key] !== 'boolean') errors.push(key + ' must be a boolean.');
  const L = value(p, 'bodyLength'),
    W = value(p, 'bodyWidth');
  if (!(L > 0 && W > 0)) errors.push('Body dimensions must be positive.');
  if (value(p, 'cornerDiameter') > 0 && (p.profile !== 'hex' || value(p, 'cornerDiameter') < W))
    errors.push('A published hex across-corner envelope must be at least the across-flats width.');
  let openingSum = 0,
    unknownOpeningSum = 0;
  for (const side of sides) {
    const end = p['end' + side],
      D = value(p, 'threadDiameter' + side),
      P = value(p, 'threadPitch' + side),
      root = value(p, 'threadRootDiameter' + side),
      male = value(p, 'maleLength' + side),
      maleEnvelope = value(p, 'maleEnvelopeLength' + side),
      depth = value(p, 'femaleDepth' + side),
      envelope = value(p, 'femaleEnvelopeDepth' + side);
    if (
      ['male', 'female'].includes(String(end)) &&
      (!(D > 0) || !String(p['threadDesignation' + side]).trim())
    )
      errors.push(
        'End ' + side + ' threads need a designation and positive nominal/source major diameter.',
      );
    if (end === 'female' && D >= W)
      errors.push('Female ' + side + ' thread bores must retain material inside the body width.');
    if (
      P > 0 &&
      ['male', 'female'].includes(String(end)) &&
      D / 2 <= nativeThreadDepth(P, end === 'female')
    )
      errors.push('End ' + side + ' thread pitch leaves no positive thread core.');
    if (root > 0 && (!(D > 0) || root >= D))
      errors.push('End ' + side + ' source root diameter must remain below its major diameter.');
    if (end === 'male' ? !(male > 0 || maleEnvelope > 0) : male !== 0 || maleEnvelope !== 0)
      errors.push(
        'Only a male ' +
          side +
          ' end may have a positive actual or explicitly unverified stud span.',
      );
    if (male > 0 && maleEnvelope > 0)
      errors.push(
        'Male ' + side + ' end must use either a confirmed span or an unverified envelope.',
      );
    if (!['female', 'self-tapping'].includes(String(end)) && (depth !== 0 || envelope !== 0))
      errors.push('End ' + side + ' has no female or pilot opening.');
    if (depth > 0 && envelope > 0)
      errors.push(
        'End ' + side + ' must use either confirmed depth or an unverified opening envelope.',
      );
    if (end === 'self-tapping' && !(value(p, 'boreDiameter') > 0 && value(p, 'boreDiameter') < W))
      errors.push(
        'A self-tapping pilot needs an explicit diameter inside the body; nominal screw diameter is not a pilot size.',
      );
    if (
      ['female', 'self-tapping'].includes(String(end)) &&
      !p.threadedThrough &&
      !p.throughBore &&
      !(depth > 0 || envelope > 0)
    )
      errors.push(
        'End ' +
          side +
          ' needs a confirmed depth or an explicitly unverified visible opening envelope.',
      );
    if (depth > L || envelope > L) errors.push('End ' + side + ' opening exceeds the body length.');
    openingSum += Math.max(depth, envelope);
    unknownOpeningSum += envelope;
  }
  if (openingSum > L) errors.push('Separate end openings may not overlap beyond the body length.');
  if (
    !p.throughBore &&
    !p.threadedThrough &&
    openingSum >= L &&
    openingSum > 0 &&
    (!p.meetingFemaleBores || unknownOpeningSum > 0)
  )
    errors.push(
      'Unverified blind openings must retain a positive web; meeting confirmed spans require the explicit source flag.',
    );
  if (
    p.meetingFemaleBores &&
    (p.endA !== 'female' ||
      p.endB !== 'female' ||
      p.threadedThrough ||
      p.throughBore ||
      unknownOpeningSum !== 0 ||
      !(value(p, 'femaleDepthA') > 0 && value(p, 'femaleDepthB') > 0) ||
      Math.abs(openingSum - L) > 1e-8)
  )
    errors.push(
      'Meeting female bores require two confirmed end depths summing to body length, without unknown envelopes or a continuous-through-thread declaration.',
    );
  if (
    p.threadedThrough &&
    (p.endA !== 'female' ||
      p.endB !== 'female' ||
      openingSum !== 0 ||
      p.meetingFemaleBores ||
      value(p, 'threadDiameterA') !== value(p, 'threadDiameterB') ||
      value(p, 'threadPitchA') !== value(p, 'threadPitchB') ||
      p.threadDesignationA !== p.threadDesignationB)
  )
    errors.push(
      'A continuous through thread needs matching female interfaces and replaces separate depths/envelopes.',
    );
  if (
    p.throughBore &&
    !p.threadedThrough &&
    !(value(p, 'boreDiameter') > 0 && value(p, 'boreDiameter') < W)
  )
    errors.push('A plain through bore needs an explicit diameter smaller than the body width.');
  if (composite) {
    const od = value(p, 'insertOuterDiameter'),
      a = value(p, 'insertLengthA'),
      b = value(p, 'insertLengthB'),
      known = od > 0 || a > 0 || b > 0 || p.insertThrough;
    if (known) {
      if (!(od > Math.max(value(p, 'threadDiameterA'), value(p, 'threadDiameterB')) && od < W))
        errors.push(
          'Confirmed insert outside diameter must exceed the threads and remain inside the body.',
        );
      if (p.insertThrough ? a !== 0 || b !== 0 : a + b > L || !(a > 0 || b > 0))
        errors.push('Confirmed insert spans must fit within the body without overlap.');
      if (p.threadedThrough && !p.insertThrough)
        errors.push('A confirmed continuous metal through thread needs a continuous insert.');
      for (const side of sides) {
        if (
          ['male', 'female'].includes(String(p['end' + side])) &&
          !p.insertThrough &&
          !(value(p, 'insertLength' + side) > 0)
        )
          errors.push(
            'All threaded ends need confirmed insert spans before separate inserts can be modeled.',
          );
        if (!p.insertThrough && openingSpan(p, side) > value(p, 'insertLength' + side))
          errors.push('A thread/opening cannot extend beyond its confirmed insert envelope.');
      }
    }
  }
  if (presets.length) {
    const selected = presets.find((preset) => preset.parameters.catalogItem === p.catalogItem);
    if (!selected || Object.entries(selected.parameters).some(([key, v]) => p[key] !== v))
      errors.push('Select an unchanged supplier SKU; fixed catalog geometry cannot be resized.');
  } else if (p.catalogItem !== 'prototype')
    errors.push('The development model has no supplier catalog item.');
  return errors;
}

const cylinder = (radius: number, height: number, z: number): Shape => ({
  kind: 'cylinder',
  radius,
  height,
  origin: [0, 0, z],
  axis: 'z',
  segments: 64,
});
const union = (children: Shape[]): Shape =>
  children.length === 1 ? children[0] : { kind: 'union', children };
const cut = (body: Shape, cutters: Shape[]): Shape =>
  cutters.length ? { kind: 'subtract', children: [body, ...cutters] } : body;
const flipped = (shape: Shape, z: number): Shape => ({
  kind: 'transform',
  child: shape,
  translation: [0, 0, z],
  rotation: [180, 0, 0],
});
function endCylinder(
  p: Parameters,
  side: Side,
  length: number,
  internal: boolean,
  nominalOnly = false,
): Shape {
  const shape = cylinder(value(p, 'threadDiameter' + side) / 2, length, 0);
  if (shape.kind === 'cylinder' && value(p, 'threadPitch' + side) > 0 && !nominalOnly)
    shape.thread = {
      pitch: value(p, 'threadPitch' + side),
      internal,
      designation: String(p['threadDesignation' + side]),
    };
  return side === 'A'
    ? internal
      ? shape
      : flipped(shape, 0)
    : internal
      ? flipped(shape, value(p, 'bodyLength'))
      : {
          kind: 'transform',
          child: shape,
          translation: [0, 0, value(p, 'bodyLength')],
          rotation: [0, 0, 0],
        };
}
function body(p: Parameters): Shape {
  const W = value(p, 'bodyWidth'),
    L = value(p, 'bodyLength'),
    shape: Shape = {
      kind: 'cylinder',
      radius: p.profile === 'hex' ? W / Math.sqrt(3) : W / 2,
      height: L,
      origin: [0, 0, 0],
      axis: 'z',
      segments: p.profile === 'hex' ? 6 : 64,
    };
  return p.profile === 'hex' &&
    value(p, 'cornerDiameter') > 0 &&
    value(p, 'cornerDiameter') < (2 * W) / Math.sqrt(3)
    ? { kind: 'intersect', children: [shape, cylinder(value(p, 'cornerDiameter') / 2, L, 0)] }
    : shape;
}
function openingCutters(p: Parameters, owners: Side[] = sides): Shape[] {
  const cutters: Shape[] = [],
    L = value(p, 'bodyLength');
  if (p.threadedThrough) return [endCylinder(p, 'A', L, true)];
  for (const side of owners) {
    const span = openingSpan(p, side),
      end = p['end' + side];
    if (span > 0 && end === 'female')
      cutters.push(endCylinder(p, side, span, true, value(p, 'femaleDepth' + side) === 0));
    if (span > 0 && end === 'self-tapping')
      cutters.push(
        side === 'A'
          ? cylinder(value(p, 'boreDiameter') / 2, span, 0)
          : flipped(cylinder(value(p, 'boreDiameter') / 2, span, 0), L),
      );
  }
  const a = openingSpan(p, 'A'),
    b = openingSpan(p, 'B');
  if (p.throughBore && L > a + b)
    cutters.push(cylinder(value(p, 'boreDiameter') / 2, L - a - b, a));
  return cutters;
}
const stud = (p: Parameters, side: Side) =>
  endCylinder(p, side, studSpan(p, side), false, value(p, 'maleLength' + side) === 0);
function boreEnvelopes(p: Parameters, owners: Side[]) {
  return owners.flatMap((side) =>
    value(p, 'femaleEnvelopeDepth' + side) > 0
      ? [
          {
            end: side,
            visualizationExtent: value(p, 'femaleEnvelopeDepth' + side),
            verified: false,
            purpose: 'Visible blind-opening installation envelope; not a thread or drilling depth.',
          },
        ]
      : [],
  );
}
function studEnvelopes(p: Parameters, owners: Side[]) {
  return owners.flatMap((side) =>
    value(p, 'maleEnvelopeLength' + side) > 0
      ? [
          {
            end: side,
            visualizationExtent: value(p, 'maleEnvelopeLength' + side),
            verified: false,
            purpose:
              'Visible stud installation envelope; actual protrusion and thread span are unpublished.',
          },
        ]
      : [],
  );
}
function interfaceNotes(p: Parameters, composite: boolean, separated: boolean): string {
  const notes = [
    'Dimensions describe the selected installation model; thread fits, tolerances and strength require the supplier drawing.',
  ];
  for (const side of sides)
    if (
      ['male', 'female'].includes(String(p['end' + side])) &&
      value(p, 'threadPitch' + side) === 0
    )
      notes.push(
        'End ' +
          side +
          ' thread pitch/profile is unpublished; the interface stays smooth in both modes.',
      );
  if (boreEnvelopes(p, sides).length)
    notes.push(
      'Blind-opening extents are unverified visualization envelopes, not thread or drilling depths. No helical feature is assigned to those openings.',
    );
  if (studEnvelopes(p, sides).length)
    notes.push(
      'Stud protrusions shown as envelopes are unverified; they do not define actual thread spans or verified overall product length.',
    );
  if (p.meetingFemaleBores)
    notes.push(
      'Separate source-defined female spans meet at the centre. This is not a source declaration of one continuous through thread; mutual thread phase, drill tips and the transition are unspecified.',
    );
  if (value(p, 'cornerDiameter') > 0)
    notes.push(
      'The published across-corner envelope is respected; corner rounds/chamfers and their manufacturing profile are unspecified.',
    );
  if ([p.endA, p.endB].includes('self-tapping'))
    notes.push(
      'Self-tapping pilot openings use explicit smooth envelopes, without an invented forming profile.',
    );
  if (composite)
    notes.push(
      separated
        ? 'Insert cylinders are source-defined installation envelopes; knurl, interference fit and retention details are not supplied.'
        : 'Hidden insert dimensions are unpublished. The body is an installation envelope; exposed metal studs are shown independently without inventing hidden metal.',
    );
  return notes.join(' ');
}
function metadata(
  p: Parameters,
  shape: Shape,
  owners: Side[],
  composite: boolean,
  separated: boolean,
): Record<string, string> {
  const result = threadMetadata(boundaryThreadCallouts(shape));
  const nominal = owners.flatMap((side) => {
    const end = p['end' + side],
      designation = String(p['threadDesignation' + side]).trim();
    if (!designation || !['female', 'male', 'self-tapping'].includes(String(end))) return [];
    if (value(p, 'femaleEnvelopeDepth' + side) > 0)
      return [
        side +
          ': source ' +
          end +
          ' ' +
          designation +
          ', depth unpublished; displayed blind opening is an unverified visualization envelope',
      ];
    if (value(p, 'maleEnvelopeLength' + side) > 0)
      return [
        side +
          ': source external ' +
          designation +
          ', protrusion/thread span unpublished; displayed stud is an unverified visualization envelope',
      ];
    if (value(p, 'threadPitch' + side) === 0 || end === 'self-tapping')
      return [
        side +
          ': source ' +
          end +
          ' ' +
          designation +
          '; smooth interface envelope, thread profile/pitch unspecified',
      ];
    return [];
  });
  if (nominal.length) {
    result.ThreadCallouts = [result.ThreadCallouts, ...nominal].filter(Boolean).join('; ');
    result.ThreadLabels = [
      ...new Set(
        [
          result.ThreadLabels,
          ...owners.map((side) => String(p['threadDesignation' + side])),
        ].filter(Boolean),
      ),
    ].join('; ');
  }
  if (p.meetingFemaleBores && owners.length)
    result.ThreadCallouts = [
      result.ThreadCallouts,
      'Separate source spans meet; thread phase and drill transition are unspecified, not a confirmed continuous through thread.',
    ]
      .filter(Boolean)
      .join('; ');
  return {
    ...result,
    SupplierCatalogItem: String(p.catalogItem),
    SupplierThreadDesignationA: String(p.threadDesignationA),
    SupplierThreadDesignationB: String(p.threadDesignationB),
    SourceThreadRootDiametersJSON: JSON.stringify(
      Object.fromEntries(
        sides
          .filter((side) => value(p, 'threadRootDiameter' + side) > 0)
          .map((side) => [side, value(p, 'threadRootDiameter' + side)]),
      ),
    ),
    InterfaceGeometryNotes: interfaceNotes(p, composite, separated),
    NominalBoreEnvelopeJSON: JSON.stringify(boreEnvelopes(p, owners)),
    NominalStudEnvelopeJSON: JSON.stringify(studEnvelopes(p, owners)),
    PurchasedUnitScope: composite
      ? 'One complete supplier unit; visual body, stud and insert envelopes are not a manufacturing BOM.'
      : 'One supplier spacer or standoff.',
  };
}
const palette: Record<string, number> = {
  neutral: 0x9aa3ac,
  brass: 0xb9a067,
  nickel: 0xc4c9cd,
  aluminium: 0xc2c7cb,
  steel: 0x87919a,
  'nylon-black': 0x25282d,
  'nylon-white': 0xe4e3dc,
};
type ModelPiece = assembly.Piece & { metadata: Record<string, string>; appearance: string };
export function pieces(p: Parameters, composite = false): ModelPiece[] {
  const cutters = openingCutters(p),
    maleSides = sides.filter((side) => p['end' + side] === 'male'),
    knownInserts = composite && value(p, 'insertOuterDiameter') > 0;
  const make = (
    label: string,
    shape: Shape,
    appearance: string,
    owners: Side[],
    separated: boolean,
  ): ModelPiece => ({
    label,
    shape,
    color: palette[appearance],
    appearance,
    metadata: metadata(p, shape, owners, composite, separated),
  });
  if (!composite)
    return [
      make(
        'PCB spacer / standoff',
        cut(union([body(p), ...maleSides.map((side) => stud(p, side))]), cutters),
        String(p.appearance),
        sides,
        false,
      ),
    ];
  if (!knownInserts)
    return [
      make(
        'Supplier body installation envelope · hidden metal unspecified',
        cut(body(p), cutters),
        String(p.appearance),
        sides.filter((side) => p['end' + side] !== 'male'),
        false,
      ),
      ...maleSides.map((side) =>
        make(
          'Exposed brass stud ' + side + ' · hidden insert unspecified',
          stud(p, side),
          'brass',
          [side],
          false,
        ),
      ),
    ];
  const L = value(p, 'bodyLength'),
    R = value(p, 'insertOuterDiameter') / 2;
  const spans: { z: number; length: number; owners: Side[] }[] = p.insertThrough
    ? [{ z: 0, length: L, owners: sides }]
    : sides.flatMap((side) =>
        value(p, 'insertLength' + side) > 0
          ? [
              {
                z: side === 'A' ? 0 : L - value(p, 'insertLength' + side),
                length: value(p, 'insertLength' + side),
                owners: [side],
              },
            ]
          : [],
      );
  const nominalCuts = cutters.map((shape) => {
    const copy = structuredClone(shape);
    const clear = (feature: Shape) => {
      if (feature.kind === 'cylinder') delete feature.thread;
      else if (feature.kind === 'transform') clear(feature.child);
    };
    clear(copy);
    return copy;
  });
  return [
    make(
      'Polymer supplier body · insert seats are nominal envelopes',
      cut(body(p), [...spans.map((span) => cylinder(R, span.length, span.z)), ...nominalCuts]),
      String(p.appearance),
      [],
      true,
    ),
    ...spans.map((span, index) =>
      make(
        'Metal insert ' + (index + 1) + ' · cylindrical installation envelope',
        cut(
          union([
            cylinder(R, span.length, span.z),
            ...span.owners
              .filter((side) => p['end' + side] === 'male')
              .map((side) => stud(p, side)),
          ]),
          openingCutters(p, span.owners),
        ),
        'brass',
        span.owners,
        true,
      ),
    ),
  ];
}
export function geometry(p: Parameters, composite = false): Group {
  const items = pieces(p, composite),
    model = assembly.geometry(items);
  model.children.forEach((child, index) =>
    child.traverse((object) => {
      if (object instanceof Mesh && object.material instanceof MeshStandardMaterial) {
        const polymer = items[index].appearance.startsWith('nylon');
        object.material.metalness = polymer ? 0 : 0.65;
        object.material.roughness = polymer ? 0.82 : 0.4;
      }
    }),
  );
  model.userData.geometryMode = currentGeometryMode();
  return model;
}
export function python(p: Parameters, composite = false): string {
  const items = pieces(p, composite);
  return (
    assembly.python(items) +
    '\ncomponent_metadata = ' +
    JSON.stringify(items.map((item) => item.metadata))
  );
}
export function dimensions(p: Parameters): Vec {
  const W = value(p, 'bodyWidth'),
    studWidth = Math.max(
      0,
      ...sides
        .filter((side) => p['end' + side] === 'male')
        .map((side) => value(p, 'threadDiameter' + side)),
    );
  return [
    Math.max(
      studWidth,
      p.profile === 'hex'
        ? Math.min((2 * W) / Math.sqrt(3), value(p, 'cornerDiameter') || Infinity)
        : W,
    ),
    Math.max(studWidth, W),
    value(p, 'bodyLength') + studSpan(p, 'A') + studSpan(p, 'B'),
  ];
}
