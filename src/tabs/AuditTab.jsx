import React, { useState, useEffect } from 'react';
import { fetchAuditLogs } from '../lib/db.js';
import { Row, Spacer, Empty } from '../components/UI.jsx';

const ACTION_META = {
  user_registered:          { icon: '🎉', color: '#6d8b74', label: 'Registered'           },
  user_logged_in:           { icon: '🔐', color: '#5c7fa3', label: 'Logged In'             },
  user_logged_out:          { icon: '🚪', color: '#888',    label: 'Logged Out'            },
  access_request_sent:      { icon: '📤', color: '#c07850', label: 'Access Request Sent'   },
  access_request_accepted:  { icon: '✅', color: '#2e7d32', label: 'Access Accepted'       },
  access_request_rejected:  { icon: '❌', color: '#c62828', label: 'Access Rejected'       },
  permission_revoked:       { icon: '🚫', color: '#e65100', label: 'Access Revoked'        },
  guest_created:            { icon: '👤', color: '#6d8b74', label: 'Guest Added'           },
  guest_updated:            { icon: '✏️', color: '#5c7fa3', label: 'Guest Updated'         },
  guest_deleted:            { icon: '🗑',  color: '#c62828', label: 'Guest Deleted'         },
  room_created:             { icon: '🛏',  color: '#6d8b74', label: 'Room Added'            },
  room_updated:             { icon: '✏️', color: '#5c7fa3', label: 'Room Updated'          },
  room_deleted:             { icon: '🗑',  color: '#c62828', label: 'Room Deleted'          },
  pair_created:             { icon: '🤝', color: '#7b68a8', label: 'Pair Created'          },
  pair_deleted:             { icon: '💔', color: '#c62828', label: 'Pair Removed'          },
  allocation_run:           { icon: '✨', color: '#c8956c', label: 'Allocation Run'        },
  shared_data_accessed:     { icon: '🔍', color: '#888',    label: 'Shared Data Accessed'  },
  data_imported:            { icon: '⬆',  color: '#5c7fa3', label: 'Data Imported'         },
  data_exported:            { icon: '⬇',  color: '#7a9e7e', label: 'Data Exported'         },
};

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7)  return `${d}d ago`;
  return new Date(isoString).toLocaleDateString();
}

export default function AuditTab({ userId }) {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all'); // 'all' | category key
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    fetchAuditLogs(userId, 200).then(({ data }) => {
      if (!cancelled) { setLogs(data || []); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [userId]);

  const categories = [
    { id: 'all',        label: 'All' },
    { id: 'auth',       label: '🔐 Auth',       actions: ['user_registered','user_logged_in','user_logged_out'] },
    { id: 'access',     label: '🔑 Access',      actions: ['access_request_sent','access_request_accepted','access_request_rejected','permission_revoked'] },
    { id: 'data',       label: '📋 Data',        actions: ['guest_created','guest_updated','guest_deleted','room_created','room_updated','room_deleted','pair_created','pair_deleted'] },
    { id: 'allocation', label: '✨ Allocation',  actions: ['allocation_run'] },
    { id: 'backup',     label: '💾 Backup',      actions: ['data_imported','data_exported'] },
  ];

  const filtered = logs.filter(log => {
    if (filter !== 'all') {
      const cat = categories.find(c => c.id === filter);
      if (cat?.actions && !cat.actions.includes(log.action_type)) return false;
    }
    if (search) {
      const s = search.toLowerCase();
      return log.description.toLowerCase().includes(s) ||
        (log.actor?.display_name || '').toLowerCase().includes(s) ||
        log.action_type.toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 'bold', color: '#c8956c', marginBottom: 4 }}>Activity Timeline</div>
        <div style={{ fontSize: 12, color: '#aaa' }}>
          A complete record of all actions taken on your data and by your account.
        </div>
      </div>

      {/* Controls */}
      <Row style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search activity…"
          style={{ padding: '6px 11px', borderRadius: 8, border: '1.5px solid #e8ddd8',
                   fontSize: 13, fontFamily: 'Georgia,serif', outline: 'none', width: 200 }}
        />
        <Spacer />
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {categories.map(c => (
            <button key={c.id} onClick={() => setFilter(c.id)} style={{
              padding: '5px 12px', border: 'none', borderRadius: 7,
              background: filter === c.id ? '#c8956c' : '#f0e8e4',
              color: filter === c.id ? '#fff' : '#888',
              fontFamily: 'Georgia,serif', fontSize: 11, fontWeight: 'bold', cursor: 'pointer',
            }}>{c.label}</button>
          ))}
        </div>
      </Row>

      {loading && (
        <div style={{ textAlign: 'center', color: '#aaa', padding: 30, fontSize: 13 }}>Loading activity…</div>
      )}

      {!loading && filtered.length === 0 && (
        <Empty>{logs.length === 0 ? 'No activity recorded yet.' : 'No entries match your filter.'}</Empty>
      )}

      {/* Timeline */}
      <div style={{ position: 'relative' }}>
        {/* Vertical line */}
        {filtered.length > 0 && (
          <div style={{ position: 'absolute', left: 19, top: 0, bottom: 0, width: 2, background: '#f0ddd8', zIndex: 0 }} />
        )}

        {filtered.map((log, i) => {
          const meta = ACTION_META[log.action_type] || { icon: '•', color: '#aaa', label: log.action_type };
          const actorName = log.actor?.display_name || log.actor?.email || 'System';
          const isMe = log.user_id === userId;

          return (
            <div key={log.id} style={{
              display: 'flex', gap: 14, marginBottom: 14,
              position: 'relative', zIndex: 1,
            }}>
              {/* Icon bubble */}
              <div style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                background: '#fff', border: `2px solid ${meta.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              }}>
                {meta.icon}
              </div>

              {/* Content */}
              <div style={{
                flex: 1, background: '#fff', borderRadius: 10,
                padding: '10px 14px', border: '1px solid #f0ddd8',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                <Row style={{ flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontWeight: 'bold', fontSize: 13, color: '#333' }}>
                    {log.description}
                  </span>
                  <Spacer />
                  <span style={{ fontSize: 10, color: '#bbb', whiteSpace: 'nowrap' }}>
                    {timeAgo(log.created_at)}
                  </span>
                </Row>
                <Row style={{ marginTop: 5, gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ background: '#f5f0ee', color: '#888', padding: '2px 8px', borderRadius: 8, fontSize: 10 }}>
                    {meta.label}
                  </span>
                  <span style={{ fontSize: 11, color: isMe ? '#c8956c' : '#5c7fa3' }}>
                    by {isMe ? 'you' : actorName}
                  </span>
                  {log.entity_type && (
                    <span style={{ fontSize: 10, color: '#ccc' }}>
                      · {log.entity_type}
                    </span>
                  )}
                </Row>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 10, color: '#bbb', fontFamily: 'monospace',
                                background: '#fafafa', borderRadius: 5, padding: '3px 7px', display: 'inline-block' }}>
                    {JSON.stringify(log.metadata).slice(0, 120)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {logs.length > 0 && (
        <div style={{ textAlign: 'center', fontSize: 11, color: '#ccc', marginTop: 10 }}>
          Showing {filtered.length} of {logs.length} entries
        </div>
      )}
    </div>
  );
}
