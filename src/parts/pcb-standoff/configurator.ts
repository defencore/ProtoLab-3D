import type { Preset } from '../../core/types';
import data from './presets.json';
import { parameterSchema, prototypeDefaults, catalogFields } from './lib/schema';
const presets = data as Preset[];
export const catalogFilterFields = catalogFields(presets);
export const defaults = presets.length ? { ...presets[0].parameters } : { ...prototypeDefaults };
export const parameters = parameterSchema(presets);
