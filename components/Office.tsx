"use client";
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import type { Group } from "three";
import type { AgentRuntime, AgentStatus } from "../src/agents/cycle.ts";

export const STATUS_COLOR: Record<AgentStatus, string> = {
  trabalhando: "#2fbf71",
  alerta: "#f2a93b",
  ocioso: "#7a8aa0",
  pausado_risco: "#e5484d",
  em_espera: "#4b5563",
};

function Desk({ agent, selected, onSelect }: { agent: AgentRuntime; selected: boolean; onSelect: (id: number) => void }) {
  const idx = agent.id - 1;
  const x = ((idx % 5) - 2) * 2.4;
  const z = (Math.floor(idx / 5) - 1) * 2.6 + 1.5;
  const body = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (body.current && agent.status === "trabalhando") body.current.position.y = Math.sin(clock.elapsedTime * 3 + agent.id) * 0.03;
  });
  const color = STATUS_COLOR[agent.status];
  return (
    <group position={[x, 0, z]} onClick={(e) => { e.stopPropagation(); onSelect(agent.id); }}>
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[1.7, 0.08, 0.9]} />
        <meshStandardMaterial color="#8a6a4a" />
      </mesh>
      <mesh position={[0, 0.98, -0.25]}>
        <boxGeometry args={[0.7, 0.45, 0.05]} />
        <meshStandardMaterial color="#0f172a" emissive={color} emissiveIntensity={agent.status === "trabalhando" ? 0.6 : 0.15} />
      </mesh>
      <group ref={body} position={[0, 0, 0.75]}>
        <mesh position={[0, 0.85, 0]}>
          <capsuleGeometry args={[0.2, 0.45, 4, 12]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[0, 1.42, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
      {selected && (
        <mesh position={[0, 0.02, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.0, 1.15, 32]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
      <Html position={[0, 1.95, 0.75]} center distanceFactor={10} style={{ pointerEvents: "none" }}>
        <div style={{ background: "rgba(0,0,0,.65)", color: "#fff", padding: "1px 6px", borderRadius: 6, fontSize: 11, whiteSpace: "nowrap" }}>
          {agent.id}
        </div>
      </Html>
    </group>
  );
}

function ServerRoom({ label }: { label: string }) {
  return (
    <group position={[0, 0, -5.5]}>
      {[-3, -1.5, 0, 1.5, 3].map((x) => (
        <mesh key={x} position={[x, 1, 0]}>
          <boxGeometry args={[1.1, 2, 0.9]} />
          <meshStandardMaterial color="#1f2937" emissive="#1b6ef3" emissiveIntensity={0.25} />
        </mesh>
      ))}
      <Html position={[0, 2.6, 0]} center distanceFactor={12}>
        <div style={{ background: "rgba(0,0,0,.7)", color: "#cfe1ff", padding: "4px 10px", borderRadius: 8, fontSize: 13, whiteSpace: "nowrap" }}>
          Sala de servidores · {label}
        </div>
      </Html>
    </group>
  );
}

export default function Office(props: { agents: AgentRuntime[]; hashrateLabel: string; selectedId: number | null; onSelect: (id: number) => void }) {
  return (
    <Canvas camera={{ position: [0, 8.5, 11], fov: 50 }} dpr={[1, 2]}>
      <color attach="background" args={["#0b1220"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[6, 10, 6]} intensity={1.1} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[30, 22]} />
        <meshStandardMaterial color="#16202e" />
      </mesh>
      <ServerRoom label={props.hashrateLabel} />
      {props.agents.map((a) => (
        <Desk key={a.id} agent={a} selected={props.selectedId === a.id} onSelect={props.onSelect} />
      ))}
      <OrbitControls enablePan={false} minDistance={6} maxDistance={22} maxPolarAngle={Math.PI / 2.1} target={[0, 0.8, 0]} />
    </Canvas>
  );
}
