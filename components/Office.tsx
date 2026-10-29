"use client";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { CanvasTexture } from "three";
import type { Group } from "three";
import type { AgentRuntime, AgentStatus } from "../src/agents/cycle.ts";

export const STATUS_COLOR: Record<AgentStatus, string> = {
  trabalhando: "#2fbf71",
  alerta: "#f2a93b",
  ocioso: "#7a8aa0",
  pausado_risco: "#e5484d",
  em_espera: "#4b5563",
};

/** Rótulo desenhado no próprio 3D (sem DOM), para desmontar limpo ao trocar de aba. */
function Label({ text, position, width = 0.9, px = 256 }: { text: string; position: [number, number, number]; width?: number; px?: number }) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = px;
    c.height = 96;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "rgba(0,0,0,0.72)";
      g.fillRect(0, 0, px, 96);
      g.fillStyle = "#ffffff";
      let size = 52;
      g.font = `bold ${size}px system-ui, sans-serif`;
      while (g.measureText(text).width > px - 24 && size > 14) {
        size -= 2;
        g.font = `bold ${size}px system-ui, sans-serif`;
      }
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, px / 2, 50);
    }
    return new CanvasTexture(c);
  }, [text, px]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={[width, (width * 96) / px, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

function Desk({ agent, selected, onSelect }: { agent: AgentRuntime; selected: boolean; onSelect: (id: number) => void }) {
  const idx = agent.id - 1;
  const x = ((idx % 5) - 2) * 2.4;
  const z = (Math.floor(idx / 5) - 2) * 2.5 + 1;
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
      <Label text={String(agent.id)} position={[0, 2.0, 0.75]} width={0.55} px={128} />
    </group>
  );
}

function ServerRoom({ label }: { label: string }) {
  return (
    <group position={[0, 0, -8.5]}>
      {[-3, -1.5, 0, 1.5, 3].map((x) => (
        <mesh key={x} position={[x, 1, 0]}>
          <boxGeometry args={[1.1, 2, 0.9]} />
          <meshStandardMaterial color="#1f2937" emissive="#1b6ef3" emissiveIntensity={0.25} />
        </mesh>
      ))}
      <Label text={`Sala de servidores · ${label}`} position={[0, 2.6, 0]} width={5.2} px={1024} />
    </group>
  );
}

/** Afasta a câmera em telas estreitas (celular) para caber as 5 colunas de mesas. */
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

export default function Office(props: { agents: AgentRuntime[]; hashrateLabel: string; selectedId: number | null; onSelect: (id: number) => void }) {
  return (
    <Canvas camera={{ position: [0, 9.5, 12], fov: 50 }} dpr={[1, 2]}>
      <color attach="background" args={["#0b1220"]} />
      <Rig />
      <ambientLight intensity={0.8} />
      <directionalLight position={[6, 10, 6]} intensity={1.1} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[34, 28]} />
        <meshStandardMaterial color="#16202e" />
      </mesh>
      <ServerRoom label={props.hashrateLabel} />
      {props.agents.map((a) => (
        <Desk key={a.id} agent={a} selected={props.selectedId === a.id} onSelect={props.onSelect} />
      ))}
      <OrbitControls enablePan={false} minDistance={6} maxDistance={40} maxPolarAngle={Math.PI / 2.1} target={[0, 0.5, -1]} />
    </Canvas>
  );
}
