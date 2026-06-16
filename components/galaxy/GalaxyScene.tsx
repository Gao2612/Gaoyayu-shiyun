"use client";

import { Sparkles, Stars } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";

import { GalaxyCamera } from "@/components/galaxy/GalaxyCamera";
import { PoemStars } from "@/components/galaxy/PoemStars";
import { createPoemStarVisuals } from "@/lib/poem-star-visual";
import { useGalaxyStore } from "@/store/galaxy-store";
import type { Poem } from "@/types/poem";
import type { PoemPosition } from "@/types/poem";

type GalaxySceneProps = Readonly<{
  matchedPoemIds: readonly string[];
  poems: readonly Poem[];
}>;

export function GalaxyScene(
  props: GalaxySceneProps,
): React.ReactElement {
  const selectedPoemId = useGalaxyStore(
    (state) => state.selectedPoemId,
  );
  const clearSelection = useGalaxyStore(
    (state) => state.clearSelection,
  );
  const selectedPosition: PoemPosition | null = useMemo(() => {
    const selectedStar = createPoemStarVisuals(props.poems).find(
      (star) => star.id === selectedPoemId,
    );
    return selectedStar?.position ?? null;
  }, [props.poems, selectedPoemId]);

  return (
    <Canvas
      className="galaxy-canvas"
      camera={{ position: [0, 0, 12], fov: 52 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={clearSelection}
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
      <PoemStars
        matchedPoemIds={props.matchedPoemIds}
        poems={props.poems}
      />
      <GalaxyCamera
        selectedPosition={selectedPosition}
      />
    </Canvas>
  );
}
