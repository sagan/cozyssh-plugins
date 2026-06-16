/**
 * @file Command History
 * @module CmdHistory
 * @author sagan
 * @license BSD-3-Clause
 * @version 1.0.0
 * @since 2026-05-30
 * @id cs-cmd-history
 * @group _Sys
 */

import React, { useState, useEffect } from "react";
import { CSEventDetailShellIntegration } from "./csapi";

/**
 * Cmd History Applet for CozySSH
 */
const CmdHistoryApplet = () => {
  // Initialize state with the current terminal's integration data
  const [history, setHistory] = useState(() => {
    return window.csGetShellIntegration?.()?.recentCommands || [];
  });

  useEffect(() => {
    // Listener for shell integration updates (command finished, etc.)
    const handleIntegration = (e: CustomEvent<CSEventDetailShellIntegration>) => {
      if (e.detail.is_active_terminal) {
        setHistory(e.detail.shellIntegration?.recentCommands || []);
      }
    };

    // Listener for switching between terminal tabs/panes
    const handleTerminalChange = () => {
      setHistory(window.csGetShellIntegration?.()?.recentCommands || []);
    };

    window.addEventListener("cs:shell-integration", handleIntegration);
    window.addEventListener("cs:terminal-change", handleTerminalChange);

    return () => {
      window.removeEventListener("cs:shell-integration", handleIntegration);
      window.removeEventListener("cs:terminal-change", handleTerminalChange);
    };
  }, []);

  const handleCopy = (cmd: string) => {
    if (cmd) {
      navigator.clipboard.writeText(cmd);
      csNotify("Command copied to clipboard");
    }
  };

  const handleResend = (e: React.MouseEvent, cmd: string) => {
    e.stopPropagation(); // Prevent the parent click (copy) from triggering
    if (cmd && window.csSendData) {
      window.csSendData(cmd + "\n");
      window.csFocus?.();
    }
  };

  return (
    <div
      style={{
        padding: "12px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          fontWeight: "bold",
          fontSize: "0.75rem",
          color: "#888",
          letterSpacing: "0.05em",
          borderBottom: "1px solid #eee",
          paddingBottom: "6px",
          marginBottom: "4px",
        }}
      >
        RECENT COMMANDS
      </div>
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
        {history.length === 0 ? (
          <div
            style={{ textAlign: "center", color: "#999", marginTop: "30px", fontSize: "0.9rem", fontStyle: "italic" }}
          >
            No history detected.
          </div>
        ) : (
          history.map((entry, i) => (
            <div
              key={entry.commandId || i}
              onClick={() => handleCopy(entry.command || "")}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px",
                borderRadius: "8px",
                background: entry.exitStatus === 0 ? "#f0fdf4" : entry.exitStatus !== undefined ? "#fef2f2" : "#f8f9fa",
                border: "1px solid",
                borderColor:
                  entry.exitStatus === 0 ? "#dcfce7" : entry.exitStatus !== undefined ? "#fee2e2" : "#e5e7eb",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#edf2f7")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  entry.exitStatus === 0 ? "#f0fdf4" : entry.exitStatus !== undefined ? "#fef2f2" : "#f8f9fa")
              }
            >
              <div style={{ flex: 1, minWidth: 0, marginRight: "8px" }}>
                <div
                  style={{
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    color: "#1a202c",
                  }}
                >
                  {entry.command || "(empty)"}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginTop: "6px",
                    fontSize: "0.7rem",
                    color: "#718096",
                  }}
                >
                  <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  <span
                    style={{
                      color: entry.exitStatus === 0 ? "#059669" : "#dc2626",
                      fontWeight: "bold",
                    }}
                  >
                    {entry.exitStatus === 0 ? "✓" : `✗ (${entry.exitStatus})`}
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => handleResend(e, entry.command || "")}
                style={{
                  background: "#5d00ff",
                  color: "#fff",
                  border: "none",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  fontWeight: "bold",
                  flexShrink: 0,
                }}
              >
                Resend
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const APPLET_ID = "CmdHistory";

export default {
  cache: true,
  run() {
    if (csGetApplet(APPLET_ID)) {
      csCloseApplet(APPLET_ID);
    } else {
      csOpenApplet(APPLET_ID, CmdHistoryApplet, { position: "sidebar" });
    }
  },
} satisfies CsScript;
