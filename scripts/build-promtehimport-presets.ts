/** Adapt the complete cached supplier inventory into validated, offline model presets. */
import fs from 'node:fs';
import { Box3, Vector3 } from 'three';
import { parts } from '../src/parts';
import type { Parameters, PartDefinition, Preset } from '../src/core/types';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { cskKeyDimensions, zarnReferenceDimensions } from '../src/catalog/lib/bearing-reference';
import { lmkReference, lmkReferenceUrl } from '../src/catalog/lmk-reference';
import {
  sourceReconciliations,
  type SourceReconciliation,
} from '../src/catalog/promtehimport-reconciliations';

interface Product {
  url: string;
  sourceUrl?: string;
  name?: string;
  manufacturer?: string;
  description?: string;
  features?: { type?: string; closure?: string };
  tables?: string[][];
  categories: string[];
  error?: string;
  checkedAt?: string;
}
interface Inventory {
  status: string;
  snapshotDate: string;
  categories: Record<
    string,
    { url: string; pages: number; productUrls: string[]; failedPages: unknown[] }
  >;
  uniqueProductCount: number;
  products: Record<string, Product>;
}
interface Evidence {
  value: number;
  source: string;
}
interface Result {
  url: string;
  designation: string;
  categories: string[];
  status: string;
  partId?: string;
  reason?: string;
  parameters?: Parameters;
  verifiedParameters?: string[];
  evidence?: Record<string, Evidence | { value: string; source: string }>;
  reconciliation?: SourceReconciliation;
}
const input = process.argv[2] ?? 'data/promtehimport-inventory.json';
const inventory: Inventory = JSON.parse(fs.readFileSync(input, 'utf8'));
const modelMap = new Map(parts.map((part) => [part.id, part]));
const generated: Record<string, Preset[]> = {};
const results: Result[] = [];
const checkedGeometry = new Map<string, string | null>();

const number = (raw: string): number | undefined => {
  const value = raw.trim().replace(',', '.');
  if (/[≈~<>±]|min|max/i.test(value)) return undefined;
  const match = value.match(/^(-?\d+(?:\.\d+)?)\s*(?:mm|\u043c\u043c|°)?$/i);
  return match && Number.isFinite(+match[1]) ? +match[1] : undefined;
};
const key = (raw: string) => raw.replace(/[\s_{}]/g, '');
function fields(product: Product) {
  const values = new Map<string, Evidence[]>();
  const add = (label: string, value: number | undefined, source: string) => {
    if (value === undefined || value <= 0) return;
    const previous = values.get(label) ?? [];
    if (!previous.some((item) => Math.abs(item.value - value) < 1e-6))
      previous.push({ value, source });
    values.set(label, previous);
  };
  for (const cells of product.tables ?? []) {
    let symbol = key(cells[0]);
    const raw = cells.slice(1).find((cell) => number(cell) !== undefined);
    const metric =
      cells.slice(1).some((cell) => /^(?:mm|\u043c\u043c)$/i.test(cell)) ||
      !!raw?.match(/(?:mm|\u043c\u043c)/i);
    if (
      /^[a-zA-Zα][a-zA-Z\d,.]*$/.test(symbol) &&
      (metric ||
        cells.length === 2 ||
        cells
          .slice(1)
          .some((cell) =>
            /\u0434\u0456\u0430\u043c\u0435\u0442\u0440|\u0448\u0438\u0440\u0438\u043d\u0430|\u0432\u0438\u0441\u043e\u0442\u0430|\u0434\u043e\u0432\u0436\u0438\u043d\u0430|diameter|width/i.test(
              cell,
            ),
          ))
    ) {
      if (cells.slice(1).some((cell) => /\bkN\b|\bN\b|r\/min|kg|1\/min/i.test(cell))) continue;
      add(symbol, raw ? number(raw) : undefined, cells.join(' | '));
    }
    const normalized = cells[0].toLowerCase();
    const captionSymbol = cells[0].match(
      /(?:^|\s)([A-Za-z][A-Za-z\d_{}]*)\s*,?\s*(?:mm|\u043c\u043c)\.?$/i,
    )?.[1];
    if (captionSymbol) add(key(captionSymbol), raw ? number(raw) : undefined, cells.join(' | '));
    const leadingSymbol = cells[0].match(/^([A-Za-z][A-Za-z\d_{}]*)\s*[—–-]\s*/)?.[1];
    const trailingSymbol = cells[0].match(
      /(?:mm|\u043c\u043c)\s*\)?\s*([A-Za-z][A-Za-z\d_{}]*)$/i,
    )?.[1];
    if (!cells.slice(1).some((cell) => /\bkN\b|\bN\b|r\/min|kg|1\/min/i.test(cell)))
      for (const symbol of [leadingSymbol, trailingSymbol])
        if (symbol) add(key(symbol), raw ? number(raw) : undefined, cells.join(' | '));
    if (
      /\u0448\u0438\u0440\u0438\u043d\u0430 \u0437\u043e\u0432\u043d\u0456\u0448\u043d\u044c\u043e\u0433\u043e \u043a\u0456\u043b\u044c\u0446\u044f/.test(
        normalized,
      )
    )
      add('C', raw ? number(raw) : undefined, cells.join(' | '));
    if (
      /^(?:\u0434\u0456\u0430\u043c\u0435\u0442\u0440 \u043e\u0442\u0432\u043e\u0440\u0443)$/.test(
        normalized,
      )
    )
      add('d', raw ? number(raw) : undefined, cells.join(' | '));
    if (
      /^\u0437\u0430\u0433\u0430\u043b\u044c\u043d\u0430 \u0448\u0438\u0440\u0438\u043d\u0430$/.test(
        normalized,
      )
    )
      add('T', raw ? number(raw) : undefined, cells.join(' | '));
    if (
      /^\u0448\u0438\u0440\u0438\u043d\u0430,? \u0432\u043d\u0443\u0442\u0440\u0456\u0448\u043d\u0454 \u043a\u0456\u043b\u044c\u0446\u0435$/.test(
        normalized,
      )
    )
      add('B', raw ? number(raw) : undefined, cells.join(' | '));
    if (
      /^\u0448\u0438\u0440\u0438\u043d\u0430,? \u0437\u043e\u0432\u043d\u0456\u0448\u043d\u0454 \u043a\u0456\u043b\u044c\u0446\u0435$/.test(
        normalized,
      )
    )
      add('C', raw ? number(raw) : undefined, cells.join(' | '));
    if (
      /\u0437\u0430\u0433\u0430\u043b\u044c\u043d\u0430 \u0432\u0438\u0441\u043e\u0442\u0430/.test(
        normalized,
      )
    )
      add('@totalHeight', raw ? number(raw) : undefined, cells.join(' | '));
    if (
      /\u0432\u0438\u0441\u043e\u0442\u0430 \u043e\u0441\u0456 \u0432\u0430\u043b\u0430/.test(
        normalized,
      )
    )
      add('@centerHeight', raw ? number(raw) : undefined, cells.join(' | '));
    if (/\u0434\u043e\u0432\u0436\u0438\u043d\u0430 l/.test(normalized))
      add('L', raw ? number(raw) : undefined, cells.join(' | '));
    if (
      /\u0448\u0438\u0440\u0438\u043d\u0430 \u043f\u0456\u0434\u043e\u0448\u0432\u0438/.test(
        normalized,
      )
    )
      add('A', raw ? number(raw) : undefined, cells.join(' | '));
    if (
      /\u0446\u0435\u043d\u0442\u0440\u0430\u043c\u0438 \u043a\u0440\u0456\u043f\u0438\u043b\u044c\u043d\u0438\u0445 \u043e\u0442\u0432\u043e\u0440\u0456\u0432/.test(
        normalized,
      )
    )
      add('J', raw ? number(raw) : undefined, cells.join(' | '));
    if (
      /\u0432\u043d\u0443\u0442\u0440\u0456\u0448\u043d\u0456\u0439 \u0434\u0456\u0430\u043c\u0435\u0442\u0440|\u0432\u043d\u0443\u0442\u0440\. \u0434\u0456\u0430\u043c\u0435\u0442\u0440|\u0432\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0439 \u0434\u0438\u0430\u043c\u0435\u0442\u0440/.test(
        normalized,
      ) &&
      !/[a-z]\d/.test(normalized)
    )
      symbol = '@bore';
    else if (
      /\u0437\u043e\u0432\u043d\u0456\u0448\u043d\u0456\u0439 \u0434\u0456\u0430\u043c\u0435\u0442\u0440|\u043d\u0430\u0440\u0443\u0436\u043d\u044b\u0439 \u0434\u0438\u0430\u043c\u0435\u0442\u0440/.test(
        normalized,
      ) &&
      !/[a-z]\d/.test(normalized)
    )
      symbol = '@outer';
    else if (
      /^(\u0432\u0438\u0441\u043e\u0442\u0430|\u0432\u044b\u0441\u043e\u0442\u0430|\u0448\u0438\u0440\u0438\u043d\u0430)$|^\u0448\u0438\u0440\u0438\u043d\u0430 b,/.test(
        normalized,
      )
    )
      symbol = '@width';
    else continue;
    add(symbol, raw ? number(raw) : undefined, cells.join(' | '));
  }
  const triplet = product.name?.match(
    /\(\s*(\d+(?:[.,]\d+)?)\s*[x\u0445×*]\s*(\d+(?:[.,]\d+)?)\s*[x\u0445×*]\s*(\d+(?:[.,]\d+)?)/i,
  );
  if (triplet)
    ['@bore', '@outer', '@width'].forEach((name, index) =>
      add(name, +triplet[index + 1].replace(',', '.'), 'Product title dimensions'),
    );
  return values;
}

function designation(product: Product) {
  let title = (product.name ?? '').replace(/(?<=\d)[×\u0445](?=\d)/g, 'x');
  const cyrillic: Record<number, string> = {
    0x0410: 'A',
    0x0411: 'B',
    0x0412: 'V',
    0x0413: 'G',
    0x0414: 'D',
    0x0415: 'E',
    0x0401: 'E',
    0x0416: 'Zh',
    0x0417: 'Z',
    0x0418: 'I',
    0x0419: 'Y',
    0x041a: 'K',
    0x041b: 'L',
    0x041c: 'M',
    0x041d: 'N',
    0x041e: 'O',
    0x041f: 'P',
    0x0420: 'R',
    0x0421: 'S',
    0x0422: 'T',
    0x0423: 'U',
    0x0424: 'F',
    0x0425: 'X',
    0x0426: 'Ts',
    0x0427: 'Ch',
    0x0428: 'Sh',
    0x0429: 'Shch',
    0x042a: '',
    0x042b: 'Y',
    0x042c: '',
    0x042d: 'E',
    0x042e: 'Yu',
    0x042f: 'Ya',
    0x0406: 'I',
    0x0407: 'Yi',
    0x0404: 'Ye',
  };
  title = title.replace(/\S+/g, (token) =>
    /\d/.test(token) || /^[\u0410-\u042f\u0406\u0407\u0404]{1,2}$/.test(token)
      ? token.replace(
          /[\u0410-\u042f\u0406\u0407\u0404]/g,
          (character) => cyrillic[character.charCodeAt(0)] ?? character,
        )
      : token,
  );
  // Preserve the complete supplier designation, including prefixes, suffixes and aliases.
  // Manufacturer and translated prose are separate from the technical identifier.
  const brands = [
    'FO Bearings',
    'PFI Bearings',
    'SKF',
    'FAG',
    'INA',
    'SNR',
    'NTN',
    'NSK',
    'KOYO',
    'NACHI',
    'KYK',
    'CX',
    'ZVL',
    'ZKL',
    'CRAFT',
    'TIMKEN',
    'EZO',
    'KINEX',
    'MTM',
    'FERSA',
    'FBJ',
    'ZSG',
    'Z&S',
    'PFI',
    'CT',
    'FO',
    'HARP',
    'GPZ',
    'GOST',
    'USA',
    'Japan',
    'Poland',
    'Czech',
    'Lithuania',
    'Serbia',
    'Slovakia',
  ];
  for (const brand of [product.manufacturer ?? '', ...brands]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)) {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    title = title.replace(new RegExp('(?:^|\\s)' + escaped + '(?=\\s|$)', 'gi'), ' ');
  }
  title = title
    .replace(/[^A-Za-z\d.,/()x*+\s-]/g, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return title.replace(/^[\s/.,-]+|[\s/.,-]+$/g, '');
}

function classify(product: Product, name: string, alias = false): string | undefined {
  const code = name.split('(')[0].replace(/[\s-]/g, '').toUpperCase();
  const numericCode = name.split('(')[0].trim().match(/^\d+/)?.[0] ?? '';
  const title = (product.name ?? '').toLowerCase();
  if (/\+\s*H\s*\d/i.test(name) || /\u0437\s+\u0432\u0442\u0443\u043b\u043a/.test(title))
    return undefined;
  if (product.categories.includes('c34') && /(?:\d|Z|RS)N(?:R)?(?=C[234]|$|[/])/.test(code))
    return undefined;
  if (/^AS\d{4}(?:\/|$)/.test(code) && product.categories.includes('c44')) return 'washer';
  if (/\b\d+-?TT/i.test(name) && !product.features?.closure) return undefined;
  if (/^(NF|NCL)\d/i.test(code)) return undefined;
  if (
    /N2-SC|KRR|KYY|KYP|KRRA|KRP|BBAR|RY|NPP|JD|^203KR|205GP|^1726|^15802/i.test(code) ||
    /\u0448\u0435\u0441\u0442\u0438\u0433\u0440\u0430\u043d|\u043a\u043e\u0436\u0443\u0441\u0456/.test(
      title,
    )
  )
    return undefined;
  if (
    /\u043a\u043e\u0440\u043f\u0443\u0441(?!\u043d\u0438\u0439)|\u043a\u0456\u043b\u044c\u0446\u0435|\u0448\u0430\u0439\u0431\u0430|\u0432\u0430\u043b |\u043d\u0430\u043f\u0440\u0430\u0432\u043b\u044f\u044e\u0447|\u043a\u0430\u0440\u0435\u0442\u043a\u0430|\u0433\u0430\u0439\u043a\u0430|\u0441\u0435\u043f\u0430\u0440\u0430\u0442\u043e\u0440/.test(
      title,
    ) &&
    !/\u043f\u0456\u0434\u0448\u0438\u043f\u043d\u0438\u043a \u043a\u043e\u0440\u043f\u0443\u0441\u043d\u0438\u0439/.test(
      title,
    )
  )
    return undefined;
  if (/^UCFL\d/.test(code)) return 'flange-2-bolt-bearing';
  if (/^UCF\d/.test(code)) return 'flange-4-bolt-bearing';
  if (/^UCP\d/.test(code)) return 'pillow-block-bearing';
  if (/^UC\d/.test(code)) return 'insert-bearing';
  if (/^SA2\d{2}/.test(code)) return undefined;
  if (/^(SA|SAL|POS)\d/.test(code)) return 'rod-end-bearing';
  if (/^(SI|SIL|PHS)\d/.test(code))
    return modelMap.get('rod-end-bearing')?.parameters.some((field) => field.key === 'shankType')
      ? 'rod-end-bearing'
      : undefined;
  if (/^GEH?\d/.test(code)) return 'plain-bearing';
  if (product.categories.includes('c39')) {
    const dimensions = fields(product);
    if (
      ['T', 'B', 'C'].every((key) => dimensions.has(key)) &&
      (dimensions.has('d') || dimensions.has('@bore')) &&
      (dimensions.has('D') || dimensions.has('@outer'))
    )
      return 'tapered-roller-bearing';
  }
  if (/^HF\d/.test(code)) return 'one-way-clutch';
  if (/^CSK\d/.test(code)) return 'csk-clutch';
  if (/^H(?:MK|K)\d+(?:L|RS)(?:\/|$)/.test(code)) return undefined;
  if (/^HK\d/.test(code)) return 'needle-bearing';
  if (/^HMK\d+(?:(?:T2)?LL|T2)?(?:\/3AS)?$/.test(code)) return 'needle-bearing';
  if (/^NKIB\d/.test(code)) return 'combined-bearing';
  if (/\bZARN\s*\d/i.test(name)) return 'zarn-bearing';
  if (/^(NU|NJ|NF|NUP|NCL|N)\d{3,}/.test(code)) return 'roller-bearing';
  if (/^H\d/.test(code)) return 'adapter-sleeve';
  if (/^LMK[L]?\d/.test(code)) return 'flanged-linear-bearing';
  if (/^LMF[L]?\d/.test(code)) return 'round-flange-linear-bearing';
  if (/^LME?\d{1,3}(?:UU|$)/.test(code) && !/(OP|AJ|FL|UUOP)/.test(code) && !/^LM\d+LUU/.test(code))
    return 'linear-bearing';
  if (/^(811|812)\d{2}/.test(code)) return 'thrust-roller-bearing';
  if (/^29[234]\d{2}$/.test(numericCode)) return 'spherical-thrust-bearing';
  if (/^51[1234]\d{2}$/.test(numericCode)) return 'thrust-bearing';
  if (/^2[1234][0123]\d{2}$/.test(numericCode)) return 'spherical-roller-bearing';
  if (/^3[0123]\d{3}$/.test(numericCode)) return 'tapered-roller-bearing';
  if (/^(12|13|22|23)\d{2}$/.test(numericCode)) return 'self-aligning-bearing';
  if (/^4[23]\d{2}$/.test(numericCode)) return 'double-row-bearing';
  if (
    /^(?:30|32|33|52|53)\d{2}$/.test(numericCode) &&
    product.categories.some((category) => ['c36', 'c51'].includes(category)) &&
    !/^(?:30|32|33|52|53)\d{2}D(?:\D|$)|NR|UPG/i.test(code)
  )
    return 'double-row-angular-contact-bearing';
  if (/^(?:7[0123]\d{2}|71[89]\d{2})$/.test(numericCode) && !product.categories.includes('c39'))
    return 'angular-contact-bearing';
  if (/^(6\d{2,4}|16\d{3}|MR\d)/.test(code) && product.categories.includes('c34'))
    return 'ball-bearing';
  if (
    product.categories.includes('c34') &&
    /^\d{3,7}(?:(?:2RS\d?|ZZ|2Z|C3|[A-Z]))*$/.test(code) &&
    product.features?.type === 'single-row ball'
  )
    return 'ball-bearing';
  if (
    product.categories.includes('c54') &&
    /\u0441\u0430\u043b\u044c\u043d\u0438\u043a|\u043c\u0430\u043d\u0436\u0435\u0442\u0430/.test(
      title,
    )
  )
    return 'radial-oil-seal';
  if (!alias)
    for (const alternative of name.matchAll(/\(([^)]+)\)/g)) {
      if (/\d\s*[x*]\s*\d/i.test(alternative[1])) continue;
      const id = classify(product, alternative[1], true);
      if (id) return id;
    }
  return undefined;
}

function unsupportedReason(product: Product, name: string) {
  const code = name.replace(/[\s-]/g, '').toUpperCase();
  if (/\+H\d/.test(code))
    return 'Bearing with an adapter sleeve requires a separate assembly model';
  if (
    product.categories.includes('c34') &&
    /(?:\d|Z|RS)N(?:R)?(?=C[234]|$|[/])/.test(
      name.split('(')[0].replace(/[\s-]/g, '').toUpperCase(),
    )
  )
    return 'Outer snap-ring groove or retaining-ring assembly requires a dedicated bearing variant';
  if (/^(?:SA2\d{2}|YET|YEL|YAR|UEL)/.test(code))
    return 'Insert bearing has an eccentric or specialized locking construction';
  if (product.categories.includes('c40'))
    return 'Insert bearing locking collar, bore or outer profile needs a distinct model';
  if (product.categories.includes('c37'))
    return 'Housing style differs from the supported pillow, oval two-bolt or square four-bolt units';
  if (product.categories.includes('c36') && /^(?:PHU|PW|DAC|PC|PCR|VKBA|BAHB|F\d)/.test(code))
    return 'Automotive hub or cartridge construction requires a dedicated bearing model';
  if (product.categories.includes('c47') && /^(?:SCS?|SBR|TBR|SHF|SK)\d/.test(code))
    return 'Linear carriage or shaft support is not a plain cylindrical linear bushing';
  if (/^LM[EFK]?.*(?:OP|AJ)/.test(code))
    return 'Open or adjustable linear bushing requires its own body construction';
  if (/^(?:LMF|KH|KB)/.test(code) && product.categories.includes('c47'))
    return 'This thin-wall or specialized linear-bushing construction is not represented';
  if (
    product.categories.some((category) => ['c43', 'c44', 'c48'].includes(category)) &&
    /^(?:NK|NA|NKI|RNA|K\d|AXK|AXW|BK|HMK)/.test(code)
  )
    return 'Needle-bearing subtype does not match the available drawn-cup construction';
  if (/^(?:NF|NCL|NN|NNU)/.test(code))
    return 'Cylindrical roller rib or row construction is not represented by NU/N/NJ/NUP';
  if (/^(?:20[23]\d{2}|C\d)/.test(code) && product.categories.includes('c42'))
    return 'Single-row barrel or toroidal construction differs from a double-row spherical roller bearing';
  if (/N2SC|KRR|KYY|KYP|KRRA|KRP|BBAR|NPP|^203KR|205GP|^1726|^15802/.test(code))
    return 'Special agricultural or track-roller profile requires a dedicated geometry model';
  if (/\b(?:NR|UPG)\b/.test(name))
    return 'Snap-ring or special ring construction is not represented';
  if (product.categories.includes('c39'))
    return 'Tapered-bearing designation lacks sufficient evidence to establish the exact ring construction';
  return 'No exact geometry family for the source designation';
}

function boreConstruction(partId: string, designation: string) {
  const pattern =
    partId === 'self-aligning-bearing'
      ? /\b(?:12|13|22|23)\d{2}(?!\d)([^()]*)/i
      : partId === 'spherical-roller-bearing'
        ? /\b2[1234][0123]\d{2}(?!\d)([^()]*)/i
        : undefined;
  const suffix = pattern ? designation.match(pattern)?.[1] : undefined;
  if (suffix === undefined) return undefined;
  const taper = suffix.match(
    /(?:^|[^A-Za-z]|(?:EA|CC|CA|MB|MA|E|M))K(30)?(?=$|[^A-Za-z]|TN|TV|C\d|M|D1|J)/i,
  );
  if (taper) return taper[1] ? 'taper30' : 'taper12';
  return /K/i.test(suffix) ? undefined : 'straight';
}

function modelParameters(
  part: PartDefinition,
  product: Product,
  code: string,
  values: Map<string, Evidence[]>,
) {
  const parameters = { ...part.defaults };
  if ('boreType' in parameters) parameters.boreType = boreConstruction(part.id, code) ?? 'straight';
  const reconciliation = sourceReconciliations[product.url.match(/-o(\d+)\/?$/)?.[1] ?? ''];
  if (part.id === 'roller-bearing' && 'ribs' in parameters)
    parameters.ribs =
      code
        .trim()
        .match(/(?:^|[\s(])(NUP|NU|NJ|NF|NCL|N)(?=\s*\d)/i)?.[1]
        .toUpperCase() ?? 'NU';
  const evidence: Record<string, Evidence> = {};
  const get = (target: string, symbols: string[], required = true) => {
    const found = symbols.flatMap((symbol) => values.get(symbol) ?? []);
    const unique = [...new Set(found.map((item) => item.value))];
    const expected = reconciliation?.parameters[target];
    if (expected !== undefined && found.length && !found.some((item) => item.value === expected))
      throw new Error(
        `Conflicting ${target}: supplier values do not contain manufacturer reference ${expected}`,
      );
    let selected = found[0];
    if (unique.length > 1) {
      const confirmed = found.find((item) => item.value === reconciliation?.parameters[target]);
      // Inch conversions are often rounded to two decimals in the store summary.
      // Accept only exact decimal-rounding equivalents, never a relative tolerance.
      const places = (item: Evidence) =>
        Math.max(
          String(item.value).split('.')[1]?.length ?? 0,
          ...item.source
            .split('|')
            .slice(1)
            .filter((cell) => number(cell) === item.value)
            .map((cell) => cell.match(/[.,](\d+)/)?.[1].length ?? 0),
        );
      const precise = [...found].sort((a, b) => places(b) - places(a))[0];
      if (confirmed) selected = confirmed;
      else if (
        found.every(
          (item) =>
            item.value === precise.value ||
            (places(item) >= 2 && +precise.value.toFixed(places(item)) === item.value),
        )
      )
        selected = precise;
      else throw new Error(`Conflicting ${target}: ${unique.join(' / ')}`);
    }
    if (!found.length) {
      if (required) throw new Error(`Missing ${target}: ${symbols.join(', ')}`);
      return undefined;
    }
    parameters[target] = selected.value;
    evidence[target] = selected;
    return selected.value;
  };
  if (part.id === 'washer') {
    get('bore', ['Dp1', 'd', '@bore']);
    get('outerDiameter', ['Dp', 'D', '@outer']);
    get('thickness', ['S', 's', '@width']);
  } else if (part.id === 'zarn-bearing') {
    get('bore', ['d', '@bore']);
    get('outer', ['D', '@outer']);
    get('width', ['H', '@width']);
    const reference = zarnReferenceDimensions(+parameters.bore);
    if (reference) Object.assign(parameters, reference);
    get('shoulderSpan', ['H1'], !reference);
    get('outerWidth', ['C'], !reference);
    get('washerDiameter', ['D1'], !reference);
    get('washerThickness', ['B'], !reference);
    if (+parameters.washerDiameter <= +parameters.bore)
      throw new Error(
        'Conflicting internal dimensions: supplier washer diameter does not clear the bore',
      );
  } else if (['flanged-linear-bearing', 'round-flange-linear-bearing'].includes(part.id)) {
    get('bore', ['d', '@bore']);
    get('outer', ['D', '@outer']);
    get('width', ['L', '@width']);
    const reference = lmkReference[+parameters.bore];
    if (!reference || reference.outer !== parameters.outer)
      throw new Error('Missing matching LMK flange reference for supplier bore/outside diameter');
    for (const [key, value] of Object.entries(reference)) {
      if (key === 'bore' || key === 'outer') continue;
      if (key === 'flangeWidth' && part.id === 'round-flange-linear-bearing') continue;
      parameters[key] = value;
      evidence[key] = {
        value: +value,
        source: `HepcoMotion LMF/LMFL/LMK/LMKL dimension table: ${lmkReferenceUrl}`,
      };
    }
  } else if (part.id === 'csk-clutch') {
    get('bore', ['d', '@bore']);
    get('outer', ['D', '@outer']);
    get('width', ['B', '@width']);
    Object.assign(parameters, cskKeyDimensions(+parameters.bore));
    const suffix = code.match(/^CSK\s*\d+\s*(PP|P)?/i)?.[1]?.toUpperCase();
    parameters.keyways = suffix ?? 'none';
    const keywayDescription =
      (product.tables ?? [])
        .find((row) =>
          /\u0448\u043f\u043e\u043d\u043a\u043e\u0432\u0438\u0439 \u043f\u0430\u0437/i.test(row[0]),
        )
        ?.slice(1)
        .join(' ') ?? '';
    if (
      suffix === 'PP' &&
      /\u0432\u043d\u0443\u0442\u0440\u0456\u0448\u043d\u044c\u043e\u043c\u0443/.test(
        keywayDescription,
      ) &&
      !/\u0437\u043e\u0432\u043d\u0456\u0448\u043d\u044c\u043e\u043c\u0443/.test(keywayDescription)
    )
      throw new Error(
        'Conflicting keyway construction: PP designation but supplier describes an inner-only keyway',
      );
    if (suffix) {
      get('innerKeyWidth', values.has('a') ? ['a'] : ['b'], false);
      get('innerKeyDepth', ['t'], false);
      if (suffix === 'PP') {
        get('outerKeyWidth', values.has('a') ? ['b'] : ['b1'], false);
        get('outerKeyDepth', ['t1'], false);
      }
    }
  } else if (part.id === 'adapter-sleeve') {
    // Sleeve drawings use d/B for the bearing seat/locknut; store captions often reuse
    // those letters for the shaft bore/whole sleeve. Only explicit drawing rows resolve them.
    for (const symbol of ['d', 'B'])
      values.set(
        symbol,
        (values.get(symbol) ?? []).filter((item) => key(item.source.split('|')[0]) === symbol),
      );
    get('bore', ['d1', '@bore']);
    get('outer', ['d3', '@outer']);
    get('width', ['B1', '@width']);
    get('seatDiameter', ['d']);
    get('nutThickness', ['B']);
  } else if (part.id === 'rod-end-bearing') {
    get('bore', ['d', '@bore']);
    get('outer', ['d2']);
    // A store's generic height may describe the eye body C1, not the inner member B.
    values.set(
      '@width',
      (values.get('@width') ?? []).filter(
        (item) =>
          !/^\u0412\u0438\u0441\u043e\u0442\u0430\s*\|/.test(item.source) ||
          !(values.get('C1') ?? []).some((head) => head.value === item.value),
      ),
    );
    get('width', ['B', '@width']);
    get('headWidth', ['C1']);
    const threadRow = (product.tables ?? []).find(
      (row) =>
        /^(d1|d3|G)$/.test(key(row[0])) && row.slice(1).some((value) => /^M\s*\d/.test(value)),
    );
    const thread = threadRow
      ?.slice(1)
      .join(' ')
      .match(/M\s*(\d+(?:[.,]\d+)?)/i);
    if (!thread) throw new Error('Missing nominal shank thread d1');
    parameters.stemDiameter = +thread[1].replace(',', '.');
    evidence.stemDiameter = { value: +parameters.stemDiameter, source: threadRow!.join(' | ') };
    const h = values.get('h')?.[0];
    if (!h) throw new Error('Missing shank center height h');
    parameters.stemLength = h.value - +parameters.outer / 2;
    evidence.stemLength = {
      value: +parameters.stemLength,
      source: 'Derived h − d2/2 from ' + h.source,
    };
    if ('shankType' in parameters)
      parameters.shankType = /^(SI|SIL|PHS)/i.test(code) ? 'female' : 'male';
  } else if (part.id === 'pillow-block-bearing' || part.id.startsWith('flange-')) {
    get('bore', ['d', '@bore']);
    if (part.id === 'pillow-block-bearing') {
      get('baseWidth', ['L']);
      get('baseDepth', ['A']);
      get('totalHeight', ['@totalHeight', 'H2']);
      get('centerHeight', values.has('@centerHeight') ? ['@centerHeight'] : ['H']);
      get('mountPitch', ['J']);
      get('hole', ['N'], false);
      get('slotLength', ['N1'], false);
      get('baseThickness', values.has('@centerHeight') ? ['@baseThickness'] : ['H1'], false);
      get('insertWidth', ['B']);
      parameters.width = +parameters.baseDepth * 0.62;
      const maximumInsertRadius =
        Math.min(
          +parameters.centerHeight - +parameters.baseThickness,
          +parameters.totalHeight - +parameters.centerHeight,
        ) - 1.2;
      parameters.outer = Math.min(
        2 * (+parameters.totalHeight - +parameters.centerHeight),
        +parameters.bore + (2 * (maximumInsertRadius - +parameters.bore / 2)) / 0.6,
      );
    } else {
      const oval = part.id === 'flange-2-bolt-bearing';
      get('flangeWidth', ['L']);
      get('flangeLength', [oval ? 'H' : 'L']);
      get('width', ['T', 'U']);
      get('housingDepth', ['A']);
      get('mountPitch', ['J']);
      get('hole', ['N']);
      get('insertWidth', ['B']);
      parameters.insertOuter = Math.max(
        +parameters.bore * 1.8,
        +parameters.flangeWidth * (oval ? 0.78 : 0.55),
      );
      parameters.outerWidth = +parameters.insertWidth * 0.55;
      parameters.innerShoulder = Math.max(+parameters.bore * 1.35, +parameters.insertOuter * 0.55);
      // Unsourced ring internals fit the overlap of the source housing and insert intervals.
      const overlapStart = Math.max(0, +parameters.width - +parameters.insertWidth);
      const overlapEnd = Math.min(+parameters.housingDepth, +parameters.width);
      parameters.seatCenter = (overlapStart + overlapEnd) / 2;
      get('flangeThickness', ['A1'], false);
      get('seatCenter', ['A2'], false);
    }
  } else {
    get('bore', part.id === 'needle-bearing' ? ['Fw', '@bore'] : ['d', '@bore']);
    get('outer', ['D', '@outer']);
    get(
      'width',
      part.id === 'spherical-thrust-bearing'
        ? ['T', 'H']
        : part.id === 'tapered-roller-bearing'
          ? ['T']
          : part.id === 'needle-bearing'
            ? ['C', '@width']
            : part.id === 'thrust-bearing' || part.id === 'thrust-roller-bearing'
              ? ['T', '@width']
              : ['B', '@width'],
    );
    if (['insert-bearing', 'combined-bearing', 'plain-bearing'].includes(part.id))
      get('outerWidth', ['C']);
    if (part.id === 'insert-bearing') {
      parameters.hubDiameter = +parameters.bore + (+parameters.outer - +parameters.bore) * 0.28;
      get('hubDiameter', ['d1'], false);
    }
    if (part.id === 'combined-bearing') get('raceDiameter', ['F']);
    if (part.id === 'thrust-roller-bearing') {
      parameters.washer = +parameters.width * 0.29;
      get('washer', ['s'], false);
    }
  }
  const gap = (+parameters.outer - +parameters.bore) / 2;
  const bearingCount = Math.max(
    4,
    Math.min(
      12,
      Math.floor(
        (Math.PI * (+parameters.outer + +parameters.bore)) / 2 / Math.max(gap * 0.45, 0.01),
      ),
    ),
  );
  for (const name of ['balls', 'rollers', 'elements'])
    if (name in parameters) parameters[name] = bearingCount;
  if (part.id === 'thrust-roller-bearing') parameters.rollers = 6;
  if ('seals' in parameters)
    parameters.seals = /2RS|DDU|LLU|LLB|2RSH|2RSL|2RST/i.test(code)
      ? 'rubber'
      : /ZZ|2Z/i.test(code)
        ? 'metal'
        : /RS|DU/i.test(code)
          ? 'rubber-one'
          : /Z(?:R)?(?=C\d|[\s/(]|$)/i.test(code)
            ? 'metal-one'
            : (product.features?.closure ?? 'open');
  if ('closure' in parameters)
    parameters.closure = /2RS|DDU|LLU|LLB|2RSH|2RSL|2RST/i.test(code)
      ? 'rubber'
      : /ZZ|2Z/i.test(code)
        ? 'metal'
        : /RS|DU/i.test(code)
          ? 'rubber-one'
          : /Z(?:R)?(?=C\d|[\s/(]|$)/i.test(code)
            ? 'metal-one'
            : (product.features?.closure ?? 'open');
  if (part.id === 'needle-bearing' && 'seals' in parameters)
    parameters.seals = /^H(?:MK|K)[\s-]*\d+[\s-]*(?:T2)?(?:LL|2RS)(?:[\s/-]|$)/i.test(code)
      ? 'rubber'
      : 'open';
  if (part.id === 'self-aligning-bearing' && 'seals' in parameters)
    parameters.seals =
      /2RS|DDU|LLU/i.test(code) || product.features?.closure === 'rubber' ? 'rubber' : 'open';
  // No source-verified scalar is changed to make a preset pass geometric validation.
  return { parameters, evidence };
}

for (const product of Object.values(inventory.products)) {
  const name = designation(product);
  const result: Result = {
    url: product.url,
    designation: name,
    categories: product.categories,
    status: 'pending',
    ...(sourceReconciliations[product.url.match(/-o(\d+)\/?$/)?.[1] ?? '']
      ? { reconciliation: sourceReconciliations[product.url.match(/-o(\d+)\/?$/)?.[1] ?? ''] }
      : {}),
  };
  if (product.error) {
    results.push({ ...result, status: 'fetch-failed', reason: product.error });
    continue;
  }
  const id = classify(product, name);
  result.partId = id;
  if (!id) {
    results.push({
      ...result,
      status: 'unsupported-subtype',
      reason: unsupportedReason(product, name),
    });
    continue;
  }
  const part = modelMap.get(id);
  if (!part) {
    results.push({ ...result, status: 'missing-model', reason: `Model ${id} is not registered` });
    continue;
  }
  try {
    const { parameters, evidence } = modelParameters(part, product, name, fields(product));
    result.parameters = parameters;
    result.verifiedParameters = Object.keys(evidence);
    result.evidence = evidence;
    if ('boreType' in parameters && boreConstruction(id, name)) {
      result.verifiedParameters.push('boreType');
      result.evidence = {
        ...result.evidence,
        boreType: {
          value: String(parameters.boreType),
          source: `Bore construction from modern supplier designation ${name}`,
        },
      };
    }
    if (['needle-bearing', 'self-aligning-bearing'].includes(id) && parameters.seals === 'rubber') {
      result.verifiedParameters.push('seals');
      result.evidence = {
        ...result.evidence,
        seals: { value: 'rubber', source: `Two sealing lips from supplier designation ${name}` },
      };
    }
    if (id === 'roller-bearing' && typeof parameters.ribs === 'string') {
      result.verifiedParameters.push('ribs');
      result.evidence = {
        ...evidence,
        ribs: {
          value: parameters.ribs,
          source: `Construction specified by supplier designation ${name}`,
        },
      };
    }
    if (id === 'csk-clutch' && typeof parameters.keyways === 'string') {
      result.verifiedParameters.push('keyways');
      result.evidence = {
        ...result.evidence,
        keyways: {
          value: parameters.keyways,
          source: `Keyway construction from supplier designation ${name}`,
        },
      };
    }
    let errors = (part.states?.map((state) => state.id) ?? ['default']).flatMap((state) =>
      validateParameters(part, parameters, state),
    );
    const countKey = ['balls', 'rollers', 'elements'].find((key) => key in parameters);
    while (
      countKey &&
      +parameters[countKey] > 4 &&
      errors.some((error) =>
        /Too many (rolling elements|balls)|Reduce (?:the )?(?:element|roller|ball) count|Reduce the balls per row/i.test(
          error,
        ),
      )
    ) {
      parameters[countKey] = +parameters[countKey] - 1;
      errors = (part.states?.map((state) => state.id) ?? ['default']).flatMap((state) =>
        validateParameters(part, parameters, state),
      );
    }
    if (errors.length) {
      results.push({ ...result, status: 'model-rejected', reason: [...new Set(errors)].join(' ') });
      continue;
    }
    const geometryKey = JSON.stringify([id, parameters]);
    if (!checkedGeometry.has(geometryKey)) {
      let failure: string | null = null;
      for (const state of part.states?.map((state) => state.id) ?? ['default']) {
        const model = part.buildGeometry(parameters, state);
        try {
          const bounds = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray();
          if (
            part
              .dimensions(parameters, state)
              .some(
                (length, axis) =>
                  !Number.isFinite(bounds[axis]) ||
                  Math.abs(bounds[axis] - length) > Math.max(0.02, length * 0.002),
              )
          )
            failure = 'Preview envelope differs from configured dimensions';
        } finally {
          disposeModel(model);
        }
      }
      checkedGeometry.set(geometryKey, failure);
    }
    const failure = checkedGeometry.get(geometryKey);
    if (failure) {
      results.push({ ...result, status: 'model-rejected', reason: failure });
      continue;
    }
    const rawManufacturer = product.manufacturer ?? '';
    const cleanedManufacturer =
      rawManufacturer === '\u0413\u041f\u0417'
        ? 'GPZ'
        : rawManufacturer === '\u0425\u0410\u0420\u041f'
          ? 'HARP'
          : /\u0411\u0435\u0437 \u0431\u0440\u0435\u043d\u0434\u0443/i.test(rawManufacturer)
            ? undefined
            : rawManufacturer.replace(/[^A-Za-z0-9 &.,/-]/g, '').trim() || undefined;
    const manufacturer = /^(?:FO|FO\s*Bearings)$/i.test(cleanedManufacturer ?? '')
      ? 'FO Bearings'
      : /^FERSA$/i.test(cleanedManufacturer ?? '')
        ? 'FERSA'
        : /^KYK(?:\s*Bearings)?$/i.test(cleanedManufacturer ?? '')
          ? 'KYK'
          : cleanedManufacturer;
    const preset: Preset = {
      id: `promteh-${product.url.match(/-o(\d+)\/?$/)?.[1] ?? name.replace(/\W/g, '')}`,
      name: manufacturer ? `${name} · ${manufacturer}` : name,
      description: Number.isFinite(+parameters.outer)
        ? `${parameters.bore} × ${parameters.outer} × ${parameters.width} mm · Supplier dimensions`
        : `Bore ${parameters.bore} mm · ${part
            .dimensions(parameters, part.states?.[0]?.id ?? 'default')
            .map((value) => +value.toFixed(3))
            .join(' × ')} mm envelope`,
      parameters,
      catalog: {
        designation: name,
        manufacturer,
        sourceName: 'Promtehimport',
        sourceUrl: product.sourceUrl ?? product.url,
        verifiedParameters: result.verifiedParameters,
        ...(['flanged-linear-bearing', 'round-flange-linear-bearing'].includes(id)
          ? { alternateSourceUrls: [lmkReferenceUrl] }
          : {}),
        ...(result.reconciliation
          ? { alternateSourceUrls: [result.reconciliation.referenceUrl] }
          : {}),
      },
    };
    if (['flanged-linear-bearing', 'round-flange-linear-bearing'].includes(id))
      preset.description +=
        '. Flange dimensions and ball circuit count cross-referenced to HepcoMotion; supplier interchangeability is not asserted.';
    if (result.reconciliation)
      preset.description +=
        '. Conflicting shop summary reconciled against NSK reference dimensions.';
    (generated[id] ??= []).push(preset);
    results.push({ ...result, status: 'imported' });
  } catch (error) {
    results.push({
      ...result,
      status: String(error).includes('Conflicting') ? 'source-conflict' : 'missing-dimensions',
      reason: String(error).replace(/^Error: /, ''),
    });
  }
}
for (const presets of Object.values(generated))
  presets.sort((a, b) => String(a.name).localeCompare(b.name, 'en', { numeric: true }));
// Preserve exact supplier evidence using machine escapes in repository snapshots.
function sourceJson(value: unknown): string {
  return JSON.stringify(value).replace(
    /\p{Script=Cyrillic}/gu,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

fs.writeFileSync('src/catalog/generated/promtehimport-presets.json', sourceJson(generated));
const counts: Record<string, number> = {};
const processedProducts = results.length;
const membership = new Map<string, string[]>();
for (const [code, category] of Object.entries(inventory.categories))
  for (const url of category.productUrls)
    membership.set(url, [...(membership.get(url) ?? []), code]);
for (const [url, categories] of membership)
  if (!inventory.products[url])
    results.push({
      url,
      designation: '',
      categories,
      status: 'not-fetched',
      reason: 'Source product page has not been retrieved; no dimensions are inferred.',
    });
for (const result of results) counts[result.status] = (counts[result.status] ?? 0) + 1;
const unsupportedGroups = Object.values(
  results
    .filter((result) => result.status === 'unsupported-subtype')
    .reduce<
      Record<
        string,
        { reason: string; count: number; examples: Array<{ designation: string; url: string }> }
      >
    >((groups, result) => {
      const reason = result.reason ?? 'Unresolved source construction';
      const group = (groups[reason] ??= { reason, count: 0, examples: [] });
      group.count += 1;
      if (group.examples.length < 3)
        group.examples.push({ designation: result.designation, url: result.url });
      return groups;
    }, {}),
).sort((a, b) => b.count - a.count);
const categoryCoverage = Object.fromEntries(
  Object.entries(inventory.categories).map(([code, category]) => {
    const entries = results.filter((result) => result.categories.includes(code));
    const statuses: Record<string, number> = {};
    for (const entry of entries) statuses[entry.status] = (statuses[entry.status] ?? 0) + 1;
    return [
      code,
      {
        url: category.url,
        pages: category.pages,
        failedPages: category.failedPages.length,
        enumerated: category.productUrls.length,
        statuses,
      },
    ];
  }),
);
const report = {
  snapshotDate: inventory.snapshotDate,
  sourceStatus: inventory.status,
  enumeratedProducts: inventory.uniqueProductCount,
  processedProducts,
  counts,
  byModel: Object.fromEntries(
    Object.entries(generated).map(([id, presets]) => [id, presets.length]),
  ),
  categories: inventory.categories,
  categoryCoverage,
  unsupportedGroups,
  results,
};
fs.writeFileSync('data/promtehimport-import-report.json', sourceJson(report));
fs.writeFileSync(
  'src/catalog/generated/promtehimport-coverage.json',
  JSON.stringify({
    source: 'Promtehimport',
    snapshotDate: report.snapshotDate,
    sourceStatus: report.sourceStatus,
    enumeratedProducts: report.enumeratedProducts,
    processedProducts,
    counts,
    byModel: report.byModel,
    categories: categoryCoverage,
    unsupportedGroups,
  }),
);
console.log(
  JSON.stringify(
    {
      sourceStatus: inventory.status,
      enumeratedProducts: inventory.uniqueProductCount,
      processedProducts,
      counts,
      byModel: report.byModel,
      uniqueGeometryChecks: checkedGeometry.size,
    },
    null,
    2,
  ),
);
