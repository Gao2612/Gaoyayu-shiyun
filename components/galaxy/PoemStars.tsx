"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Color, Object3D, StaticDrawUsage } from "three";
import type { InstancedMesh } from "three";

import {
  createPoemStarVisuals,
  type PoemStarVisual,
} from "@/lib/poem-star-visual";
import { useGalaxyStore } from "@/store/galaxy-store";
import type { Poem } from "@/types/poem";

type PoemStarsProps = Readonly<{
  matchedPoemIds: readonly string[];
  poems: readonly Poem[];
}>;

type InstanceEvent = Readonly<{
  instanceId?: number;
}>;

export function PoemStars(
  props: PoemStarsProps,
): React.ReactElement {
  const meshRef = useRef<InstancedMesh>(null);
  const dimmedMeshRef = useRef<InstancedMesh>(null);
  const hitMeshRef = useRef<InstancedMesh>(null);
  const hoveredPoemId = useGalaxyStore(
    (state) => state.hoveredPoemId,
  );
  const selectedPoemId = useGalaxyStore(
    (state) => state.selectedPoemId,
  );
  const hoverPoem = useGalaxyStore((state) => state.hoverPoem);
  const selectPoem = useGalaxyStore((state) => state.selectPoem);
  const stars: readonly PoemStarVisual[] = useMemo(
    (): readonly PoemStarVisual[] =>
      createPoemStarVisuals(props.poems),
    [props.poems],
  );
  const matchedPoemIds: ReadonlySet<string> = useMemo(
    (): ReadonlySet<string> => new Set(props.matchedPoemIds),
    [props.matchedPoemIds],
  );

  useEffect((): (() => void) => {
    document.body.style.cursor = hoveredPoemId === null
      ? "default"
      : "pointer";

    return (): void => {
      document.body.style.cursor = "default";
    };
  }, [hoveredPoemId]);

  useLayoutEffect((): void => {
    const mesh: InstancedMesh | null = meshRef.current;
    const dimmedMesh: InstancedMesh | null = dimmedMeshRef.current;
    const hitMesh: InstancedMesh | null = hitMeshRef.current;
    if (mesh === null || dimmedMesh === null || hitMesh === null) {
      return;
    }

    const transform: Object3D = new Object3D();
    stars.forEach((star: PoemStarVisual, index: number): void => {
      const isMatched: boolean = matchedPoemIds.has(star.id);
      const isSelected: boolean = star.id === selectedPoemId;
      const isHovered: boolean = star.id === hoveredPoemId;
      const stateScale: number = isSelected
        ? 1.85
        : isHovered
          ? 1.4
          : 1;
      const stateColor: Color = isSelected
        ? new Color("#fff4cf")
        : isHovered
          ? star.color.clone().lerp(new Color("#ffffff"), 0.55)
          : star.color;

      transform.position.set(...star.position);
      transform.scale.setScalar(isMatched ? star.scale * stateScale : 0);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, stateColor);

      transform.scale.setScalar(isMatched ? 0 : star.scale * 0.82);
      transform.updateMatrix();
      dimmedMesh.setMatrixAt(index, transform.matrix);
      dimmedMesh.setColorAt(index, star.color);

      transform.scale.setScalar(star.scale * 3.4);
      transform.updateMatrix();
      hitMesh.setMatrixAt(index, transform.matrix);
    });

    mesh.instanceMatrix.setUsage(StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    dimmedMesh.instanceMatrix.setUsage(StaticDrawUsage);
    dimmedMesh.instanceMatrix.needsUpdate = true;
    hitMesh.instanceMatrix.setUsage(StaticDrawUsage);
    hitMesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor !== null) {
      mesh.instanceColor.needsUpdate = true;
    }
    if (dimmedMesh.instanceColor !== null) {
      dimmedMesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
    dimmedMesh.computeBoundingSphere();
    hitMesh.computeBoundingSphere();
  }, [hoveredPoemId, matchedPoemIds, selectedPoemId, stars]);

  function getPoemId(event: InstanceEvent): string | null {
    const instanceId: number | undefined = event.instanceId;
    if (instanceId === undefined) {
      return null;
    }
    return stars[instanceId]?.id ?? null;
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>): void {
    event.stopPropagation();
    hoverPoem(getPoemId(event));
  }

  function handlePointerOut(): void {
    hoverPoem(null);
  }

  function handleClick(event: ThreeEvent<MouseEvent>): void {
    event.stopPropagation();
    const poemId: string | null = getPoemId(event);
    if (poemId !== null) {
      selectPoem(poemId);
    }
  }

  return (
    <group>
      <instancedMesh
        args={[undefined, undefined, stars.length]}
        frustumCulled={false}
        ref={meshRef}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, stars.length]}
        frustumCulled={false}
        ref={dimmedMeshRef}
      >
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          opacity={0.18}
          toneMapped={false}
          transparent
        />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, stars.length]}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        ref={hitMeshRef}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color="#ffffff"
          depthWrite={false}
          opacity={0.001}
          transparent
        />
      </instancedMesh>
    </group>
  );
}
