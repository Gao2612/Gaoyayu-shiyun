"use client";

import { OrbitControls, Sparkles, Stars } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { PoemStars } from "@/components/galaxy/PoemStars";
import type { Poem } from "@/types/poem";

type GalaxySceneProps = Readonly<{
  isEntered: boolean;
  poems: readonly Poem[];
}>;

export function GalaxyScene(
  props: GalaxySceneProps,
): React.ReactElement {
  return (
    <Canvas
      className="galaxy-canvas"
      camera={{ position: [0, 0, 12], fov: 52 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
    >
      <color args={["#02040a"]} attach="background" />
      <fog args={["#02040a", 12, 34]} attach="fog" />
      <ambientLight intensity={0.8} />
      <pointLight color="#b8dce6" intensity={8} position={[1, 2, 4]} />
      <Stars
        depth={45}
        factor={2.8}
        fade
        radius={38}
        saturation={0.25}
        speed={0.25}
      />
      <Sparkles
        color="#a6c7d4"
        count={90}
        opacity={0.35}
        scale={[18, 10, 10]}
        size={1.2}
        speed={0.12}
      />
      <PoemStars poems={props.poems} />
      <OrbitControls
        autoRotate
        autoRotateSpeed={props.isEntered ? 0.42 : 0.18}
        enableDamping
        enablePan={false}
        maxDistance={20}
        minDistance={6}
      />
    </Canvas>
  );
}
