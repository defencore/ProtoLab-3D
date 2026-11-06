import { fixedProductConfigurator } from './lib/purchased-product';
import catalog from './lib/catalog.json';

export const { defaults, parameters } = fixedProductConfigurator(catalog);
export const catalogSelection = [{ key: 'model' }];
