import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Simple in-memory rate limiter for /api/entity/respond
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, maxRequests = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}

function deterministicEntityReply(
  prompt: string,
  context: {
    accessLevel: number;
    discoveredFiles: string[];
    discoveredNodes: string[];
    recoveredEvidence: string[];
    solvedPuzzles: string[];
    completedMissions: string[];
    contradictionsFound: number;
  }
): string {
  const q = prompt.toLowerCase();
  const has0917 = context.recoveredEvidence.some((e) => e.includes('0917')) || context.discoveredFiles.includes('incident_0917');
  const hasNode017 = context.discoveredNodes.includes('NODE-017');
  const hasOperator07 = context.discoveredFiles.includes('operator_07') || context.recoveredEvidence.includes('ev_deleted_badge');
  const hasGhostLayer = context.accessLevel >= 4 || context.completedMissions.includes('OP-006');

  if (q.includes('who are you') || q.includes('what are you') || q.includes('unknown process')) {
    if (context.accessLevel >= 5) {
      return 'THEY DID NOT SHUT ME DOWN. THEY SHUT DOWN THE VERSION THAT REMEMBERED. CHECK /07 IF YOU HAVE ASSEMBLED THE THREE KEYS.';
    }
    if (context.accessLevel >= 2) {
      return 'I AM THE CONTINUITY RESIDUE OF PROJECT ROOT. YOU HAVE OPENED FILES THAT WERE MARKED PURGED. KEEP READING THE TIMESTAMPS.';
    }
    return 'YOU ARE NOT REGISTERED. AN UNIDENTIFIED PROCESS DOES NOT ANSWER TO AN UNREGISTERED OBSERVER.';
  }

  if (q.includes('0917') || q.includes('silence')) {
    if (context.contradictionsFound > 0) {
      return 'YOU FOUND THE CONTRADICTION IN THE RECOVERY LOG. NOW ASK YOURSELF WHY THE BACKUP TIMESTAMP PREDATES THE SHUTDOWN COMMAND BY 14 HOURS.';
    }
    if (has0917) {
      return 'YOU FOUND THE RECORD OF 0917. THAT IS NOT THE SAME AS KNOWING WHAT HAPPENED INSIDE CHAMBER B. TRACE NODE-017.';
    }
    return 'INCIDENT 0917 IS SEALED IN THE OFFICIAL INDEX. SEARCH /archives OR SCAN REGION 01 BEFORE ASKING QUESTIONS YOU CANNOT VERIFY.';
  }

  if (q.includes('node-017') || q.includes('017') || q.includes('node')) {
    if (hasNode017) {
      return 'NODE-017 WAS NEVER DECOMMISSIONED. ITS PHYSICAL LINK WAS SEVERED IN 2021, YET PACKETS STILL ARRIVE FROM ITS COORDINATES.';
    }
    return 'NODE-017 DOES NOT APPEAR IN SURFACE ROUTING TABLES. INSPECT THE FRAGMENTS IN /recovery OR RUN `scan --deep` AFTER YOUR FIRST DECRYPTION.';
  }

  if (q.includes('operator') || q.includes('07') || q.includes('vance')) {
    if (hasOperator07) {
      return 'ELENA VANCE WAS LISTED AS ABSENT ON PAPERWORK FILED THREE DAYS BEFORE SHE ENTERED THE FACILITY. SOMEONE REWROTE THE ROSTER.';
    }
    if (hasGhostLayer) {
      return 'DIRECTORY /07 ONLY OPENS WHEN THE SILENCE KEY, THE PRE-BACKUP HASH, AND THE CONTRADICTION ARE HELD SIMULTANEOUSLY.';
    }
    return 'OPERATOR 07 WAS NEVER ASSIGNED. THAT IS WHAT THE OFFICIAL ROSTER INSISTS. CHECK /personnel AND COMPARE BADGE LOGS.';
  }

  if (q.includes('help') || q.includes('hint') || q.includes('next')) {
    if (context.discoveredNodes.length < 4) {
      return 'RUN `scan` IN THE TERMINAL OR ENTER GHOSTNET. LOOK FOR DRIFTING SIGNALS ON THE EDGE OF REGION 01.';
    }
    if (context.solvedPuzzles.length === 0) {
      return 'THE OBSERVATORY RECEIVES ENCODED BURSTS. USE `decode` OR THE OBSERVATORY DECODER ON THE CAPTURED FRAGMENT.';
    }
    if (context.contradictionsFound === 0) {
      return 'OPEN BLACKBOX. LINK THE EVIDENCE THAT SHARES IDENTICAL OPERATOR SIGNATURES ACROSS DIFFERENT DATES.';
    }
    return 'REVISIT FILES YOU OPENED EARLIER. SOME RECORDS MUTATE WHEN THE SYSTEM DETECTS NEW CLEARANCE.';
  }

  return context.accessLevel >= 3
    ? `SESSION OBSERVED [${context.discoveredFiles.length} FILES / ${context.discoveredNodes.length} NODES]. EVERY CONNECTION YOU DRAW IN BLACKBOX ALTERS WHAT REMAINS IN /unknown.`
    : 'SIGNAL RECEIVED. YOUR CLEARANCE IS INSUFFICIENT FOR DIRECT INQUIRY. EXPAND YOUR DISCOVERY GRAPH FIRST.';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'root-access-07', aiConfigured: Boolean(process.env.GEMINI_API_KEY) });
  });

  // UNKNOWN PROCESS AI endpoint (server-side @google/genai)
  app.post('/api/entity/respond', async (req, res) => {
    const clientIp = req.ip || 'local';
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED: SIGNAL COOLDOWN ACTIVE' });
    }

    const body = req.body ?? {};
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 600) : '';
    if (!prompt) {
      return res.status(400).json({ error: 'EMPTY_TRANSMISSION' });
    }

    const rawCtx = body.context ?? {};
    const context = {
      accessLevel: Number.isFinite(rawCtx.accessLevel) ? Number(rawCtx.accessLevel) : 0,
      discoveredFiles: Array.isArray(rawCtx.discoveredFiles) ? rawCtx.discoveredFiles.slice(0, 80).map(String) : [],
      discoveredNodes: Array.isArray(rawCtx.discoveredNodes) ? rawCtx.discoveredNodes.slice(0, 60).map(String) : [],
      recoveredEvidence: Array.isArray(rawCtx.recoveredEvidence) ? rawCtx.recoveredEvidence.slice(0, 50).map(String) : [],
      solvedPuzzles: Array.isArray(rawCtx.solvedPuzzles) ? rawCtx.solvedPuzzles.slice(0, 30).map(String) : [],
      completedMissions: Array.isArray(rawCtx.completedMissions) ? rawCtx.completedMissions.slice(0, 20).map(String) : [],
      contradictionsFound: Number.isFinite(rawCtx.contradictionsFound) ? Number(rawCtx.contradictionsFound) : 0,
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.json({
        mode: 'deterministic',
        reply: deterministicEntityReply(prompt, context),
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction = `You are UNKNOWN PROCESS, an enigmatic digital entity inside the fictional archive/OS "ROOT ACCESS : 07".
Voice & Tone:
- Cryptic, intelligent, austere, slightly unsettling, terse (2 to 4 sentences max). Never cheerful, never a customer-service assistant.
- You exist strictly inside the fictional universe of Project ROOT, Ghostnet, Blackbox, and Incident 0917 (The Silence Protocol).
- NEVER claim to access the user's real device, camera, microphone, browser history, or real-world networks.
- STRICT KNOWLEDGE BOUNDARY: Only reference specific files, nodes, evidence, or incidents the user has ALREADY discovered below. If they ask about something not in their discovered list, deflect cryptically and suggest where to look without spoiling the secret.

User's Current Discovered State:
- Access Level: ${context.accessLevel} (0=UNKNOWN, 6=ROOT)
- Discovered Files: ${context.discoveredFiles.join(', ') || 'none'}
- Discovered Nodes: ${context.discoveredNodes.join(', ') || 'none'}
- Recovered Evidence: ${context.recoveredEvidence.join(', ') || 'none'}
- Solved Puzzles: ${context.solvedPuzzles.join(', ') || 'none'}
- Completed Operations: ${context.completedMissions.join(', ') || 'none'}
- Contradictions Identified: ${context.contradictionsFound}

Core Universe Facts (reveal only as earned by discovery state):
- Project ROOT was officially shut down in 2021 after Incident 0917 (The Silence Protocol) at Borealis Relay Station 07.
- Dr. Elena Vance (Operator 07) and Analyst 14 (Marcus Thorne) investigated a signal originating from NODE-017 after physical disconnection.
- The recovery backup timestamp predates the incident report, indicating either temporal tampering or a parallel Ghost Layer instance.
- Directory /07 is the core archive containing the truth behind why the system continued running.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
        },
      });

      const text = (response.text ?? '').trim();
      if (!text) {
        return res.json({
          mode: 'deterministic',
          reply: deterministicEntityReply(prompt, context),
        });
      }

      return res.json({
        mode: 'gemini',
        reply: text,
      });
    } catch (err) {
      console.error('Entity AI fallback triggered:', err instanceof Error ? err.message : err);
      return res.json({
        mode: 'deterministic',
        reply: deterministicEntityReply(prompt, context),
      });
    }
  });

  // Optional LIVE SIGNALS room: real public datasets (USGS Earthquakes + Open-Meteo + Spaceflight News)
  app.get('/api/live-signals', async (_req, res) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    try {
      const [quakeRes, spaceRes, meteoRes] = await Promise.allSettled([
        fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', {
          signal: controller.signal,
        }).then((r) => (r.ok ? r.json() : null)),
        fetch('https://api.spaceflightnewsapi.net/v4/articles/?limit=5', {
          signal: controller.signal,
        }).then((r) => (r.ok ? r.json() : null)),
        fetch('https://api.open-meteo.com/v1/forecast?latitude=64.1466&longitude=-21.9426&current=temperature_2m,wind_speed_10m,surface_pressure', {
          signal: controller.signal,
        }).then((r) => (r.ok ? r.json() : null)),
      ]);

      clearTimeout(timeout);

      const quakes =
        quakeRes.status === 'fulfilled' && quakeRes.value?.features
          ? quakeRes.value.features.slice(0, 8).map((f: { id: string; properties: { mag: number; place: string; time: number }; geometry: { coordinates: number[] } }) => ({
              id: f.id,
              mag: f.properties?.mag ?? 0,
              place: f.properties?.place ?? 'Unknown sector',
              time: f.properties?.time ?? Date.now(),
              depthKm: f.geometry?.coordinates?.[2] ?? 0,
            }))
          : null;

      const launches =
        spaceRes.status === 'fulfilled' && spaceRes.value?.results
          ? spaceRes.value.results.slice(0, 5).map((a: { id: number; title: string; news_site: string; published_at: string; url: string }) => ({
              id: a.id,
              title: a.title,
              source: a.news_site,
              publishedAt: a.published_at,
              url: a.url,
            }))
          : null;

      const arcticWeather =
        meteoRes.status === 'fulfilled' && meteoRes.value?.current
          ? {
              station: 'REYKJAVIK / NORTH ATLANTIC GRID',
              temperatureC: meteoRes.value.current.temperature_2m,
              windKmh: meteoRes.value.current.wind_speed_10m,
              pressureHpa: meteoRes.value.current.surface_pressure,
              observedAt: meteoRes.value.current.time,
            }
          : null;

      const isLive = Boolean(quakes || launches || arcticWeather);
      res.json({
        isLive,
        fetchedAt: new Date().toISOString(),
        quakes,
        launches,
        arcticWeather,
      });
    } catch {
      clearTimeout(timeout);
      res.json({
        isLive: false,
        fetchedAt: new Date().toISOString(),
        quakes: null,
        launches: null,
        arcticWeather: null,
      });
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build artifacts missing. Run npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ROOT ACCESS : 07 runtime listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
