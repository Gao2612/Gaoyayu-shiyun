"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { PoemPosition } from "@/types/poem";

type GalaxyCameraProps = Readonly<{
  selectedPosition: PoemPosition | null;
}>;

const DEFAULT_TARGET: Vector3 = new Vector3(0, 0, 0);
const DEFAULT_CAMERA_POSITION: Vector3 = new Vector3(0, 0, 12);
const FOCUS_DISTANCE: number = 3.2;
const FOCUS_SPEED: number = 4.6;
const TRANSITION_EPSILON: number = 0.015;

export function GalaxyCamera(
  props: GalaxyCameraProps,
): React.ReactElement {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const camera = useThree((state) => state.camera);
  const focusTargetRef = useRef<Vector3>(DEFAULT_TARGET.clone());
  const focusCameraRef = useRef<Vector3>(camera.position.clone());
  const isTransitioningRef = useRef<boolean>(false);

  useEffect((): void => {
    const nextTarget: Vector3 = props.selectedPosition === null
      ? DEFAULT_TARGET.clone()
      : new Vector3(...props.selectedPosition);
    const direction: Vector3 = camera.position
      .clone()
      .sub(nextTarget)
      .normalize();

    focusTargetRef.current.copy(nextTarget);
    focusCameraRef.current.copy(props.selectedPosition === null
      ? DEFAULT_CAMERA_POSITION
      : nextTarget.clone().add(
        direction.multiplyScalar(FOCUS_DISTANCE),
      ));
    isTransitioningRef.current = true;
  }, [camera, props.selectedPosition]);

  useFrame((_, delta: number): void => {
    const controls: OrbitControlsImpl | null = controlsRef.current;
    if (controls === null || !isTransitioningRef.current) {
      return;
    }

    const interpolation: number = 1 - Math.exp(-FOCUS_SPEED * delta);
    camera.position.lerp(focusCameraRef.current, interpolation);
    controls.target.lerp(focusTargetRef.current, interpolation);
    controls.update();

    const cameraRemaining: number = camera.position.distanceTo(
      focusCameraRef.current,
    );
    const targetRemaining: number = controls.target.distanceTo(
      focusTargetRef.current,
    );
    if (
      cameraRemaining < TRANSITION_EPSILON
      && targetRemaining < TRANSITION_EPSILON
    ) {
      camera.position.copy(focusCameraRef.current);
      controls.target.copy(focusTargetRef.current);
      controls.update();
      isTransitioningRef.current = false;
    }
  });

  return (
    <OrbitControls
      autoRotate={false}
      enableDamping
      enablePan={false}
      maxDistance={18}
      minDistance={2.4}
      ref={controlsRef}
      rotateSpeed={0.65}
      zoomSpeed={0.8}
    />
  );
}
