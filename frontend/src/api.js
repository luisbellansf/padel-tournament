async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Fehler');
  return data;
}

export const api = {
  register: (b) => request('/auth/register', { method: 'POST', body: b }),
  login:    (b) => request('/auth/login',    { method: 'POST', body: b }),
  logout:   ()  => request('/auth/logout',   { method: 'POST' }),
  me: () => request('/players/me'),
  updateMe: (b) => request('/players/me', { method: 'PATCH', body: b }),
  updateProfile: (b) => request('/players/me', { method: 'PATCH', body: b }),
  players: () => request('/players'),
  tournaments: () => request('/tournaments'),
  tournament: (id) => request(`/tournaments/${id}`),
  createTournament: (b) => request('/tournaments', { method: 'POST', body: b }),
  deleteTournament: (id) => request(`/tournaments/${id}`, { method: 'DELETE' }),
  registerForTournament: (id, b) => request(`/tournaments/${id}/register`, { method: 'POST', body: b }),
  formTeams: (id) => request(`/tournaments/${id}/form-teams`, { method: 'POST' }),
  generate: (id) => request(`/tournaments/${id}/generate`, { method: 'POST' }),
  score:     (id, matchId, b) => request(`/tournaments/${id}/matches/${matchId}/score`, { method: 'POST', body: b }),
  undoScore: (id, matchId)    => request(`/tournaments/${id}/matches/${matchId}/score`, { method: 'DELETE' }),
  startAmericanoFinals: (id, playerIds) => request(`/tournaments/${id}/americano-finals`, { method: 'POST', body: { playerIds } }),
  // Admin: Turnier-Anmeldungen verwalten
  toggleStandings:   (tId, hide)    => request(`/tournaments/${tId}/hide-standings`, { method: 'PATCH', body: { hide } }),
  adminRegisterUser: (tId, userId)  => request(`/tournaments/${tId}/register-user`, { method: 'POST', body: { userId } }),
  adminRemoveReg:    (tId, userId)  => request(`/tournaments/${tId}/registrations/${userId}`, { method: 'DELETE' }),
  // Admin: Userverwaltung
  adminUsers:    ()            => request('/players/admin/all'),
  updateUser:    (id, b)       => request(`/players/${id}`, { method: 'PATCH', body: b }),
  changeRole:    (id, role)    => request(`/players/${id}/role`, { method: 'PATCH', body: { role } }),
  deleteUser:    (id)          => request(`/players/${id}`, { method: 'DELETE' }),
  resetPassword: (id, b)       => request(`/players/${id}/reset-password`, { method: 'POST', body: b }),
};
