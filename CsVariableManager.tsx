/**
 * @file Variable Manager.
 * @module VariableManager
 * @author sagan
 * @license BSD-3-Clause
 * @version 1.0.0
 * @since 2026-05-22
 * @id cs-variable-manager
 * @group _Sys
 */

import React, { useState, useEffect } from "react";

const SettingsApplet = () => {
  const [variables, setVariables] = useState(csGetVar());
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const refresh = () => setVariables(csGetVar());

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    await csSetVar(newKey.trim(), newValue);
    setNewKey("");
    setNewValue("");
    refresh();
    csNotify(`Variable "${newKey}" saved`);
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Delete ${key}?`)) {
      return;
    }
    await csSetVar(key, undefined);
    refresh();
    csNotify(`Variable "${key}" deleted`);
  };

  // Populate the form fields with the selected variable's data
  const handleEdit = (key: string, value: string) => {
    setNewKey(key);
    setNewValue(value);
  };

  useEffect(() => {
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <div
      style={{
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Header Section */}
      <div style={{ borderBottom: "1px solid #333", paddingBottom: "12px" }}>
        <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#5d00ff" }}>Variable Manager</h3>
        <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem" }}>Persist script data in config.yaml</p>
      </div>

      {/* Add/Edit Variable Form */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          background: "#00000014",
          padding: "12px",
          borderRadius: "8px",
          border: "1px solid #333",
        }}
      >
        <input
          placeholder="Header Name (e.g. THEME)"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          style={{
            border: "1px solid #444",
            padding: "6px 10px",
            borderRadius: "4px",
            fontSize: "0.9rem",
          }}
        />
        <input
          placeholder="Value..."
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          style={{
            border: "1px solid #444",
            padding: "6px 10px",
            borderRadius: "4px",
            fontSize: "0.9rem",
          }}
        />
        <button
          onClick={handleAdd}
          style={{
            background: "#5d00ff",
            color: "#fff",
            border: "none",
            padding: "8px",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
            marginTop: "4px",
          }}
        >
          Save Variable
        </button>
      </div>

      {/* Variable List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {Object.entries(variables).length === 0 ? (
          <div style={{ textAlign: "center", color: "#666", padding: "20px", fontSize: "0.9rem" }}>
            No variables stored.
          </div>
        ) : (
          Object.entries(variables).map(([key, val]) => (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#ffffff05",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #222",
              }}
            >
              <div style={{ flex: 1, minWidth: 0, paddingRight: "12px" }}>
                <div style={{ fontSize: "0.75rem", color: "#5d00ff", fontWeight: "bold" }}>{key}</div>
                <div
                  style={{
                    fontSize: "0.95rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={val}
                >
                  {val}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => handleEdit(key, val)}
                  style={{
                    background: "transparent",
                    color: "#4da6ff",
                    border: "1px solid #4da6ff33",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(key)}
                  style={{
                    background: "transparent",
                    color: "#ff4444",
                    border: "1px solid #ff444433",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const name = "Variable Manager";

export default {
  cache: true,
  run() {
    if (csGetApplet(name)) {
      csCloseApplet(name);
    } else {
      csOpenApplet(name, SettingsApplet, { position: "sidebar" });
    }
  },
} satisfies CsScript;
