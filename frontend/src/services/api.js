async function request(url, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = isFormData
    ? options.headers
    : { 'Content-Type': 'application/json', ...(options.headers || {}) };

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { erro: text || `Erro HTTP ${res.status}` };
  }

  if (!res.ok) {
    throw new Error(data.erro || `Falha na requisição (${res.status})`);
  }
  return data;
}

export const api = {
  getHealth: () => request('/api/health'),
  getConfig: () => request('/api/config'),
  getDashboard: () => request('/api/dashboard'),
  resetarDemo: () => request('/api/admin/reset', { method: 'POST' }),

  analisarPrato: (formData) => request('/api/balanca/analisar', { method: 'POST', body: formData }),
  listarPratos: (limite = 15, origem) => {
    const q = new URLSearchParams({ limite: String(limite) });
    if (origem) q.set('origem', origem);
    return request(`/api/balanca/pratos?${q.toString()}`);
  },

  getFilas: () => request('/api/filas'),
  atualizarFilas: (payload) => request('/api/filas/config', { method: 'PUT', body: JSON.stringify(payload) }),

  getMesas: () => request('/api/mesas'),
  atualizarMesa: (id, status = 'proximo') =>
    request(`/api/mesas/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  simularMesas: (intensidade = 1) =>
    request('/api/mesas/simular', { method: 'POST', body: JSON.stringify({ intensidade }) }),
  reiniciarMesas: () => request('/api/mesas/reiniciar', { method: 'POST' }),

  getDesperdicio: () => request('/api/desperdicio'),
  registrarSobra: (payload) =>
    request('/api/desperdicio/sobra', {
      method: 'POST',
      body: payload instanceof FormData ? payload : JSON.stringify(payload),
    }),
  getCubas: () => request('/api/qualidade/cubas'),
  getFeedback: () => request('/api/qualidade/feedback'),
  enviarFeedback: (payload) =>
    request('/api/qualidade/feedback', { method: 'POST', body: JSON.stringify(payload) }),
};
