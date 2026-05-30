/**
 * @file AI Assistant
 * @module AI
 * @author sagan
 * @license BSD-3-Clause
 * @version 1.0.0
 * @since 2026-05-30
 * @id cs-ai-assistant
 * @group _Sys
 * AI Assistant Script for CozySSH
 * Features:
 * - Sidebar Chat Interface
 * - Terminal context integration
 * - Gemini Model Support
 * - Persistent Settings
 * - Stream Responses
 * - Markdown Rendering
 */

import React, { useState, useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";

interface Msg {
  role: "user" | "system" | "assistant";
  content: string;
}

const AIAssistant = () => {
  const [view, setView] = useState<"chat" | "settings">("chat");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Settings State (Initialized from csGetVar)
  const [provider, setProvider] = useState(() => csGetVar("AI_PROVIDER") || "gemini");
  const [model, setModel] = useState(() => csGetVar("AI_MODEL") || "gemini-3.1-flash-lite-preview");
  const [apiKey, setApiKey] = useState(() => csGetVar("AI_API_KEY") || "");

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleAsk = async (forcePrompt = null) => {
    const userPrompt =
      forcePrompt ||
      input ||
      "Analyze the terminal output, diagnose errors, suggest commands or explain what's happening";

    if (!apiKey) {
      csNotify("Please configure API Key in settings.");
      setView("settings");
      return;
    }

    const terminalOutput = csGetTerminalContents();
    if (!terminalOutput) {
      return;
    }
    const systemPrompt =
      "You are a helpful terminal assistant. You have access to the recent terminal output buffer. Help the user diagnose issues, explain commands, or provide guidance. Keep responses concise and use markdown formatting.";

    const newUserMsg: Msg = { role: "user", content: userPrompt };
    setMessages((prev) => [...prev, newUserMsg]);
    setInput("");
    setLoading(true);

    try {
      // Build Gemini history
      const history = messages.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));

      // Inject terminal context into the current message
      const currentPrompt = `[TERMINAL OUTPUT START]\n${terminalOutput}\n[TERMINAL OUTPUT END]\n\nUser Question: ${userPrompt}`;

      const payload = {
        contents: [...history, { role: "user", parts: [{ text: currentPrompt }] }],
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
      };

      const response = await csFetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Unknown API error");
      }

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder("utf-8");
      let assistantMessage = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr.trim() === "[DONE]") continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.candidates && data.candidates[0].content?.parts?.[0]?.text) {
                assistantMessage += data.candidates[0].content.parts[0].text;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1].content = assistantMessage;
                  return newMessages;
                });
              }
            } catch (e) {
              // ignore parse errors for partial lines
            }
          }
        }
      }
    } catch (e) {
      csNotify(`AI Error: ${e}`);
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ Error: ${e}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleTestAndSave = async () => {
    setLoading(true);
    try {
      // Test the key with a minimal request
      const response = await csFetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }),
        }
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      // Save to persistent storage
      await csSetVar({
        AI_PROVIDER: provider,
        AI_MODEL: model,
        AI_API_KEY: apiKey,
      });
      csNotify("Settings saved!");
      setView("chat");
    } catch (e) {
      csNotify(`Test failed: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const resetSession = () => {
    setMessages([]);
    setInput("");
  };

  // --- Styles ---
  const containerStyle = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#0f0f0f",
    color: "#e0e0e0",
    fontFamily: "system-ui, -apple-system, sans-serif",
  } as const;

  const headerStyle = {
    padding: "12px 16px",
    background: "#1a1a1a",
    borderBottom: "1px solid #333",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as const;

  const buttonStyle = {
    background: "linear-gradient(135deg, #6e8efb, #a777e3)",
    color: "#fff",
    border: "none",
    padding: "8px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
  } as const;

  const inputStyle = {
    width: "100%",
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: "8px",
    padding: "12px",
    color: "#fff",
    fontSize: "0.9rem",
    outline: "none",
    resize: "none",
  } as const;

  // --- Render Views ---

  if (view === "settings") {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <span style={{ fontWeight: "bold" }}>AI Settings</span>
          <button
            onClick={() => setView("chat")}
            style={{ background: "none", color: "#888", border: "none", cursor: "pointer" }}
          >
            Back
          </button>
        </div>
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "0.8rem", color: "#888", display: "block", marginBottom: "4px" }}>Provider</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} style={inputStyle}>
              <option value="gemini">Gemini</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", color: "#888", display: "block", marginBottom: "4px" }}>Model</label>
            <select value={model} onChange={(e) => setModel(e.target.value)} style={inputStyle}>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", color: "#888", display: "block", marginBottom: "4px" }}>API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter API Key"
              style={inputStyle}
            />
          </div>
          <button onClick={handleTestAndSave} disabled={loading} style={buttonStyle}>
            {loading ? "Testing..." : "Test & Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={{ fontWeight: "bold" }}>{name}</span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={resetSession}
            style={{ background: "none", color: "#888", border: "none", cursor: "pointer", fontSize: "0.8rem" }}
          >
            Reset
          </button>
          <button
            onClick={() => setView("settings")}
            style={{ background: "none", color: "#888", border: "none", cursor: "pointer", fontSize: "0.8rem" }}
          >
            ⚙️
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{ flex: 1, overflow: "auto", padding: "16px", display: "flex", flexDirection: "column" }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: "40px", opacity: 0.5 }}>
            <div style={{ fontSize: "2rem" }}>🤖</div>
            <p>How can I help with your terminal today?</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "90%",
                padding: "10px 14px",
                borderRadius: "12px",
                background: m.role === "user" ? "#3b3b3b" : "#252525",
                marginBottom: "10px",
                fontSize: "0.9rem",
                border: "1px solid #333",
                overflowX: "auto",
              }}
            >
              {m.role === "user" ? (
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
              ) : (
                <div
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(m.content)) }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                />
              )}
            </div>
          ))
        )}
        {loading && <div style={{ fontSize: "0.8rem", opacity: 0.5 }}>AI is thinking...</div>}
      </div>

      <div style={{ padding: "16px", background: "#121212", borderTop: "1px solid #333" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          style={{ ...inputStyle, marginBottom: "8px" }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAsk();
            }
          }}
        />
        <button onClick={() => handleAsk()} disabled={loading} style={{ ...buttonStyle, width: "100%" }}>
          Ask
        </button>
      </div>
    </div>
  );
};

const name = "AI Assistant";

export default {
  cache: true,
  run() {
    if (csGetApplet(name)) {
      csCloseApplet(name);
    } else {
      csOpenApplet(name, AIAssistant, { position: "sidebar" });
    }
  },
} satisfies CsScript;
