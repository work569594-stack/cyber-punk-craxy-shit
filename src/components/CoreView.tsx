import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ArrowRight, Compass, FileSearch, Minus, Network, Plus, RotateCcw, ShieldAlert } from 'lucide-react';
import { ACCESS_LEVELS, ALL_FILES, EVIDENCE_ITEMS, OPERATIONS } from '../data/universeData';
import { useWorldStore } from '../engine/worldStore';

const _vec3 = new THREE.Vector3();
const DEFAULT_CAM_POS = new THREE.Vector3(0, 1.5, 9.8);
const DEFAULT_TARGET = new THREE.Vector3(0, -0.15, 0);

export function CoreView() {
  const {
    accessLevel,
    sessionId,
    connectedNodes,
    discoveredNodes,
    openedFiles,
    recoveredEvidence,
    evidenceConnections,
    completedMissions,
    setView,
    openFile,
    executeCommand,
    pushNotification,
    overrides,
  } = useWorldStore();

  const canvasHostRef = useRef<HTMLDivElement>(null);
  const zoomActionRef = useRef<((action: 'in' | 'out' | 'reset') => void) | null>(null);
  const [webglLost, setWebglLost] = useState(false);
  const [symbolInspected, setSymbolInspected] = useState(false);

  const tier = ACCESS_LEVELS[accessLevel] ?? ACCESS_LEVELS[0];
  const contradictions = evidenceConnections.filter((c) => c.status === 'CONTRADICTION').length;
  const activeOp = OPERATIONS.find((o) => !completedMissions.includes(o.id)) ?? OPERATIONS[OPERATIONS.length - 1];

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
    scene.background = new THREE.Color(0x020403);
    scene.fog = new THREE.FogExp2(0x020403, 0.045);

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 320);
    const aspect = width / height;
    const camera = new THREE.PerspectiveCamera(44, aspect, 0.1, 100);
    // Pull back slightly on narrow screens so entire sculpture fits cleanly inside viewport
    const initialDistScale = aspect < 1 ? 1.28 : 1;
    camera.position.copy(DEFAULT_CAM_POS).multiplyScalar(initialDistScale);
    camera.lookAt(DEFAULT_TARGET);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.outline = 'none';
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(DEFAULT_TARGET);
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 3.8;
    controls.maxDistance = 20;
    controls.zoomSpeed = 0.9;
    controls.update();

    zoomActionRef.current = (action) => {
      if (action === 'reset') {
        const curAspect = camera.aspect || 1;
        const scale = curAspect < 1 ? 1.28 : 1;
        camera.position.copy(DEFAULT_CAM_POS).multiplyScalar(scale);
        controls.target.copy(DEFAULT_TARGET);
        controls.update();
        return;
      }
      const offset = camera.position.clone().sub(controls.target);
      const factor = action === 'in' ? 0.78 : 1.28;
      const nextLen = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
      offset.setLength(nextLen);
      camera.position.copy(controls.target).add(offset);
      controls.update();
    };

    const hemi = new THREE.HemisphereLight(0x1f4d2e, 0x020403, 0.8);
    scene.add(hemi);
    const keyLight = new THREE.DirectionalLight(0x00ff41, 1.4);
    keyLight.position.set(4, 6, 4);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xc68a2a, 0.8);
    rimLight.position.set(-5, -2, -4);
    scene.add(rimLight);

    // Composite 7-part Continuity Core sculpture centered cleanly around DEFAULT_TARGET
    const coreGroup = new THREE.Group();

    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x0b1610,
      metalness: 0.85,
      roughness: 0.28,
    });
    const phosphorMat = new THREE.MeshStandardMaterial({
      color: 0x00ff41,
      emissive: 0x00ff41,
      emissiveIntensity: 0.55,
      metalness: 0.3,
      roughness: 0.35,
      wireframe: true,
    });
    const amberRingMat = new THREE.MeshStandardMaterial({
      color: 0xc68a2a,
      emissive: 0x3b2404,
      metalness: 0.9,
      roughness: 0.2,
    });

    const innerOcta = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), darkMetal);
    const wireShell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.38, 1), phosphorMat);
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.03, 12, 64), amberRingMat);
    ringA.rotation.x = Math.PI / 3;
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.02, 12, 64), darkMetal);
    ringB.rotation.y = Math.PI / 4;
    const ringC = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.015, 10, 64), phosphorMat);
    ringC.rotation.x = -Math.PI / 5;

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.35, 0.22, 24), darkMetal);
    pedestal.position.y = -2.2;

    coreGroup.add(innerOcta, wireShell, ringA, ringB, ringC, pedestal);
    scene.add(coreGroup);

    // Subtle floating particles
    const pCount = 160;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      _vec3.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 10);
      pPos[i * 3] = _vec3.x;
      pPos[i * 3 + 1] = _vec3.y;
      pPos[i * 3 + 2] = _vec3.z;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x00ff41, size: 0.045, transparent: true, opacity: 0.5 });
    const points = new THREE.Points(pGeo, pMat);
    scene.add(points);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglLost(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const syncSize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(container);
    window.addEventListener('resize', syncSize);

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
      innerOcta.rotation.y += dt * 0.35;
      wireShell.rotation.y -= dt * 0.2;
      wireShell.rotation.x += dt * 0.12;
      ringA.rotation.z += dt * 0.25;
      ringB.rotation.x -= dt * 0.18;
      ringC.rotation.y += dt * 0.15;
      points.rotation.y += dt * 0.03;

      controls.update();
      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      zoomActionRef.current = null;
      resizeObserver.disconnect();
      window.removeEventListener('resize', syncSize);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      pGeo.dispose();
      pMat.dispose();
      darkMetal.dispose();
      phosphorMat.dispose();
      amberRingMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handleHiddenSymbolClick = () => {
    setSymbolInspected(true);
    pushNotification({
      title: 'HIDDEN IDENTIFIER REVEALED',
      message: 'Symbol 07-ALPHA resolved to target fragment_04 in /ghostnet. Search `NODE-017` or decode in Observatory.',
      severity: 'ANOMALY',
    });
    executeCommand('find fragment_04');
  };

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-12 gap-0 overflow-y-auto overflow-x-hidden bg-[#020403]">
      {/* Central 3D Continuity Core Stage */}
      <div className="relative lg:col-span-7 flex flex-col h-[420px] lg:h-full min-h-0 overflow-hidden border-b lg:border-b-0 lg:border-r border-[#506454]/25 bg-[#000000]">
        <div ref={canvasHostRef} className="relative h-full w-full flex-1 overflow-hidden cursor-grab active:cursor-grabbing" />
        {webglLost && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#020403] text-xs text-[#506454]">
            WebGL context suspended. Core telemetry continues in sidebar.
          </div>
        )}

        {/* Restrained Top-Left Overlay */}
        <div className="pointer-events-none absolute left-5 top-5 space-y-1">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#506454]">
            Project ROOT Continuity Chamber
          </div>
          <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#D6E2D8] text-balance">
            The Core — {tier.name}
          </h2>
          <p className="font-mono-tabular text-xs text-[#00FF41]">
            Level 0{accessLevel} · Session {sessionId}
          </p>
        </div>

        {/* Camera Orbit & Zoom Controls */}
        <div className="absolute bottom-4 left-5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => zoomActionRef.current?.('in')}
            title="Zoom in"
            aria-label="Zoom in"
            className="border border-[#506454]/40 bg-[#071009] p-1.5 text-xs text-[#D6E2D8] transition-colors hover:border-[#00FF41] hover:text-[#00FF41]"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => zoomActionRef.current?.('out')}
            title="Zoom out"
            aria-label="Zoom out"
            className="border border-[#506454]/40 bg-[#071009] p-1.5 text-xs text-[#D6E2D8] transition-colors hover:border-[#00FF41] hover:text-[#00FF41]"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => zoomActionRef.current?.('reset')}
            title="Reset view"
            aria-label="Reset camera view"
            className="inline-flex items-center gap-1 border border-[#506454]/40 bg-[#071009] px-2 py-1.5 text-[11px] text-[#506454] transition-colors hover:border-[#00FF41] hover:text-[#00FF41] whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3 w-3" />
            Fit
          </button>
        </div>

        {/* Hidden Interactive Glyph */}
        <button
          type="button"
          onClick={handleHiddenSymbolClick}
          title="Inspect anomalous system glyph"
          className="absolute bottom-4 right-5 border border-[#506454]/30 bg-[#071009] px-3 py-1.5 font-mono-tabular text-xs text-[#506454] transition-colors hover:border-[#00FF41] hover:text-[#00FF41] whitespace-nowrap shrink-0"
        >
          {symbolInspected ? 'ANCHOR 07-ALPHA [LOGGED]' : '◈ 07-ALPHA'}
        </button>
      </div>

      {/* Right Operational Briefing & Cross-Layer Navigation */}
      <div className="lg:col-span-5 flex flex-col justify-between p-6 space-y-6 bg-[#020403]">
        <div className="space-y-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#506454]">Active Directive</div>
            <h3 className="mt-1 font-terminal text-base font-semibold text-[#00FF41]">
              {activeOp.code} — {activeOp.title}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#D6E2D8]/85">{activeOp.briefing}</p>
            <div className="mt-3 border border-[#506454]/30 bg-[#071009] p-3 text-xs text-[#C68A2A]">
              Objective: {activeOp.objective}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-b border-[#506454]/25 py-4 font-mono-tabular">
            <div>
              <div className="text-[11px] text-[#506454]">Ghostnet Nodes</div>
              <div className="mt-1 text-lg text-[#D6E2D8]">
                {connectedNodes.length} <span className="text-xs text-[#506454]">/ {discoveredNodes.length} visible</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#506454]">Archive Files Read</div>
              <div className="mt-1 text-lg text-[#D6E2D8]">
                {openedFiles.length} <span className="text-xs text-[#506454]">/ {ALL_FILES.length}</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#506454]">Blackbox Evidence</div>
              <div className="mt-1 text-lg text-[#D6E2D8]">
                {recoveredEvidence.length} <span className="text-xs text-[#506454]">/ {EVIDENCE_ITEMS.length}</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#506454]">Contradictions</div>
              <div className={`mt-1 text-lg ${contradictions > 0 ? 'text-[#FF2424]' : 'text-[#D6E2D8]'}`}>
                {contradictions} <span className="text-xs text-[#506454]">verified</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-widest text-[#506454]">Immediate Entry Points</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setView('GHOSTNET')}
                className="flex items-center justify-between border border-[#506454]/35 bg-[#071009] px-3.5 py-2.5 text-left text-xs text-[#D6E2D8] transition-colors hover:border-[#00FF41] hover:text-[#00FF41]"
              >
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <Network className="h-3.5 w-3.5" /> Enter Ghostnet
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setView('BLACKBOX')}
                className="flex items-center justify-between border border-[#506454]/35 bg-[#071009] px-3.5 py-2.5 text-left text-xs text-[#D6E2D8] transition-colors hover:border-[#C68A2A] hover:text-[#C68A2A]"
              >
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <ShieldAlert className="h-3.5 w-3.5" /> Open Blackbox
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  openFile('readme_entry');
                  setView('ARCHIVE');
                }}
                className="flex items-center justify-between border border-[#506454]/35 bg-[#071009] px-3.5 py-2.5 text-left text-xs text-[#D6E2D8] transition-colors hover:border-[#00FF41] hover:text-[#00FF41]"
              >
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <FileSearch className="h-3.5 w-3.5" /> Inspect Archive
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setView('OBSERVATORY')}
                className="flex items-center justify-between border border-[#506454]/35 bg-[#071009] px-3.5 py-2.5 text-left text-xs text-[#D6E2D8] transition-colors hover:border-[#00FF41] hover:text-[#00FF41]"
              >
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <Compass className="h-3.5 w-3.5" /> Tune Observatory
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {overrides.length > 0 && (
          <div className="border-t border-[#C68A2A]/30 pt-3 space-y-2">
            <div className="text-[11px] uppercase tracking-widest text-[#C68A2A]">
              Live Architect Bulletins ({overrides.length})
            </div>
            <div className="space-y-1.5 max-h-28 overflow-y-auto">
              {overrides.map((ovr) => (
                <div key={ovr.id} className="border border-[#506454]/25 bg-[#071009] px-3 py-2 text-xs">
                  <div className="font-terminal text-[11px] text-[#00FF41]">
                    [{ovr.kind.toUpperCase()}] {ovr.title}
                  </div>
                  {ovr.payload?.message && (
                    <div className="mt-0.5 text-[11px] text-[#D6E2D8]/80">{ovr.payload.message}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-[#506454]/20 pt-3 text-[11px] text-[#506454]">
          Drag to orbit, scroll or use +/- controls to zoom. Every file, node, transmission, and evidence record shares one underlying graph.
        </div>
      </div>
    </div>
  );
}
