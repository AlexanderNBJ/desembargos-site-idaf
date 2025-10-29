const MAPPIA_DB_URL = process.env.MAPPIA_DB_URL;
const isComumQuery = parseInt(process.env.MAPPIA_IS_COMUM_QUERY, 10);
const isGerenteQuery = parseInt(process.env.MAPPIA_IS_GERENTE_QUERY, 10);

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedPermissions(token) {
  const entry = cache.get(token);
  if (!entry) return null;
  const now = Date.now();
  if (now > entry.expireAt) {
    cache.delete(token);
    return null;
  }
  return entry.permissions;
}

function setCachedPermissions(token, permissions) {
  cache.set(token, {
    permissions,
    expireAt: Date.now() + CACHE_TTL_MS,
  });
}

// tenta extrair um "valor" booleano/número da resposta do Mappia
function extractValue(respJson) {
  if (respJson == null) 
    return -1;

  // caso seja array: pega o primeiro elemento
  if (Array.isArray(respJson) && respJson.length > 0) {
    respJson = respJson[0];
  }

  // se tem "value"
  if (Object.prototype.hasOwnProperty.call(respJson, 'value')) {
    return respJson.value;
  }

  // se tem '?column?' (ex.: { '?column?': 1 })
  if (Object.prototype.hasOwnProperty.call(respJson, '?column?')) {
    return respJson['?column?'];
  }

  // procura a primeira propriedade numérica (heurística)
  for (const k of Object.keys(respJson)) {
    const v = respJson[k];
    if (typeof v === 'number' || (!isNaN(Number(v)) && v !== null)) {
      return Number(v);
    }
  }

  return -1;
}

async function fetchPermissions(token) {
  if (!MAPPIA_DB_URL) {
    return [false, false];
  }

  const cached = getCachedPermissions(token);
  if (cached) {
    return cached;
  }

  const permissions = [false, false];

  try {
    const base = MAPPIA_DB_URL.replace(/\/$/, '');
    const urlComum = `${base}/run/${isComumQuery}?token=${encodeURIComponent(token)}`;
    const urlGerente = `${base}/run/${isGerenteQuery}?token=${encodeURIComponent(token)}`;

    const dashboardResp = await fetch(urlComum);

    if (dashboardResp.ok) {
      const dashboardData = await dashboardResp.json();
      const val = extractValue(dashboardData);

      if (val !== -1) 
        permissions[0] = true;
    } 

    const metricsResp = await fetch(urlGerente);

    if (metricsResp.ok) {
      const metricsData = await metricsResp.json();
      const val = extractValue(metricsData);

      if (val !== -1)
        permissions[1] = true;
    }

    setCachedPermissions(token, permissions);
  } 
  catch (err) {
    console.error('Error fetching permissions:', err);
  }

  return permissions;
}

module.exports = {
  fetchPermissions
};
