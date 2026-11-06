import { detailComponent } from '../../../core/component-recipes';
import { box, union, type Shape } from '../../../core/assembly/boundary/shapes';
import { guideShape, centralGuideLayout } from '../../tr8-quad-cnc-actuator/part';
import { laserLayout, frameLayout } from './layout';

/** Separate milled guide, retained by square keys in the two 3 mm bearing discs. */
export function centralGuideShape(): Shape {
  const guide = centralGuideLayout(laserLayout), [back, front] = frameLayout.guideShoulders;
  const square = (from:number,to:number,half:number): Shape => ({
    kind:'transform',translation:[0,0,0],rotation:[laserLayout.clock,0,0],
    child:box([to-from,2*half,2*half],[from,-half,-half]),
  });
  const existingFaces:Shape = {
    kind:'intersect',children:[guideShape(laserLayout),
      box([guide.xSpan[1]-back,64,64],[back,-32,-32])],
  };
  return union(existingFaces,square(back,front,guide.coreHalfWidth),
    square(back-frameLayout.tabDepth,back,frameLayout.guideTenon/2),
    square(front,front+frameLayout.tabDepth,frameLayout.guideTenon/2));
}

export function centralGuidePiece() {
  const label='Central nut guide · milled pinwheel spine · square locating tenons';
  const component=detailComponent('central-nut-guide',label,centralGuideShape());
  component.manufacturing={
    material:'Steel; grade, guide-face finish and fits per production drawing',
    blank:'Round billet diameter 32 x 35.4 mm minimum plus machining allowance',
    processes:['milling'],
    requirements:[
      'Mill only this separate guide for the structural frame. Its four fins retain the original 0.05 mm nominal carrier sliding clearance.',
      'Square 8 x 8 mm tenons engage 2.7 mm into the 8.1 x 8.1 mm laser sockets in the middle and end bearing discs.',
      'Fit the two tenons for clocking and alignment; the eight standoff end bolts capture the complete frame stack axially. No guide fasteners are added.',
      'Finish and lubricate all four sliding faces; assign real tolerances, parallelism, root reliefs, stiffness and wear limits.',
    ],
  };
  return {component,label,color:0x79909f,requireSingleSolid:true};
}
