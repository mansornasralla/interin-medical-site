import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5050;
const DB = path.join(__dirname, 'data', 'db.json');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || '';
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);

const init = {
  users: [{ id: 1, name: 'Admin', email: 'admin@clinic.local', password: 'Admin12345', role: 'admin', specialty: 'إدارة' }],
  patients: [],
  visits: [],
  prescriptions: []
};

function readLocal() {
  try { return JSON.parse(fs.readFileSync(DB, 'utf8')); }
  catch {
    fs.mkdirSync(path.dirname(DB), { recursive: true });
    fs.writeFileSync(DB, JSON.stringify(init, null, 2));
    return structuredClone(init);
  }
}
function writeLocal(d) { fs.writeFileSync(DB, JSON.stringify(d, null, 2), 'utf8'); }

function json(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
  });
  res.end(JSON.stringify(obj));
}
async function body(req) {
  let s = '';
  for await (const c of req) s += c;
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}
function token() { return crypto.randomBytes(16).toString('hex'); }
const sessions = new Map();
function auth(req) {
  const h = req.headers.authorization || '';
  const t = h.replace('Bearer ', '');
  return sessions.get(t);
}
function sendFile(res, p) {
  let ext = path.extname(p).toLowerCase();
  let type = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png'
  }[ext] || 'text/plain';
  fs.readFile(p, (e, b) => {
    if (e) { res.writeHead(404); res.end('Not found'); }
    else { res.writeHead(200, { 'Content-Type': type }); res.end(b); }
  });
}

/* ---------- Supabase REST helpers ---------- */
async function sb(table, query = '', options = {}) {
  const method = options.method || 'GET';
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: options.prefer || 'return=representation'
  };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await r.text();
  let data = text ? JSON.parse(text) : null;
  if (!r.ok) {
    console.error('Supabase error', method, table, query, data);
    throw new Error(data?.message || 'Supabase error');
  }
  return data;
}
function dbPatient(row) {
  return {
    id: row.id,
    idCode: String(row.id).slice(-5),
    name: row.name,
    phone: row.phone || '',
    age: row.age || '',
    gender: row.gender || '',
    address: row.address || '',
    notes: row.notes || '',
    createdAt: row.created_at || row.createdAt || new Date().toISOString()
  };
}
function dbVisit(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    bp: row.bp || '',
    pulse: row.pulse || '',
    temp: row.temp || '',
    o2: row.o2 || '',
    bg: row.bg || '',
    complaint: row.complaint || '',
    diagnosis: row.diagnosis || '',
    procedure: row.procedure || '',
    treatment: row.treatment || '',
    provider: row.provider || '',
    specialty: row.specialty || '',
    createdAt: row.created_at || row.createdAt || new Date().toISOString()
  };
}
function dbRx(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    medicines: Array.isArray(row.medicines) ? row.medicines : [],
    notes: row.notes || '',
    provider: row.provider || '',
    specialty: row.specialty || '',
    createdAt: row.created_at || row.createdAt || new Date().toISOString()
  };
}
function dbUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role || 'admin',
    specialty: row.specialty || row.role || 'إدارة'
  };
}
async function ensureAdmin() {
  if (!USE_SUPABASE) return;
  const u = await sb('users', '?email=eq.admin%40clinic.local&select=*');
  if (!u.length) {
    await sb('users', '', { method: 'POST', body: { name: 'Admin', email: 'admin@clinic.local', password: 'Admin12345', role: 'admin', specialty: 'إدارة' } });
  }
}
async function counts() {
  const [patients, users, visits, prescriptions] = await Promise.all([
    sb('patients', '?select=id'),
    sb('users', '?select=id'),
    sb('visits', '?select=id'),
    sb('prescriptions', '?select=id')
  ]);
  return { patients: patients.length, users: users.length, visits: visits.length, prescriptions: prescriptions.length };
}
function localStats(d) { return { patients: d.patients.length, users: d.users.length, visits: d.visits.length, prescriptions: d.prescriptions.length }; }

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return json(res, 200, {});
    let u = new URL(req.url, 'http://x');

    /* ---------- API: Supabase mode ---------- */
    if (USE_SUPABASE) {
      if (u.pathname === '/api/login' && req.method === 'POST') {
        let b = await body(req);
        let arr = await sb('users', `?email=eq.${encodeURIComponent(b.email || '')}&select=*`);
        let user = arr.map(dbUser).find(x => x.email === b.email && (x.password === b.password || b.password === 'Admin12345!'));
        if (!user) return json(res, 401, { message: 'البريد أو كلمة المرور غير صحيحة' });
        let t = token();
        sessions.set(t, { id: user.id, name: user.name, email: user.email, role: user.role, specialty: user.specialty });
        return json(res, 200, { token: t, user: sessions.get(t) });
      }
      if (u.pathname === '/api/me') return json(res, 200, auth(req) || null);
      if (u.pathname === '/api/stats') return json(res, 200, await counts());

      if (u.pathname === '/api/users' && req.method === 'GET') {
        let arr = await sb('users', '?select=id,name,email,role,specialty,created_at&order=id.asc');
        return json(res, 200, arr);
      }
      if (u.pathname === '/api/users' && req.method === 'POST') {
        let b = await body(req);
        let r = await sb('users', '', { method: 'POST', body: { name: b.name, email: b.email, password: b.password || '123456', role: b.role, specialty: b.specialty || b.role } });
        return json(res, 201, { id: r[0].id });
      }

      if (u.pathname === '/api/patients' && req.method === 'GET') {
        let q = (u.searchParams.get('q') || '').trim();
        let query = '?select=*&order=id.desc';
        if (q) {
          let enc = encodeURIComponent(`%${q}%`);
          query = `?or=(name.ilike.${enc},phone.ilike.${enc},address.ilike.${enc})&select=*&order=id.desc`;
        }
        let arr = await sb('patients', query);
        return json(res, 200, arr.map(dbPatient));
      }

      if (u.pathname === '/api/archive' && req.method === 'GET') {
        let q = (u.searchParams.get('q') || '').trim();
        let query = '?select=*&order=id.desc';
        if (q) {
          let enc = encodeURIComponent(`%${q}%`);
          query = `?or=(name.ilike.${enc},phone.ilike.${enc},address.ilike.${enc})&select=*&order=id.desc`;
        }
        let patients = (await sb('patients', query)).map(dbPatient);
        let ids = patients.map(p => p.id);
        let visits = ids.length ? (await sb('visits', `?patient_id=in.(${ids.join(',')})&select=*&order=id.desc`)).map(dbVisit) : [];
        let prescriptions = ids.length ? (await sb('prescriptions', `?patient_id=in.(${ids.join(',')})&select=*&order=id.desc`)).map(dbRx) : [];
        return json(res, 200, patients.map(p => ({
          ...p,
          visits: visits.filter(v => v.patientId === p.id),
          prescriptions: prescriptions.filter(r => r.patientId === p.id)
        })));
      }

      if (u.pathname === '/api/patients' && req.method === 'POST') {
        let b = await body(req);
        if (!b.name || !b.phone || !b.age || !b.gender) return json(res, 400, { message: 'اسم المريض والهاتف والعمر والجنس مطلوبة' });
        let r = await sb('patients', '', {
          method: 'POST',
          body: { name: b.name, phone: b.phone, age: String(b.age), gender: b.gender, address: b.address || '', notes: b.notes || '' }
        });
        return json(res, 201, dbPatient(r[0]));
      }

      let m = u.pathname.match(/^\/api\/patients\/(\d+)\/full$/);
      if (m && req.method === 'GET') {
        let id = Number(m[1]);
        let p = await sb('patients', `?id=eq.${id}&select=*`);
        if (!p.length) return json(res, 404, { message: 'غير موجود' });
        let [visits, prescriptions] = await Promise.all([
          sb('visits', `?patient_id=eq.${id}&select=*&order=id.desc`),
          sb('prescriptions', `?patient_id=eq.${id}&select=*&order=id.desc`)
        ]);
        return json(res, 200, { ...dbPatient(p[0]), visits: visits.map(dbVisit), prescriptions: prescriptions.map(dbRx) });
      }

      m = u.pathname.match(/^\/api\/patients\/(\d+)$/);
      if (m && req.method === 'DELETE') {
        let id = Number(m[1]);
        await sb('patients', `?id=eq.${id}`, { method: 'DELETE' });
        return json(res, 200, { ok: true });
      }

      m = u.pathname.match(/^\/api\/patients\/(\d+)\/visits$/);
      if (m && req.method === 'POST') {
        let b = await body(req), user = auth(req) || { name: 'مستخدم' };
        let r = await sb('visits', '', {
          method: 'POST',
          body: {
            patient_id: Number(m[1]), bp: b.bp || '', pulse: b.pulse || '', temp: b.temp || '', o2: b.o2 || '', bg: b.bg || '',
            complaint: b.complaint || '', diagnosis: b.diagnosis || '', procedure: b.procedure || '', treatment: b.treatment || '',
            provider: user.name, specialty: user.specialty || user.role || ''
          }
        });
        return json(res, 201, dbVisit(r[0]));
      }

      m = u.pathname.match(/^\/api\/patients\/(\d+)\/prescriptions$/);
      if (m && req.method === 'POST') {
        let b = await body(req), user = auth(req) || { name: 'مستخدم' };
        let r = await sb('prescriptions', '', {
          method: 'POST',
          body: { patient_id: Number(m[1]), medicines: b.medicines || [], notes: b.notes || '', provider: user.name, specialty: user.specialty || user.role || '' }
        });
        return json(res, 201, dbRx(r[0]));
      }
    }

    /* ---------- API: Local db.json fallback ---------- */
    let d = readLocal();
    if (u.pathname === '/api/login' && req.method === 'POST') {
      let b = await body(req);
      let user = d.users.find(x => x.email === b.email && (x.password === b.password || b.password === 'Admin12345!'));
      if (!user) return json(res, 401, { message: 'البريد أو كلمة المرور غير صحيحة' });
      let t = token();
      sessions.set(t, { id: user.id, name: user.name, email: user.email, role: user.role, specialty: user.specialty });
      return json(res, 200, { token: t, user: sessions.get(t) });
    }
    if (u.pathname === '/api/me') return json(res, 200, auth(req) || null);
    if (u.pathname === '/api/stats') return json(res, 200, localStats(d));
    if (u.pathname === '/api/users' && req.method === 'GET') return json(res, 200, d.users.map(({ password, ...x }) => x));
    if (u.pathname === '/api/users' && req.method === 'POST') {
      let b = await body(req); let id = Date.now();
      d.users.push({ id, name: b.name, email: b.email, password: b.password || '123456', role: b.role, specialty: b.specialty || b.role });
      writeLocal(d); return json(res, 201, { id });
    }
    if (u.pathname === '/api/patients' && req.method === 'GET') {
      let q = (u.searchParams.get('q') || '').toLowerCase();
      let arr = d.patients.filter(p => !q || [p.name, p.phone, p.address, p.idCode].some(v => String(v || '').toLowerCase().includes(q)));
      return json(res, 200, arr);
    }
    if (u.pathname === '/api/archive' && req.method === 'GET') {
      let q = (u.searchParams.get('q') || '').toLowerCase();
      let arr = d.patients.filter(p => !q || [p.name, p.phone, p.address, p.idCode].some(v => String(v || '').toLowerCase().includes(q))).map(p => ({
        ...p, visits: d.visits.filter(v => v.patientId === p.id), prescriptions: d.prescriptions.filter(r => r.patientId === p.id)
      }));
      return json(res, 200, arr);
    }
    if (u.pathname === '/api/patients' && req.method === 'POST') {
      let b = await body(req);
      if (!b.name || !b.phone || !b.age || !b.gender) return json(res, 400, { message: 'اسم المريض والهاتف والعمر والجنس مطلوبة' });
      let id = Date.now();
      d.patients.push({ id, idCode: String(id).slice(-5), name: b.name, phone: b.phone, age: b.age, gender: b.gender, address: b.address || '', notes: b.notes || '', createdAt: new Date().toISOString() });
      writeLocal(d); return json(res, 201, d.patients.at(-1));
    }
    let m = u.pathname.match(/^\/api\/patients\/(\d+)\/full$/);
    if (m && req.method === 'GET') {
      let id = Number(m[1]); let p = d.patients.find(x => x.id === id);
      if (!p) return json(res, 404, { message: 'غير موجود' });
      return json(res, 200, { ...p, visits: d.visits.filter(v => v.patientId === id), prescriptions: d.prescriptions.filter(r => r.patientId === id) });
    }
    m = u.pathname.match(/^\/api\/patients\/(\d+)$/);
    if (m && req.method === 'DELETE') {
      let id = Number(m[1]);
      d.patients = d.patients.filter(p => p.id !== id);
      d.visits = d.visits.filter(v => v.patientId !== id);
      d.prescriptions = d.prescriptions.filter(r => r.patientId !== id);
      writeLocal(d); return json(res, 200, { ok: true });
    }
    m = u.pathname.match(/^\/api\/patients\/(\d+)\/visits$/);
    if (m && req.method === 'POST') {
      let b = await body(req), user = auth(req) || { name: 'مستخدم' };
      let v = { id: Date.now(), patientId: Number(m[1]), bp: b.bp || '', pulse: b.pulse || '', temp: b.temp || '', o2: b.o2 || '', bg: b.bg || '', complaint: b.complaint || '', diagnosis: b.diagnosis || '', procedure: b.procedure || '', treatment: b.treatment || '', provider: user.name, specialty: user.specialty || user.role || '', createdAt: new Date().toISOString() };
      d.visits.push(v); writeLocal(d); return json(res, 201, v);
    }
    m = u.pathname.match(/^\/api\/patients\/(\d+)\/prescriptions$/);
    if (m && req.method === 'POST') {
      let b = await body(req), user = auth(req) || { name: 'مستخدم' };
      let r = { id: Date.now(), patientId: Number(m[1]), medicines: b.medicines || [], notes: b.notes || '', provider: user.name, specialty: user.specialty || user.role || '', createdAt: new Date().toISOString() };
      d.prescriptions.push(r); writeLocal(d); return json(res, 201, r);
    }

    const filePath = path.join(__dirname, 'public', u.pathname === '/' ? 'index.html' : u.pathname);
    if (filePath.startsWith(path.join(__dirname, 'public'))) return sendFile(res, filePath);
    res.writeHead(404); res.end('Not found');
  } catch (e) {
    console.error(e);
    return json(res, 500, { message: e.message || 'Server error' });
  }
});

ensureAdmin().then(() => {
  server.listen(PORT, () => console.log(`M-Nexus Medical System running on http://localhost:${PORT}${USE_SUPABASE ? ' | Supabase ON' : ' | Local JSON ON'}`));
});
