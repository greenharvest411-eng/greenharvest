async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers },
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export const api = {
  me: () => request('/api/auth/me'),
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  organisation: () => request('/api/organisation'),
  accounts: () => request('/api/accounts'),
  createAccount: (value) => request('/api/accounts', { method: 'POST', body: JSON.stringify(value) }),
  rates: () => request('/api/exchange-rates'),
  createRate: (value) => request('/api/exchange-rates', { method: 'POST', body: JSON.stringify(value) }),
  transactions: () => request('/api/transactions'),
  monthlyFinance: () => request('/api/finance/monthly'),
  createTransaction: (value) => request('/api/transactions', { method: 'POST', body: JSON.stringify(value) }),
  contributions: () => request('/api/contributions'),
  createContribution: (value) => request('/api/contributions', { method: 'POST', body: JSON.stringify(value) }),
  purchases: () => request('/api/purchases'),
  createPurchase: (value) => request('/api/purchases', { method: 'POST', body: JSON.stringify(value) }),
  suppliers: () => request('/api/suppliers'),
  createSupplier: (value) => request('/api/suppliers', { method: 'POST', body: JSON.stringify(value) }),
  customers: () => request('/api/customers'),
  createCustomer: (value) => request('/api/customers', { method: 'POST', body: JSON.stringify(value) }),
  stock: () => request('/api/stock'),
  createStockItem: (value) => request('/api/stock', { method: 'POST', body: JSON.stringify(value) }),
  moveStock: (value) => request('/api/stock/movements', { method: 'POST', body: JSON.stringify(value) }),
  sales: () => request('/api/sales'),
  createSale: (value) => request('/api/sales', { method: 'POST', body: JSON.stringify(value) }),
  attendance: () => request('/api/attendance'),
  createAttendance: (value) => request('/api/attendance', { method: 'POST', body: JSON.stringify(value) }),
  payroll: () => request('/api/payroll'),
  createPayroll: (value) => request('/api/payroll', { method: 'POST', body: JSON.stringify(value) }),
  addPayrollPayment: (id, value) => request(`/api/payroll/${id}/payments`, { method: 'POST', body: JSON.stringify(value) }),
  crops: () => request('/api/crop-cycles'),
  createCrop: (value) => request('/api/crop-cycles', { method: 'POST', body: JSON.stringify(value) }),
  decisions: () => request('/api/decisions'),
  createDecision: (value) => request('/api/decisions', { method: 'POST', body: JSON.stringify(value) }),
  structure: () => request('/api/structure'),
  people: () => request('/api/people'),
  createPerson: (value) => request('/api/people', { method: 'POST', body: JSON.stringify(value) }),
  updatePerson: (id, value) => request(`/api/people/${id}`, { method: 'PATCH', body: JSON.stringify(value) }),
  assets: () => request('/api/assets'),
  createAsset: (value) => request('/api/assets', { method: 'POST', body: JSON.stringify(value) }),
  updateAsset: (id, value) => request(`/api/assets/${id}`, { method: 'PATCH', body: JSON.stringify(value) }),
  createDepartment: (value) => request('/api/departments', { method: 'POST', body: JSON.stringify(value) }),
  createLocation: (value) => request('/api/locations', { method: 'POST', body: JSON.stringify(value) }),
  audit: () => request('/api/audit'),
  projects: () => request('/api/projects'),
  createProject: (value) => request('/api/projects', { method: 'POST', body: JSON.stringify(value) }),
  async uploadImage(file) {
    const signed = await request('/api/uploads/presign', { method: 'POST', body: JSON.stringify({ contentType: file.type, size: file.size, filename: file.name }) });
    const form = new FormData();
    Object.entries(signed.fields).forEach(([key, value]) => form.append(key, value));
    form.append('file', file);
    const response = await fetch(signed.uploadUrl, { method: signed.method, body: form });
    if (!response.ok) throw new Error('Could not upload picture to the company bucket');
    return signed.key;
  },
};
