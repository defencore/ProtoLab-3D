import { BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { unzlibSync } from 'three/addons/libs/fflate.module.js';
import type { Parameters, PartDefinition, Preset } from '../../../core/types';
import type { ProductProfile } from '../../../core/product-types';

export interface PurchasedModel {
  id: string;
  label: string;
  designation: string;
  manufacturer: string;
  sourceUrl: string;
  cadSourceUrl: string;
  sourceSha256: string;
  bounds: number[];
  dimensions: number[];
  volume: number;
  solidCount: number;
  role: string;
  requirements: string[];
  normalization: string;
  sourceEquipmentId: string;
}

interface MeshPart {
  vertices: string;
  triangles: string;
  color: number;
}

export interface PurchasedNative {
  components: { id: string; brep: string; meshParts: MeshPart[] }[];
}

const meshCache = new WeakMap<MeshPart, BufferGeometry>();

function unpack(value: string): ArrayBuffer {
  const bytes = unzlibSync(Uint8Array.from(atob(value), (c) => c.charCodeAt(0)));
  return bytes.slice().buffer as ArrayBuffer;
}

export function fixedProductConfigurator(models: PurchasedModel[]) {
  return {
    defaults: { model: models[0].id } satisfies Parameters,
    parameters: [
      {
        key: 'model',
        label: 'Supplier execution',
        group: 'Product',
        type: 'select' as const,
        options: models.map((m) => ({ value: m.id, label: m.label })),
      },
    ],
  };
}

/** Complete native supplier geometry stays one reusable, opaque procurement unit. */
export function purchasedProduct(
  identity: Pick<
    PartDefinition,
    'id' | 'name' | 'category' | 'subgroup' | 'icon' | 'description' | 'keywords'
  >,
  product: ProductProfile,
  models: PurchasedModel[],
  native: PurchasedNative,
  presets: Preset[],
): PartDefinition {
  const { defaults, parameters } = fixedProductConfigurator(models);
  const byId = new Map(native.components.map((m) => [m.id, m]));
  const selected = (p: Parameters) => {
    const model = models.find((m) => m.id === p.model);
    if (!model) throw new Error('Choose a supported supplier execution.');
    return model;
  };
  const validate = (p: Parameters, state = 'default') => {
    const errors: string[] = [];
    const model = models.find((m) => m.id === p.model);
    if (!model) errors.push('Choose a supported supplier execution.');
    if (Object.keys(p).some((key) => key !== 'model'))
      errors.push('This supplier product has fixed geometry; dimensions cannot be overridden.');
    if (state !== 'default') errors.push('Choose the complete product installation view.');
    if (model) {
      const asset = byId.get(model.id);
      if (!asset?.brep || asset.meshParts.length !== model.solidCount)
        errors.push('Complete native product geometry is unavailable.');
      if (
        model.dimensions.length !== 3 ||
        model.dimensions.some((d) => !Number.isFinite(d) || d <= 0)
      )
        errors.push('The supplier installation dimensions are invalid.');
    }
    return errors;
  };
  const requireValid = (p: Parameters, state: string) => {
    const errors = validate(p, state);
    if (errors.length) throw new Error(errors.join(' '));
  };
  return {
    ...identity,
    product,
    defaults,
    parameters,
    presets,
    presetMatchKeys: ['model'],
    catalogSelection: [{ key: 'model' }],
    catalogSelectionOnly: true,
    catalogFilterFields: [
      {
        key: 'width',
        label: 'Product X extent',
        type: 'number',
        group: 'Installation dimensions',
        unit: 'mm',
        catalogSummary: true,
      },
      {
        key: 'depth',
        label: 'Product Y extent',
        type: 'number',
        group: 'Installation dimensions',
        unit: 'mm',
      },
      {
        key: 'height',
        label: 'Product Z extent',
        type: 'number',
        group: 'Installation dimensions',
        unit: 'mm',
        catalogSummary: true,
      },
    ],
    complexity: 'Fixed supplier product with original native CAD',
    preview: 'worker',
    states: [
      {
        id: 'default',
        label: 'Complete product',
        description: 'Complete purchased unit in its own reusable product coordinates.',
      },
    ],
    validate,
    buildGeometry(p, state = 'default') {
      requireValid(p, state);
      const model = selected(p);
      const group = new Group();
      group.name = model.label;
      group.userData.supply = 'purchased';
      group.userData.productModel = model.id;
      for (const [i, source] of byId.get(model.id)!.meshParts.entries()) {
        let geometry = meshCache.get(source);
        if (!geometry) {
          const positions = new Float32Array(unpack(source.vertices));
          const indices = new Uint32Array(unpack(source.triangles));
          if (
            !positions.length ||
            positions.length % 3 ||
            !indices.length ||
            indices.length % 3 ||
            positions.some((v) => !Number.isFinite(v)) ||
            indices.some((j) => j >= positions.length / 3)
          )
            throw new Error('Invalid native product preview topology.');
          geometry = new BufferGeometry();
          geometry.setAttribute('position', new BufferAttribute(positions, 3));
          geometry.setIndex(new BufferAttribute(indices, 1));
          geometry.computeVertexNormals();
          geometry.userData.nativeTopology = true;
          meshCache.set(source, geometry);
        }
        const object = new Mesh(
          geometry.clone(),
          new MeshStandardMaterial({
            color: source.color,
            metalness: model.role === 'waterproof-servo' && i < 3 ? 0.18 : 0.55,
            roughness: 0.45,
          }),
        );
        object.name = `${model.label} · supplied body ${i + 1}`;
        object.userData.supply = 'purchased';
        group.add(object);
      }
      return group;
    },
    buildExportGeometry() {
      throw new Error(
        'Buy this product complete. Its installation CAD has no printable fabrication export.',
      );
    },
    dimensions(p, state = 'default') {
      requireValid(p, state);
      return [...selected(p).dimensions] as [number, number, number];
    },
    python(p, state = 'default') {
      requireValid(p, state);
      const model = selected(p);
      return [
        'import base64, zlib',
        `# Complete purchased product: ${model.designation}`,
        `# Product coordinate frame: ${model.normalization}`,
        'purchased_unit = Part.Shape()',
        `purchased_unit.importBrepFromString(zlib.decompress(base64.b64decode(${JSON.stringify(byId.get(model.id)!.brep)})).decode('utf-8'))`,
        `if len(purchased_unit.Solids) != ${model.solidCount} or any(not s.isValid() or not s.isClosed() or s.Volume <= 0 for s in purchased_unit.Solids):`,
        "    raise ValueError('Native purchased product geometry failed validation.')",
        'shape = Part.makeCompound([purchased_unit])',
        `component_labels = [${JSON.stringify(model.label)}]`,
        'component_manufactured = [False]',
        `component_metadata = [${JSON.stringify({ Supply: 'purchased', PurchasedUnit: model.designation, SupplierSource: model.sourceUrl, ProductCoordinates: model.normalization })}]`,
      ].join('\n');
    },
    assessment(p) {
      const model = selected(p);
      return [`Buy complete: ${model.designation}.`, model.normalization, ...model.requirements];
    },
    fabricationFiles(p) {
      const model = selected(p);
      return [
        {
          id: 'purchasing-record',
          label: 'Product purchasing record',
          description: 'Order designation, source and installation requirements',
          name: `${identity.id}-${model.id}-purchasing.json`,
          type: 'application/json',
          content: JSON.stringify({ ...model, supply: 'purchased', manufacturing: null }, null, 2),
        },
      ];
    },
    notes:
      'Fixed complete supplier article. Native source faces are preserved under rigid coordinate normalization; internal supplied bodies remain one purchase. No fabrication STL is available.',
    sources: models.map((model) => ({
      label: `${model.label} purchasing source`,
      url: model.sourceUrl,
    })),
  };
}
