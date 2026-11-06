export const drawingUrl =
  'https://klmaster.com/files/ckeditor/580/f86e25b13177f9f3ba48a7148953cec8.jpg';
export const sp16DrawingUrl =
  'https://klmaster.com/files/goods/182/gallery/germetichnyy_razem_sp16_5_pin_1.jpg';
export const sp16ContactsUrl =
  'https://klmaster.com/files/goods/182/gallery/germetichnyy_razem_sp16_5_pin_ip68_komplekt_2.jpg';
export const sp20ThreeDrawingUrl =
  'https://klmaster.com/files/ckeditor/580/5238f7e9a0fea65cb4a62e36c2631fb1.jpg';
export const sp20ThreeContactsUrl =
  'https://klmaster.com/files/goods/703/gallery/germetichnyy_razem_sp20_3_pin_ip68_komplekt_3.jpg';

export interface ConnectorModel {
  id: string;
  designation: string;
  series: 'SP16' | 'SP20';
  contacts: 2 | 3 | 4 | 5 | 6;
  housing: 'cable-plug' | 'panel-socket';
  contactSex: 'male' | 'female';
  contactDiameter: number;
  sourceUrl: string;
  kitCode: string;
}

export const models: ConnectorModel[] = (
  [
    { series: 'SP20', contacts: 2, code: '702' },
    { series: 'SP20', contacts: 4, code: '705' },
    { series: 'SP20', contacts: 6, code: '707' },
    { series: 'SP20', contacts: 3, code: '703' },
    { series: 'SP16', contacts: 5, code: '182' },
  ] as const
).flatMap(({ series, contacts, code }) => {
  return (['cable-plug', 'panel-socket'] as const).map((housing) => ({
    id: `${series.toLowerCase()}-${contacts}-${housing}`,
    designation: `${series}-${contacts} ${housing === 'cable-plug' ? 'cable plug · male contacts' : 'panel socket · female contacts'}`,
    series,
    contacts,
    housing,
    contactSex: housing === 'cable-plug' ? ('male' as const) : ('female' as const),
    contactDiameter: series === 'SP16' ? 1 : contacts === 6 ? 1.8 : 2.8,
    sourceUrl:
      series === 'SP16'
        ? 'https://klmaster.com/catalog/germetichnyy-razem-sp16-5-pin-182/'
        : contacts === 3
          ? 'https://klmaster.com/catalog/germetichnyy-razem-sp20-3-pin-ip68-komplekt-703/'
          : `https://klmaster.com/ua/catalog/germetichnyy-razem-sp20-${contacts}-pin-ip68-komplekt-${code}/`,
    kitCode: `00000${code}`,
  }));
});

export const findModel = (id: unknown): ConnectorModel | undefined =>
  models.find((model) => model.id === id);

/** Face-view topology follows the supplier contact diagram; pitch is approximate. */
export function contactPositions(
  count: ConnectorModel['contacts'],
  series: ConnectorModel['series'] = 'SP20',
): [number, number][] {
  if (count === 2)
    return [
      [0, 3.6],
      [0, -3.6],
    ];
  const radius = series === 'SP16' ? 3.4 : 4.3;
  if (count === 5)
    return [126, 54, 198, 342, 270].map((angle) => [
      radius * Math.cos((angle * Math.PI) / 180),
      radius * Math.sin((angle * Math.PI) / 180),
    ]);
  if (count === 3)
    return [90, -30, 210].map((angle) => [
      radius * Math.cos((angle * Math.PI) / 180),
      radius * Math.sin((angle * Math.PI) / 180),
    ]);
  return Array.from({ length: count }, (_, index) => {
    const angle = (index * 2 * Math.PI) / count;
    return [radius * Math.cos(angle), radius * Math.sin(angle)];
  });
}
