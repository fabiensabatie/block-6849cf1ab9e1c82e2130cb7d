import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';

interface BlockProps {
  title?: string;
  description?: string;
}

// Noise function for terrain generation
function noise(x: number, z: number): number {
  return Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2 + 
         Math.sin(x * 0.05) * Math.cos(z * 0.05) * 4 +
         Math.sin(x * 0.02) * Math.cos(z * 0.02) * 8;
}

// Voxel component
function Voxel({ position, color }: { position: [number, number, number], color: string }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

// Island generator
function VoxelIsland() {
  const voxels = useMemo(() => {
    const voxelData: Array<{ position: [number, number, number], color: string }> = [];
    const size = 50;
    const centerX = size / 2;
    const centerZ = size / 2;
    
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        // Distance from center for island shape
        const distFromCenter = Math.sqrt((x - centerX) ** 2 + (z - centerZ) ** 2);
        const maxDist = size * 0.4;
        
        if (distFromCenter < maxDist) {
          // Generate terrain height with noise
          const height = Math.max(0, noise(x, z) * (1 - distFromCenter / maxDist));
          const voxelHeight = Math.floor(height) + 1;
          
          for (let y = 0; y <= voxelHeight; y++) {
            let color = '#8B4513'; // Brown for dirt
            
            // Color based on height and position
            if (y === voxelHeight && y > 3) {
              color = '#228B22'; // Green for grass on top
            } else if (y === voxelHeight && y <= 3) {
              color = '#F4A460'; // Sandy for beach
            } else if (y === 0) {
              color = '#696969'; // Gray for bedrock
            }
            
            // Add some trees randomly
            if (y === voxelHeight && y > 5 && Math.random() < 0.02) {
              // Tree trunk
              voxelData.push({
                position: [x - centerX, y + 1, z - centerZ],
                color: '#8B4513'
              });
              voxelData.push({
                position: [x - centerX, y + 2, z - centerZ],
                color: '#8B4513'
              });
              // Tree leaves
              for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                  for (let dy = 0; dy <= 1; dy++) {
                    if (Math.random() < 0.7) {
                      voxelData.push({
                        position: [x - centerX + dx, y + 3 + dy, z - centerZ + dz],
                        color: '#228B22'
                      });
                    }
                  }
                }
              }
            }
            
            voxelData.push({
              position: [x - centerX, y, z - centerZ],
              color
            });
          }
        }
      }
    }
    
    return voxelData;
  }, []);

  return (
    <group>
      {voxels.map((voxel, index) => (
        <Voxel key={index} position={voxel.position} color={voxel.color} />
      ))}
    </group>
  );
}

// Player controller with WASD movement
function PlayerController() {
  const { camera } = useThree();
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.code.toLowerCase();
      if (['keyw', 'keya', 'keys', 'keyd', 'space'].includes(key)) {
        keysPressed.current[key] = true;
        event.preventDefault();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.code.toLowerCase();
      if (['keyw', 'keya', 'keys', 'keyd', 'space'].includes(key)) {
        keysPressed.current[key] = false;
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((state, delta) => {
    const speed = 10;
    
    // Get camera direction
    camera.getWorldDirection(direction.current);
    
    // Calculate movement vectors
    const forward = direction.current.clone();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    
    // Reset velocity
    velocity.current.set(0, 0, 0);
    
    // WASD movement
    if (keysPressed.current.keyw) {
      velocity.current.add(forward.multiplyScalar(speed * delta));
    }
    if (keysPressed.current.keys) {
      velocity.current.add(forward.multiplyScalar(-speed * delta));
    }
    if (keysPressed.current.keya) {
      velocity.current.add(right.multiplyScalar(-speed * delta));
    }
    if (keysPressed.current.keyd) {
      velocity.current.add(right.multiplyScalar(speed * delta));
    }
    if (keysPressed.current.space) {
      velocity.current.y += speed * delta;
    }
    
    // Apply movement
    camera.position.add(velocity.current);
    
    // Keep camera above ground level
    if (camera.position.y < 2) {
      camera.position.y = 2;
    }
  });

  return null;
}

// Water plane around the island
function Water() {
  const waterRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (waterRef.current) {
      waterRef.current.material.uniforms = {
        ...waterRef.current.material.uniforms,
        time: { value: state.clock.elapsedTime }
      };
    }
  });

  return (
    <mesh ref={waterRef} position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[200, 200]} />
      <meshLambertMaterial color="#4169E1" transparent opacity={0.6} />
    </mesh>
  );
}

// Sky component
function Sky() {
  return (
    <mesh>
      <sphereGeometry args={[100, 32, 32]} />
      <meshBasicMaterial color="#87CEEB" side={THREE.BackSide} />
    </mesh>
  );
}

// Instructions overlay
function Instructions({ show }: { show: boolean }) {
  if (!show) return null;
  
  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      color: 'white',
      fontFamily: 'monospace',
      fontSize: '14px',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: '15px',
      borderRadius: '5px',
      zIndex: 1000
    }}>
      <h3 style={{ margin: '0 0 10px 0' }}>🏝️ Voxel Island Explorer</h3>
      <p style={{ margin: '5px 0' }}>🖱️ Click to capture mouse and look around</p>
      <p style={{ margin: '5px 0' }}>⌨️ WASD to move</p>
      <p style={{ margin: '5px 0' }}>🚀 SPACE to fly up</p>
      <p style={{ margin: '5px 0' }}>⏎ ESC to release mouse</p>
    </div>
  );
}

const Block: React.FC<BlockProps> = ({ title = "3D Voxel Island Explorer", description }) => {
  const [showInstructions, setShowInstructions] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', background: '#87CEEB' }}>
      <Instructions show={showInstructions && !isLocked} />
      
      <Canvas
        camera={{ 
          position: [0, 15, 20], 
          fov: 75,
          near: 0.1,
          far: 1000
        }}
        style={{ background: '#87CEEB' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[50, 50, 25]} 
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        
        {/* Scene components */}
        <Sky />
        <Water />
        <VoxelIsland />
        
        {/* Controls */}
        <PointerLockControls 
          onLock={() => {
            setIsLocked(true);
            setShowInstructions(false);
          }}
          onUnlock={() => {
            setIsLocked(false);
            setShowInstructions(true);
          }}
        />
        <PlayerController />
        
        {/* Fog for atmosphere */}
        <fog attach="fog" args={['#87CEEB', 50, 100]} />
      </Canvas>
      
      {!isLocked && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: 'white',
          fontSize: '18px',
          fontFamily: 'monospace',
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: '20px',
          borderRadius: '10px'
        }}>
          <h2>🏝️ Click to Start Exploring!</h2>
          <p>Click anywhere to capture mouse and begin your voxel island adventure</p>
        </div>
      )}
    </div>
  );
};

export default Block;