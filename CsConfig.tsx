/**
 * @file Config - Advanced settings manager for CozySSH.
 * @module Config
 * @author sagan
 * @license MIT
 * @version 1.0.0
 * @since 2026-05-30
 * @id cs-config
 * @group _Sys
 */

import React, { useState, useEffect, useCallback } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────

const LOCAL_PREFIX = "local_";

// all variables default (if unset) to false
const BOOL_VARS = [
  { key: "cs_noautoload", description: "Disable automatic opening of terminals on load." },
  { key: "cs_noautorun", description: "Disable automatic execution of autorun scripts." },
  { key: "cs_nowakelock", description: "Disable the screen wake lock (prevents screen staying on)." },
  { key: "cs_nomodtextarea", description: "Disable the modified textarea input mode." },
  { key: "cs_noimage", description: "Disable inline image rendering in the terminal." },
  { key: "cs_noweblinks", description: "Disable clickable web links in the terminal." },
  { key: "cs_nowebgl", description: "Disable WebGL renderer (falls back to canvas)." },
];

const INT_VARS = [
  { key: "cs_scroll_lines", description: "Terminal scroll speed in lines.", defaultValue: 3, min: 1, max: 100 },
];

type Scope = "global" | "local";
type Tab = "settings" | "global-styles" | "local-styles";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Read both scopes of a var from the live store. */
function readBothScopes(key: string): { global: string | undefined; local: string | undefined } {
  const all = csGetVar() as Record<string, string | undefined>;
  return {
    global: all[key],
    local: all[LOCAL_PREFIX + key],
  };
}

/** Initial scope: "local" if local version exists, else "global". */
function initialScope(key: string): Scope {
  const all = csGetVar() as Record<string, string | undefined>;
  return LOCAL_PREFIX + key in all ? "local" : "global";
}

/** Save a single var to its target scope (does NOT touch the other scope). */
async function persistVar(key: string, scope: Scope, value: string | undefined) {
  const storeKey = scope === "local" ? LOCAL_PREFIX + key : key;
  await csSetVar(storeKey, value);
}

// ── ScopeToggle ───────────────────────────────────────────────────────────────

const ScopeToggle = ({ scope, onChange }: { scope: Scope; onChange: (s: Scope) => void }) => (
  <div style={s.scopeToggle}>
    <button
      style={{ ...s.scopeBtn, ...(scope === "global" ? s.scopeBtnActiveGlobal : {}) }}
      onClick={() => onChange("global")}
      title="Sync across all browsers via server"
    >
      Global
    </button>
    <button
      style={{ ...s.scopeBtn, ...(scope === "local" ? s.scopeBtnActiveLocal : {}) }}
      onClick={() => onChange("local")}
      title="Stored in this browser's localStorage only"
    >
      Local
    </button>
  </div>
);

// ── BoolVarRow ────────────────────────────────────────────────────────────────

const BoolVarRow = ({ varKey, description }: { varKey: string; description: string }) => {
  const [scope, setScope] = useState<Scope>(() => initialScope(varKey));
  const [values, setValues] = useState(() => readBothScopes(varKey));

  // Refresh when localStorage changes (cross-tab)
  useEffect(() => {
    const handler = () => setValues(readBothScopes(varKey));
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [varKey]);

  const currentRaw = scope === "local" ? values.local : values.global;
  const isOn = currentRaw === "1";
  const isSet = currentRaw !== undefined;

  const handleScopeChange = (newScope: Scope) => {
    setScope(newScope);
  };

  const handleToggle = async () => {
    const newVal = isOn ? undefined : "1";
    try {
      await persistVar(varKey, scope, newVal);
      setValues(readBothScopes(varKey));
    } catch (e: any) {
      csNotify(`Error saving "${varKey}": ${e.message ?? e}`, "error");
    }
  };

  return (
    <div style={s.varCard} className="cs-cfg-varcard">
      <div style={s.varHeader}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.varKey}>{varKey}</div>
          <div style={s.varDesc}>{description}</div>
        </div>
        <ScopeToggle scope={scope} onChange={handleScopeChange} />
      </div>
      <div style={s.varControls}>
        <div
          style={{ ...s.toggleSwitch, ...(isOn ? s.toggleSwitchOn : {}) }}
          onClick={handleToggle}
          title={isOn ? "Click to disable" : "Click to enable"}
        >
          <div style={{ ...s.toggleThumb, ...(isOn ? s.toggleThumbOn : {}) }} />
        </div>
        <span style={{ fontSize: "0.83rem", fontWeight: 600, color: isOn ? "#4f46e5" : "#a1a1aa" }}>
          {isOn ? "Enabled" : "Disabled"}
        </span>
        <span style={{ ...s.unsetBadge, visibility: isSet ? "hidden" : "visible" }}>not set</span>
      </div>
    </div>
  );
};

// ── ScrollLinesRow ────────────────────────────────────────────────────────────

const IntVarRow = ({
  varKey,
  description,
  defaultValue,
  min,
  max,
}: {
  varKey: string;
  description: string;
  defaultValue: number;
  min: number;
  max: number;
}) => {
  const [scope, setScope] = useState<Scope>(() => initialScope(varKey));
  const [values, setValues] = useState(() => readBothScopes(varKey));
  // Local draft for the number input (so user can type freely before blur)
  const currentRaw = scope === "local" ? values.local : values.global;
  const [draft, setDraft] = useState(currentRaw ?? defaultValue.toString());

  // When scope switches, update draft to reflect the other scope's value
  useEffect(() => {
    const v = scope === "local" ? values.local : values.global;
    setDraft(v ?? defaultValue.toString());
  }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh values from store on storage event
  useEffect(() => {
    const handler = () => {
      const fresh = readBothScopes(varKey);
      setValues(fresh);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const handleBlur = async () => {
    const parsed = parseInt(draft);
    const clamped = isNaN(parsed) ? 3 : Math.max(1, Math.min(50, parsed));
    const valStr = String(clamped);
    setDraft(valStr);
    try {
      await persistVar(varKey, scope, valStr);
      setValues(readBothScopes(varKey));
    } catch (e: any) {
      csNotify(`Error saving "${varKey}": ${e.message ?? e}`, "error");
    }
  };

  const handleReset = async () => {
    try {
      await persistVar(varKey, scope, undefined);
      setValues(readBothScopes(varKey));
      setDraft(defaultValue.toString());
    } catch (e: any) {
      csNotify(`Error resetting "${varKey}": ${e.message ?? e}`, "error");
    }
  };

  const isSet = currentRaw !== undefined;

  return (
    <div style={s.varCard} className="cs-cfg-varcard">
      <div style={s.varHeader}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.varKey}>{varKey}</div>
          <div style={s.varDesc}>
            {description} (default: {defaultValue}).
          </div>
        </div>
        <ScopeToggle scope={scope} onChange={setScope} />
      </div>
      <div style={s.varControls}>
        <input
          type="number"
          min={min}
          max={max}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          style={s.numberInput}
        />
        {isSet && (
          <button onClick={handleReset} style={s.resetBtn}>
            Reset
          </button>
        )}
        <span style={{ ...s.unsetBadge, visibility: isSet ? "hidden" : "visible" }}>not set</span>
      </div>
    </div>
  );
};

// ── Settings Tab ──────────────────────────────────────────────────────────────

const SettingsTab = () => (
  <div style={s.tabContent}>
    {INT_VARS.map(({ key, description, defaultValue, min, max }) => (
      <IntVarRow key={key} varKey={key} description={description} defaultValue={defaultValue} min={min} max={max} />
    ))}
    {BOOL_VARS.map(({ key, description }) => (
      <BoolVarRow key={key} varKey={key} description={description} />
    ))}
  </div>
);

// ── StyleEditor (reused for both global and local) ────────────────────────────

interface StyleEditorProps {
  cssKey: string; // e.g. "css" or "local_css"
  classKey: string; // e.g. "class" or "local_class"
  scope: "Global" | "Local";
}

const StyleEditor = ({ cssKey, classKey, scope }: StyleEditorProps) => {
  const all = () => csGetVar() as Record<string, string | undefined>;

  const [cssVal, setCssVal] = useState(() => all()[cssKey] ?? "");
  const [classVal, setClassVal] = useState(() => all()[classKey] ?? "");
  // Track saving state per key for visual feedback
  const [saving, setSaving] = useState<string | null>(null);

  const loadValues = useCallback(() => {
    const a = all();
    setCssVal(a[cssKey] ?? "");
    setClassVal(a[classKey] ?? "");
  }, [cssKey, classKey]);

  useEffect(() => {
    loadValues();
    window.addEventListener("storage", loadValues);
    return () => window.removeEventListener("storage", loadValues);
  }, [loadValues]);

  const save = async (key: string, value: string) => {
    setSaving(key);
    try {
      await csSetVar(key, value || undefined);
      loadValues();
    } catch (e: any) {
      csNotify(`Error saving "${key}": ${e.message ?? e}`, "error");
    } finally {
      setSaving(null);
    }
  };

  const isSaving = (key: string) => saving === key;

  return (
    <div style={s.tabContent}>
      <div style={s.styleNotice}>
        <span>ℹ</span>
        <span>
          {scope === "Global"
            ? "Global styles are synced to the server and applied across all browsers."
            : "Local styles are stored in this browser only and not synced."}{" "}
          Changes apply on the <strong>next page reload</strong>.
        </span>
      </div>

      {/* CSS editor */}
      <div style={s.styleCard}>
        <div style={s.varKey}>
          {cssKey}
          <span style={scope === "Global" ? s.badgeGlobal : s.badgeLocal}>{scope}</span>
        </div>
        <div style={s.varDesc}>
          Injected as a <code style={s.inlineCode}>&lt;style&gt;</code> tag in the document head on page load.
        </div>
        <textarea
          className="cs-cfg-textarea"
          style={{
            ...s.cssTextarea,
            ...(isSaving(cssKey) ? { opacity: 0.6 } : {}),
          }}
          value={cssVal}
          onChange={(e) => setCssVal(e.target.value)}
          onBlur={() => save(cssKey, cssVal)}
          placeholder="/* Custom CSS rules e.g. body { font-size: 15px; } */"
          spellCheck={false}
        />
      </div>

      {/* Class editor */}
      <div style={s.styleCard}>
        <div style={s.varKey}>
          {classKey}
          <span style={scope === "Global" ? s.badgeGlobal : s.badgeLocal}>{scope}</span>
        </div>
        <div style={s.varDesc}>
          Space-separated CSS class names added to the <code style={s.inlineCode}>&lt;html&gt;</code> element on load.
        </div>
        <input
          type="text"
          className="cs-cfg-classinput"
          style={{
            ...s.classInput,
            ...(isSaving(classKey) ? { opacity: 0.6 } : {}),
          }}
          value={classVal}
          onChange={(e) => setClassVal(e.target.value)}
          onBlur={() => save(classKey, classVal)}
          placeholder="e.g. dark compact"
        />
      </div>
    </div>
  );
};

// ── Main Applet ───────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "settings", label: "⚙ Settings" },
  { id: "global-styles", label: "🌐 Global Styles" },
  { id: "local-styles", label: "💻 Local Styles" },
];

const ConfigApplet = () => {
  const [activeTab, setActiveTab] = useState<Tab>("settings");

  return (
    <div style={s.container}>
      <style>{`
        @keyframes cs-cfg-fadein {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: none; }
        }
        .cs-cfg-varcard:hover {
          border-color: #c7d2fe !important;
          box-shadow: 0 2px 8px rgba(79,70,229,0.07) !important;
        }
        .cs-cfg-textarea:focus, .cs-cfg-classinput:focus {
          outline: none;
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.15) !important;
        }
      `}</style>

      {/* Header */}
      <div style={s.header}>
        <h3 style={s.title}>⚙ CozySSH Config</h3>
        <p style={s.subtitle}>Advanced settings — changes are saved automatically</p>
      </div>

      {/* Tab bar */}
      <div style={s.tabBar}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            style={{ ...s.tabBtn, ...(activeTab === id ? s.tabBtnActive : {}) }}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div style={s.tabBody} key={activeTab}>
        {activeTab === "settings" && <SettingsTab />}
        {activeTab === "global-styles" && <StyleEditor cssKey="css" classKey="class" scope="Global" />}
        {activeTab === "local-styles" && (
          <StyleEditor cssKey={LOCAL_PREFIX + "css"} classKey={LOCAL_PREFIX + "class"} scope="Local" />
        )}
      </div>
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  resetBtn: {
    background: "#ef4444",
    color: "#ffffff",
    border: "none",
    padding: "6px 12px",
    borderRadius: 6,
    cursor: "pointer",
  },
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    background: "#ffffff",
    color: "#18181b",
    fontFamily: '"Inter", "Outfit", -apple-system, sans-serif',
    overflow: "hidden",
  },
  header: {
    padding: "18px 24px 14px",
    borderBottom: "1px solid #e4e4e7",
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: "1.2rem",
    fontWeight: 700,
    background: "linear-gradient(90deg, #4f46e5 0%, #6366f1 100%)",
    WebkitBackgroundClip: "text" as const,
    WebkitTextFillColor: "transparent" as const,
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: "0.78rem",
    color: "#71717a",
  },
  tabBar: {
    display: "flex",
    gap: "2px",
    padding: "10px 20px 0",
    borderBottom: "1px solid #e4e4e7",
    flexShrink: 0,
  },
  tabBtn: {
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    padding: "7px 14px",
    fontSize: "0.83rem",
    fontWeight: 600,
    color: "#71717a",
    cursor: "pointer",
    borderRadius: "6px 6px 0 0",
    transition: "color 0.15s",
    marginBottom: "-1px",
    whiteSpace: "nowrap" as const,
  },
  tabBtnActive: {
    color: "#4f46e5",
    borderBottom: "2px solid #4f46e5",
  },
  tabBody: {
    flex: 1,
    overflow: "hidden",
    animation: "cs-cfg-fadein 0.18s ease",
  },
  tabContent: {
    height: "100%",
    overflowY: "auto" as const,
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
    boxSizing: "border-box" as const,
  },
  // Var cards
  varCard: {
    border: "1px solid #e4e4e7",
    borderRadius: "10px",
    padding: "13px 16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "9px",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  varHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    flexWrap: "wrap" as const,
  },
  varKey: {
    fontSize: "0.82rem",
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    fontWeight: 700,
    color: "#3730a3",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  varDesc: {
    fontSize: "0.77rem",
    color: "#71717a",
    marginTop: "3px",
    lineHeight: 1.4,
  },
  varControls: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  // Scope toggle
  scopeToggle: {
    display: "flex",
    borderRadius: "6px",
    overflow: "hidden",
    border: "1px solid #e4e4e7",
    flexShrink: 0,
  },
  scopeBtn: {
    background: "#f4f4f5",
    border: "none",
    padding: "3px 10px",
    fontSize: "0.72rem",
    fontWeight: 700,
    color: "#71717a",
    cursor: "pointer",
    transition: "all 0.15s",
    letterSpacing: "0.02em",
  },
  scopeBtnActiveGlobal: {
    background: "#4f46e5",
    color: "#fff",
  },
  scopeBtnActiveLocal: {
    background: "#0891b2",
    color: "#fff",
  },
  // Toggle switch
  toggleSwitch: {
    width: "36px",
    height: "20px",
    borderRadius: "10px",
    background: "#d4d4d8",
    position: "relative" as const,
    cursor: "pointer",
    transition: "background 0.2s",
    flexShrink: 0,
  },
  toggleSwitchOn: {
    background: "#4f46e5",
  },
  toggleThumb: {
    position: "absolute" as const,
    top: "2px",
    left: "2px",
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    background: "#fff",
    transition: "left 0.2s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
  },
  toggleThumbOn: {
    left: "18px",
  },
  // Number input
  numberInput: {
    width: "80px",
    padding: "5px 9px",
    border: "1px solid #e4e4e7",
    borderRadius: "6px",
    fontSize: "0.88rem",
    color: "#18181b",
    background: "#f4f4f5",
    outline: "none",
  },
  unsetBadge: {
    fontSize: "0.7rem",
    color: "#a1a1aa",
    fontStyle: "italic",
    background: "#f4f4f5",
    padding: "2px 7px",
    borderRadius: "99px",
    border: "1px solid #e4e4e7",
  },
  // Styles tab
  styleNotice: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-start",
    background: "rgba(99,102,241,0.06)",
    border: "1px solid rgba(99,102,241,0.18)",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "0.8rem",
    color: "#3730a3",
    lineHeight: 1.55,
  },
  styleCard: {
    border: "1px solid #e4e4e7",
    borderRadius: "10px",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },
  badgeGlobal: {
    fontSize: "0.62rem",
    fontFamily: '"Inter", sans-serif',
    fontWeight: 700,
    background: "rgba(79,70,229,0.1)",
    color: "#4f46e5",
    border: "1px solid rgba(79,70,229,0.2)",
    borderRadius: "4px",
    padding: "1px 5px",
    letterSpacing: "0.03em",
  },
  badgeLocal: {
    fontSize: "0.62rem",
    fontFamily: '"Inter", sans-serif',
    fontWeight: 700,
    background: "rgba(8,145,178,0.1)",
    color: "#0891b2",
    border: "1px solid rgba(8,145,178,0.2)",
    borderRadius: "4px",
    padding: "1px 5px",
    letterSpacing: "0.03em",
  },
  cssTextarea: {
    width: "100%",
    minHeight: "140px",
    padding: "10px 12px",
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    fontSize: "0.8rem",
    lineHeight: 1.65,
    border: "1px solid #e4e4e7",
    borderRadius: "6px",
    background: "#fafafa",
    color: "#18181b",
    resize: "vertical" as const,
    boxSizing: "border-box" as const,
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  classInput: {
    width: "100%",
    padding: "7px 12px",
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    fontSize: "0.85rem",
    border: "1px solid #e4e4e7",
    borderRadius: "6px",
    background: "#fafafa",
    color: "#18181b",
    boxSizing: "border-box" as const,
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  inlineCode: {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: "0.85em",
    background: "rgba(79,70,229,0.08)",
    padding: "1px 4px",
    borderRadius: "3px",
  },
} as const;

// ── Export ────────────────────────────────────────────────────────────────────

const APPLET_NAME = "Config";

export default {
  noFocus: true,
  cache: true,
  run() {
    if (csGetApplet(APPLET_NAME)) {
      csCloseApplet(APPLET_NAME);
    } else {
      csOpenApplet(APPLET_NAME, ConfigApplet, { position: "dialog", width: 680, height: 600 });
    }
  },
} satisfies CsScript;
