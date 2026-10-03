export function expireGroups(state, time, events) {
  for (const group of state.groups) {
    if (group.deadline !== null && time > group.deadline + 1e-5) {
      const deadline = group.deadline;
      resetGroup(state, group);
      state.feedback = { text: 'Time expired · the totems have gone dark', until: time + 1.8 };
      events.push({ type: 'timeout', time: deadline });
    }
  }
}

function resetGroup(state, group) {
  for (const id of group.members) {
    const totem = state.totems.find(item => item.id === id);
    totem.hits = 0;
    totem.active = false;
  }
  group.deadline = null;
  group.next = 0;
  group.completed = false;
}

export function hitTotem(state, totem, time, events) {
  expireGroups(state, time, events);
  const group = state.groups.find(item => item.id === totem.group);
  if (totem.active) return;
  if (group?.type === 'ordered' && group.members[group.next] !== totem.id) {
    resetGroup(state, group);
    state.feedback = { text: 'Wrong order · start again at 1', until: time + 1.8 };
    events.push({ type: 'wrongOrder', position: { x: totem.x, y: totem.y }, time });
    return;
  }
  if (group?.type === 'timed' && group.deadline === null) group.deadline = time + group.window;
  totem.hits = Math.min(totem.requiredHits, totem.hits + 1);
  totem.active = totem.hits === totem.requiredHits;
  if (group?.type === 'ordered' && totem.active) group.next++;
  if (group && group.members.every(id => state.totems.find(item => item.id === id).active)) {
    group.completed = true;
    group.deadline = null;
  }
}
