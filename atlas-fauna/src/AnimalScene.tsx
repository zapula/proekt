import { Suspense, useLayoutEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Html, OrbitControls, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';

interface ModelProps {
  url: string;
  scaleFactor: number;
}

const disposeMaterial = (
  material: THREE.Material,
  disposedMaterials: Set<THREE.Material>,
  disposedTextures: Set<THREE.Texture>
) => {
  if (disposedMaterials.has(material)) return;
  disposedMaterials.add(material);

  Object.values(material).forEach((value) => {
    if (value instanceof THREE.Texture && !disposedTextures.has(value)) {
      disposedTextures.add(value);
      value.dispose();
    }
  });

  material.dispose();
};

function Model({ url, scaleFactor }: ModelProps) {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(), [scene]);

  const [correction, setCorrection] = useState({
    position: new THREE.Vector3(0, 0, 0),
    baseScale: 1
  });

  useLayoutEffect(() => {
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z, 0.0001);
    const targetSize = 1.8;
    const baseScale = targetSize / maxDimension;

    setCorrection({
      position: new THREE.Vector3(-center.x, -box.min.y, -center.z),
      baseScale
    });

    return () => {
      const disposedGeometries = new Set<THREE.BufferGeometry>();
      const disposedMaterials = new Set<THREE.Material>();
      const disposedTextures = new Set<THREE.Texture>();

      clonedScene.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;

        if (mesh.geometry && !disposedGeometries.has(mesh.geometry)) {
          disposedGeometries.add(mesh.geometry);
          mesh.geometry.dispose();
        }

        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => disposeMaterial(material, disposedMaterials, disposedTextures));
          return;
        }

        if (mesh.material) {
          disposeMaterial(mesh.material, disposedMaterials, disposedTextures);
        }
      });
    };
  }, [clonedScene]);

  return (
    <group scale={correction.baseScale * scaleFactor} position={[0, 0, 0]}>
      <primitive object={clonedScene} position={correction.position} />
    </group>
  );
}

function Ground() {
  const textures = useTexture({
    map: '/textures/grass/diffuse.jpg',
    normalMap: '/textures/grass/normal.jpg',
    roughnessMap: '/textures/grass/roughness.jpg',
    aoMap: '/textures/grass/ao.jpg'
  });

  useLayoutEffect(() => {
    [textures.map, textures.normalMap, textures.roughnessMap, textures.aoMap].forEach((texture) => {
      if (!texture) return;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(4, 4);
    });
  }, [textures]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <circleGeometry args={[7, 64]} />
      <meshStandardMaterial
        {...textures}
        side={THREE.DoubleSide}
        normalScale={new THREE.Vector2(0.8, 0.8)}
        roughness={1}
        color={new THREE.Color(0.5, 0.5, 0.5)}
      />
    </mesh>
  );
}

function Loader() {
  return (
    <Html center>
      <div
        style={{
          color: '#333',
          background: '#fff',
          padding: '10px 20px',
          borderRadius: '20px',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
        }}
      >
        Loading 3D scene...
      </div>
    </Html>
  );
}

export default function AnimalScene({
  modelUrl,
  isAdult,
  scale = 1
}: {
  modelUrl: string;
  isAdult: boolean;
  scale?: number;
}) {
  const safeModelUrl = useMemo(() => modelUrl.trim().replace(/\\/g, '/'), [modelUrl]);

  useLayoutEffect(() => {
    return () => {
      if (safeModelUrl) {
        useGLTF.clear(safeModelUrl);
      }
    };
  }, [safeModelUrl]);

  const ageScale = isAdult ? 1.5 : 0.8;
  const finalScale = ageScale * scale;

  return (
    <div style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }}>
      <Canvas
        dpr={[1, 1.5]}
        shadows
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        camera={{ position: [0, 1.5, 6], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Environment files="/textures/forest/forest.exr" background blur={0} />

        <ambientLight intensity={0.6} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0001}
        />

        <Suspense fallback={<Loader />}>
          <Model url={safeModelUrl} scaleFactor={finalScale} />

          <ContactShadows
            position={[0, 0.01, 0]}
            opacity={0.65}
            scale={7}
            blur={2.5}
            far={1.5}
            color="#000000"
          />

          <Ground />
        </Suspense>

        <OrbitControls
          makeDefault
          minDistance={2}
          maxDistance={9}
          target={[0, 0.6, 0]}
          maxPolarAngle={Math.PI / 2.05}
        />
      </Canvas>
    </div>
  );
}
