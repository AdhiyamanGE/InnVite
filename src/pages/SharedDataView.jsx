import React, { useState } from 'react';
import { useAppData } from '../lib/useAppData.js';
import { useLocks } from '../lib/useLocks.js';
import { logAction } from '../lib/audit.js';
import { Row, Spacer, Btn, LoadingScreen, ErrorScreen, Empty } from '../components/UI.jsx';
import GuestsTab   from '../tabs/GuestsTab.jsx';
import RoomsTab    from '../tabs/RoomsTab.jsx';
import PairsTab    from '../tabs/PairsTab.jsx';
import AllocateTab from '../tabs/AllocateTab.jsx';

export default function SharedDataView({
  ownerId,
  ownerProfile,
  currentUser,
  currentProfile,
  canEdit,
  showAlert,
  showConfirm,
  onClose,
}) {
  const [tab, setTab] = useState('guests');

  // Load the owner's data, acting as currentUser (actorId)
  const db = useAppData({
    userId:  ownerId,
    actorId: currentUser.id,
    canEdit,
  });

  const locks = useLocks({
    ownerId,
    currentUserId:   currentUser.id,
    currentUserName: currentProfile?.display_name || currentUser.email,
  });

  // Log access on first render
  React.useEffect(() => {
    logAction({
      userId: currentUser.id, ownerId,
      actionType: 'shared_data_accessed',
      description: `${currentProfile?.display_name || 'User'} accessed ${ownerProfile?.display_name || 'owner'}'s shared data`,
    });
  }, [ownerId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (db.loading) return <LoadingScreen />;
  if (db.error)   return <ErrorScreen message={db.error} />;

  const tabs = [
    { id: 'guests',   icon: '👥', label: 'Guests',   count: db.guests.length },
    { id: 'rooms',    icon: '🛏',  label: 'Rooms',    count: db.rooms.length  },
    { id: 'pairs',    icon: '🤝', label: 'Pairs',    count: db.pairs.length  },
    { id: 'allocate', icon: '✨', label: 'Allocate', count: null             },
  ];

  // Enhanced ops that acquire a lock before editing
  function withLock(type, id, op) {
    return async (...args) => {
      const acq = await locks.acquireLock(type, id);
      if (!acq.success) {
        await showAlert(`⚠️ This record is currently being edited by ${acq.lockedByName}. Try again shortly.`);
        return { error: 'locked' };
      }
      try {
        return await op(...args);
      } finally {
        locks.releaseLock(type, id);
      }
    };
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#f8ede8 0%,#fdf6f3 100%)' }}>
      {/* ── Shared data banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #5c7fa3 0%, #7b68a8 100%)',
        padding: '14px 20px', color: '#fff',
      }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <Row>
            <div>
              <div style={{ fontSize: 16, fontWeight: 'bold', fontFamily: 'Georgia,serif' }}>
                🔗 {ownerProfile?.display_name || 'Shared'}'s InnVite Data
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                {canEdit ? '✏️ You have View + Edit access' : '👁 You have View-only access'}
                {' · '}{ownerProfile?.email}
              </div>
            </div>
            <Spacer />
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
              color: '#fff', borderRadius: 8, padding: '6px 14px',
              fontFamily: 'Georgia,serif', fontSize: 12, cursor: 'pointer',
            }}>
              ← Back to My Data
            </button>
          </Row>
        </div>
      </div>

      {/* ── View-only notice ── */}
      {!canEdit && (
        <div style={{
          background: '#e3f2fd', borderBottom: '1px solid #90caf9',
          padding: '8px 20px', textAlign: 'center', fontSize: 12, color: '#1565c0',
        }}>
          👁 Read-only mode — request Edit access to make changes
        </div>
      )}

      {/* ── Change tracking notice (for editors) ── */}
      {canEdit && (
        <div style={{
          background: '#fff8e1', borderBottom: '1px solid #ffe082',
          padding: '8px 20px', textAlign: 'center', fontSize: 12, color: '#7a5c10',
        }}>
          ✏️ Your changes will be logged and highlighted for the owner — records show "Edited by you"
        </div>
      )}

      {/* ── Tab bar ── */}
      <div style={{
        display: 'flex', background: '#fff',
        borderBottom: '2px solid #c9d8ea',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '12px 6px', border: 'none',
              background: active ? '#fff' : '#f0f4f8',
              borderBottom: active ? '3px solid #5c7fa3' : '3px solid transparent',
              fontFamily: 'Georgia,serif', cursor: 'pointer',
              fontSize: 12, color: active ? '#5c7fa3' : '#aaa',
              fontWeight: active ? 'bold' : 'normal', transition: 'all .15s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span>{t.label}</span>
              {t.count !== null && (
                <span style={{ fontSize: 10, background: active ? '#5c7fa3' : '#ddd',
                               color: active ? '#fff' : '#999', borderRadius: 10, padding: '0 6px' }}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '16px 14px 40px' }}>
        {tab === 'guests' && (
          <GuestsTab
            guests={db.guests}
            addGuest={canEdit ? db.addGuest : null}
            editGuest={canEdit ? db.editGuest : null}
            removeGuest={canEdit ? db.removeGuest : null}
            clearGuestsBySide={canEdit ? db.clearGuestsBySide : null}
            clearAllGuests={canEdit ? db.clearAllGuests : null}
            dropPairsForGuest={canEdit ? db.dropPairsForGuest : null}
            locks={locks}
            currentUserId={currentUser.id}
            readOnly={!canEdit}
            showAlert={showAlert}
            editorName={currentProfile?.display_name}
          />
        )}
        {tab === 'rooms' && (
          <RoomsTab
            rooms={db.rooms}
            addRoom={canEdit ? db.addRoom : null}
            editRoom={canEdit ? db.editRoom : null}
            removeRoom={canEdit ? db.removeRoom : null}
            clearAllRooms={canEdit ? db.clearAllRooms : null}
            locks={locks}
            currentUserId={currentUser.id}
            readOnly={!canEdit}
            showAlert={showAlert}
            editorName={currentProfile?.display_name}
          />
        )}
        {tab === 'pairs' && (
          <PairsTab
            guests={db.guests}
            pairs={db.pairs}
            addPair={canEdit ? db.addPair : null}
            removePair={canEdit ? db.removePair : null}
            readOnly={!canEdit}
            showAlert={showAlert}
          />
        )}
        {tab === 'allocate' && (
          <AllocateTab
            result={db.result}
            guests={db.guests}
            rooms={db.rooms}
            runAllocation={canEdit ? db.runAllocation : null}
            updateResult={canEdit ? db.updateResult : null}
            readOnly={!canEdit}
            showAlert={showAlert}
            showConfirm={showConfirm}
          />
        )}
      </div>
    </div>
  );
}
