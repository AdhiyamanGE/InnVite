import React, { useState } from 'react';
import { Card, Row, Spacer, Btn, Empty, Input, Select } from '../components/UI.jsx';

const statusColor = {
  pending:  { bg: '#fff8e1', color: '#f57f17', label: '⏳ Pending'  },
  accepted: { bg: '#e8f5e9', color: '#2e7d32', label: '✅ Accepted' },
  rejected: { bg: '#fce4ec', color: '#c62828', label: '❌ Rejected' },
};

const accessLabel = { view: '👁 View Only', edit: '✏️ Edit Only', both: '👁 + ✏️ View & Edit' };

export default function AccessTab({
  currentUser, currentProfile,
  incomingRequests, outgoingRequests,
  myGrantees, grantedToMe,
  profilesMap,
  sendRequest, acceptRequest, rejectRequest, revokeAccess,
  showAlert,
}) {
  const [toEmail,     setToEmail]     = useState('');
  const [accessType,  setAccessType]  = useState('view');
  const [sending,     setSending]     = useState(false);
  const [section,     setSection]     = useState('incoming'); // 'incoming'|'outgoing'|'send'|'granted'

  const pendingIn = incomingRequests.filter(r => r.status === 'pending');

  async function handleSend() {
    if (!toEmail.trim()) return;
    setSending(true);
    const { error } = await sendRequest(toEmail.trim(), accessType);
    setSending(false);
    if (error) { await showAlert(error); return; }
    setToEmail('');
    await showAlert('✅ Access request sent successfully!');
  }

  async function handleAccept(id) {
    const { error } = await acceptRequest(id);
    if (error) await showAlert('Failed: ' + error);
  }

  async function handleReject(id) {
    const { error } = await rejectRequest(id);
    if (error) await showAlert('Failed: ' + error);
  }

  async function handleRevoke(granteeId) {
    const name = profilesMap[granteeId]?.display_name || 'this user';
    const { error } = await revokeAccess(granteeId);
    if (error) await showAlert('Failed: ' + error);
  }

  return (
    <div>
      {/* ── Section tabs ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { id: 'incoming', label: `📥 Incoming${pendingIn.length ? ` (${pendingIn.length})` : ''}` },
          { id: 'outgoing', label: '📤 Outgoing' },
          { id: 'send',     label: '➕ Send Request' },
          { id: 'granted',  label: '🔑 Access Given' },
        ].map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{
            padding: '7px 16px', borderRadius: 8, border: 'none',
            background: section === s.id ? '#c8956c' : '#f0e8e4',
            color: section === s.id ? '#fff' : '#888',
            fontFamily: 'Georgia,serif', fontSize: 12, fontWeight: 'bold', cursor: 'pointer',
          }}>{s.label}</button>
        ))}
      </div>

      {/* ── Incoming requests ── */}
      {section === 'incoming' && (
        <div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>
            Requests from other users to access your InnVite data.
          </div>
          {incomingRequests.length === 0 && <Empty>No incoming access requests.</Empty>}
          {incomingRequests.map(req => {
            const s = statusColor[req.status];
            const from = profilesMap[req.from_user];
            return (
              <div key={req.id} style={{
                background: '#fff', borderRadius: 10, padding: '14px 16px',
                marginBottom: 10, border: '1px solid #f0ddd8',
                borderLeft: `4px solid ${s.color}`,
              }}>
                <Row style={{ flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 14 }}>
                      {from?.display_name || 'Unknown User'}
                    </div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>{from?.email}</div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                      Requests: <strong>{accessLabel[req.access_type]}</strong>
                    </div>
                    <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>
                      {new Date(req.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 'bold' }}>
                      {s.label}
                    </span>
                    {req.status === 'pending' && (
                      <Row style={{ gap: 8 }}>
                        <Btn small onClick={() => handleAccept(req.id)}>✅ Accept</Btn>
                        <Btn small danger onClick={() => handleReject(req.id)}>❌ Reject</Btn>
                      </Row>
                    )}
                  </div>
                </Row>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Outgoing requests ── */}
      {section === 'outgoing' && (
        <div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>
            Requests you've sent to access other users' data.
          </div>
          {outgoingRequests.length === 0 && <Empty>You haven't sent any access requests yet.</Empty>}
          {outgoingRequests.map(req => {
            const s = statusColor[req.status];
            const to = profilesMap[req.to_user];
            return (
              <div key={req.id} style={{
                background: '#fff', borderRadius: 10, padding: '14px 16px',
                marginBottom: 10, border: '1px solid #f0ddd8',
                borderLeft: `4px solid ${s.color}`,
              }}>
                <Row style={{ flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 14 }}>
                      To: {to?.display_name || 'Unknown User'}
                    </div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>{to?.email}</div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                      Requested: <strong>{accessLabel[req.access_type]}</strong>
                    </div>
                    <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>
                      {new Date(req.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 'bold', alignSelf: 'flex-start' }}>
                    {s.label}
                  </span>
                </Row>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Send new request ── */}
      {section === 'send' && (
        <Card title="Send Access Request">
          <div style={{ fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 1.6 }}>
            Enter the email address of another user. They will receive a request to grant you
            access to their InnVite data.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label="Their Email Address" value={toEmail} onChange={setToEmail}
              placeholder="coordinator@example.com" />
            <Select
              label="Access Type"
              value={accessType}
              onChange={setAccessType}
              options={[
                { value: 'view', label: '👁  View Only — read guest list, rooms, allocation' },
                { value: 'edit', label: '✏️  Edit Only — modify data (requires view to see it)' },
                { value: 'both', label: '👁 + ✏️  View & Edit — full access to their data' },
              ]}
            />
            <div style={{ background: '#fffbf0', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#7a5c10' }}>
              <strong>ℹ️ Incremental permissions:</strong> If you already have View access and request Edit,
              you'll end up with both if accepted.
            </div>
            <div>
              <Btn onClick={handleSend} disabled={!toEmail.trim() || sending}>
                {sending ? 'Sending…' : '📤 Send Request'}
              </Btn>
            </div>
          </div>
        </Card>
      )}

      {/* ── Access I've granted ── */}
      {section === 'granted' && (
        <div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>
            Users who currently have access to your data.
          </div>
          {myGrantees.length === 0 && <Empty>You haven't granted access to anyone yet.</Empty>}
          {myGrantees.map(perm => {
            const grantee = profilesMap[perm.grantee_id];
            return (
              <div key={perm.id} style={{
                background: '#fff', borderRadius: 10, padding: '14px 16px',
                marginBottom: 10, border: '1px solid #f0ddd8',
              }}>
                <Row style={{ flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 14 }}>
                      {grantee?.display_name || 'Unknown User'}
                    </div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>{grantee?.email}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      {perm.can_view && <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 'bold' }}>👁 View</span>}
                      {perm.can_edit && <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 'bold' }}>✏️ Edit</span>}
                    </div>
                  </div>
                  <Btn small danger onClick={() => handleRevoke(perm.grantee_id)}>Revoke</Btn>
                </Row>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
