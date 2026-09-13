import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import type { Mesh, Material } from 'three';
import type { Parameters, PartDefinition } from './types';

export function downloadFile(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadStl(part: PartDefinition, parameters: Parameters, state: string) {
  const model = part.buildGeometry(parameters, state);
  try {
    model.updateMatrixWorld(true);
    const data = new STLExporter().parse(model, { binary: true });
    downloadFile(data, `${part.id}-${state}.stl`, 'model/stl');
  } finally {
    model.traverse((child) => {
      const mesh = child as Mesh;
      mesh.geometry?.dispose();
      if (mesh.material)
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(
          (material: Material) => material.dispose(),
        );
    });
  }
}
