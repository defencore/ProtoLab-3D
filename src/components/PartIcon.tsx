import {
  Box,
  Camera,
  CircleDot,
  CircuitBoard,
  Cog,
  Disc3,
  Layers3,
  Magnet,
  Nut,
  Plane,
  Rotate3D,
  Route,
  Workflow,
  Wrench,
} from 'lucide-react';

export function PartIcon({ type, size = 18 }: { type: string; size?: number }) {
  const Icon =
    (
      {
        bearing: CircleDot,
        bolt: Nut,
        spring: Rotate3D,
        box: Box,
        bracket: Workflow,
        wheel: Disc3,
        gear: Cog,
        rail: Route,
        magnet: Magnet,
        wing: Plane,
        camera: Camera,
        circuit: CircuitBoard,
      } as Record<string, typeof Box>
    )[type] ?? Wrench;
  return <Icon size={size} strokeWidth={1.65} />;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Layers3 size={23} strokeWidth={2} />
      </span>
      {!compact && (
        <>
          <span>
            ProtoLab<span className="brand-dot">.</span>
          </span>
          <span className="brand-tag">3D</span>
        </>
      )}
    </div>
  );
}
