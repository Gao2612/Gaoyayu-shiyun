"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Object3D, StaticDrawUsage } from "three";
import type { Group, InstancedMesh } from "three";

import {
  createPoemStarVisuals,
  type PoemStarVisual,
} from "@/lib/poem-star-visual";
import type { Poem } from "@/types/poem";

type PoemStarsProps = Readonly<{
  poems: readonly Poem[];
}>;

export function PoemStars(
  props: PoemStarsProps,
): React.ReactElement {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<InstancedMesh>(null);
  const stars: readonly PoemStarVisual[] = useMemo(
    (): readonly PoemStarVisual[] =>
      createPoemStarVisuals(props.poems),
    [props.poems],
  );

  useLayoutEffect((): void => {
    const mesh: InstancedMesh | null = meshRef.current;
    if (mesh === null) {
      return;
    }

    const transform: Object3D = new Object3D();
    stars.forEach((star: PoemStarVisual, index: number): void => {
      transform.position.set(...star.position);
      transform.scale.setScalar(star.scale);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, star.color);
    });

    mesh.instanceMatrix.setUsage(StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor !== null) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
  }, [stars]);

  useFrame((state, delta: number): void => {
    if (groupRef.current === null) {
      return;
    }

    groupRef.current.rotation.y += delta * 0.015;
    groupRef.current.rotation.x =
      Math.sin(state.clock.elapsedTime * 0.08) * 0.035;
  });

  return (
    <group ref={groupRef}>
      <instancedMesh
        args={[undefined, undefined, stars.length]}
        frustumCulled={false}
        ref={meshRef}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
