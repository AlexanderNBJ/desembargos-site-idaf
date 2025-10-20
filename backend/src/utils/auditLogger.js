require('dotenv').config();
const db = require('../config/db');
const userLogsTable = process.env.USER_LOG_TABLE;

function normalizeIpValue(raw) {
  if (!raw) return null;
  // se for array, use o primeiro
  if (Array.isArray(raw)) raw = raw[0];
  // se for objeto, tente extrair campos comuns
  if (typeof raw === 'object') {
    if (raw.address) raw = raw.address;
    else if (raw.ip) raw = raw.ip;
    else {
      // converte obj para string e tentamos extrair algo útil
      try { raw = JSON.stringify(raw); } catch (e) { raw = String(raw); }
    }
  }
  raw = String(raw).trim();
  // regex simples: pega primeira ocorrência de IPv4 ou IPv6-like
  const m = raw.match(/([0-9]{1,3}(?:\.[0-9]{1,3}){3}|[0-9A-Fa-f:]{3,})/);
  return m ? m[1] : null;
}

function safeStringify(obj) {
  if (obj === null || obj === undefined) return null;
  try {
    return JSON.stringify(obj);
  } catch (e) {
    // se houver circular refs, cai aqui — guardamos uma versão curta
    try { return JSON.stringify(Object.assign({}, obj)); } catch (err) { return String(obj); }
  }
}

/* extrai IP padrão (x-forwarded-for / req.ip / connection) */
async function extractIpFromReq(req) {
  if (!req) return null;
  // Se 'trust proxy' estiver habilitado no Express, req.ip já conterá o IP do cliente final.
  // A lógica de fallback para headers ainda é útil caso o 'trust proxy' não esteja configurado
  // ou se houver cenários de múltiplos proxies.
  const ipFromTrustProxy = req.ip ? normalizeIpValue(req.ip) : null;
  if (ipFromTrustProxy) {
    return ipFromTrustProxy;
  }

  // Lógica de fallback manual (seu código original, que é robusto)
  const xf = (req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || null;
  if (xf) {
    // x-forwarded-for pode ser "cliente, proxy1, proxy2"
    const first = Array.isArray(xf) ? xf[0] : String(xf).split(',')[0];
    return normalizeIpValue(first);
  }
  if (req.connection && req.connection.remoteAddress) {
    return normalizeIpValue(req.connection.remoteAddress);
  }
  return null;
}

function extractUsernameFromReq(req) {
  try {
    if (req && req.user && (req.user.username || req.user.name || req.user.email)) {
      return req.user.username || req.user.name || req.user.email;
    }
    const auth = req && (req.headers && (req.headers.authorization || req.headers.Authorization));
    if (auth && typeof auth === 'string') {
      const parts = auth.split(' ');
      if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
        const token = parts[1];
        try {
          const jwt = require('jsonwebtoken');
          const payload = jwt.decode(token);
          if (payload) {
            return payload.username || payload.preferred_username || payload.sub || payload.name || null;
          }
        } catch (e) {
          // fallback: base64 decode payload
          try {
            const payloadPart = token.split('.')[1];
            if (payloadPart) {
              const b64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
              const json = Buffer.from(b64, 'base64').toString('utf8');
              const obj = JSON.parse(json);
              return obj.username || obj.preferred_username || obj.sub || obj.name || null;
            }
          } catch (err) {
            return null;
          }
        }
      }
    }
  } catch (err) {
    return null;
  }
  return null;
}

/**
 * logAction
 * @param {Object} opts
 *   - req: express request (optional)
 *   - username: explicit username (optional, overrides req)
 *   - action: string short action identifier (required)
 *   - details: object with additional details (optional)
 */
async function logAction({ req = null, username = null, action = '', details = null } = {}) {
  try {
    //console.log("[AUDIT DEBUG] logAction chamado, action =", action);
    const user = username || (req ? extractUsernameFromReq(req) : null);
    const ip = req ? await extractIpFromReq(req) : null;
    const ua = req && req.headers ? (req.headers['user-agent'] || null) : null;

    const query = `
      INSERT INTO ${userLogsTable} (username, action, details, ip, user_agent)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const values = [
      user || null,
      action,
      details ? safeStringify(details) : null,
      ip || null,
      ua || null
    ];

    //console.log("[AUDIT DEBUG] Tentando inserir log:");
    //console.log("  username:", values[0]);
    //console.log("  action:", values[1]);
    //console.log("  details:", values[2]);
    //console.log("  ip:", values[3]);
    //console.log("  user_agent:", values[4]);

    const result = await db.query(query, values);
    //console.log("[AUDIT DEBUG] Log inserido com sucesso, id:", result.rows[0]?.id);
  } catch (err) {
    console.error('auditLogger.logAction error:', err && err.message ? err.message : err);
  }
}

module.exports = { logAction };
