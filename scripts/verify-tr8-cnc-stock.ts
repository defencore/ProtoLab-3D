import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cncLayout, type CncVariant } from '../src/parts/tr8-quad-cnc-actuator/lib/layout';
import { cncChannels } from '../src/parts/tr8-quad-cnc-actuator/lib/placement';
import { defaults } from '../src/parts/tr8-quad-cnc-actuator/configurator';
const variant=process.argv[2] as CncVariant,layout=cncLayout(variant);
const directory=resolve(process.argv[3]??`test-results/${variant==='coplanar-64'?'tr8-quad-cnc-actuator':'tr8-quad-staggered-actuator'}/channel`);
writeFileSync(resolve(directory,'continuous-layout.json'),JSON.stringify({layout,channels:cncChannels(defaults,'assembled',layout)}));
console.log(JSON.stringify({variant,directory}));
