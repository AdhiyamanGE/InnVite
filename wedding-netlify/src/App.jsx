import React, { useState, useRef } from 'react';
import { useAuth } from './lib/useAuth.js';
import { useAppData } from './lib/useAppData.js';
import { usePermissions } from './lib/usePermissions.js';
import { logout } from './lib/auth.js';
import { logAction } from './lib/audit.js';
import { LoadingScreen, ErrorScreen, Row, Spacer, Btn, ConfirmDialog, AlertDialog } from './components/UI.jsx';
import LoginPage      from './pages/LoginPage.jsx';
import SharedDataView from './pages/SharedDataView.jsx';
import GuestsTab      from './tabs/GuestsTab.jsx';
import RoomsTab       from './tabs/RoomsTab.jsx';
import PairsTab       from './tabs/PairsTab.jsx';
import AllocateTab    from './tabs/AllocateTab.jsx';
import AccessTab      from './tabs/AccessTab.jsx';
import AuditTab       from './tabs/AuditTab.jsx';

const HEADER_GRAD = 'linear-gradient(135deg, #c8956c 0%, #b5838d 50%, #6d8b74 100%)';

export default function App() {
  const { user, profile, loading: authLoading } = useAuth();
  const [dialog, setDialog]   = useState(null);
  const [sharedView, setSharedView] = useState(null); // { ownerId, ownerProfile, canEdit }
  const importRef = useRef(null);

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (authLoading) return <LoadingScreen />;
  if (!user)       return <LoginPage onSuccess={() => {}} />;

  return (
    <MainApp
      user={user} profile={profile}
      dialog={dialog} setDialog={setDialog}
      sharedView={sharedView} setSharedView={setSharedView}
      importRef={importRef}
    />
  );
}

function MainApp({ user, profile, dialog, setDialog, sharedView, setSharedView, importRef }) {
  const db = useAppData({ userId: user.id, actorId: user.id, canEdit: true });
  const perms = usePermissions(user, profile);

  // ── Dialog helpers ────────────────────────────────────────────────────────
  function showAlert(message) {
    return new Promise(resolve => setDialog({ type: 'alert', message, resolve }));
  }
  function showConfirm(message) {
    return new Promise(resolve => setDialog({ type: 'confirm', message, resolve }));
  }
  function closeDialog(value) {
    const resolve = dialog?.resolve;
    setDialog(null);
    resolve?.(value);
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  async function handleLogout() {
    logAction({ userId: user.id, actionType: 'user_logged_out', description: `${profile?.display_name || user.email} logged out` });
    await logout();
  }

  // ── Tab navigation ────────────────────────────────────────────────────────
  const pendingCount = perms.incomingRequests.filter(r => r.status === 'pending').length;

  const mainTabs = [
    { id: 'guests',   icon: '👥', label: 'Guests',   count: db.guests.length },
    { id: 'rooms',    icon: '🛏',  label: 'Rooms',    count: db.rooms.length  },
    { id: 'pairs',    icon: '🤝', label: 'Pairs',    count: db.pairs.length  },
    { id: 'allocate', icon: '✨', label: 'Allocate', count: null             },
    { id: 'access',   icon: '🔑', label: 'Access',   count: pendingCount || null },
    { id: 'activity', icon: '📋', label: 'Activity', count: null             },
  ];

  // Shared data shortcuts (users who've granted access to current user)
  const sharedUsers = perms.grantedToMe.map(p => ({
    granterId: p.granter_id,
    profile: perms.profilesMap[p.granter_id],
    canView: p.can_view,
    canEdit: p.can_edit,
  }));

  // ── Import handler ────────────────────────────────────────────────────────
  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let parsed;
    try { parsed = JSON.parse(await file.text()); }
    catch { await showAlert('Could not read file. Must be a valid InnVite export (.json).'); return; }
    if (!parsed.guests && !parsed.rooms) { await showAlert('Not a valid backup file.'); return; }
    const { error, cancelled } = await db.importBackup(parsed, showConfirm);
    if (error) await showAlert('Import failed: ' + String(error));
    if (!error && !cancelled) await showAlert('✅ Import successful! Re-run allocation to see results.');
  }

  // ── Shared data view ──────────────────────────────────────────────────────
  if (sharedView) {
    return (
      <>
        {dialog?.type==='confirm' && <ConfirmDialog message={dialog.message} onOk={()=>closeDialog(true)} onCancel={()=>closeDialog(false)} />}
        {dialog?.type==='alert'   && <AlertDialog   message={dialog.message} onClose={()=>closeDialog()} />}
        <SharedDataView
          ownerId={sharedView.granterId}
          ownerProfile={sharedView.profile}
          currentUser={user}
          currentProfile={profile}
          canEdit={sharedView.canEdit}
          showAlert={showAlert}
          showConfirm={showConfirm}
          onClose={() => setSharedView(null)}
        />
      </>
    );
  }

  if (db.loading) return <LoadingScreen />;
  if (db.error)   return <ErrorScreen message={db.error} />;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#f8ede8 0%,#fdf6f3 100%)' }}>
      {/* ── Modals ── */}
      {dialog?.type==='confirm' && <ConfirmDialog message={dialog.message} onOk={()=>closeDialog(true)} onCancel={()=>closeDialog(false)} />}
      {dialog?.type==='alert'   && <AlertDialog   message={dialog.message} onClose={()=>closeDialog()} />}

      {/* ── Header ── */}
      <div style={{ background: HEADER_GRAD, padding: '18px 20px 14px', color: '#fff' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <Row>
            <div>
              <div style={{ fontSize: 22, fontWeight: 'bold', fontFamily: 'Georgia,serif', letterSpacing: 1 }}>
                🏨 InnVite
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                Room allocation · Preferred pairs · Collaborative
              </div>
            </div>
            <Spacer />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 'bold' }}>{profile?.display_name || user.email}</div>
              <div style={{ fontSize: 10, opacity: 0.6 }}>{user.email}</div>
              <button onClick={handleLogout} style={{
                marginTop: 4, background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.4)', color: '#fff',
                borderRadius: 6, padding: '3px 10px', fontSize: 11,
                fontFamily: 'Georgia,serif', cursor: 'pointer',
              }}>Sign Out</button>
            </div>
          </Row>

          {/* Export / Import */}
          <Row style={{ marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
            <input ref={importRef} type="file" accept=".json,application/json" onChange={handleImportFile} style={{ display: 'none' }} />
            <button onClick={db.exportBackup} style={headerBtn}>⬇ Export</button>
            <button onClick={() => importRef.current?.click()} style={headerBtn}>⬆ Import</button>
            {sharedUsers.length > 0 && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>Shared with you:</span>
                {sharedUsers.map(su => (
                  <button key={su.granterId}
                    onClick={() => setSharedView({ granterId: su.granterId, profile: su.profile, canEdit: su.canEdit })}
                    style={{ ...headerBtn, background: su.canEdit ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.15)' }}>
                    {su.canEdit ? '✏️' : '👁'} {su.profile?.display_name || su.profile?.email || 'User'}
                  </button>
                ))}
              </div>
            )}
          </Row>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '2px solid #f0ddd8', position: 'sticky', top: 0, zIndex: 100, overflowX: 'auto' }}>
        {mainTabs.map(t => {
          const active = db.tab === t.id;
          return (
            <button key={t.id} onClick={() => db.setTab(t.id)} style={{
              flex: '0 0 auto', padding: '10px 6px', border: 'none',
              background: active ? '#fff' : '#fdf6f3',
              borderBottom: active ? '3px solid #c8956c' : '3px solid transparent',
              fontFamily: 'Georgia,serif', cursor: 'pointer',
              fontSize: 11, color: active ? '#c8956c' : '#aaa',
              fontWeight: active ? 'bold' : 'normal',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              minWidth: 56,
            }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span>{t.label}</span>
              {t.count !== null && t.count > 0 && (
                <span style={{
                  fontSize: 9, background: active ? '#c8956c' : t.id==='access' ? '#e53935' : '#ddd',
                  color: '#fff', borderRadius: 10, padding: '0 5px',
                }}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '16px 14px 40px' }}>
        {db.tab === 'guests' && (
          <GuestsTab guests={db.guests} addGuest={db.addGuest} editGuest={db.editGuest}
            removeGuest={db.removeGuest} clearGuestsBySide={db.clearGuestsBySide}
            clearAllGuests={db.clearAllGuests} dropPairsForGuest={db.dropPairsForGuest}
            currentUserId={user.id} showAlert={showAlert} />
        )}
        {db.tab === 'rooms' && (
          <RoomsTab rooms={db.rooms} addRoom={db.addRoom} editRoom={db.editRoom}
            removeRoom={db.removeRoom} clearAllRooms={db.clearAllRooms}
            currentUserId={user.id} showAlert={showAlert} />
        )}
        {db.tab === 'pairs' && (
          <PairsTab guests={db.guests} pairs={db.pairs}
            addPair={db.addPair} removePair={db.removePair} showAlert={showAlert} />
        )}
        {db.tab === 'allocate' && (
          <AllocateTab result={db.result} guests={db.guests} rooms={db.rooms}
            runAllocation={db.runAllocation} updateResult={db.updateResult}
            showAlert={showAlert} showConfirm={showConfirm} />
        )}
        {db.tab === 'access' && (
          <AccessTab
            currentUser={user} currentProfile={profile}
            incomingRequests={perms.incomingRequests}
            outgoingRequests={perms.outgoingRequests}
            myGrantees={perms.myGrantees}
            grantedToMe={perms.grantedToMe}
            profilesMap={perms.profilesMap}
            sendRequest={perms.sendRequest}
            acceptRequest={perms.acceptRequest}
            rejectRequest={perms.rejectRequest}
            revokeAccess={perms.revokeAccess}
            showAlert={showAlert}
          />
        )}
        {db.tab === 'activity' && <AuditTab userId={user.id} />}
      </div>
    </div>
  );
}

const headerBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  background: 'rgba(255,255,255,0.18)', color: '#fff',
  border: '1.5px solid rgba(255,255,255,0.55)',
  borderRadius: 8, padding: '5px 13px',
  fontSize: 12, fontFamily: 'Georgia,serif', fontWeight: 'bold', cursor: 'pointer',
};
