/**
 * @file Plugin Manager.
 * @module PluginManager
 * @author sagan
 * @license MIT
 * @version 1.0.0
 * @since 2026-05-22
 * @id cs-plugin-manager
 */

import React, { useState, useEffect } from 'react';

interface PluginManifestItem {
  name: string;
  id: string;
  type: string;
  description?: string;
  payload?: string;
  filename?: string;
  autorun?: number;
  order?: number;
  group?: string;
  shortcut?: string;
  author?: string;
  version?: string;
}

const MANIFEST_URL = 'https://raw.githubusercontent.com/sagan/cozyssh-plugins/refs/heads/master/manifest.json';
const RAW_REPO_ROOT = 'https://raw.githubusercontent.com/sagan/cozyssh-plugins/refs/heads/master/';

const PluginManagerApplet = () => {
  const [plugins, setPlugins] = useState<PluginManifestItem[]>([]);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Sync state with CozySSH global buttons list
  const refreshInstalled = () => {
    try {
      const { buttons } = csGetAll();
      const installed = new Set(buttons.map((b: any) => b.id));
      setInstalledIds(installed);
    } catch (e) {
      console.error('Failed to get installed buttons:', e);
    }
  };

  // Fetch the manifest list
  const loadManifest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await csFetch(MANIFEST_URL);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      if (data && Array.isArray(data.plugins)) {
        setPlugins(data.plugins);
      } else {
        throw new Error('Invalid manifest structure');
      }
    } catch (e: any) {
      console.error('Failed to load plugin manifest:', e);
      setError(`Failed to load plugin manifest: ${e.message || e}`);
    } finally {
      setLoading(false);
      refreshInstalled();
    }
  };

  useEffect(() => {
    loadManifest();
  }, []);

  // Filter plugins by name, ID, or description
  const filteredPlugins = plugins.filter((plugin) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      plugin.name.toLowerCase().includes(query) ||
      plugin.id.toLowerCase().includes(query) ||
      (plugin.description || '').toLowerCase().includes(query)
    );
  });

  // Install or Re-install a plugin
  const handleInstall = async (plugin: PluginManifestItem) => {
    setActioningId(plugin.id);
    try {
      let payloadContent = plugin.payload || '';

      // If payload is not inlined, fetch from repository via filename
      if (!payloadContent && plugin.filename) {
        const fileUrl = `${RAW_REPO_ROOT}${plugin.filename}`;
        const res = await csFetch(fileUrl);
        if (!res.ok) {
          throw new Error(`Failed to fetch script code from ${fileUrl}`);
        }
        payloadContent = await res.text();
      }

      await csUpdateButton({
        id: plugin.id,
        name: plugin.name,
        type: plugin.type,
        payload: payloadContent,
        group: plugin.group || 'Default',
        autorun: plugin.autorun || 0,
        order: plugin.order || 0,
        shortcut: plugin.shortcut || '',
      });

      csNotify(`Plugin "${plugin.name}" installed successfully!`, 'success');
      refreshInstalled();
    } catch (e: any) {
      console.error(`Failed to install plugin ${plugin.name}:`, e);
      csNotify(`Failed to install plugin: ${e.message || e}`, 'error');
    } finally {
      setActioningId(null);
    }
  };

  // Uninstall a plugin
  const handleUninstall = async (plugin: PluginManifestItem) => {
    if (!confirm(`Are you sure you want to uninstall "${plugin.name}"?`)) {
      return;
    }
    setActioningId(plugin.id);
    try {
      await csDeleteButton(plugin.id);
      csNotify(`Plugin "${plugin.name}" uninstalled successfully!`, 'success');
      refreshInstalled();
    } catch (e: any) {
      console.error(`Failed to uninstall plugin ${plugin.name}:`, e);
      csNotify(`Failed to uninstall plugin: ${e.message || e}`, 'error');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes cs-plugin-spin {
          to { transform: rotate(360deg); }
        }
        .cs-plugin-search-input:focus {
          border-color: #4f46e5 !important;
          background: #ffffff !important;
          box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1) !important;
        }
      `}</style>

      <div style={styles.header}>
        <div>
          <h3 style={styles.title}><a target="_blank" rel="noopener noreferrer" href="https://github.com/sagan/cozyssh-plugins">Plugin Manager</a></h3>
          <p style={styles.subtitle}>Browse, install, and manage official CozySSH plugins</p>
        </div>
        <button
          onClick={loadManifest}
          style={{
            ...styles.btnReinstall,
            padding: '8px 12px',
          }}
          disabled={loading}
        >
          Refresh List
        </button>
      </div>

      <div style={styles.searchContainer}>
        <input
          type="search"
          placeholder="Search plugins by name, ID, or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="cs-plugin-search-input"
          style={styles.searchInput}
          disabled={loading}
        />
      </div>

      {error && (
        <div style={styles.alert}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <div>Fetching remote plugin database...</div>
        </div>
      ) : (
        <div style={styles.pluginList}>
          {filteredPlugins.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#71717a' }}>
              {plugins.length === 0 ? 'No plugins found in manifest.' : 'No plugins match your search query.'}
            </div>
          ) : (
            filteredPlugins.map((plugin) => {
              const isInstalled = installedIds.has(plugin.id);
              const isActioning = actioningId === plugin.id;

              return (
                <div key={plugin.id} style={styles.pluginCard}>
                  <div style={styles.pluginHeader}>
                    <div>
                      <h4 style={styles.pluginTitle}>{plugin.name}</h4>
                      <div style={styles.author}>
                        By {plugin.author || 'sagan'} {plugin.version && `• v${plugin.version}`}
                      </div>
                    </div>
                    <div>
                      {isInstalled ? (
                        <span style={styles.badgeInstalled}>Installed</span>
                      ) : (
                        <span style={styles.badgeNotInstalled}>Available</span>
                      )}
                    </div>
                  </div>

                  {plugin.description && (
                    <p style={styles.description}>{plugin.description}</p>
                  )}

                  <div style={styles.footer}>
                    <div style={styles.meta}>
                      Type: <code style={{ color: '#4f46e5', fontWeight: 600 }}>{plugin.type}</code>
                    </div>
                    <div style={styles.actions}>
                      {isInstalled ? (
                        <>
                          <button
                            onClick={() => handleUninstall(plugin)}
                            style={{
                              ...styles.btnUninstall,
                              ...(isActioning ? styles.btnDisabled : {}),
                            }}
                            disabled={isActioning}
                          >
                            Uninstall
                          </button>
                          <button
                            onClick={() => handleInstall(plugin)}
                            style={{
                              ...styles.btnReinstall,
                              ...(isActioning ? styles.btnDisabled : {}),
                            }}
                            disabled={isActioning}
                          >
                            {isActioning ? 'Loading...' : 'Re-install'}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleInstall(plugin)}
                          style={{
                            ...styles.btnInstall,
                            ...(isActioning ? styles.btnDisabled : {}),
                          }}
                          disabled={isActioning}
                        >
                          {isActioning ? 'Installing...' : 'Install'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    background: '#ffffff',
    color: '#18181b',
    fontFamily: '"Inter", "Outfit", -apple-system, sans-serif',
    height: '100%',
    minHeight: '450px',
    boxSizing: 'border-box' as 'border-box',
    overflowY: 'auto' as 'auto',
  },
  header: {
    borderBottom: '1px solid #e4e4e7',
    paddingBottom: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: '1.4rem',
    fontWeight: 700,
    background: 'linear-gradient(90deg, #4f46e5 0%, #6366f1 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '0.85rem',
    color: '#71717a',
  },
  searchContainer: {
    width: '100%',
  },
  searchInput: {
    width: '100%',
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #e4e4e7',
    background: '#f4f4f5',
    color: '#18181b',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box' as 'border-box',
    transition: 'all 0.2s ease',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 0',
    color: '#71717a',
    gap: '12px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #f4f4f5',
    borderTop: '3px solid #4f46e5',
    borderRadius: '50%',
    animation: 'cs-plugin-spin 1s linear infinite',
  },
  pluginList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  pluginCard: {
    background: '#ffffff',
    border: '1px solid #e4e4e7',
    borderRadius: '12px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    transition: 'all 0.2s ease',
  },
  pluginHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  pluginTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    margin: 0,
    color: '#18181b',
  },
  author: {
    fontSize: '0.75rem',
    color: '#71717a',
    marginTop: '2px',
  },
  badgeInstalled: {
    background: 'rgba(16, 185, 129, 0.1)',
    color: '#059669',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  badgeNotInstalled: {
    background: 'rgba(113, 113, 122, 0.08)',
    color: '#52525b',
    border: '1px solid rgba(113, 113, 122, 0.15)',
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  description: {
    fontSize: '0.9rem',
    color: '#3f3f46',
    lineHeight: 1.5,
    margin: 0,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '4px',
  },
  meta: {
    fontSize: '0.75rem',
    color: '#71717a',
  },
  actions: {
    display: 'flex',
    gap: '10px',
  },
  btnInstall: {
    background: '#4f46e5',
    color: '#ffffff',
    border: 'none',
    padding: '6px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.85rem',
    transition: 'background 0.2s ease',
  },
  btnUninstall: {
    background: 'transparent',
    color: '#dc2626',
    border: '1px solid rgba(220, 38, 38, 0.3)',
    padding: '6px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.85rem',
    transition: 'all 0.2s ease',
  },
  btnReinstall: {
    background: 'transparent',
    color: '#27272a',
    border: '1px solid rgba(39, 39, 42, 0.2)',
    padding: '6px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.85rem',
    transition: 'all 0.2s ease',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  alert: {
    background: 'rgba(239, 68, 68, 0.08)',
    color: '#b91c1c',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '0.9rem',
    margin: 0,
  }
};

const name = "Plugin Manager";

// Applet launcher entrypoint
export function run() {
  if (csGetApplet(name)) {
    csCloseApplet(name);
  } else {
    csOpenApplet(name, PluginManagerApplet, { position: "dialog", width: 700, height: 600 });
  }
}

// Controls to cache module and prevent terminal focus loss on launch
export const cache = true;
export const noFocus = true;
