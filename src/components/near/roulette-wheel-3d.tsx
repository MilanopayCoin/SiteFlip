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

function makeLabelTexture(num: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(num), 32, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
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
    duration: 8000,
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const textures: THREE.CanvasTexture[] = [];
    const w = Math.max(280, mount.clientWidth || 320);
    const h = Math.max(280, mount.clientHeight || 320);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    // Centered framing — wheel fully in view on narrow phones
    camera.position.set(0, 3.4, 3.5);
    camera.lookAt(0, 0.05, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.SpotLight(0xffe566, 1.25, 30, 0.55, 0.35);
    key.position.set(1.5, 5.5, 2.5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x88ccff, 0.3);
    fill.position.set(-3, 2, -1);
    scene.add(fill);

    const root = new THREE.Group();
    root.rotation.x = -Math.PI / 2.45;
    scene.add(root);

    const wheel = new THREE.Group();
    root.add(wheel);
    wheelRef.current = wheel;

    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(1.55, 1.7, 0.32, 64, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x5c3a1e,
        metalness: 0.2,
        roughness: 0.7,
        side: THREE.DoubleSide,
      })
    );
    bowl.rotation.x = Math.PI / 2;
    bowl.position.z = -0.14;
    root.add(bowl);

    wheel.add(
      new THREE.Mesh(
        new THREE.TorusGeometry(1.32, 0.065, 12, 72),
        new THREE.MeshStandardMaterial({
          color: 0xd4af37,
          metalness: 0.9,
          roughness: 0.22,
        })
      )
    );
    wheel.add(
      new THREE.Mesh(
        new THREE.TorusGeometry(0.36, 0.035, 10, 40),
        new THREE.MeshStandardMaterial({
          color: 0xd4af37,
          metalness: 0.85,
          roughness: 0.25,
        })
      )
    );

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.26, 0.16, 24),
      new THREE.MeshStandardMaterial({
        color: 0xf0e6c8,
        metalness: 0.7,
        roughness: 0.3,
      })
    );
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);

    const felt = new THREE.Mesh(
      new THREE.CircleGeometry(1.45, 64),
      new THREE.MeshStandardMaterial({
        color: 0x0b3d28,
        roughness: 0.92,
        metalness: 0.04,
      })
    );
    felt.position.z = -0.05;
    root.add(felt);

    const seg = (Math.PI * 2) / ORDER.length;
    ORDER.forEach((num, i) => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.absarc(0, 0, 1.2, i * seg + 0.008, (i + 1) * seg - 0.008, false);
      shape.lineTo(0, 0);
      const mesh = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshStandardMaterial({
          color: segColor(num),
          metalness: 0.12,
          roughness: 0.55,
          side: THREE.DoubleSide,
        })
      );
      mesh.position.z = 0.03;
      wheel.add(mesh);

      const tex = makeLabelTexture(num);
      textures.push(tex);
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(0.13, 0.13),
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
        })
      );
      const mid = i * seg + seg / 2;
      const r = 0.98;
      label.position.set(Math.cos(mid) * r, Math.sin(mid) * r, 0.055);
      label.rotation.z = mid + Math.PI / 2;
      wheel.add(label);
    });

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xf8f5ef,
        metalness: 0.35,
        roughness: 0.35,
      })
    );
    ball.position.set(1.05, 0, 0.12);
    wheel.add(ball);

    const syncSize = () => {
      const nw = Math.max(200, mount.clientWidth);
      const nh = Math.max(200, mount.clientHeight);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh, false);
    };
    const ro = new ResizeObserver(syncSize);
    ro.observe(mount);

    const tick = (t: number) => {
      animRef.current = requestAnimationFrame(tick);
      const st = spinState.current;
      if (st.active) {
        const p = Math.min(1, (t - st.start) / st.duration);
        const ease = 1 - Math.pow(1 - p, 3.2);
        wheel.rotation.z = st.from + (st.to - st.from) * ease;
        const ballSpin = -wheel.rotation.z * 1.55 + (1 - ease) * Math.PI * 14;
        const br = 1.1 - ease * 0.2;
        ball.position.x = Math.cos(ballSpin) * br;
        ball.position.y = Math.sin(ballSpin) * br;
        ball.position.z = 0.12 + Math.sin(ease * Math.PI) * 0.04;
        if (p >= 1) st.active = false;
      } else {
        wheel.rotation.z += 0.0012;
      }
      renderer.render(scene, camera);
    };
    animRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      wheelRef.current = null;
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
      style={{
        width: "100%",
        height: "100%",
        minHeight: 240,
        overflow: "hidden",
      }}
    />
  );
}
