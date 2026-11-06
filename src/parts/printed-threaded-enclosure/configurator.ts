import shell from '../printed-threaded-shell/part';
import type { Parameters, ParameterDefinition } from '../../core/types';
const { model: _model, ...values } = shell.defaults;
export const defaults: Parameters = values;
export const parameters: ParameterDefinition[] = shell.parameters
  .filter((field) => field.key !== 'model')
  .map((field) => ({ ...field, visibleWhen: undefined }));
