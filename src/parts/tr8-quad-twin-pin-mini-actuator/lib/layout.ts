import {layout as original,twinPin} from '../../tr8-quad-twin-pin-actuator/part';

/** Shorten only the outward bearing stack; all four drive datums stay fixed. */
export const layout={...original,diameter:54,postRadius:23.5,postClock:18,
  outputBearingCentres:[twinPin.innerBearingCentre,12] as const,
  outputClip:14.4,outputTail:22.5};
export const compact={...twinPin,outerShift:-5,guideLowY:-7.05,guideHighY:-5.05,sleeveTo:10.5,outerCheekLow:9.9,outerCheekHigh:12.9};
export function diameterLimit() {
  const top=layout.lever/Math.cos(Math.PI/9)+.30822227524088+4.25;
  const radial=layout.outputRadial+9.55;
  return {controllingFeature:'Unchanged one-piece crank, outer top edge at neutral',
    minimumDiameter:2*Math.hypot(radial,top),crankRadial:radial,crankTop:top,
    selectedDiameter:layout.diameter,nominalRadialMargin:layout.diameter/2-Math.hypot(radial,top)};
}
