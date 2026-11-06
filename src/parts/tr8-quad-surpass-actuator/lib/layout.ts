import {layout as previous} from '../../tr8-quad-twin-pin-mini-actuator/part';
export const layout={...previous,diameter:70,screwPitchRadius:20.5,outputRadial:Math.sqrt(20.5**2-10**2),postRadius:30.5,couplingCentre:-32.4};
export const radialShift=layout.outputRadial-previous.outputRadial;
export const motorModel='surpass-2845-3100kv';
export const motorSource='https://images-na.ssl-images-amazon.com/images/I/51uWegAEAqL.jpg';
export const motorRoll=Math.atan2(layout.lever,layout.outputRadial)*180/Math.PI-180;
export const motorFit={shaftDiameter:3.175,shaftProjection:15,bodyDiameter:28,bodyLength:47,
  mountingCross:[16,19],shaftClearance:8.2,boltClearance:3.4,boltLength:5,plateThickness:3,threadEngagement:2,
  motorShaftEngagement:7,screwShaftEngagement:7,shoulderClearance:.4};
export const inheritedParameters={motorModel:'361-12',bearingKit:'prom-smb'};
