/**
 * @file Server Monitor
 * @module ServerMonitor
 * @author sagan
 * @license BSD-3-Clause
 * @version 1.0.0
 * @since 2026-06-08
 * @id cs-server-monitor
 * @group _Sys
 * Server Monitor for CozySSH — Linux only.
 * Periodically queries CPU, memory, disk, load & uptime via csExecInTerminal
 * and displays them in a sleek sidebar applet.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CpuStat {
  user: number;
  nice: number;
  system: number;
  idle: number;
  iowait: number;
  irq: number;
  softirq: number;
}

interface MemStat {
  total: number; // MiB
  used: number; // MiB
  free: number; // MiB
  bufcache: number; // MiB
  available: number; // MiB
}

interface DiskEntry {
  fs: string;
  size: string;
  used: string;
  avail: string;
  pct: number;
  mount: string;
}

interface NetEntry {
  iface: string;
  rxBytes: number;
  txBytes: number;
}

interface Stats {
  cpu: number | null; // 0-100
  mem: MemStat | null;
  disks: DiskEntry[];
  load: [number, number, number] | null; // 1m 5m 15m
  uptime: string | null;
  net: NetEntry[];
  hostname: string | null;
  os: string | null;
  ts: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBytes = (n: number): string => {
  if (n >= 1024 * 1024) {
    return `${(n / 1024 / 1024).toFixed(1)} GiB`;
  }
  if (n >= 1024) {
    return `${(n / 1024).toFixed(1)} MiB`;
  }
  return `${n} KiB`;
};

const pctColor = (pct: number): string => {
  if (pct >= 90) {
    return "#ff4d4d";
  }
  if (pct >= 70) {
    return "#ffaa00";
  }
  return "#4ade80";
};

// Parse /proc/stat cpu line
function parseCpuLine(line: string): CpuStat | null {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 8) {
    return null;
  }
  return {
    user: parseInt(parts[1]),
    nice: parseInt(parts[2]),
    system: parseInt(parts[3]),
    idle: parseInt(parts[4]),
    iowait: parseInt(parts[5]),
    irq: parseInt(parts[6]),
    softirq: parseInt(parts[7]),
  };
}

function cpuPct(a: CpuStat, b: CpuStat): number {
  const idleDelta = b.idle + b.iowait - (a.idle + a.iowait);
  const totalDelta =
    b.user +
    b.nice +
    b.system +
    b.idle +
    b.iowait +
    b.irq +
    b.softirq -
    (a.user + a.nice + a.system + a.idle + a.iowait + a.irq + a.softirq);
  if (totalDelta <= 0) {
    return 0;
  }
  return Math.round((1 - idleDelta / totalDelta) * 100);
}

// Build a single compound shell command that returns all info we need
// Separated by unique markers so we can split the output
const CMD = [
  // 1. CPU raw /proc/stat line
  "cat /proc/stat | grep '^cpu '",
  // 2. Memory: free -m output
  "free -m",
  // 3. Disk: df -h -x tmpfs -x devtmpfs
  "df -h -x tmpfs -x devtmpfs -x squashfs --output=source,size,used,avail,pcent,target 2>/dev/null | tail -n +2",
  // 4. Load averages
  "cat /proc/loadavg",
  // 5. Uptime human readable
  "uptime -p 2>/dev/null || uptime",
  // 6. Network: /proc/net/dev
  "cat /proc/net/dev",
  // 7. hostname
  "hostname",
  // 8. OS release
  "cat /etc/os-release 2>/dev/null | grep '^PRETTY_NAME' | cut -d= -f2 | tr -d '\"'",
].join(' && echo "---CSZZ---" && ');

function parseStats(raw: string, prevCpu: CpuStat | null): { stats: Partial<Stats>; cpu: CpuStat | null } {
  const sections = raw.split("---CSZZ---").map((s) => s.trim());
  const result: Partial<Stats> = { disks: [], net: [], ts: Date.now() };
  let newCpu: CpuStat | null = null;

  // Section 0: /proc/stat
  if (sections[0]) {
    const c = parseCpuLine(sections[0]);
    if (c) {
      newCpu = c;
      if (prevCpu) {
        result.cpu = cpuPct(prevCpu, c);
      }
    }
  }

  // Section 1: free -m
  if (sections[1]) {
    const lines = sections[1].split("\n");
    // Look for the "Mem:" line
    const memLine = lines.find((l) => l.trim().startsWith("Mem:"));
    if (memLine) {
      const p = memLine.trim().split(/\s+/);
      // free -m: Mem: total used free shared buff/cache available
      const total = parseInt(p[1]);
      const used = parseInt(p[2]);
      const free = parseInt(p[3]);
      const bufcache = parseInt(p[5]) || 0;
      const available = parseInt(p[6]) || free;
      result.mem = { total, used, free, bufcache, available };
    }
  }

  // Section 2: df output
  if (sections[2]) {
    result.disks = sections[2]
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const p = line.trim().split(/\s+/);
        if (p.length < 6) {
          return null;
        }
        return {
          fs: p[0],
          size: p[1],
          used: p[2],
          avail: p[3],
          pct: parseInt(p[4]) || 0,
          mount: p[5],
        } as DiskEntry;
      })
      .filter(Boolean) as DiskEntry[];
  }

  // Section 3: /proc/loadavg
  if (sections[3]) {
    const p = sections[3].trim().split(/\s+/);
    if (p.length >= 3) {
      result.load = [parseFloat(p[0]), parseFloat(p[1]), parseFloat(p[2])];
    }
  }

  // Section 4: uptime -p
  if (sections[4]) {
    // Strip leading "up " if present from plain `uptime`
    let up = sections[4].trim().replace(/^up\s+/i, "");
    // "uptime -p" returns "up X hours, Y minutes"
    up = up.replace(/^up\s+/i, "");
    result.uptime = up;
  }

  // Section 5: /proc/net/dev
  if (sections[5]) {
    result.net = sections[5]
      .split("\n")
      .slice(2) // skip 2 header lines
      .filter(Boolean)
      .map((line) => {
        const [ifacePart, ...rest] = line.trim().split(":");
        if (!rest.length) {
          return null;
        }
        const nums = rest[0].trim().split(/\s+/);
        return {
          iface: ifacePart.trim(),
          rxBytes: parseInt(nums[0]) || 0,
          txBytes: parseInt(nums[8]) || 0,
        } as NetEntry;
      })
      .filter((e): e is NetEntry => e !== null && e.iface !== "lo");
  }

  // Section 6: hostname
  if (sections[6]) {
    result.hostname = sections[6].trim();
  }

  // Section 7: OS
  if (sections[7]) {
    result.os = sections[7].trim();
  }

  return { stats: result, cpu: newCpu };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Gauge = ({ pct, label, value }: { pct: number; label: string; value: string }) => {
  const color = pctColor(pct);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "0.78rem" }}>
        <span style={{ color: "#aaa" }}>{label}</span>
        <span style={{ color, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      </div>
      <div style={{ height: 6, background: "#2a2a2a", borderRadius: 99, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${Math.min(pct, 100)}%`,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            borderRadius: 99,
            transition: "width 0.6s ease",
          }}
        />
      </div>
    </div>
  );
};

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div
    style={{
      background: "#161616",
      border: "1px solid #2a2a2a",
      borderRadius: 10,
      padding: "12px 14px",
      marginBottom: 10,
    }}
  >
    <div
      style={{
        fontSize: "0.68rem",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#555",
        fontWeight: 700,
        marginBottom: 10,
      }}
    >
      {title}
    </div>
    {children}
  </div>
);

const StatRow = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      fontSize: "0.8rem",
      color: "#ccc",
      marginBottom: 6,
    }}
  >
    <span style={{ color: "#777" }}>{label}</span>
    <span style={{ fontFamily: mono ? "monospace" : "inherit", color: "#e0e0e0" }}>{value}</span>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const APPLET_NAME = "Server Monitor";
const DEFAULT_INTERVAL = 5; // seconds

const ServerMonitor = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [interval, setIntervalSec] = useState(DEFAULT_INTERVAL);
  const [paused, setPaused] = useState(false);

  // Network delta tracking
  const prevNetRef = useRef<NetEntry[] | null>(null);
  const [netDelta, setNetDelta] = useState<{ iface: string; rx: number; tx: number }[]>([]);
  const prevNetTimeRef = useRef<number>(0);

  // CPU /proc/stat carry-over between polls
  const prevCpuRef = useRef<CpuStat | null>(null);

  const fetchStats = useCallback(async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await csExecInTerminal(CMD);
      if (res.error) {
        setError(String(res.error));
        return;
      }
      const raw = res.stdout;
      const { stats: parsed, cpu } = parseStats(raw, prevCpuRef.current);

      // Compute network delta
      if (parsed.net && prevNetRef.current) {
        const now = Date.now();
        const elapsed = (now - prevNetTimeRef.current) / 1000;
        if (elapsed > 0) {
          const deltas = parsed.net
            .map((n) => {
              const prev = prevNetRef.current!.find((p) => p.iface === n.iface);
              if (!prev) {
                return null;
              }
              return {
                iface: n.iface,
                rx: Math.max(0, n.rxBytes - prev.rxBytes) / elapsed,
                tx: Math.max(0, n.txBytes - prev.txBytes) / elapsed,
              };
            })
            .filter(Boolean) as { iface: string; rx: number; tx: number }[];
          setNetDelta(deltas);
        }
        prevNetTimeRef.current = now;
      } else {
        prevNetTimeRef.current = Date.now();
      }
      prevNetRef.current = parsed.net ?? null;
      prevCpuRef.current = cpu;

      setStats((prev) => ({ ...prev, ...parsed }) as Stats);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // Polling loop
  useEffect(() => {
    if (paused) {
      return;
    }
    fetchStats();
    const id = setInterval(fetchStats, interval * 1000);
    return () => clearInterval(id);
  }, [interval, paused]);

  useEffect(() => {
    window.addEventListener("cs:terminal-change", fetchStats);
    return () => window.removeEventListener("cs:terminal-change", fetchStats);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  const container: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#0d0d0d",
    color: "#e0e0e0",
    fontFamily: "system-ui, -apple-system, sans-serif",
    overflow: "hidden",
  };

  const header: React.CSSProperties = {
    padding: "10px 14px",
    background: "#141414",
    borderBottom: "1px solid #222",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexShrink: 0,
  };

  const iconBtn: React.CSSProperties = {
    background: "none",
    border: "none",
    color: "#666",
    cursor: "pointer",
    fontSize: "1rem",
    padding: "2px 6px",
    borderRadius: 4,
  };

  const scrollArea: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: "10px 12px",
  };

  const footer: React.CSSProperties = {
    padding: "8px 14px",
    borderTop: "1px solid #222",
    background: "#141414",
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: "0.75rem",
    color: "#555",
    flexShrink: 0,
  };

  const cpuPct = stats?.cpu ?? null;
  const mem = stats?.mem ?? null;
  const memPct = mem ? Math.round(((mem.total - mem.available) / mem.total) * 100) : null;

  return (
    <div style={container}>
      {/* Header */}
      <div style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.95rem", fontWeight: 700 }}>📊</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", lineHeight: 1.2 }}>
              {stats?.hostname ?? APPLET_NAME}
            </div>
            {stats?.os && <div style={{ fontSize: "0.68rem", color: "#555", marginTop: 1 }}>{stats.os}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button style={{ ...iconBtn, color: loading ? "#4ade80" : "#666" }} onClick={fetchStats} title="Refresh now">
            {loading ? "⟳" : "↺"}
          </button>
          <button style={iconBtn} onClick={() => setPaused((p) => !p)} title={paused ? "Resume" : "Pause"}>
            {paused ? "▶" : "⏸"}
          </button>
          <button style={iconBtn} onClick={() => csCloseApplet(APPLET_NAME)} title="Close">
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={scrollArea}>
        {error && (
          <div
            style={{
              background: "#2a1010",
              border: "1px solid #ff4d4d44",
              color: "#ff6b6b",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: "0.78rem",
              marginBottom: 10,
            }}
          >
            ⚠ {error}
          </div>
        )}

        {!stats && !error && (
          <div style={{ textAlign: "center", marginTop: 40, color: "#444", fontSize: "0.85rem" }}>
            {loading ? "Fetching stats…" : "No data yet"}
          </div>
        )}

        {stats && (
          <>
            {/* ── System Overview ── */}
            <Card title="System">
              {stats.uptime && <StatRow label="Uptime" value={stats.uptime} />}
              {stats.load && (
                <StatRow
                  label="Load avg"
                  value={`${stats.load[0].toFixed(2)}  ${stats.load[1].toFixed(2)}  ${stats.load[2].toFixed(2)}`}
                  mono
                />
              )}
            </Card>

            {/* ── CPU ── */}
            <Card title="CPU">
              {cpuPct !== null ? (
                <Gauge pct={cpuPct} label="Usage" value={`${cpuPct}%`} />
              ) : (
                <div style={{ fontSize: "0.78rem", color: "#555" }}>Waiting for second sample…</div>
              )}
            </Card>

            {/* ── Memory ── */}
            {mem && (
              <Card title="Memory">
                <Gauge pct={memPct ?? 0} label="Used" value={`${mem.total - mem.available} / ${mem.total} MiB`} />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "4px 12px",
                    marginTop: 4,
                  }}
                >
                  <StatRow label="Free" value={`${mem.free} MiB`} />
                  <StatRow label="Available" value={`${mem.available} MiB`} />
                  <StatRow label="Buf/Cache" value={`${mem.bufcache} MiB`} />
                  <StatRow label="Total" value={`${mem.total} MiB`} />
                </div>
              </Card>
            )}

            {/* ── Disk ── */}
            {stats.disks.length > 0 && (
              <Card title="Disk">
                {stats.disks.map((d) => (
                  <Gauge key={d.mount} pct={d.pct} label={`${d.mount} (${d.fs})`} value={`${d.used} / ${d.size}`} />
                ))}
              </Card>
            )}

            {/* ── Network ── */}
            {netDelta.length > 0 && (
              <Card title="Network (per sec)">
                {netDelta.map((n) => (
                  <div key={n.iface} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: 4 }}>{n.iface}</div>
                    <div style={{ display: "flex", gap: 16, fontSize: "0.8rem" }}>
                      <span>
                        <span style={{ color: "#4ade80" }}>↓</span>{" "}
                        <span style={{ fontFamily: "monospace" }}>{fmtBytes(n.rx)}/s</span>
                      </span>
                      <span>
                        <span style={{ color: "#60a5fa" }}>↑</span>{" "}
                        <span style={{ fontFamily: "monospace" }}>{fmtBytes(n.tx)}/s</span>
                      </span>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={footer}>
        <span>Interval:</span>
        {[3, 5, 10, 30].map((s) => (
          <button
            key={s}
            onClick={() => setIntervalSec(s)}
            style={{
              background: interval === s ? "#2a2a2a" : "none",
              border: `1px solid ${interval === s ? "#444" : "transparent"}`,
              color: interval === s ? "#ccc" : "#555",
              borderRadius: 4,
              padding: "2px 7px",
              cursor: "pointer",
              fontSize: "0.73rem",
            }}
          >
            {s}s
          </button>
        ))}
        {stats && <span style={{ marginLeft: "auto" }}>{new Date(stats.ts).toLocaleTimeString()}</span>}
      </div>
    </div>
  );
};

// ─── Script entrypoint ────────────────────────────────────────────────────────

export default {
  cache: true,
  run() {
    if (csGetApplet(APPLET_NAME)) {
      csCloseApplet(APPLET_NAME);
    } else {
      csOpenApplet(APPLET_NAME, ServerMonitor, { position: "sidebar" });
    }
  },
} satisfies CsScript;
