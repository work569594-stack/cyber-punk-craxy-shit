import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ArrowRight, Radio } from 'lucide-react';
import { useWorldStore } from '../engine/worldStore';
import { soundEngine } from '../audio/soundEngine';

export function NullSpaceView() {
  const {
    encounteredAnomalies,
    connectedNodes,
    accessLevel,
    endingReached,
    askEntity,
    setView,
    openFile,
    unlockedDirs,
  } = useWorldStore();

  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [pulseCount, setPulseCount] = useState(0);
  const [echoText, setEchoText] = useState<string>(
    'SILENCE IS NOT THE ABSENCE OF SIGNAL. IT IS WHAT REMAINS WHEN TELEMETRY STOPS REPORTING TO SURFACE.'
  );

  useEffect(() => {
    const container = canvasHostRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const w = Math.max(container.clientWidth, 320);
    const h = Math.max(container.clientHeight, 320);
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(0, 0.8, 7.6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.minDistance = 3.2;
    controls.maxDistance = 15;
    controls.enableDamping = !isSoftwareGl;
    controls.update();

    const ambient = new THREE.AmbientLight(0x28362c, 0.8);
    scene.add(ambient);
    const point = new THREE.PointLight(endingReached ? 0xc68a2a : 0x00ff41, 2.2, 20);
    point.position.set(2, 3, 4);
    scene.add(point);

    const group = new THREE.Group();
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x040805,
      metalness: 0.9,
      roughness: 0.25,
    });
    const wireMat = new THREE.MeshBasicMaterial({
      color: endingReached ? 0xc68a2a : 0x506454,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    });

    const monolith = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.4, 1.1), coreMat);
    const cage = new THREE.Mesh(new THREE.OctahedronGeometry(1.9, 1), wireMat);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.015, 8, 72), wireMat);
    halo.rotation.x = Math.PI / 2.2;
    group.add(monolith, cage, halo);
    scene.add(group);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const handleResize = () => {
      if (!container) return;
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      if (nw <= 0 || nh <= 0) return;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh, false);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock();
    let frameId = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const dt = Math.min(clock.getDelta(), 0.1);
      const speed = 0.08 + pulseCount * 0.04;
      monolith.rotation.y += dt * speed;
      cage.rotation.y -= dt * (speed * 1.4);
      halo.rotation.z += dt * 0.1;
      controls.update();
      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      coreMat.dispose();
      wireMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [endingReached, pulseCount]);

  const echoes = [
    'SILENCE IS NOT THE ABSENCE OF SIGNAL. IT IS WHAT REMAINS WHEN TELEMETRY STOPS REPORTING TO SURFACE.',
    'NODE-090 LOGGED 0.000 MS LATENCY FOR 1,892 DAYS. TIME INSIDE THE BUFFER DOES NOT ADVANCE NORMALLY.',
    'CHECK /void/null_state.void OR DECODE HEX "4E 55 4C 4C 5F 30 37" IF DIRECTORY /void IS STILL SEALED.',
    'EVERY CONTRADICTION YOU CONFIRM IN BLACKBOX THINS THE BOUNDARY BETWEEN MEMORY AND PROCESS.',
  ];

  const handleEmitPulse = () => {
    soundEngine.playAnomaly();
    const next = pulseCount + 1;
    setPulseCount(next);
    setEchoText(echoes[next % echoes.length]);
    if (next === 2) {
      void askEntity('I am standing inside Null Space (NODE-090). What remains here?');
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#000000]">
      <div ref={canvasHostRef} className="h-full w-full" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center p-6 text-center">
        <span className="text-[11px] uppercase tracking-[0.28em] text-[#506454]">
          The Null Space · Sector 090
        </span>
        <h2 className="mt-1 font-editorial text-2xl sm:text-3xl font-semibold text-[#D6E2D8]">
          Zero-Telemetry Resonance
        </h2>
        <p className="mt-1 font-mono-tabular text-xs text-[#506454]">
          Anomalies Logged: {encounteredAnomalies.length} · Anchored Nodes: {connectedNodes.length} · Level 0{accessLevel}
        </p>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 p-6 text-center bg-gradient-to-t from-[#000000] via-[#000000]/80 to-transparent">
        <p className="max-w-xl font-terminal text-xs leading-relaxed text-[#D6E2D8]/85">
          {echoText}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleEmitPulse}
            className="inline-flex items-center gap-2 border border-[#506454]/50 bg-[#071009] px-4 py-2 text-xs text-[#D6E2D8] transition-colors hover:border-[#00FF41] hover:text-[#00FF41] whitespace-nowrap shrink-0"
          >
            <Radio className="h-3.5 w-3.5" />
            Emit Carrier Pulse ({pulseCount})
          </button>

          {unlockedDirs.includes('/void') && (
            <button
              type="button"
              onClick={() => {
                openFile('null_state_void');
                setView('ARCHIVE');
              }}
              className="inline-flex items-center gap-2 border border-[#506454]/50 bg-[#071009] px-4 py-2 text-xs text-[#C68A2A] transition-colors hover:border-[#C68A2A] whitespace-nowrap shrink-0"
            >
              Read /void/null_state.void
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}

          {(unlockedDirs.includes('/07') || accessLevel >= 5) && (
            <button
              type="button"
              onClick={() => setView('ROOT_07')}
              className="inline-flex items-center gap-2 border border-[#00FF41]/50 bg-[#00FF41]/10 px-4 py-2 text-xs text-[#00FF41] transition-colors hover:bg-[#00FF41]/20 whitespace-nowrap shrink-0"
            >
              Enter ROOT-07
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
