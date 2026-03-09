import { SIDES } from './constants.js';

/**
 * Core room allocation algorithm.
 *
 * Rules (in priority order):
 *  1. Preferred pairs always placed in the same room first.
 *  2. Families are atomic units — never split unless larger than every room.
 *  3. Rooms are locked to the first side that occupies them — zero cross-side mixing.
 *  4. Greedy group formation to minimise total rooms used.
 *
 * @param {object[]} guests  - Full guest list (confirmed + pending).
 * @param {object[]} rooms   - Full room list.
 * @param {object[]} pairs   - Preferred pairs [{ id, a, b }].
 * @returns {{ placed: {room, guests[]}[], unplaced: guest[] }}
 */
export function allocate(guests, rooms, pairs = []) {
  const confirmed = guests.filter(g => g.confirmed);
  if (!confirmed.length || !rooms.length) {
    return { placed: [], unplaced: confirmed };
  }

  // ── bookkeeping ─────────────────────────────────────────────────────────────
  const roomAssignments = {};                    // roomId → guestId[]
  rooms.forEach(r => { roomAssignments[r.id] = []; });
  const roomOwner = {};                          // roomId → sideId
  const assigned  = new Set();                   // guestIds that are placed

  const roomsAsc = rooms.slice().sort((a, b) => a.capacity - b.capacity);

  function findSmallestFit(sideId, needed) {
    return roomsAsc.find(r => {
      if (roomOwner[r.id] && roomOwner[r.id] !== sideId) return false;
      return r.capacity - roomAssignments[r.id].length >= needed;
    });
  }

  function anyRoomFits(sideId, needed) {
    return roomsAsc.some(r => {
      if (roomOwner[r.id] && roomOwner[r.id] !== sideId) return false;
      return r.capacity - roomAssignments[r.id].length >= needed;
    });
  }

  function claimRoom(room, sideId, guestIds) {
    if (!roomOwner[room.id]) roomOwner[room.id] = sideId;
    guestIds.forEach(id => {
      roomAssignments[room.id].push(id);
      assigned.add(id);
    });
  }

  // ── group by side ────────────────────────────────────────────────────────────
  const bySide = {};
  SIDES.forEach(s => { bySide[s.id] = []; });
  confirmed.forEach(g => { if (bySide[g.side]) bySide[g.side].push(g); });

  // ── process each side ────────────────────────────────────────────────────────
  SIDES.forEach(({ id: sideId }) => {
    const sideGuests = bySide[sideId];
    if (!sideGuests.length) return;

    // Step 1: Honor preferred pairs
    pairs.forEach(({ a, b }) => {
      const gA = sideGuests.find(g => g.id === a);
      const gB = sideGuests.find(g => g.id === b);
      if (!gA || !gB || assigned.has(a) || assigned.has(b)) return;
      const room = findSmallestFit(sideId, 2);
      if (room) {
        claimRoom(room, sideId, [a, b]);
      } else {
        const rA = findSmallestFit(sideId, 1);
        if (rA) claimRoom(rA, sideId, [a]);
        const rB = findSmallestFit(sideId, 1);
        if (rB) claimRoom(rB, sideId, [b]);
      }
    });

    // Step 2: Build family units from remaining unassigned guests
    const remaining = sideGuests.filter(g => !assigned.has(g.id));
    const familyMap = {};
    remaining.forEach(g => {
      const fk = (g.family || '').trim() || `__solo__${g.id}`;
      if (!familyMap[fk]) familyMap[fk] = { key: fk, members: [] };
      familyMap[fk].members.push(g.id);
    });
    let families = Object.values(familyMap).sort((a, b) => b.members.length - a.members.length);

    // Step 3: Greedy group formation — minimum rooms
    while (families.length > 0) {
      const seed = families[0];
      let group = [seed];
      let groupSize = seed.members.length;

      for (let i = 1; i < families.length; i++) {
        const candidate = families[i];
        if (anyRoomFits(sideId, groupSize + candidate.members.length)) {
          group.push(candidate);
          groupSize += candidate.members.length;
        }
      }

      const room = findSmallestFit(sideId, groupSize);
      if (room) {
        claimRoom(room, sideId, group.flatMap(f => f.members));
        const doneKeys = new Set(group.map(f => f.key));
        families = families.filter(f => !doneKeys.has(f.key));
      } else {
        // Forced split: seed family larger than every remaining room
        let members = seed.members.slice();
        while (members.length > 0) {
          const r = findSmallestFit(sideId, 1);
          if (!r) break;
          const space = r.capacity - roomAssignments[r.id].length;
          claimRoom(r, sideId, members.splice(0, space));
        }
        families.splice(0, 1);
      }
    }
  });

  // ── build result ─────────────────────────────────────────────────────────────
  const placed = rooms
    .filter(r => roomAssignments[r.id].length > 0)
    .map(r => ({
      room: r,
      guests: roomAssignments[r.id]
        .map(id => confirmed.find(g => g.id === id))
        .filter(Boolean),
    }));

  const unplaced = confirmed.filter(g => !assigned.has(g.id));

  return { placed, unplaced };
}
