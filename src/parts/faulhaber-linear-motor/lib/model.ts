import type { Parameters } from '../../../core/types';
import {
  supplierGeometry,
  supplierDimensions,
  supplierPython,
} from '../../../core/manufacturer-cad';
import models from './models.json';
import { nativeModels } from './native';
export function modelData(p: Parameters) {
  const model = models.find((m) => m.model === p.model);
  if (!model) throw new Error('Choose a listed FAULHABER model.');
  return model;
}
function travel(p: Parameters): number {
  const position = p.position;
  if (typeof position !== 'number' || !Number.isFinite(position) || position < 0 || position > 100)
    throw new Error('Rod position must be between 0% and 100%.');
  return (position / 100 - 0.5) * modelData(p).attributes.stroke;
}
export function geometry(p: Parameters) {
  return supplierGeometry(nativeModels, modelData(p).assets, travel(p));
}
export function dimensions(p: Parameters): [number, number, number] {
  return supplierDimensions(nativeModels, modelData(p).assets, travel(p));
}
export function python(p: Parameters): string {
  return supplierPython(nativeModels, modelData(p).assets, travel(p));
}
