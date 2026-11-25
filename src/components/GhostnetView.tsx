import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Eye, Layers, Minus, Plus, Radio, RotateCcw, Search, Share2, Zap } from 'lucide-react';
import { GHOST_EDGES, GHOST_NODES, GHOST_REGIONS } from '../data/universeData';
import { useWorldStore } from '../engine/worldStore';
import { GhostNode, RegionId } from '../types/universe';

const STATUS_HEX: Record<string, number> = {
  ONLINE: 0x00ff41,
  UNSTABLE: 0xc68a2a,
  ENCRYPTED: 0xc68a2a,
  CORRUPTED: 0xff2424,
  RESTRICTED: 0xff2424,
  GHOST: 0xd6e2d8,
  UNKNOWN: 0xd6e2d8,
  OFFLINE: 0x506454,
  DELETED: 0x333333,
};

export function GhostnetView() {
  const {
    discoveredNodes,
    connectedNodes,
    collapsedNodes,
    unlockedRegions,
    activeNodeId,
    ghostLayerActive,
    toggleGhostLayer,
    connectNode,
    traceNode,
    scanNetwork,
    openFile,
    setView,
    setSelectedIncident,
    unlockedCommands,
  } = useWorldStore();

  const [mode2D, setMode2D] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<RegionId | 'ALL'>('ALL');
  const [selectedNodeId, setSelectedNodeId] = useState<string>(activeNodeId || 'NODE-001');
  const [traceLog, setTraceLog] = useState<string[]>([]);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const canvasHostRef = useRef<HTMLDivElement>(null);
  const zoomActionRef = useRef<((action: 'in' | 'out' | 'reset') => void) | null>(null);
  const stateRef = useRef({
    discoveredNodes,
    connectedNodes,
    collapsedNodes,
    selectedNodeId,
    ghostLayerActive,
  });
  stateRef.current = { discoveredNodes, connectedNodes, collapsedNodes, selectedNodeId, ghostLayerActive };

  const visibleNodes = useMemo(() => {
    return GHOST_NODES.filter((n) => {
      if (collapsedNodes.includes(n.id)) return false;
      if (!discoveredNodes.includes(n.id)) return false;
      if (n.ghostLayerOnly && !ghostLayerActive) return false;
      if (regionFilter !== 'ALL' && n.region !== regionFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          n.id.toLowerCase().includes(q) ||
          n.name.toLowerCase().includes(q) ||
          n.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [discoveredNodes, collapsedNodes, ghostLayerActive, regionFilter, searchQuery]);

  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(() => {
    return GHOST_EDGES.filter((e) => {
      if (e.ghostLayerOnly && !ghostLayerActive) return false;
      return visibleIds.has(e.from) && visibleIds.has(e.to);
    });
  }, [visibleIds, ghostLayerActive]);

  const selectedNode: GhostNode | undefined = useMemo(
    () => GHOST_NODES.find((n) => n.id === selectedNodeId) ?? visibleNodes[0],
    [selectedNodeId, visibleNodes]
  );

  // Three.js spatial 3D network
  useEffect(() => {
    if (mode2D) return;
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
    scene.fog = new THREE.FogExp2(0x020403, 0.012);

    const w = Math.max(container.clientWidth, 320);
    const h = Math.max(container.clientHeight, 300);
    const camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 300);
    camera.position.set(0, 18, 40);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.outline = 'none';
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, -20);
    controls.enableZoom = true;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxDistance = 160;
    controls.minDistance = 4;
    controls.update();

    zoomActionRef.current = (action) => {
      if (action === 'reset') {
        camera.position.set(0, 18, 40);
        controls.target.set(0, 0, -20);
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

    scene.add(new THREE.HemisphereLight(0x1f4d2e, 0x020403, 0.9));
    const dirLight = new THREE.DirectionalLight(0x00ff41, 1.1);
    dirLight.position.set(15, 25, 20);
    scene.add(dirLight);

    // Subtle spatial grid floor
    const grid = new THREE.GridHelper(160, 40, 0x0a5728, 0x071009);
    grid.position.set(0, -24, -34);
    scene.add(grid);

    // Background deep void stars
    const starCount = 320;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 180;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 100;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 180 - 25;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x506454, size: 0.25, transparent: true, opacity: 0.45 });
    scene.add(new THREE.Points(starGeo, starMat));

    // Build interactive node groups (3-part composite mesh per node)
    const nodeGroups = new Map<string, THREE.Group>();
    const clickableTargets: THREE.Mesh[] = [];
    const sphereGeo = new THREE.OctahedronGeometry(0.95, 1);
    const ringGeo = new THREE.TorusGeometry(1.45, 0.04, 8, 28);
    const hitGeo = new THREE.SphereGeometry(2.1, 10, 10);

    for (const n of GHOST_NODES) {
      const grp = new THREE.Group();
      grp.position.set(n.position[0], n.position[1], n.position[2]);

      const colorHex = STATUS_HEX[n.status] ?? 0x00ff41;
      const coreMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: n.status === 'OFFLINE' ? 0.1 : 0.45,
        metalness: 0.55,
        roughness: 0.3,
      });
      const coreMesh = new THREE.Mesh(sphereGeo, coreMat);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.35,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;

      const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
      hitMesh.userData = { nodeId: n.id };
      hitMesh.layers.set(1);
      clickableTargets.push(hitMesh);

      grp.add(coreMesh, ringMesh, hitMesh);
      scene.add(grp);
      nodeGroups.set(n.id, grp);
    }

    // Build edge lines
    const edgeLines = new Map<string, THREE.Line>();
    for (const edge of GHOST_EDGES) {
      const fromNode = GHOST_NODES.find((x) => x.id === edge.from);
      const toNode = GHOST_NODES.find((x) => x.id === edge.to);
      if (!fromNode || !toNode) continue;
      const pts = [
        new THREE.Vector3(...fromNode.position),
        new THREE.Vector3(...toNode.position),
      ];
      const lGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lMat = new THREE.LineBasicMaterial({
        color: edge.contradictory ? 0xff2424 : edge.ghostLayerOnly ? 0xc68a2a : 0x0a5728,
        transparent: true,
        opacity: edge.ghostLayerOnly ? 0.55 : 0.45,
      });
      const line = new THREE.Line(lGeo, lMat);
      scene.add(line);
      edgeLines.set(edge.id, line);
    }

    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let lastHoverCheck = 0;

    const updatePointer = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 50) return;
      lastHoverCheck = now;
      updatePointer(e.clientX, e.clientY);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableTargets, false).filter((h) => {
        const id = h.object.userData.nodeId as string;
        return stateRef.current.discoveredNodes.includes(id) && !stateRef.current.collapsedNodes.includes(id);
      });
      if (hits.length > 0) {
        const id = hits[0].object.userData.nodeId as string;
        setHoveredNodeId(id);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        setHoveredNodeId(null);
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const onClick = (e: MouseEvent) => {
      updatePointer(e.clientX, e.clientY);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableTargets, false).filter((h) => {
        const id = h.object.userData.nodeId as string;
        return stateRef.current.discoveredNodes.includes(id) && !stateRef.current.collapsedNodes.includes(id);
      });
      if (hits.length > 0) {
        const id = hits[0].object.userData.nodeId as string;
        setSelectedNodeId(id);
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('click', onClick);

    const onResize = () => {
      if (!container) return;
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      if (nw <= 0 || nh <= 0) return;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh, false);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);
    window.addEventListener('resize', onResize);

    if (!isSoftwareGl) renderer.compile(scene, camera);

    const clock = new THREE.Clock();
    let frameId = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const s = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (s === gl.UNSIGNALED) frameId = window.setTimeout(poll, 5);
        else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const dt = Math.min(clock.getDelta(), 0.1);
      const st = stateRef.current;

      for (const n of GHOST_NODES) {
        const grp = nodeGroups.get(n.id);
        if (!grp) continue;
        const isVisible =
          st.discoveredNodes.includes(n.id) &&
          !st.collapsedNodes.includes(n.id) &&
          (!n.ghostLayerOnly || st.ghostLayerActive);
        grp.visible = isVisible;
        if (!isVisible) continue;

        const isSelected = st.selectedNodeId === n.id;
        const isConnected = st.connectedNodes.includes(n.id);
        const targetScale = isSelected ? 1.55 : isConnected ? 1.2 : 0.95;
        grp.scale.setScalar(THREE.MathUtils.damp(grp.scale.x, targetScale, 8, dt));
        grp.children[0].rotation.y += dt * (isSelected ? 1.2 : 0.35);
        grp.children[1].rotation.z -= dt * 0.45;
      }

      for (const edge of GHOST_EDGES) {
        const line = edgeLines.get(edge.id);
        if (!line) continue;
        const fromVis = nodeGroups.get(edge.from)?.visible ?? false;
        const toVis = nodeGroups.get(edge.to)?.visible ?? false;
        line.visible = fromVis && toVis && (!edge.ghostLayerOnly || st.ghostLayerActive);
      }

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
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('click', onClick);
      controls.dispose();
      sphereGeo.dispose();
      ringGeo.dispose();
      hitGeo.dispose();
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [mode2D]);

  const handleConnect = (id: string) => {
    connectNode(id);
    setSelectedNodeId(id);
  };

  const handleTrace = (id: string) => {
    const res = traceNode(id);
    setTraceLog(res);
  };

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-12 bg-[#020403] overflow-hidden">
      {/* Main 3D / 2D Network Stage */}
      <div className="relative lg:col-span-8 flex flex-col min-h-[340px] border-b lg:border-b-0 lg:border-r border-[#506454]/25 bg-[#000000]">
        {/* Top Toolbar */}
        <div className="z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[#506454]/25 bg-[#071009]/95 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#506454]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter nodes..."
                className="w-40 sm:w-48 border border-[#506454]/40 bg-[#020403] pl-8 pr-2.5 py-1 text-xs text-[#D6E2D8] placeholder-[#506454] focus:border-[#00FF41] focus:outline-none"
              />
            </div>

            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value as RegionId | 'ALL')}
              aria-label="Filter region"
              className="border border-[#506454]/40 bg-[#020403] px-2.5 py-1 text-xs text-[#D6E2D8] focus:border-[#00FF41] focus:outline-none"
            >
              <option value="ALL">All Unlocked Regions ({unlockedRegions.length}/6)</option>
              {GHOST_REGIONS.filter((r) => unlockedRegions.includes(r.id)).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} · {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scanNetwork(true)}
              className="inline-flex items-center gap-1.5 border border-[#00FF41]/60 bg-[#00FF41]/10 px-3 py-1 text-xs text-[#00FF41] hover:bg-[#00FF41]/20 whitespace-nowrap shrink-0"
            >
              <Radio className="h-3.5 w-3.5" />
              Scan Network
            </button>
            <button
              type="button"
              onClick={toggleGhostLayer}
              className={`inline-flex items-center gap-1.5 border px-3 py-1 text-xs whitespace-nowrap shrink-0 ${
                ghostLayerActive
                  ? 'border-[#FF2424] bg-[#FF2424]/15 text-[#FF2424]'
                  : 'border-[#506454]/40 bg-[#020403] text-[#D6E2D8] hover:border-[#C68A2A]'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              {ghostLayerActive ? 'Ghost Layer: ON' : 'Ghost Layer'}
            </button>
            <button
              type="button"
              onClick={() => setMode2D(!mode2D)}
              className="border border-[#506454]/40 bg-[#020403] px-3 py-1 text-xs text-[#D6E2D8] hover:border-[#00FF41] whitespace-nowrap shrink-0"
            >
              {mode2D ? '3D Spatial' : '2D Tactical'}
            </button>
          </div>
        </div>

        {/* Canvas or 2D Tactical Fallback */}
        <div className="relative flex-1 overflow-hidden">
          {!mode2D ? (
            <div ref={canvasHostRef} className="h-full w-full min-h-[300px]" />
          ) : (
            <div className="h-full w-full overflow-auto p-4 bg-[#020403]">
              <svg viewBox="-45 -30 90 95" className="w-full h-full min-h-[340px]">
                {visibleEdges.map((edge) => {
                  const a = GHOST_NODES.find((n) => n.id === edge.from);
                  const b = GHOST_NODES.find((n) => n.id === edge.to);
                  if (!a || !b) return null;
                  return (
                    <line
                      key={edge.id}
                      x1={a.position[0]}
                      y1={-a.position[2]}
                      x2={b.position[0]}
                      y2={-b.position[2]}
                      stroke={edge.contradictory ? '#FF2424' : edge.ghostLayerOnly ? '#C68A2A' : '#0A5728'}
                      strokeWidth={0.3}
                      strokeOpacity={0.6}
                    />
                  );
                })}
                {visibleNodes.map((n) => {
                  const isSel = selectedNode?.id === n.id;
                  const fill =
                    n.status === 'CORRUPTED' || n.status === 'RESTRICTED'
                      ? '#FF2424'
                      : n.status === 'UNSTABLE' || n.status === 'ENCRYPTED'
                        ? '#C68A2A'
                        : n.status === 'OFFLINE'
                          ? '#506454'
                          : '#00FF41';
                  return (
                    <g
                      key={n.id}
                      onClick={() => setSelectedNodeId(n.id)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={n.position[0]}
                        cy={-n.position[2]}
                        r={isSel ? 2.1 : 1.3}
                        fill={fill}
                        stroke={isSel ? '#D6E2D8' : 'none'}
                        strokeWidth={0.4}
                      />
                      <text
                        x={n.position[0] + 1.8}
                        y={-n.position[2] + 0.6}
                        fill="#D6E2D8"
                        fontSize="1.8"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {n.id}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {!mode2D && (
            <div className="absolute right-4 bottom-4 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => zoomActionRef.current?.('in')}
                title="Zoom in"
                aria-label="Zoom in Ghostnet"
                className="border border-[#506454]/40 bg-[#071009] p-1.5 text-xs text-[#D6E2D8] hover:border-[#00FF41] hover:text-[#00FF41]"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => zoomActionRef.current?.('out')}
                title="Zoom out"
                aria-label="Zoom out Ghostnet"
                className="border border-[#506454]/40 bg-[#071009] p-1.5 text-xs text-[#D6E2D8] hover:border-[#00FF41] hover:text-[#00FF41]"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => zoomActionRef.current?.('reset')}
                title="Reset Ghostnet view"
                aria-label="Reset Ghostnet camera"
                className="inline-flex items-center gap-1 border border-[#506454]/40 bg-[#071009] px-2 py-1.5 text-[11px] text-[#506454] hover:border-[#00FF41] hover:text-[#00FF41] whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3 w-3" />
                Fit
              </button>
            </div>
          )}

          {hoveredNodeId && !mode2D && (
            <div className="pointer-events-none absolute left-4 bottom-4 border border-[#00FF41]/40 bg-[#071009] px-3 py-1.5 font-mono-tabular text-xs text-[#00FF41]">
              TARGET: {hoveredNodeId} — Click to inspect
            </div>
          )}
        </div>
      </div>

      {/* Node Inspector Panel */}
      <aside className="lg:col-span-4 flex flex-col justify-between overflow-y-auto bg-[#071009] p-5 space-y-5">
        {selectedNode ? (
          <div className="space-y-4">
            <div className="border-b border-[#506454]/30 pb-3">
              <div className="flex items-center justify-between text-xs text-[#506454] font-mono-tabular">
                <span>{selectedNode.id} · {selectedNode.region}</span>
                <span
                  className={
                    selectedNode.status === 'CORRUPTED' || selectedNode.status === 'RESTRICTED'
                      ? 'text-[#FF2424]'
                      : selectedNode.status === 'ONLINE'
                        ? 'text-[#00FF41]'
                        : 'text-[#C68A2A]'
                  }
                >
                  {selectedNode.status}
                </span>
              </div>
              <h3 className="mt-1 font-terminal text-lg font-semibold text-[#D6E2D8]">
                {selectedNode.name}
              </h3>
              <div className="mt-1 text-xs text-[#506454] font-mono-tabular">
                {selectedNode.category} · Signal {selectedNode.signalStrength}% · Clearance L0{selectedNode.requiredAccess}
              </div>
            </div>

            <p className="text-xs leading-relaxed text-[#D6E2D8]/85">{selectedNode.description}</p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleConnect(selectedNode.id)}
                className="inline-flex items-center gap-1.5 border border-[#00FF41] bg-[#00FF41]/10 px-3 py-1.5 text-xs text-[#00FF41] hover:bg-[#00FF41]/20 whitespace-nowrap"
              >
                <Zap className="h-3.5 w-3.5" />
                {connectedNodes.includes(selectedNode.id) ? 'Connected' : 'Connect'}
              </button>
              <button
                type="button"
                onClick={() => handleTrace(selectedNode.id)}
                className="inline-flex items-center gap-1.5 border border-[#506454]/50 bg-[#020403] px-3 py-1.5 text-xs text-[#D6E2D8] hover:border-[#00FF41] whitespace-nowrap"
              >
                <Share2 className="h-3.5 w-3.5" />
                Trace
              </button>
              {selectedNode.linkedIncidents.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIncident(selectedNode.linkedIncidents[0]);
                    setView('BLACKBOX');
                  }}
                  className="inline-flex items-center gap-1.5 border border-[#C68A2A]/50 bg-[#020403] px-3 py-1.5 text-xs text-[#C68A2A] hover:border-[#C68A2A] whitespace-nowrap"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Open Incident
                </button>
              )}
            </div>

            {connectedNodes.includes(selectedNode.id) && (
              <div className="border border-[#00FF41]/30 bg-[#020403] p-3 space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-[#00FF41]">Recovered Telemetry</div>
                <p className="text-xs leading-relaxed text-[#D6E2D8]/90">{selectedNode.recoveredData}</p>
              </div>
            )}

            {traceLog.length > 0 && (
              <div className="border border-[#506454]/30 bg-[#020403] p-3 space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-[#C68A2A]">Trace Topology</div>
                {traceLog.map((line, i) => (
                  <div key={i} className="font-mono-tabular text-xs text-[#D6E2D8]/85">
                    {line}
                  </div>
                ))}
              </div>
            )}

            {selectedNode.linkedFiles.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] uppercase tracking-wider text-[#506454]">Linked Files</div>
                <div className="flex flex-col gap-1">
                  {selectedNode.linkedFiles.map((fid) => (
                    <button
                      key={fid}
                      type="button"
                      onClick={() => {
                        openFile(fid);
                        setView('ARCHIVE');
                      }}
                      className="text-left border border-[#506454]/25 bg-[#020403] px-2.5 py-1.5 font-terminal text-xs text-[#D6E2D8] hover:border-[#00FF41] hover:text-[#00FF41]"
                    >
                      Open {fid}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Node List */}
            <div className="border-t border-[#506454]/25 pt-3 space-y-1.5">
              <div className="text-[11px] uppercase tracking-wider text-[#506454]">
                Discovered Nodes ({visibleNodes.length})
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {visibleNodes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setSelectedNodeId(n.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1 text-left font-mono-tabular text-xs border ${
                      selectedNode.id === n.id
                        ? 'border-[#00FF41] bg-[#00FF41]/10 text-[#00FF41]'
                        : 'border-transparent bg-[#020403] text-[#D6E2D8]/80 hover:border-[#506454]/40'
                    }`}
                  >
                    <span className="truncate">{n.id} · {n.name}</span>
                    <span className="text-[10px] text-[#506454] shrink-0">{n.status}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-[#506454]">Select a node to inspect telemetry.</div>
        )}

        {!unlockedCommands.includes('ghost') && (
          <div className="border-t border-[#506454]/20 pt-2 text-[11px] text-[#506454]">
            Tip: Decrypt Fragment 04 in The Observatory to expose Region 03 and NODE-017.
          </div>
        )}
      </aside>
    </div>
  );
}
