import { useCallback, useEffect, useState } from 'react';
import { Activity, Cloud, Globe, RefreshCw, Satellite } from 'lucide-react';

interface QuakeItem {
  id: string;
  mag: number;
  place: string;
  time: number;
  depthKm: number;
}

interface LaunchArticle {
  id: number;
  title: string;
  source: string;
  publishedAt: string;
  url: string;
}

interface ArcticWeather {
  station: string;
  temperatureC: number;
  windKmh: number;
  pressureHpa: number;
  observedAt: string;
}

interface LiveSignalsPayload {
  isLive: boolean;
  fetchedAt: string;
  quakes: QuakeItem[] | null;
  launches: LaunchArticle[] | null;
  arcticWeather: ArcticWeather | null;
}

export function LiveSignalsView() {
  const [data, setData] = useState<LiveSignalsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/live-signals');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = (await resp.json()) as LiveSignalsPayload;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach live telemetry proxy.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSignals();
  }, [fetchSignals]);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#020403] p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#506454]/25 pb-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#506454]">
            External Telemetry Bridge
          </div>
          <h2 className="mt-1 font-editorial text-2xl sm:text-3xl font-semibold text-[#D6E2D8]">
            Live Signals — Real Public Feeds
          </h2>
          <p className="mt-1 text-xs text-[#506454]">
            Authentic external public feeds (USGS Seismic, Spaceflight News API, Open-Meteo North Atlantic). Clearly separated from fictional Project ROOT lore.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono-tabular text-xs text-[#00FF41]">
            {loading ? 'POLLING...' : data?.isLive ? 'REAL PUBLIC DATA ONLINE' : 'EXTERNAL FEED UNAVAILABLE'}
          </span>
          <button
            type="button"
            onClick={() => void fetchSignals()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 border border-[#506454]/40 bg-[#071009] px-3 py-1.5 text-xs text-[#D6E2D8] hover:border-[#00FF41] hover:text-[#00FF41] disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="border border-[#FF2424]/40 bg-[#FF2424]/10 p-4 text-xs text-[#FF2424]">
          Public telemetry proxy returned an error: {error}. Fictional ROOT OS subsystems remain unaffected.
        </div>
      )}

      {data && !data.isLive && !loading && (
        <div className="border border-[#C68A2A]/40 bg-[#C68A2A]/10 p-4 text-xs text-[#C68A2A]">
          External public APIs are currently unreachable from this runtime. No simulated telemetry is fabricated in place of real feeds.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Open-Meteo North Atlantic Station */}
        <section className="lg:col-span-4 border border-[#506454]/25 bg-[#071009] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#506454]/20 pb-2">
            <span className="flex items-center gap-2 font-terminal text-xs text-[#00FF41]">
              <Cloud className="h-4 w-4" />
              OPEN-METEO ARCTIC GRID
            </span>
            <span className="font-mono-tabular text-[10px] text-[#506454]">REAL TELEMETRY</span>
          </div>

          {data?.arcticWeather ? (
            <div className="space-y-3 font-mono-tabular">
              <div className="text-xs text-[#D6E2D8]">{data.arcticWeather.station}</div>
              <div className="grid grid-cols-3 gap-2 border-t border-b border-[#506454]/20 py-3">
                <div>
                  <div className="text-[10px] text-[#506454]">TEMP</div>
                  <div className="text-lg text-[#D6E2D8]">{data.arcticWeather.temperatureC}°C</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#506454]">WIND</div>
                  <div className="text-lg text-[#D6E2D8]">{data.arcticWeather.windKmh} km/h</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#506454]">PRESSURE</div>
                  <div className="text-lg text-[#D6E2D8]">{data.arcticWeather.pressureHpa} hPa</div>
                </div>
              </div>
              <div className="text-[11px] text-[#506454]">
                Observed: {data.arcticWeather.observedAt}
              </div>
            </div>
          ) : (
            <div className="text-xs text-[#506454]">
              {loading ? 'Awaiting Open-Meteo response...' : 'North Atlantic weather feed unavailable.'}
            </div>
          )}
        </section>

        {/* USGS Seismic Feed */}
        <section className="lg:col-span-4 border border-[#506454]/25 bg-[#071009] p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#506454]/20 pb-2">
            <span className="flex items-center gap-2 font-terminal text-xs text-[#C68A2A]">
              <Activity className="h-4 w-4" />
              USGS SEISMIC (M2.5+ 24H)
            </span>
            <span className="font-mono-tabular text-[10px] text-[#506454]">REAL TELEMETRY</span>
          </div>

          {data?.quakes && data.quakes.length > 0 ? (
            <div className="divide-y divide-[#506454]/15">
              {data.quakes.map((q) => (
                <div key={q.id} className="py-2 flex items-baseline justify-between gap-2 text-xs">
                  <div className="truncate text-[#D6E2D8]">{q.place}</div>
                  <div className="font-mono-tabular text-[#C68A2A] shrink-0">
                    M{q.mag.toFixed(1)} · {q.depthKm.toFixed(0)}km
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-[#506454]">
              {loading ? 'Querying USGS GeoJSON...' : 'USGS seismic feed unavailable.'}
            </div>
          )}
        </section>

        {/* Spaceflight News API */}
        <section className="lg:col-span-4 border border-[#506454]/25 bg-[#071009] p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#506454]/20 pb-2">
            <span className="flex items-center gap-2 font-terminal text-xs text-[#D6E2D8]">
              <Satellite className="h-4 w-4" />
              ORBITAL & SPACEFLIGHT DISPATCH
            </span>
            <span className="font-mono-tabular text-[10px] text-[#506454]">REAL TELEMETRY</span>
          </div>

          {data?.launches && data.launches.length > 0 ? (
            <div className="divide-y divide-[#506454]/15">
              {data.launches.map((item) => (
                <div key={item.id} className="py-2.5 space-y-1">
                  <div className="text-xs text-[#D6E2D8] leading-snug">{item.title}</div>
                  <div className="font-mono-tabular text-[10px] text-[#506454]">
                    {item.source} · {item.publishedAt.slice(0, 10)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-[#506454]">
              {loading ? 'Fetching orbital bulletins...' : 'Spaceflight bulletin feed unavailable.'}
            </div>
          )}
        </section>
      </div>

      {data && (
        <div className="flex items-center gap-2 border-t border-[#506454]/20 pt-3 font-mono-tabular text-[11px] text-[#506454]">
          <Globe className="h-3.5 w-3.5" />
          Last synchronized with public endpoints at {data.fetchedAt}
        </div>
      )}
    </div>
  );
}
