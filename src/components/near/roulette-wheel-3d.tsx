"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { ROULETTE_REDS } from "@/lib/near/roulette";

/** European order around the wheel (simplified visual layout 0..36). */
const ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

function segColor(n: number): number {
  if (n === 0) return 0x1a7a3a;
  return ROULETTE_REDS.has(n) ? 0xb91c1c : 0x141414;
}

export function RouletteWheel3D({
  targetNumber,
  spinning,
  className,
}: {
  targetNumber: number | null;
  spinning: boolean;
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<THREE.Group | null>(null);
  const animRef = useRef<number>(0);
  const spinState = useRef({
    active: false,
    start: 0,
    from: 0,
    to: 0,
    duration: 7000,
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth || 320;
    const h = mount.clientHeight || 320;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    camera.position.set(0, 2.6, 3.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);
    const spot = new THREE.SpotLight(0xd4ff3a, 1.2, 20, 0.5, 0.4);
    spot.position.set(2, 5, 3);
    scene.add(spot);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
    fill.position.set(-3, 2, -2);
    scene.add(fill);

    const wheel = new THREE.Group();
    wheel.rotation.x = -Math.PI / 2.4;
    scene.add(wheel);
    wheelRef.current = wheel;

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.08, 12, 64),
      new THREE.MeshStandardMaterial({
        color: 0xc4a35a,
        metalness: 0.8,
        roughness: 0.25,
      })
    );
    wheel.add(rim);

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.12, 24),
      new THREE.MeshStandardMaterial({
        color: 0xd4ff3a,
        metalness: 0.6,
        roughness: 0.3,
      })
    );
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);

    const seg = (Math.PI * 2) / ORDER.length;
    ORDER.forEach((num, i) => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.absarc(0, 0, 1.25, i * seg, (i + 1) * seg, false);
      shape.lineTo(0, 0);
      const geo = new THREE.ShapeGeometry(shape);
      const mat = new THREE.MeshStandardMaterial({
        color: segColor(num),
        metalness: 0.15,
        roughness: 0.65,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.z = 0.02;
      wheel.add(mesh);
    });

    const felt = new THREE.Mesh(
      new THREE.CircleGeometry(1.55, 64),
      new THREE.MeshStandardMaterial({
        color: 0x0b3d2e,
        roughness: 0.9,
        metalness: 0.05,
      })
    );
    felt.position.z = -0.04;
    wheel.add(felt);

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xf5f5f4,
        metalness: 0.3,
        roughness: 0.4,
      })
    );
    ball.position.set(1.05, 0, 0.12);
    wheel.add(ball);

    const onResize = () => {
      if (!mount) return;
      const nw = mount.clientWidth;
      const nh = mount.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    const tick = (t: number) => {
      animRef.current = requestAnimationFrame(tick);
      const st = spinState.current;
      if (st.active) {
        const p = Math.min(1, (t - st.start) / st.duration);
        const ease = 1 - Math.pow(1 - p, 3);
        wheel.rotation.z = st.from + (st.to - st.from) * ease;
        const ballAngle = -wheel.rotation.z * 1.35 + p * Math.PI * 10;
        ball.position.x = Math.cos(ballAngle) * (1.05 - p * 0.15);
        ball.position.y = Math.sin(ballAngle) * (1.05 - p * 0.15);
        if (p >= 1) st.active = false;
      } else {
        wheel.rotation.z += 0.002;
      }
      renderer.render(scene, camera);
    };
    animRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      wheelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!spinning || targetNumber == null || !wheelRef.current) return;
    const idx = ORDER.indexOf(targetNumber);
    if (idx < 0) return;
    const seg = (Math.PI * 2) / ORDER.length;
    const targetAngle = -idx * seg - seg / 2;
    const wheel = wheelRef.current;
    const from = wheel.rotation.z;
    const turns = Math.PI * 2 * 6;
    let delta = ((targetAngle - from) % (Math.PI * 2) + Math.PI * 2) %
      (Math.PI * 2);
    spinState.current = {
      active: true,
      start: performance.now(),
      from,
      to: from + turns + delta,
      duration: 7000,
    };
  }, [spinning, targetNumber]);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ width: "100%", height: "100%", minHeight: 280 }}
    />
  );
}
