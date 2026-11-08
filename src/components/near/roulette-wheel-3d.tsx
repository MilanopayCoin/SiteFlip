"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  EUROPEAN_WHEEL_ORDER,
  ROULETTE_REDS,
} from "@/lib/near/roulette";

const ORDER = [...EUROPEAN_WHEEL_ORDER];

function segColor(n: number): number {
  if (n === 0) return 0x0f7a3a;
  return ROULETTE_REDS.has(n) ? 0xc41e1e : 0x0a0a0a;
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
  const ballRef = useRef<THREE.Mesh | null>(null);
  const animRef = useRef<number>(0);
  const spinState = useRef({
    active: false,
    start: 0,
    from: 0,
    to: 0,
    duration: 8000,
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth || 360;
    const h = mount.clientHeight || 360;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 100);
    camera.position.set(0, 3.1, 3.6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const key = new THREE.SpotLight(0xffe566, 1.4, 30, 0.55, 0.35);
    key.position.set(2.5, 6, 3);
    scene.add(key);
    const rimL = new THREE.DirectionalLight(0x88ccff, 0.35);
    rimL.position.set(-4, 2, -2);
    scene.add(rimL);

    const root = new THREE.Group();
    root.rotation.x = -Math.PI / 2.35;
    scene.add(root);

    const wheel = new THREE.Group();
    root.add(wheel);
    wheelRef.current = wheel;

    // Wood bowl
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(1.7, 1.85, 0.35, 64, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x5c3a1e,
        metalness: 0.2,
        roughness: 0.7,
        side: THREE.DoubleSide,
      })
    );
    bowl.rotation.x = Math.PI / 2;
    bowl.position.z = -0.15;
    root.add(bowl);

    const outerRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.42, 0.07, 14, 80),
      new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.9,
        roughness: 0.22,
      })
    );
    wheel.add(outerRim);

    const innerRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.04, 12, 48),
      new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.85,
        roughness: 0.25,
      })
    );
    wheel.add(innerRim);

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.28, 0.18, 28),
      new THREE.MeshStandardMaterial({
        color: 0xf0e6c8,
        metalness: 0.7,
        roughness: 0.3,
      })
    );
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);

    const felt = new THREE.Mesh(
      new THREE.CircleGeometry(1.55, 72),
      new THREE.MeshStandardMaterial({
        color: 0x0b3d28,
        roughness: 0.92,
        metalness: 0.04,
      })
    );
    felt.position.z = -0.05;
    root.add(felt);

    const seg = (Math.PI * 2) / ORDER.length;
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;

    ORDER.forEach((num, i) => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.absarc(0, 0, 1.28, i * seg + 0.01, (i + 1) * seg - 0.01, false);
      shape.lineTo(0, 0);
      const geo = new THREE.ShapeGeometry(shape);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: segColor(num),
          metalness: 0.12,
          roughness: 0.55,
          side: THREE.DoubleSide,
        })
      );
      mesh.position.z = 0.03;
      wheel.add(mesh);

      // Number label sprite-like plane
      ctx.clearRect(0, 0, 64, 64);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(num), 32, 32);
      const tex = new THREE.CanvasTexture(canvas);
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(0.14, 0.14),
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
        })
      );
      const mid = i * seg + seg / 2;
      const r = 1.05;
      label.position.set(Math.cos(mid) * r, Math.sin(mid) * r, 0.06);
      label.rotation.z = mid + Math.PI / 2;
      wheel.add(label);
    });

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 20, 20),
      new THREE.MeshStandardMaterial({
        color: 0xf8f5ef,
        metalness: 0.35,
        roughness: 0.35,
      })
    );
    ball.position.set(1.12, 0, 0.14);
    wheel.add(ball);
    ballRef.current = ball;

    const onResize = () => {
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
        const ease = 1 - Math.pow(1 - p, 3.2);
        wheel.rotation.z = st.from + (st.to - st.from) * ease;
        const ballSpin = -wheel.rotation.z * 1.55 + (1 - ease) * Math.PI * 14;
        const br = 1.18 - ease * 0.22;
        ball.position.x = Math.cos(ballSpin) * br;
        ball.position.y = Math.sin(ballSpin) * br;
        ball.position.z = 0.14 + Math.sin(ease * Math.PI) * 0.05;
        if (p >= 1) st.active = false;
      } else {
        wheel.rotation.z += 0.0015;
      }
      renderer.render(scene, camera);
    };
    animRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      wheelRef.current = null;
      ballRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!spinning || targetNumber == null || !wheelRef.current) return;
    const idx = ORDER.indexOf(targetNumber as (typeof ORDER)[number]);
    if (idx < 0) return;
    const seg = (Math.PI * 2) / ORDER.length;
    const targetAngle = -idx * seg - seg / 2;
    const wheel = wheelRef.current;
    const from = wheel.rotation.z;
    const turns = Math.PI * 2 * 7;
    const delta =
      ((targetAngle - from) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    spinState.current = {
      active: true,
      start: performance.now(),
      from,
      to: from + turns + delta,
      duration: 8200,
    };
  }, [spinning, targetNumber]);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ width: "100%", height: "100%", minHeight: 300 }}
    />
  );
}
