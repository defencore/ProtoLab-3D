import type {Parameters} from '../../../core/types';
import {channelPieces as oldChannel,libraries,nutTravel} from '../../tr8-quad-cnc-actuator/part';
import {configureActuatorPiece} from '../../tr8-compact-actuator/part';
import {layout,twinPin as d} from './layout';
import {stockBearingPieces} from './bearings';
import {nutPiece,shaftPiece,crankPiece,sleevePiece} from './linkage';

export const innerBearingParameters={bore:3,outer:6,width:2.5,flangeOuter:7.2,flangeWidth:.6,seals:'metal',balls:8};
export function channelPieces(p:Parameters,angle:number) {
  const omit=new Set(['lead-nut','nut-yoke','nut-flange-negative','nut-flange-positive','output-shaft','output-rear-crank',
    'output-bearing-0','output-inner-spacer','output-inter-spacer']);
  const pieces=oldChannel(p,angle,layout).filter(piece=>!omit.has(piece.component.id));
  const bearing=libraries.find(part=>part.id==='flanged-ball-bearing')!;
  const inner=configureActuatorPiece(bearing,'output-inner-guide-bearing','Inner guide bearing · EZO SMF63ZZ · Ø3×6×2.5',
    innerBearingParameters,[0,d.innerBearingCentre,0],[-90,0,0],'assembled',0xaeb8c0);
  inner.component.supply='purchased';delete inner.component.manufacturing;
  inner.component.procurement={designation:'EZO SMF63ZZ · 3×6×2.5 · flange 7.2×0.6',manufacturer:'Kitanihon Seiki / EZO',
    source:'https://www.ezo-brg.co.jp/english/product/spec.php?eid=00184&unit=mm'};
  pieces.push(nutPiece(nutTravel(layout,angle)),shaftPiece(angle),crankPiece(angle),sleevePiece(),inner);
  return stockBearingPieces(p,pieces,angle);
}
