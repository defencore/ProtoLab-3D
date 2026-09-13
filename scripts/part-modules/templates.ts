export function starterFiles(id: string, name: string, order: number): Record<string, string> {
  return {
    'index.ts': `import type { PartModule } from '../../core/part-modules';
import partDefinition from './part';
const part = { ...partDefinition, id: ${JSON.stringify(id)} };
export default { apiVersion: 1, order: ${order}, part } satisfies PartModule;
`,
    'configurator.ts': `import type { ParameterDefinition, Parameters } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const parameters: ParameterDefinition[] = [
  numberParameter('outerDiameter', 'Outside diameter', 'D', 'Dimensions', 2, 100),
  numberParameter('bore', 'Bore diameter', 'd', 'Dimensions', 1, 80),
  numberParameter('length', 'Length', 'L', 'Dimensions', 1, 200),
];
export const defaults: Parameters = { outerDiameter: 8, bore: 3.4, length: 15 };
`,
    'presets.json':
      JSON.stringify(
        [
          {
            id: 'starter',
            name: 'M3 clearance spacer',
            description: 'Prototype example; not a verified supplier part.',
            parameters: { outerDiameter: 8, bore: 3.4, length: 15 },
          },
        ],
        null,
        2,
      ) + '\n',
    'part.ts': `import { Group } from 'three';
import type { PartDefinition, Preset } from '../../core/types';
import { n, num, ring } from '../../core/geometry';
import { parameters, defaults } from './configurator';
import presets from './presets.json';

const part: PartDefinition = {
  id: ${JSON.stringify(id)},
  name: ${JSON.stringify(name)},
  category: 'STRUCTURAL',
  subgroup: 'SPACERS & STANDOFFS',
  description: 'A configurable spacer with an open through bore.',
  icon: 'bolt',
  complexity: '3 parameters',
  keywords: ['spacer', 'standoff', 'custom'],
  parameters,
  defaults,
  presets: presets as Preset[],
  validate(p) {
    return n(p, 'outerDiameter') <= n(p, 'bore')
      ? ['Outside diameter must exceed the bore diameter.'] : [];
  },
  buildGeometry(p) {
    return new Group().add(ring(n(p, 'outerDiameter') / 2, n(p, 'bore') / 2, n(p, 'length')));
  },
  python(p) {
    const radius = n(p, 'outerDiameter') / 2, bore = n(p, 'bore') / 2, length = n(p, 'length');
    return 'outer = Part.makeCylinder(' + num(radius) + ', ' + num(length) + ', App.Vector(0, 0, ' + num(-length / 2) + '))\\n' +
      'inner = Part.makeCylinder(' + num(bore) + ', ' + num(length + 2) + ', App.Vector(0, 0, ' + num(-length / 2 - 1) + '))\\n' +
      'shape = outer.cut(inner)';
  },
  dimensions(p) { return [n(p, 'outerDiameter'), n(p, 'outerDiameter'), n(p, 'length')]; },
  notes: 'Nominal prototype dimensions; manufacturing tolerances are not included.',
};
export default part;
`,
    'README.md': `# ${name}\n\nThis folder is the complete editable part package.\n\n- \`part.ts\`: metadata, validation, Three.js preview, FreeCAD geometry and dimensions.\n- \`configurator.ts\`: parameter controls and default values.\n- \`presets.json\`: complete preset parameters and optional source evidence.\n- \`lib/\`: optional private geometry and domain helpers.\n- \`index.ts\`: package ID, API version and catalog order.\n\nKeep preview geometry, FreeCAD geometry and reported dimensions consistent. A FreeCAD generator must assign \`shape\`; use a compound plus \`component_labels\` for separately movable assembly components.\n\nKeep domain-specific helpers inside this folder. Imports outside it may only use the documented core SDK and Three.js or JSCAD. No registry or interface edits are needed when this folder changes.\n\nRun \`npm run parts:check\` and \`npm run typecheck\` from the project root. To hand this part to another developer, run \`npm run parts:export -- ${id} /tmp/${id}-handoff\`.\n`,
  };
}

export function workbenchFiles(id: string): Record<string, string> {
  return {
    'index.html':
      '<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>ProtoLab Part Workbench</title></head><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>\n',
    'tsconfig.json':
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            lib: ['ES2022', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            moduleResolution: 'Bundler',
            strict: true,
            skipLibCheck: true,
            esModuleInterop: true,
            resolveJsonModule: true,
            noEmit: true,
            types: ['vite/client'],
          },
          include: ['src'],
        },
        null,
        2,
      ) + '\n',
    'src/main.ts': `import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import module from './parts/${id}/index';
import { registerPartModules } from './core/part-modules';
import { generateScript, consoleCommand } from './core/freecad';
import { validateParameters } from './core/validation';
import type { Parameters } from './core/types';

const [part] = registerPartModules([module]);
let parameters: Parameters = { ...part.defaults };
let state = part.states?.[0]?.id ?? 'default';
let model: THREE.Group | undefined;
let script = '';
let presetSelect: HTMLSelectElement | undefined;
let stateSelect: HTMLSelectElement | undefined;
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = '<header><h1></h1><span>Isolated part workbench · millimetres</span></header><main><section id="preview"><div id="viewport"></div><button id="fit">Fit model</button><p id="status" role="status"></p></section><aside><h2>Configure</h2><div id="presets"></div><div id="states"></div><div id="parameters"></div><button id="reset">Reset defaults</button><h2>FreeCAD</h2><div class="actions"><button id="copy">Copy console command</button><button id="download">Download macro</button></div><textarea id="script" readonly aria-label="Generated FreeCAD script"></textarea></aside></main>';
app.querySelector('h1')!.textContent = part.name;
const viewport = document.querySelector<HTMLDivElement>('#viewport')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const textarea = document.querySelector<HTMLTextAreaElement>('#script')!;
const copy = document.querySelector<HTMLButtonElement>('#copy')!;
const download = document.querySelector<HTMLButtonElement>('#download')!;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e8edf2');
scene.add(new THREE.HemisphereLight(0xffffff, 0x445064, 3));
const light = new THREE.DirectionalLight(0xffffff, 4);
light.position.set(60, -70, 100); scene.add(light);
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100000);
camera.up.set(0, 0, 1);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
viewport.append(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
function resize() {
  const width = viewport.clientWidth, height = viewport.clientHeight;
  renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);
function fit() {
  if (!model) return;
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
  const distance = Math.max(radius * 3.6 / Math.min(camera.aspect, 1), 5);
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(1, -1.4, 0.9).normalize().multiplyScalar(distance));
  camera.near = Math.max(distance / 10000, 0.001); camera.far = distance * 100;
  camera.updateProjectionMatrix(); controls.update();
}
function release(group: THREE.Group) {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => material.dispose());
    }
  });
}
function rebuild(shouldFit = false) {
  const errors = validateParameters(part, parameters, state);
  if (!errors.length) {
    try {
      const next = part.buildGeometry(parameters, state);
      script = generateScript(part, parameters, state);
      if (model) { scene.remove(model); release(model); }
      model = next; scene.add(model);
      textarea.value = script;
      if (shouldFit) fit();
    } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  }
  copy.disabled = download.disabled = errors.length > 0;
  if (errors.length) { textarea.value = ''; script = ''; }
  status.textContent = errors.length ? errors.join(' ') : 'Preview and FreeCAD script are up to date.';
  status.classList.toggle('error', errors.length > 0);
}
function renderFields() {
  if (presetSelect) presetSelect.value = part.presets.find((preset) => Object.keys(part.defaults).every((key) => preset.parameters[key] === parameters[key]))?.id ?? '';
  if (stateSelect) stateSelect.value = state;
  const parent = document.querySelector<HTMLDivElement>('#parameters')!;
  parent.replaceChildren();
  let group = '';
  for (const field of part.parameters) {
    if (field.visibleWhen && !field.visibleWhen(parameters)) continue;
    if (field.group !== group) { const heading = document.createElement('h3'); heading.textContent = field.group; parent.append(heading); group = field.group; }
    const label = document.createElement('label');
    const title = document.createElement('span'); title.textContent = field.label + (field.unit ? ' (' + field.unit + ')' : ''); label.append(title);
    let input: HTMLInputElement | HTMLSelectElement;
    if (field.type === 'select') {
      input = document.createElement('select');
      for (const option of field.options ?? []) { const item = document.createElement('option'); item.value = option.value; item.textContent = option.label; input.append(item); }
      input.value = String(parameters[field.key]);
    } else {
      input = document.createElement('input'); input.type = field.type === 'boolean' ? 'checkbox' : 'number';
      if (field.type === 'boolean') input.checked = Boolean(parameters[field.key]);
      else { input.value = String(parameters[field.key]); if (field.min !== undefined) input.min = String(field.min); if (field.max !== undefined) input.max = String(field.max); input.step = String(field.step ?? 'any'); }
    }
    input.addEventListener('change', () => {
      const value = field.type === 'boolean' ? (input as HTMLInputElement).checked : field.type === 'number' ? Number(input.value) : input.value;
      parameters = { ...parameters, [field.key]: value };
      parameters = part.updateParameters?.(parameters, field.key) ?? parameters;
      renderFields(); rebuild();
    });
    label.append(input);
    if (field.description) { const help = document.createElement('small'); help.textContent = field.description; label.append(help); }
    parent.append(label);
  }
}
const presetHost = document.querySelector<HTMLDivElement>('#presets')!;
if (part.presets.length) {
  const label = document.createElement('label'); label.textContent = 'Preset';
  const select = document.createElement('select');
  presetSelect = select;
  select.append(new Option('Choose a preset', ''));
  for (const preset of part.presets) select.append(new Option(preset.name, preset.id));
  select.addEventListener('change', () => { const preset = part.presets.find((item) => item.id === select.value); if (preset) { parameters = { ...preset.parameters }; renderFields(); rebuild(true); } });
  label.append(select); presetHost.append(label);
}
if (part.states) {
  const label = document.createElement('label'); label.textContent = 'Model state';
  const select = document.createElement('select');
  stateSelect = select;
  for (const option of part.states) select.append(new Option(option.label, option.id));
  select.addEventListener('change', () => { state = select.value; renderFields(); rebuild(true); });
  label.append(select); document.querySelector('#states')!.append(label);
}
document.querySelector('#fit')!.addEventListener('click', fit);
document.querySelector('#reset')!.addEventListener('click', () => { parameters = { ...part.defaults }; state = part.states?.[0]?.id ?? 'default'; renderFields(); rebuild(true); });
copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(consoleCommand(script)); status.textContent = 'Console command copied.'; } catch { status.textContent = 'Clipboard unavailable. Select and copy the script below.'; } });
download.addEventListener('click', () => { const url = URL.createObjectURL(new Blob([script], { type: 'text/x-python' })); const link = document.createElement('a'); link.href = url; link.download = part.id + '.FCMacro'; link.click(); URL.revokeObjectURL(url); });
resize(); renderFields(); rebuild(true);
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
`,
    'src/style.css': `:root{font-family:system-ui,sans-serif;color:#1c2b3c;background:#f7f9fb}*{box-sizing:border-box}body{margin:0}header{padding:16px 24px;border-bottom:1px solid #ced7e0;display:flex;align-items:center;gap:24px}h1{font-size:20px;margin:0}header span{font-size:13px;color:#5c6d7c}main{display:grid;grid-template-columns:minmax(0,1fr) 350px;height:calc(100dvh - 61px)}#preview{position:relative;min-height:320px}#viewport{height:100%;width:100%}#viewport canvas{display:block}#fit{position:absolute;left:20px;top:20px}#status{position:absolute;bottom:12px;left:20px;right:20px;margin:0;padding:12px;border-radius:8px;background:#fffdf0;font-size:13px}#status.error{background:#ffe0dd;color:#8a211b}aside{padding:20px;overflow:auto;border-left:1px solid #ced7e0}h2{font-size:16px;margin:0 0 16px}h2:not(:first-child){margin-top:24px}h3{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6a7786;margin:24px 0 12px}label{display:flex;flex-direction:column;gap:6px;margin:12px 0;font-size:13px}input,select,textarea,button{font:inherit}input,select{width:100%;padding:9px;border:1px solid #b8c5d3;border-radius:5px;background:white}input[type=checkbox]{width:20px;height:20px}small{line-height:1.5;color:#657486}button{border:1px solid #b8c5d3;background:white;border-radius:6px;padding:9px 12px;cursor:pointer;font-size:12px}button:hover{background:#e7eff8}button:disabled{opacity:.5;cursor:default}.actions{display:flex;gap:8px}textarea{display:block;width:100%;height:220px;resize:vertical;margin-top:12px;border:1px solid #b8c5d3;padding:8px;font:11px/1.5 monospace}@media(max-width:760px){header{display:block}header span{display:block;margin-top:6px}main{display:flex;flex-direction:column;height:auto}#preview{height:50dvh;min-height:300px}aside{border-top:1px solid #ced7e0;border-left:0}}\n`,
  };
}
