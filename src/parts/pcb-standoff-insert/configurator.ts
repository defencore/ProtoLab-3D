import type { Preset } from '../../core/types';
import data from './presets.json';
import {
  parameterSchema,
  insertPrototypeDefaults,
  catalogFields,
} from '../pcb-standoff/lib/schema';
const presets = data as Preset[];
export const catalogFilterFields = catalogFields(presets);
export const defaults = presets.length
  ? { ...presets[0].parameters }
  : { ...insertPrototypeDefaults };
export const parameters = parameterSchema(presets, true);
