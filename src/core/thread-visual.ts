import { MeshStandardMaterial, type Mesh } from 'three';

/** Render-only helical flank shading. Exported solids remain nominal cylinders. */
export interface VisualThread {
  origin: [number, number, number];
  axis: [number, number, number];
  diameter: number;
  pitch: number;
  length: number;
  left?: boolean;
  internal?: boolean;
  rounded?: boolean;
}
const vec = (v: number[]) => `vec3(${v.map((n) => n.toFixed(6)).join(',')})`;
export function restoreThreadMaterial(material: MeshStandardMaterial) {
  const threads = material.userData.visualThreads as VisualThread[] | undefined;
  if (!threads?.length) return;
  material.roughness = Math.max(material.roughness, 0.4);
  material.customProgramCacheKey = () => JSON.stringify(threads);
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 plThreadPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nplThreadPosition = position;',
    );
    shader.fragmentShader = 'varying vec3 plThreadPosition;\n' + shader.fragmentShader;
    const fields = threads
      .map((t) => {
        const a = t.axis,
          seed = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
        return `{
        vec3 axis = normalize(${vec(a)}), delta = plThreadPosition - ${vec(t.origin)};
        float axial = dot(delta,axis), r=length(delta-axis*axial);
        vec3 u=normalize(cross(axis,${vec(seed)})), v=cross(axis,u);
        float angle=atan(dot(delta,v),dot(delta,u));
        float phase=axial/${t.pitch.toFixed(6)}-${t.left ? '-' : ''}angle/6.28318530718;
        float mask=step(0.0,axial)*step(axial,${t.length.toFixed(6)})*(1.0-smoothstep(0.08,0.22,abs(r-${(t.diameter / 2).toFixed(6)})));
        float groove=${t.rounded ? '0.5-0.5*cos(phase*6.28318530718)' : 'clamp(abs(fract(phase)-0.5)*2.0,0.125,0.875)'};
        float fade=1.0-smoothstep(0.18,0.7,fwidth(phase));
        plThreadHeight -= mask*fade*groove*${(t.pitch * (t.rounded ? 0.1 : 0.22)).toFixed(6)};
        plThreadShade += mask*fade*groove;
      }`;
      })
      .join('\n');
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      float plThreadHeight=0.0, plThreadShade=0.0;
      ${fields}
      vec3 plQ0=dFdx(-vViewPosition),plQ1=dFdy(-vViewPosition);
      vec3 plR1=cross(plQ1,normal),plR2=cross(normal,plQ0);
      float plDet=dot(plQ0,plR1);
      if(abs(plDet)>1e-15) normal=normalize(abs(plDet)*normal-sign(plDet)*(dFdx(plThreadHeight)*plR1+dFdy(plThreadHeight)*plR2));
      diffuseColor.rgb *= 1.0-0.2*min(plThreadShade,1.0);
    `,
    );
  };
  material.needsUpdate = true;
}
export function showThreads(mesh: Mesh, threads: VisualThread[]) {
  for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
    if (!(material instanceof MeshStandardMaterial)) continue;
    material.userData.visualThreads = threads;
    restoreThreadMaterial(material);
  }
}
