import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { TOOTH_COLOR, toothState, toothType } from './toothState';

// Crown geometry differs by anatomical type so the arch reads like real teeth.
function Crown({ type, color }) {
  if (type === 'incisor') {
    return (
      <mesh position={[0, 0.32, 0]} scale={[0.62, 0.62, 0.26]}>
        <boxGeometry args={[0.7, 0.95, 0.7]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.04} />
      </mesh>
    );
  }
  if (type === 'premolar') {
    return (
      <group position={[0, 0.32, 0]}>
        <mesh scale={[0.7, 0.55, 0.7]}>
          <sphereGeometry args={[0.42, 24, 24]} />
          <meshStandardMaterial color={color} roughness={0.45} />
        </mesh>
        <mesh position={[0.16, 0.18, 0]} scale={[0.34, 0.34, 0.34]}>
          <sphereGeometry args={[0.42, 16, 16]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
        <mesh position={[-0.16, 0.18, 0]} scale={[0.34, 0.34, 0.34]}>
          <sphereGeometry args={[0.42, 16, 16]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[0, 0.32, 0]}>
      <mesh scale={[0.95, 0.6, 0.85]}>
        <boxGeometry args={[0.78, 0.78, 0.78]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
      {[
        [0.2, 0.16, 0.18],
        [-0.2, 0.16, 0.18],
        [0.2, 0.16, -0.18],
        [-0.2, 0.16, -0.18],
      ].map((p, i) => (
        <mesh key={i} position={p} scale={[0.26, 0.26, 0.26]}>
          <sphereGeometry args={[0.42, 14, 14]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function ToothMesh({
  toothNumber,
  entry,
  selected = false,
  onClick,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}) {
  const [hovered, setHovered] = useState(false);
  const type = toothType(toothNumber);
  const state = toothState(entry);
  const color = selected
    ? TOOTH_COLOR.selected
    : hovered
      ? '#e0f2fe'
      : TOOTH_COLOR[state] || TOOTH_COLOR.empty;
  const twoRoots = type === 'molar';

  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(toothNumber);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      <Crown type={type} color={color} />
      {twoRoots ? (
        <>
          <mesh position={[0.16, -0.28, 0]} scale={[0.28, 0.95, 0.28]}>
            <coneGeometry args={[0.34, 1, 16]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.55} />
          </mesh>
          <mesh position={[-0.16, -0.28, 0]} scale={[0.28, 0.95, 0.28]}>
            <coneGeometry args={[0.34, 1, 16]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.55} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, -0.28, 0]} scale={[0.42, 1, 0.42]}>
          <coneGeometry args={[0.34, 1.1, 16]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.55} />
        </mesh>
      )}
      <Text position={[0, -0.95, 0]} fontSize={0.22} color="#e2e8f0" anchorX="center" anchorY="middle">
        {toothNumber}
      </Text>
    </group>
  );
}

export { ToothMesh };

export default function Tooth3D({ toothNumber = 1, entry, selected = false, onClick }) {
  return (
    <div className="h-56 w-full rounded-2xl border border-slate-700 bg-slate-950">
      <Canvas camera={{ position: [0, 0.5, 4], fov: 45 }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 4, 5]} intensity={1.2} />
        <ToothMesh toothNumber={toothNumber} entry={entry} selected={selected} onClick={onClick} />
        <OrbitControls enablePan={false} enableZoom />
      </Canvas>
    </div>
  );
}
