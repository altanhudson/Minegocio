// Revendit - funcion del servidor: actividad de testers (solo para los duenos)
// Se usa desde la app: Configuracion > Mi cuenta y suscripcion > Actividad de testers.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

const REGION = 'southamerica-east1';
const DUENOS = ['altanhudson@gmail.com', 'yamility@gmail.com'];
const COLS = ['products', 'invoices', 'clients', 'compras'];
const MAX_TESTERS = 40;

function aMs(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  const n = Date.parse(ts);
  return isNaN(n) ? 0 : n;
}

// Datos opcionales: { emails: string[] }  -> guarda la lista nueva
// Devuelve: { emails: [...], testers: [ { email, existe, creado, ultimoIngreso, ultimaActividad, ultimoUso, conteos:{...} } ] }
exports.actividadTesters = onCall(
  { region: REGION, timeoutSeconds: 120, memory: '256MiB' },
  async (request) => {
    const t = request.auth && request.auth.token;
    const mail = t && t.email ? String(t.email).toLowerCase() : '';
    if (!t || t.email_verified !== true || DUENOS.indexOf(mail) === -1) {
      throw new HttpsError('permission-denied', 'Solo para los duenos.');
    }
    const db = admin.firestore();
    const ref = db.collection('adminTesters').doc('lista');

    // 1) Lista de mails: si llega una nueva se guarda; si no, se lee la guardada
    const data = request.data || {};
    let emails;
    if (Array.isArray(data.emails)) {
      const vistos = {};
      emails = [];
      data.emails.forEach((e) => {
        const m = String(e || '').trim().toLowerCase();
        if (m.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m) && !vistos[m]) { vistos[m] = 1; emails.push(m); }
      });
      if (emails.length > MAX_TESTERS) throw new HttpsError('invalid-argument', 'Maximo ' + MAX_TESTERS + ' mails.');
      await ref.set({ emails: emails, actualizado: Date.now() });
    } else {
      const sn = await ref.get();
      emails = sn.exists && Array.isArray(sn.data().emails) ? sn.data().emails : [];
    }

    // 2) Datos de cada tester (en paralelo)
    const testers = await Promise.all(emails.map(async (email) => {
      let u;
      try {
        u = await admin.auth().getUserByEmail(email);
      } catch (e) {
        if (e && e.code === 'auth/user-not-found') return { email: email, existe: false };
        logger.error('Error buscando tester', { msg: e && e.message });
        return { email: email, existe: false, error: true };
      }
      const md = u.metadata || {};
      const r = {
        email: email,
        existe: true,
        creado: Date.parse(md.creationTime) || 0,
        ultimoIngreso: Date.parse(md.lastSignInTime) || 0,
        ultimaActividad: Date.parse(md.lastRefreshTime) || 0,
        ultimoUso: 0,
        conteos: null
      };
      // Los duenos usan las colecciones de Surtimar: no se cuentan aca
      if (DUENOS.indexOf(email) !== -1) { r.esDueno = true; return r; }
      // Registros del tester (cantidad y ultimo cambio)
      try {
        const base = db.collection('negocios').doc(u.uid);
        const cont = {};
        let ultimo = 0;
        await Promise.all(COLS.map(async (c) => {
          const col = base.collection('v2_' + c);
          const [cnt, last] = await Promise.all([
            col.count().get(),
            col.orderBy('_mod', 'desc').limit(1).get()
          ]);
          cont[c] = cnt.data().count;
          if (!last.empty) { const ms = aMs(last.docs[0].get('_mod')); if (ms > ultimo) ultimo = ms; }
        }));
        r.conteos = cont;
        r.ultimoUso = ultimo;
      } catch (e) {
        logger.error('Error contando registros de tester', { msg: e && e.message });
        r.errorConteo = true;
      }
      return r;
    }));

    return { emails: emails, testers: testers };
  }
);
