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
function travel(_p: Parameters): number {
  return 0;
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
