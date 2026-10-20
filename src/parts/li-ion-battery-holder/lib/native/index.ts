import type { SupplierAsset } from '../../../../core/manufacturer-cad';
import beilamoo2s from './beilamoo-2s.json';
import beilamoo3s from './beilamoo-3s.json';
import beilamoo4s from './beilamoo-4s.json';
import mpdPc4 from './mpd-bk-18650-pc4.json';
import mpdPc6 from './mpd-bk-18650-pc6.json';
import mpdPc8 from './mpd-bk-18650-pc8.json';

export const assets: Record<string, SupplierAsset> = {
  'beilamoo-2s': beilamoo2s,
  'beilamoo-3s': beilamoo3s,
  'beilamoo-4s': beilamoo4s,
  'mpd-bk-18650-pc4': mpdPc4,
  'mpd-bk-18650-pc6': mpdPc6,
  'mpd-bk-18650-pc8': mpdPc8,
};

export const nativeModels = assets;
export default assets;
