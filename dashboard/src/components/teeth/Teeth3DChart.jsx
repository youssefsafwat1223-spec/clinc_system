import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ToothMesh } from './Tooth3D';

function buildDentalArch() {
  const teeth = [];

  for (let index = 0; index < 16; index += 1) {
    const toothNumber = index + 1;
    const angle = Math.PI - (index / 15) * Math.PI;
    teeth.push({
      toothNumber,
      position: [Math.cos(angle) * 4.2, 1.2 + Math.sin(angle) * 0.8, Math.sin(angle) * 1.7],
      rotation: [0, -angle + Math.PI / 2, 0],
    });
  }

  for (let index = 0; index < 16; index += 1) {
    const toothNumber = 17 + index;
    const angle = (index / 15) * Math.PI;
    teeth.push({
      toothNumber,
      position: [Math.cos(angle) * 4.2, -1.4 - Math.sin(angle) * 0.8, Math.sin(angle) * 1.7],
      rotation: [Math.PI, angle - Math.PI / 2, 0],
    });
  }

  return teeth;
}

export default function Teeth3DChart({ teethNotes = {}, selectedTooth, onSelectTooth }) {
  const teeth = useMemo(() => buildDentalArch(), []);

  return (
    <div className="h-[520px] w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-950">
      <Canvas camera={{ position: [0, 0, 9], fov: 45 }}>
        <ambientLight intensity={0.95} />
        <directionalLight position={[4, 6, 8]} intensity={1.3} />
        <directionalLight position={[-4, -2, -6]} intensity={0.5} />
        {teeth.map((tooth) => {
          const entry =
            teethNotes?.[tooth.toothNumber] || teethNotes?.[String(tooth.toothNumber)] || null;
          return (
            <ToothMesh
              key={tooth.toothNumber}
              toothNumber={tooth.toothNumber}
              position={tooth.position}
              rotation={tooth.rotation}
              scale={0.65}
              selected={Number(selectedTooth) === tooth.toothNumber}
              entry={entry}
              onClick={onSelectTooth}
            />
          );
        })}
        <OrbitControls enablePan={false} enableZoom minDistance={6} maxDistance={14} />
      </Canvas>
    </div>
  );
}
