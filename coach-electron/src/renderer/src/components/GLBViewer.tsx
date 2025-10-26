import { Suspense, useEffect, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Center } from '@react-three/drei';
import * as THREE from 'three';

interface ModelProps {
  modelPath: string;
}

function Model({ modelPath }: ModelProps) {
  const { scene } = useGLTF(modelPath);
  
  // Process the scene to show only one model
  const processedScene = useMemo(() => {
    const cloned = scene.clone();
    
    // Log the scene structure for debugging
    console.log('Scene children count:', cloned.children.length);
    cloned.children.forEach((child, index) => {
      console.log(`Child ${index}:`, child.type, child.name);
    });
    
    // Keep only the first child (remove all others)
    while (cloned.children.length > 1) {
      cloned.remove(cloned.children[1]);
    }
    
    console.log('After filtering, children count:', cloned.children.length);
    
    // Scale up the model (adjust the scale value as needed - 2 means 2x larger)
    cloned.scale.set(2, 2, 2);
    
    return cloned;
  }, [scene]);
  
  return (
    <Center>
      <primitive object={processedScene} />
    </Center>
  );
}

function Loader() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="gray" />
    </mesh>
  );
}

export function GLBViewer({ modelPath, className }: { modelPath: string; className?: string }) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Clear any previous errors when component mounts
    setError(null);
  }, [modelPath]);

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100`}>
        <p className="text-red-500">Error loading 3D model: {error}</p>
      </div>
    );
  }

  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 50 }}
        gl={{ antialias: true }}
        style={{ width: '100%', height: '100%' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1;
        }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-10, -10, -5]} intensity={0.5} />
        
        <Suspense fallback={<Loader />}>
          <Model modelPath={modelPath} />
        </Suspense>
        
        <OrbitControls 
          makeDefault
          autoRotate={true}
          autoRotateSpeed={3.0}
          enableZoom={true}
          enablePan={true}
          enableRotate={true}
          minDistance={1.5}
          maxDistance={10}
        />
      </Canvas>
    </div>
  );
}

