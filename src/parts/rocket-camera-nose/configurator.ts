import type { Parameters, ParameterDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';
export const defaults: Parameters = {
  packaging: 'structural-ogive',
  cameraSetup: 'camera-19',
  tubeOD: 90,
  tubeID: 86,
  noseLength: 140,
  shoulderLength: 98,
  wall: 3,
  shoulderClearance: 0.2,
};
export const parameters: ParameterDefinition[] = [
  {
    key: 'cameraSetup',
    label: 'Camera installation',
    type: 'select',
    group: 'Cameras',
    options: [
      { value: 'camera-19', label: '19 mm CSI · interchangeable single-camera cartridge' },
      {
        value: 'ov9281',
        label: 'OV9281-110 · interchangeable single-camera cartridge',
        availableWhen: (p) =>
          p.packaging === 'structural-ogive' && p.tubeOD === 90 && p.tubeID === 86,
      },
      {
        value: 'dual',
        label: 'OV9281-110 + 19 mm CSI · both forward',
        availableWhen: (p) =>
          p.packaging === 'structural-ogive' && p.tubeOD === 90 && p.tubeID === 86,
      },
    ],
  },
  {
    key: 'packaging',
    label: 'Equipment arrangement',
    type: 'select',
    group: 'Packaging',
    options: [
      { value: 'structural-ogive', label: 'PETG structure · formed TPU electronics pockets' },
      { value: 'tpu-compact', label: 'One-piece TPU · narrow tube' },
      { value: 'tandem', label: 'Tandem · narrow tube' },
      { value: 'sandwich', label: 'Sandwich · wider tube' },
    ],
  },
  numberParameter('tubeOD', 'Mating tube outside diameter', 'D', 'Tube interface', 90, 180),
  numberParameter('tubeID', 'Measured tube inside diameter', 'd', 'Tube interface', 85, 175),
  numberParameter(
    'shoulderClearance',
    'Shoulder diametral clearance',
    'c',
    'Tube interface',
    0.2,
    1.2,
  ),
  numberParameter(
    'shoulderLength',
    'Deep shoulder insertion length',
    's',
    'Tube interface',
    90,
    400,
  ),
  numberParameter('noseLength', 'Nose body length', 'L', 'Nose housing', 70, 600),
  numberParameter('wall', 'Shell wall allowance', 't', 'Nose housing', 1, 3.2),
];
