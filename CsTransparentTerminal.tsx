/**
 * @file Transparent Terminal - Makes the xterm.js terminal window transparent with a background image.
 * @module TransparentTerminal
 * @author sagan
 * @license BSD-3-Clause
 * @version 1.0.0
 * @since 2026-06-09
 * @id cs-transparent-terminal
 * @group _Sys
 * @autorun 1
 *
 * Variables:
 *  - transparent_terminal_disabled        : "1" to disable the effect; unset / "0" means enabled.
 *  - transparent_terminal_background_image: URL of the background image (overrides default).
 *  - transparent_terminal_bg_color         : RGBA hex color for the terminal overlay (default "#00000000").
 *  - acss.transparent_terminal            : injected <style> for the terminal pane background.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";

// ── Constants ──────────────────────────────────────────────────────────────────

const VAR_DISABLED = "transparent_terminal_disabled";
const VAR_LOCAL_DISABLED = "local_transparent_terminal_disabled";
const VAR_BG_IMAGE = "transparent_terminal_background_image";
const VAR_BG_COLOR = "transparent_terminal_bg_color";
const VAR_ACSS = "acss";
const ACSS_KEY = "transparent_terminal";
const STYLE_TAG_ID = "cozy_css_" + ACSS_KEY;

/** Default overlay color — fully transparent so only the background image shows. */
const DEFAULT_BG_COLOR = "#00000000";

/** Preset overlay colors shown in the settings dialog. */
const PRESET_COLORS: { label: string; value: string; description: string }[] = [
  { label: "None", value: "#00000000", description: "Fully transparent" },
  { label: "Light", value: "#00000033", description: "80% transparent" },
  { label: "Medium", value: "#00000080", description: "50% transparent" },
  { label: "Dark", value: "#000000b3", description: "30% transparent" },
];

/**
 * Curated list of background image URLs.
 * The first entry is the default.
 */
const PRESET_IMAGES: string[] = [
  "https://raw.githubusercontent.com/sagan/cozyssh-plugins/refs/heads/master/images/anime-girl-cat-raining-4k-4w.jpg",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80",
  "https://images.unsplash.com/photo-1542223616-9de9adb5e3e8?w=1920&q=80",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80",
  "https://images.unsplash.com/photo-1477346611705-65d1883cee1e?w=1920&q=80",
];

const APPLET_NAME = "Transparent Terminal Settings";

function isEnabled(): boolean {
  return csGetVar(VAR_DISABLED) !== "1" && csGetVar(VAR_LOCAL_DISABLED) !== "1";
}

function getBackgroundImage(): string {
  const v = csGetVar(VAR_BG_IMAGE);
  return v && v.trim() ? v.trim() : PRESET_IMAGES[0];
}

function getBgColor(): string {
  const v = csGetVar(VAR_BG_COLOR);
  return v && v.trim() ? v.trim() : DEFAULT_BG_COLOR;
}

/**
 * Returns true when the color's alpha channel is fully opaque (ff).
 * Handles both 6-digit (#RRGGBB) and 8-digit (#RRGGBBAA) hex strings.
 * A 6-digit hex has no alpha component and is therefore always opaque.
 */
function isFullyOpaque(color: string): boolean {
  const hex = color.replace(/^#/, "").toLowerCase();
  if (hex.length === 8) {
    return hex.slice(6) === "ff";
  }
  // 3- or 6-digit hex: no alpha → fully opaque
  return hex.length !== 8;
}

/**
 * Build the CSS string to be stored in acss.transparent_terminal.
 * Returns an empty string when the overlay color is fully opaque,
 * because the background image would be invisible anyway.
 */
function buildCss(imageUrl: string, bgColor: string): string {
  if (isFullyOpaque(bgColor)) {
    return "";
  }
  return `
.terminal-pane {
  background-image: url(${JSON.stringify(imageUrl)});
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
`.trim();
}

/**
 * Apply terminal transparency options to all xterm instances via the proxy.
 * @param enabled  Whether the transparent terminal effect is active.
 * @param bgColor  RGBA hex string for the terminal overlay color (e.g. "#00000080").
 */
function applyTerminalOptions(enabled: boolean, bgColor: string) {
  if (enabled) {
    __CS_TERMINAL_OPTIONS__.allowTransparency = true;
    __CS_TERMINAL_OPTIONS__.theme = {
      ...__CS_TERMINAL_OPTIONS__.theme,
      background: bgColor,
    };
  } else {
    // Restore xterm.js defaults: reassign the whole object so the Proxy setter fires
    // and pushes the reset to every open terminal.
    __CS_TERMINAL_OPTIONS__ = {
      allowTransparency: false,
    };
  }
}

/**
 * Inject / update the <style> tag in <head> immediately (live, no reload).
 */
function applyStyleTag(cssText: string) {
  let tag = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = STYLE_TAG_ID;
    document.head.appendChild(tag);
  }
  tag.textContent = cssText;
}

function removeStyleTag() {
  const tag = document.getElementById(STYLE_TAG_ID);
  if (tag) {
    tag.remove();
  }
}

/**
 * Persist the CSS to the `acss` variable so it survives page reload.
 */
async function saveAcss(cssText: string | null) {
  const raw = csGetVar(VAR_ACSS);
  let acss: Record<string, string> = {};
  if (raw) {
    try {
      acss = JSON.parse(raw);
    } catch {
      /* ignore */
    }
  }
  if (cssText === null) {
    delete acss[ACSS_KEY];
  } else {
    acss[ACSS_KEY] = cssText;
  }
  await csSetVar(VAR_ACSS, Object.keys(acss).length > 0 ? JSON.stringify(acss) : undefined);
}

/**
 * Core apply function – idempotent, can be called as many times as needed.
 */
async function applyEffect(enabled?: boolean) {
  if (enabled === undefined) {
    enabled = isEnabled();
  }
  const imageUrl = getBackgroundImage();
  const bgColor = getBgColor();

  if (enabled) {
    applyTerminalOptions(true, bgColor);
    const css = buildCss(imageUrl, bgColor);
    if (css) {
      applyStyleTag(css);
      await saveAcss(css);
    } else {
      // Opaque overlay — image is invisible, so remove the background-image CSS entirely
      removeStyleTag();
      await saveAcss(null);
    }
  } else {
    applyTerminalOptions(false, bgColor);
    removeStyleTag();
    await saveAcss(null);
  }
}

// ── Settings Dialog Component ──────────────────────────────────────────────────

const SettingsDialog = () => {
  const [disabled, setDisabled] = useState(() => csGetVar(VAR_DISABLED) === "1");
  const [localDisabled, setLocalDisabled] = useState(() => csGetVar(VAR_LOCAL_DISABLED) === "1");
  const [bgImage, setBgImage] = useState(() => csGetVar(VAR_BG_IMAGE) || "");
  const [bgColor, setBgColor] = useState(() => getBgColor());
  const [customUrl, setCustomUrl] = useState("");
  const [customColor, setCustomColor] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reload state when vars change
  const reloadState = useCallback(() => {
    setDisabled(csGetVar(VAR_DISABLED) === "1");
    setLocalDisabled(csGetVar(VAR_LOCAL_DISABLED) === "1");
    setBgImage(csGetVar(VAR_BG_IMAGE) ?? "");
    setBgColor(getBgColor());
  }, []);

  useEffect(() => {
    window.addEventListener("cs:vars", reloadState);
    return () => window.removeEventListener("cs:vars", reloadState);
  }, [reloadState]);

  // The effective URL currently previewed
  const effectiveUrl = bgImage || PRESET_IMAGES[0];

  const persist = async (updates: {
    disabled?: boolean;
    localDisabled?: boolean;
    imageUrl?: string | undefined;
    bgColor?: string | undefined;
  }) => {
    setSaving(true);
    try {
      const varUpdates: Record<string, string | undefined> = {};
      if (updates.disabled !== undefined) {
        varUpdates[VAR_DISABLED] = updates.disabled ? "1" : undefined;
      }
      if (updates.localDisabled !== undefined) {
        varUpdates[VAR_LOCAL_DISABLED] = updates.localDisabled ? "1" : undefined;
      }
      if ("imageUrl" in updates) {
        varUpdates[VAR_BG_IMAGE] = updates.imageUrl;
      }
      if ("bgColor" in updates) {
        // Store undefined when it's the default so the var stays clean
        varUpdates[VAR_BG_COLOR] = updates.bgColor === DEFAULT_BG_COLOR ? undefined : updates.bgColor;
      }
      await csSetVar(varUpdates);
      await applyEffect();
      reloadState();
    } catch (e: any) {
      csNotify(`Error saving settings: ${e.message ?? e}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDisabled = () => persist({ disabled: !(csGetVar(VAR_DISABLED) === "1") });
  const handleToggleLocalDisabled = () => persist({ localDisabled: !(csGetVar(VAR_LOCAL_DISABLED) === "1") });

  const handleSelectPreset = (url: string) => persist({ imageUrl: url === PRESET_IMAGES[0] ? undefined : url });

  const handleSelectColor = (value: string) => {
    persist({ bgColor: value });
    setCustomColor("");
  };

  const handleSetCustomColor = () => {
    const raw = customColor.trim();
    if (!raw) return;
    // Normalise: prepend # if missing
    const color = raw.startsWith("#") ? raw : "#" + raw;
    persist({ bgColor: color });
    setCustomColor("");
  };

  const handleSetCustom = () => {
    const url = customUrl.trim();
    if (!url) return;
    persist({ imageUrl: url });
    setCustomUrl("");
  };

  const handleClearCustom = () => persist({ imageUrl: undefined });

  const isCustom = !!bgImage && !PRESET_IMAGES.includes(bgImage);
  const isCustomColor = !PRESET_COLORS.some((p) => p.value === bgColor);

  return (
    <div style={s.container}>
      <style>{`
        @keyframes tt-fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .tt-preset-img:hover { transform: scale(1.04); box-shadow: 0 4px 18px rgba(0,0,0,0.4) !important; }
        .tt-btn-primary:hover { background: #4338ca !important; }
        .tt-btn-danger:hover { background: #b91c1c !important; }
        .tt-btn-outline:hover { border-color: #6366f1 !important; color: #6366f1 !important; }
        .tt-input:focus { outline: none; border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15) !important; }
      `}</style>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerIcon}>🌄</div>
        <div>
          <h3 style={s.title}>Transparent Terminal</h3>
          <p style={s.subtitle}>Customize your terminal background</p>
        </div>
      </div>

      {/* Enable / Disable toggle */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Status</div>
        <div style={s.toggleRow}>
          <div>
            <div style={s.label}>Disable Transparent Terminal (global)</div>
            <div style={s.hint}>
              {disabled ? "Effect is currently disabled." : "Background image and transparency are active."}
            </div>
          </div>
          <div
            style={{ ...s.toggleSwitch, ...(disabled ? s.toggleSwitchOn : {}) }}
            onClick={handleToggleDisabled}
            title={disabled ? "Click to enable" : "Click to disable"}
          >
            <div style={{ ...s.toggleThumb, ...(disabled ? s.toggleThumbOn : {}) }} />
          </div>
        </div>
        <div style={s.toggleRow}>
          <div>
            <div style={s.label}>Disable Transparent Terminal (local)</div>
            <div style={s.hint}>
              {localDisabled ? "Effect is currently disabled." : "Background image and transparency are active."}
            </div>
          </div>
          <div
            style={{ ...s.toggleSwitch, ...(localDisabled ? s.toggleSwitchOn : {}) }}
            onClick={handleToggleLocalDisabled}
            title={localDisabled ? "Click to enable" : "Click to disable"}
          >
            <div style={{ ...s.toggleThumb, ...(localDisabled ? s.toggleThumbOn : {}) }} />
          </div>
        </div>
      </div>

      {/* Current preview */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Current Background</div>
        <div style={s.previewCard}>
          <img
            src={effectiveUrl}
            alt="Current background"
            style={s.previewImg}
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='100'%3E%3Crect fill='%23111' width='400' height='100'/%3E%3Ctext x='50%25' y='50%25' fill='%23555' text-anchor='middle' dy='.3em' font-family='system-ui' font-size='14'%3EFailed to load image%3C/text%3E%3C/svg%3E";
            }}
          />
          <div style={s.previewOverlay}>
            <span style={s.previewLabel}>{isCustom ? "Custom URL" : "Preset"}</span>
            {isCustom && (
              <button className="tt-btn-outline" style={s.btnSmallOutline} onClick={handleClearCustom}>
                Reset to default
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Preset gallery */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Preset Backgrounds</div>
        <div style={s.presetGrid}>
          {PRESET_IMAGES.map((url, i) => {
            const isActive = effectiveUrl === url;
            return (
              <div
                key={url}
                className="tt-preset-img"
                style={{ ...s.presetThumb, ...(isActive ? s.presetThumbActive : {}) }}
                onClick={() => handleSelectPreset(url)}
                title={`Preset ${i + 1}${i === 0 ? " (default)" : ""}`}
              >
                <img
                  src={url}
                  alt={`Preset ${i + 1}`}
                  style={s.presetImg}
                  onError={(e) => {
                    (e.target as HTMLImageElement).parentElement!.style.background = "#1a1a2e";
                  }}
                />
                {isActive && <div style={s.presetCheck}>✓</div>}
                {i === 0 && <div style={s.presetDefaultBadge}>default</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Overlay Color */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Terminal Overlay Color</div>
        <div style={s.colorPresets}>
          {PRESET_COLORS.map((p) => {
            const isActive = bgColor === p.value;
            return (
              <div
                key={p.value}
                style={{
                  ...s.colorChip,
                  ...(isActive ? s.colorChipActive : {}),
                }}
                onClick={() => handleSelectColor(p.value)}
                title={p.description}
              >
                <div
                  style={{
                    ...s.colorSwatch,
                    background: p.value === "#00000000" ? "transparent" : p.value,
                    border: p.value === "#00000000" ? "1px dashed #52525b" : "none",
                  }}
                />
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: isActive ? "#818cf8" : "#a1a1aa" }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "#52525b" }}>{p.description}</div>
                </div>
                {isActive && <span style={s.colorCheck}>✓</span>}
              </div>
            );
          })}
        </div>
        {/* Custom color input */}
        <div style={{ ...s.row, marginTop: 10 }}>
          <input
            className="tt-input"
            style={s.input}
            type="text"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSetCustomColor()}
            placeholder="Custom RGBA hex, e.g. #00000099"
            maxLength={9}
          />
          <button
            className="tt-btn-primary"
            style={{ ...s.btnPrimary, opacity: saving ? 0.6 : 1 }}
            onClick={handleSetCustomColor}
            disabled={saving || !customColor.trim()}
          >
            Apply
          </button>
        </div>
        {isCustomColor && (
          <div style={{ ...s.hint, marginTop: 6 }}>
            Custom: <code style={s.code}>{bgColor}</code> —{" "}
            <span style={{ color: "#818cf8", cursor: "pointer" }} onClick={() => handleSelectColor(DEFAULT_BG_COLOR)}>
              reset to default
            </span>
          </div>
        )}
        {!isCustomColor && (
          <div style={{ ...s.hint, marginTop: 6 }}>
            Sets the semi-transparent color overlay on top of the background image.
          </div>
        )}
      </div>

      <div style={s.section}>
        <div style={s.sectionTitle}>Custom Background URL</div>
        <div style={s.row}>
          <input
            ref={inputRef}
            className="tt-input"
            style={s.input}
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSetCustom()}
            placeholder="https://example.com/your-image.jpg"
          />
          <button
            className="tt-btn-primary"
            style={{ ...s.btnPrimary, opacity: saving ? 0.6 : 1 }}
            onClick={handleSetCustom}
            disabled={saving || !customUrl.trim()}
          >
            Apply
          </button>
        </div>
        <div style={s.hint}>Paste any publicly accessible image URL.</div>
      </div>
    </div>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    background: "#0f0f13",
    color: "#e4e4e7",
    fontFamily: '"Inter", "Outfit", -apple-system, sans-serif',
    overflow: "auto",
    animation: "tt-fadein 0.18s ease",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "18px 22px 14px",
    borderBottom: "1px solid #1f1f2e",
    background: "linear-gradient(135deg, #13131d 0%, #1a1a2e 100%)",
    flexShrink: 0,
  },
  headerIcon: {
    fontSize: "2rem",
    lineHeight: 1,
  },
  title: {
    margin: 0,
    fontSize: "1.1rem",
    fontWeight: 700,
    background: "linear-gradient(90deg, #818cf8 0%, #c084fc 100%)",
    WebkitBackgroundClip: "text" as const,
    WebkitTextFillColor: "transparent" as const,
  },
  subtitle: {
    margin: "3px 0 0",
    fontSize: "0.75rem",
    color: "#52525b",
  },
  section: {
    padding: "14px 22px",
    borderBottom: "1px solid #1f1f2e",
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "#52525b",
    marginBottom: 10,
  },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  label: {
    fontSize: "0.88rem",
    fontWeight: 600,
    color: "#d4d4d8",
    marginBottom: 3,
  },
  hint: {
    fontSize: "0.75rem",
    color: "#52525b",
    lineHeight: 1.4,
    marginTop: 4,
  },
  // Toggle switch
  toggleSwitch: {
    width: 40,
    height: 22,
    borderRadius: 11,
    background: "#3f3f46",
    position: "relative" as const,
    cursor: "pointer",
    transition: "background 0.2s",
    flexShrink: 0,
  },
  toggleSwitchOn: {
    background: "linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)",
  },
  toggleThumb: {
    position: "absolute" as const,
    top: 3,
    left: 3,
    width: 16,
    height: 16,
    borderRadius: "50%",
    background: "#fff",
    transition: "left 0.2s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
  },
  toggleThumbOn: {
    left: 21,
  },
  // Preview
  previewCard: {
    borderRadius: 10,
    overflow: "hidden",
    border: "1px solid #27272a",
    position: "relative" as const,
    background: "#18181b",
  },
  previewImg: {
    width: "100%",
    height: 120,
    objectFit: "cover" as const,
    display: "block",
  },
  previewOverlay: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    background: "rgba(0,0,0,0.6)",
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
  },
  previewLabel: {
    fontSize: "0.72rem",
    color: "#a1a1aa",
    fontWeight: 600,
    letterSpacing: "0.05em",
  },
  // Preset grid
  presetGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 8,
  },
  presetThumb: {
    borderRadius: 8,
    overflow: "hidden",
    cursor: "pointer",
    border: "2px solid transparent",
    position: "relative" as const,
    transition: "transform 0.2s, box-shadow 0.2s",
    background: "#18181b",
    aspectRatio: "16/9",
  },
  presetThumbActive: {
    border: "2px solid #818cf8",
    boxShadow: "0 0 0 3px rgba(129,140,248,0.3)",
  },
  presetImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    display: "block",
  },
  presetCheck: {
    position: "absolute" as const,
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#818cf8",
    color: "#fff",
    fontSize: "0.7rem",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  presetDefaultBadge: {
    position: "absolute" as const,
    bottom: 3,
    left: 3,
    fontSize: "0.6rem",
    background: "rgba(0,0,0,0.7)",
    color: "#a1a1aa",
    padding: "1px 5px",
    borderRadius: 4,
    letterSpacing: "0.05em",
  },
  // Custom URL row
  row: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    padding: "7px 11px",
    background: "#18181b",
    border: "1px solid #27272a",
    borderRadius: 7,
    color: "#e4e4e7",
    fontSize: "0.83rem",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
  },
  // Buttons
  btnPrimary: {
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    padding: "7px 16px",
    fontSize: "0.83rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s",
    whiteSpace: "nowrap" as const,
    fontFamily: "inherit",
  },
  btnSmallOutline: {
    background: "transparent",
    color: "#a1a1aa",
    border: "1px solid #3f3f46",
    borderRadius: 6,
    padding: "3px 10px",
    fontSize: "0.72rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "border-color 0.15s, color 0.15s",
    fontFamily: "inherit",
  },
  btnDanger: {
    width: "100%",
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    padding: "8px 16px",
    fontSize: "0.83rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s",
    fontFamily: "inherit",
  },
  disabledNotice: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    background: "rgba(220,38,38,0.08)",
    border: "1px solid rgba(220,38,38,0.2)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: "0.8rem",
    color: "#fca5a5",
    lineHeight: 1.5,
  },
  // Overlay color picker
  colorPresets: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap" as const,
  },
  colorChip: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 12px",
    borderRadius: 8,
    border: "1px solid #27272a",
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
    background: "#18181b",
    position: "relative" as const,
    flex: "1 1 auto",
    minWidth: 100,
  },
  colorChipActive: {
    border: "1px solid #818cf8",
    background: "rgba(129,140,248,0.08)",
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 6,
    flexShrink: 0,
    // Checkerboard to show transparency
    backgroundImage:
      "linear-gradient(45deg, #555 25%, transparent 25%), " +
      "linear-gradient(-45deg, #555 25%, transparent 25%), " +
      "linear-gradient(45deg, transparent 75%, #555 75%), " +
      "linear-gradient(-45deg, transparent 75%, #555 75%)",
    backgroundSize: "8px 8px",
    backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
  },
  colorCheck: {
    position: "absolute" as const,
    top: 4,
    right: 6,
    fontSize: "0.72rem",
    color: "#818cf8",
    fontWeight: 700,
  },
  code: {
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    fontSize: "0.8em",
    background: "rgba(129,140,248,0.1)",
    color: "#c4b5fd",
    padding: "1px 5px",
    borderRadius: 4,
  },
} as const;

// ── Script Entrypoint ──────────────────────────────────────────────────────────

export default {
  noFocus: true,
  cache: true,

  async unload() {
    applyEffect(false);
  },
  async run({ button, background }) {
    // Apply effect if enabled (idempotent, safe to call on every run)
    await applyEffect();

    if (background) {
      return;
    }

    // Open menu anchored to the button
    const anchor = document.getElementById(`button-${button.id}`) || document.getElementById("buttons");
    if (!anchor) {
      return;
    }
    const enabled = isEnabled();

    const MENU_TOGGLE = enabled ? "🚫 Disable Transparent Terminal" : "✅ Enable Transparent Terminal";
    const MENU_SETTINGS = "⚙ Settings…";

    const choice = await csOpenMenu(anchor, [MENU_TOGGLE, MENU_SETTINGS]);

    if (choice === MENU_TOGGLE) {
      await csSetVar(
        enabled ? { [VAR_LOCAL_DISABLED]: "1" } : { [VAR_DISABLED]: undefined, [VAR_LOCAL_DISABLED]: undefined },
      );
      await applyEffect();
      csFocus();
    } else if (choice === MENU_SETTINGS) {
      if (csGetApplet(APPLET_NAME)) {
        csCloseApplet(APPLET_NAME);
      } else {
        csOpenApplet(APPLET_NAME, SettingsDialog, { position: "dialog", width: 560, height: 620 });
      }
    }
  },
} satisfies CsScript;
