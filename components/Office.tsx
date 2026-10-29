"use client";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { CanvasTexture } from "three";
import type { Group } from "three";
import type { AgentRuntime, AgentStatus } from "../src/agents/dashboard.ts";

const COLOR: Record<AgentStatus, string> = { trabalhando: "#35c07f", simulado: "#4c8dff", alerta: "#d9a441", ocioso: "#6b7a90", pausado: "#ff6b6b", em_espera: "#4b5563" };

export interface Screen { title: string; lines: Array<{ label: string; value: string; tone?: "good" | "bad" | "neutral" }>; }

function Desk({ agent, selected, onSelect }: { agent: AgentRuntime; selected: boolean; onSelect: (id: number) => void }) {
  const idx = agent.id - 1;
  const x = ((idx % 5) - 2) * 2.4;
  const z = (Math.floor(idx / 5) - 2) * 2.5 + 1;
  const body = useRef<Group>(null);
  useFrame(({ clock }) => { if (body.current && agent.status === "trabalhando") body.current.position.y = Math.sin(clock.elapsedTime * 3 + agent.id) * 0.03; });
  const color = COLOR[agent.status] ?? "#6b7a90";
  return (
    <group position={[x, 0, z]} onClick={(e) => { e.stopPropagation(); onSelect(agent.id); }}>
      <mesh position={[0, 0.7, 0]}><boxGeometry args={[1.7, 0.08, 0.9]} /><meshStandardMaterial color="#1b2740" /></mesh>
      <mesh position={[0, 0.98, -0.25]}><boxGeometry args={[0.7, 0.45, 0.05]} /><meshStandardMaterial color="#0f172a" emissive={color} emissiveIntensity={agent.status === "trabalhando" ? 0.6 : 0.18} /></mesh>
      <group ref={body} position={[0, 0, 0.75]}>
        <mesh position={[0, 0.85, 0]}><capsuleGeometry args={[0.2, 0.45, 4, 12]} /><meshStandardMaterial color={color} /></mesh>
        <mesh position={[0, 1.42, 0]}><sphereGeometry args={[0.2, 16, 16]} /><meshStandardMaterial color={color} /></mesh>
      </group>
      {selected && (<mesh position={[0, 0.02, 0.2]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.0, 1.15, 32]} /><meshBasicMaterial color="#ffffff" /></mesh>)}
    </group>
  );
}

function Wall({ screen }: { screen: Screen }) {
  const texture = useMemo(() => {
    const W = 1024, H = 512;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "#06101f"; g.fillRect(0, 0, W, H);
      g.fillStyle = "#0b1a30"; g.fillRect(10, 10, W - 20, H - 20);
      g.fillStyle = "#4c8dff"; g.fillRect(10, 10, W - 20, 70);
      g.fillStyle = "#fff"; g.font = "bold 40px system-ui, sans-serif"; g.textBaseline = "middle"; g.fillText(screen.title, 32, 46);
      g.font = "32px system-ui, sans-serif";
      screen.lines.slice(0, 6).forEach((ln, i) => {
        const y = 128 + i * 60;
        g.fillStyle = "#9fb3cc"; g.textAlign = "left"; g.fillText(ln.label, 32, y);
        g.fillStyle = ln.tone === "good" ? "#35c07f" : ln.tone === "bad" ? "#ff6b66" : "#eaf1fb";
        g.font = "bold 34px system-ui, sans-serif"; g.textAlign = "right"; g.fillText(ln.value, W - 32, y);
        g.font = "32px system-ui, sans-serif";
      });
      g.textAlign = "left";
    }
    return new CanvasTexture(c);
  }, [screen]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group position={[0, 0, -8.5]}>
      <mesh position={[0, 2.4, -0.2]}><boxGeometry args={[12, 5.2, 0.2]} /><meshStandardMaterial color="#0a1524" /></mesh>
      <mesh position={[0, 3, 0]}><planeGeometry args={[7, 3.5]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>
    </group>
  );
}

function Rig() {
  const camera = useThree((t) => t.camera);
  const size = useThree((t) => t.size);
  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const k = aspect < 1.3 ? 1.3 / aspect : 1;
    camera.position.set(0, 9.5 * k, 12 * k);
    camera.lookAt(0, 0.5, -1);
  }, [camera, size.width, size.height]);
  return null;
}

export default function Office(props: { agents: AgentRuntime[]; screen: Screen; selectedId: number | null; onSelect: (id: number) => void }) {
  return (
    <Canvas camera={{ position: [0, 9.5, 12], fov: 50 }} dpr={[1, 2]}>
      <color attach="background" args={["#070d18"]} />
      <fog attach="fog" args={["#070d18", 18, 34]} />
      <Rig />
      <ambientLight intensity={0.6} />
      <hemisphereLight args={["#2a3d5c", "#0a0f18", 0.6]} />
      <directionalLight position={[6, 12, 6]} intensity={1.0} />
      <pointLight position={[0, 6, -7]} intensity={40} color="#4c8dff" distance={22} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}><planeGeometry args={[34, 28]} /><meshStandardMaterial color="#0f1826" roughness={0.9} /></mesh>
      <gridHelper args={[34, 34, "#1b2b44", "#132032"]} />
      <Wall screen={props.screen} />
      {props.agents.map((a) => (<Desk key={a.id} agent={a} selected={props.selectedId === a.id} onSelect={props.onSelect} />))}
      <OrbitControls enablePan={false} minDistance={6} maxDistance={40} maxPolarAngle={Math.PI / 2.1} target={[0, 0.5, -1]} />
    </Canvas>
  );
}
