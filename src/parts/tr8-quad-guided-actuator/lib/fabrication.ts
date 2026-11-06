import type { FabricationFile, Parameters } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { componentPython } from '../../../core/assembly/detail-instances';
import { cncFabricationFiles, cncMachiningSchedule, libraries, centralGuideLayout,
  centralGuideFaces, type CncLayout } from '../../tr8-quad-cnc-actuator/part';
import { guidedFramePieces } from './frame';

export function guidedMachiningSchedule(layout: CncLayout) {
  const old = cncMachiningSchedule(layout), guide = centralGuideLayout(layout);
  const { nominalFirstRollContactDegrees: _oldContact, ...linkage } = old.linkage;
  return { ...old, centralNutGuide: { ...guide, faces: centralGuideFaces(layout),
    quantity: 1, integralToMiddleBody: true, additionalFasteners: 0,
    facePolicy: 'All four carrier inner flats slide parallel to their screw axes; the fixed guide blocks both nut-roll directions independently of the outward forks.' },
    linkage: { ...linkage, guidePolicy: 'Four integral central guide faces restrain the nut carriers. Nominal running clearance permits finite angular play before contact.' },
    requirements: [...old.requirements,
      'Finish the four stationary guide faces and moving carrier flats together; assign running clearance, parallelism, flatness and surface finish.',
      'Lubricate the sliding faces and qualify guide-fin stiffness, wear and nut-reaction loads. Do not treat the nominal fit as a zero-backlash joint.',
    ] };
}

export function guidedFabricationFiles(layout: CncLayout, parameters: Parameters, pieces: ConfiguredPiece[]): FabricationFile[] {
  const oldStem = layout.variant === 'coplanar-64' ? 'TR8-CNC64' : 'TR8-CNC56';
  const stem = oldStem + '-guided';
  const body = guidedFramePieces(layout).find(piece => piece.component.id === 'cnc-middle-body')!;
  return cncFabricationFiles(layout, parameters, pieces).map(file => {
    const named = { ...file, name: file.name.replace(oldStem, stem) };
    if (file.id === 'machining') return { ...named, content: JSON.stringify(guidedMachiningSchedule(layout), null, 2)+'\n' };
    if (file.id === 'cut-manifest') return { ...named, content: JSON.stringify({ ...JSON.parse(file.content),
      centralNutGuide: 'Integral square spine and four guide fins; CNC machining only', additionalGuideFasteners: 0,
    }, null, 2)+'\n' };
    if (file.id !== 'cnc-body-native') return named;
    return { ...named, label:'One-piece guided CNC middle body · native BRep', content:
      `import FreeCAD as App, Part, math\ndoc=App.newDocument(${JSON.stringify(stem.replaceAll('-','')+'MiddleBody')})\n${componentPython(libraries,[body])}\nitem=doc.addObject('Part::Feature','GuidedMiddleBody')\nitem.Label=${JSON.stringify(body.label)}\nitem.Shape=shape\nitem.addProperty('App::PropertyFloatList','SourceRGB','Appearance')\nitem.SourceRGB=component_colors[0]\ndoc.recompute()\nif App.GuiUp:\n    import FreeCADGui as Gui\n    item.ViewObject.ShapeColor=tuple(component_colors[0])\n    Gui.activeDocument().activeView().viewAxonometric()\n    Gui.activeDocument().activeView().fitAll()\n` };
  });
}
