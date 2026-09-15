import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const defaults: Parameters = {
  bodyDiameter: 40,
  bodyHeight: 20,
  wallThickness: 3,
  backThickness: 4,
  poleDiameter: 16,
  coilClearance: 0.5,
  coilRecess: 1,
  mountingBoreDiameter: 5,
  mountingBoreDepth: 8,
  armatureDiameter: 40,
  armatureThickness: 4,
  airGap: 0.5,
  showLeads: true,
  leadDiameter: 1.8,
  leadLength: 16,
};

const dimension = (
  key: string,
  label: string,
  group: string,
  min: number,
  max: number,
  step = 0.1,
): ParameterDefinition => numberParameter(key, label, '', group, min, max, step);

export const parameters: ParameterDefinition[] = [
  dimension('bodyDiameter', 'Cup outside diameter', 'Steel cup', 12, 160),
  dimension('bodyHeight', 'Cup height', 'Steel cup', 5, 100),
  dimension('wallThickness', 'Outer wall thickness', 'Steel cup', 0.8, 20),
  dimension('backThickness', 'Back plate thickness', 'Steel cup', 0.8, 30),
  dimension('poleDiameter', 'Central pole diameter', 'Steel cup', 3, 100),
  {
    ...dimension('coilClearance', 'Coil radial and rear clearance', 'Potted coil', 0.1, 5, 0.05),
    description: 'Clearance between the simplified potted winding and the steel cup.',
  },
  dimension('coilRecess', 'Coil recess below pole face', 'Potted coil', 0.1, 10, 0.05),
  {
    ...dimension('mountingBoreDiameter', 'Rear mounting bore diameter', 'Mounting', 1, 30, 0.05),
    description: 'Smooth blind pilot bore; a helical mounting thread is not represented.',
  },
  dimension('mountingBoreDepth', 'Rear mounting bore depth', 'Mounting', 1, 60),
  {
    ...dimension('armatureDiameter', 'Armature diameter', 'Armature plate', 12, 180),
    description: 'The removable plate is included in the assembled and exploded states.',
  },
  dimension('armatureThickness', 'Armature thickness', 'Armature plate', 0.8, 30),
  dimension('airGap', 'Working air gap', 'Armature plate', 0, 20, 0.05),
  {
    key: 'showLeads',
    label: 'Include paired rear leads',
    type: 'boolean',
    group: 'Electrical leads',
  },
  {
    ...dimension('leadDiameter', 'Insulated lead diameter', 'Electrical leads', 0.5, 8, 0.05),
    visibleWhen: (p) => p.showLeads === true,
  },
  {
    ...dimension('leadLength', 'Lead extension behind cup', 'Electrical leads', 2, 120),
    visibleWhen: (p) => p.showLeads === true,
  },
];

export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [];
