import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls, Text } from '@react-three/drei';

function ToothMesh({
  toothNumber,
  selected = false,
  hasData = false,
  onClick,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}) {
  const [hovered, setHovered] = useState(false);
  const color = selected ? '#38bdf8' : hasData ? '#facc15' : hovered ? '#e0f2fe' : '#f8fafc';

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
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.35, 0.28]} scale={[0.75, 0.55, 0.22]}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.18, 0]} scale={[0.45, 0.9, 0.45]}>
        <coneGeometry args={[0.38, 1.1, 32]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.78, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.012, 8, 48]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <Text position={[0, -0.95, 0]} fontSize={0.22} color="#0f172a" anchorX="center" anchorY="middle">
        {toothNumber}
      </Text>
    </group>
  );
}

export { ToothMesh };

export default function Tooth3D({ toothNumber = 1, selected = false, hasData = false, onClick }) {
  return (
    <div className="h-56 w-full rounded-2xl border border-slate-700 bg-slate-950">
      <Canvas camera={{ position: [0, 0.5, 4], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 5]} intensity={1.3} />
        <Environment preset="city" />
        <ToothMesh toothNumber={toothNumber} selected={selected} hasData={hasData} onClick={onClick} />
        <OrbitControls enablePan={false} enableZoom />
      </Canvas>
    </div>
  );
}
