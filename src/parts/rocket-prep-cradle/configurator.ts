import type { Parameters } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const parameters = [
  numberParameter('width', 'Base width', 'W', 'Cradle', 30, 400),
  numberParameter('depth', 'Support depth', 'D', 'Cradle', 15, 180),
  numberParameter('height', 'Overall height', 'H', 'Cradle', 20, 250),
  numberParameter('opening', 'V opening width', 'V', 'Cradle', 10, 370),
  numberParameter('floor', 'Material below V apex', 'f', 'Cradle', 3, 80),
];

export const defaults: Parameters = { width: 130, depth: 50, height: 70, opening: 108, floor: 15 };
