import {layout as previous} from '../../tr8-quad-twin-pin-mini-actuator/part';
export const layout={...previous,diameter:56};
export const motorModel='2250S024BX4-6855';
export const motorSource='https://eshop.faulhaber.com/en/2250S024BX4-6855/2250S024BX4-6855';
/** Tangential cable roots form a pinwheel, clear of adjacent motor bodies. */
export const motorRoll=Math.atan2(layout.lever,layout.outputRadial)*180/Math.PI-90;
export const motorFit={pilotDiameter:10.1,pilotBlankDiameter:9.8,boltCircle:17,boltClearance:2.2,
  boltLength:5,plateThickness:3,threadEngagement:2,blindDepth:3,shaftEngagement:6.4,
  bodyDiameter:22,bodyLength:51.8,shaftProjection:12.2};
export const inheritedParameters={motorModel:'361-12',bearingKit:'prom-smb'};
