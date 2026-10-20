import py100 from './py-10x10cm.json';
import py79 from './py-7x9cm.json';
import py37 from './py-3x7cm.json';
import py46 from './py-4x6cm.json';
import py57 from './py-5x7cm.json';
import py68 from './py-6x8cm.json';
import type { SupplierAsset } from '../../../../core/manufacturer-cad';

export const assets: Record<string, SupplierAsset> = {
  'py-10x10cm': py100,
  'py-7x9cm': py79,
  'py-3x7cm': py37,
  'py-4x6cm': py46,
  'py-5x7cm': py57,
  'py-6x8cm': py68,
};
export default assets;
