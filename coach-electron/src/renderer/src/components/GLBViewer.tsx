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
  
  // Extract geometry for point cloud
  const pointCloudGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];
    
    // Sample rate: 1 = all points, 2 = every 2nd point, 3 = every 3rd point, etc.
    const sampleRate = 5; // Reduce density by showing only every 5th point
    
    processedScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const mesh = child as THREE.Mesh;
        const positionAttribute = mesh.geometry.attributes.position;
        const colorAttribute = mesh.geometry.attributes.color;
        
        if (positionAttribute) {
          const matrix = mesh.matrixWorld;
          
          for (let i = 0; i < positionAttribute.count; i += sampleRate) {
            const vertex = new THREE.Vector3(
              positionAttribute.getX(i),
              positionAttribute.getY(i),
              positionAttribute.getZ(i)
            );
            vertex.applyMatrix4(matrix);
            positions.push(vertex.x, vertex.y, vertex.z);
            
            // Use original colors if available, otherwise white
            if (colorAttribute) {
              colors.push(
                colorAttribute.getX(i),
                colorAttribute.getY(i),
                colorAttribute.getZ(i)
              );
            } else {
              colors.push(1, 1, 1); // White points
            }
          }
        }
      }
    });
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    return geometry;
  }, [processedScene]);
  
  return (
    <Center>
      <points geometry={pointCloudGeometry}>
        <pointsMaterial
          size={0.008}
          transparent={true}
          opacity={0.9}
          vertexColors={true}
          sizeAttenuation={true}
        />
      </points>
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
    <div className={className} style={{ width: '100%', height: '100%', backgroundColor: '#000000' }}>
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 50 }}
        gl={{ antialias: true }}
        style={{ width: '100%', height: '100%', backgroundColor: '#000000' }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1;
          scene.background = new THREE.Color('#000000');
        }}
      >
        {/* Lighting */}
        <ambientLight intensity={1.0} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        <directionalLight position={[-10, -10, -5]} intensity={0.8} />
        <directionalLight position={[0, -10, 0]} intensity={0.5} />
        
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

