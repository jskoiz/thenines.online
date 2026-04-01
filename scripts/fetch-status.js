#!/usr/bin/env node
// Fetches Claude & OpenAI status pages, normalizes into the data shape
// the frontend expects, and writes public/data/status.json.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';

// --- Status mapping ---
const IMPACT_MAP = { none: 'g', minor: 'y', major: 'r', critical: 'r' };
const PRIORITY = { g: 0, b: 1, y: 2, o: 3, r: 4 };
const UPTIME_SCORES = { g: 100, y: 99.5, o: 98, r: 95, b: 99 };
const STATUS_MAP = {
  operational: 'g',
  degraded_performance: 'y',
  partial_outage: 'o',
  major_outage: 'r',
  under_maintenance: 'b',
};

// --- Component mapping ---
const CLAUDE_COMPONENT_MAP = {
  'claude.ai': 'claude.ai',
  'platform.claude.com (formerly console.anthropic.com)': 'platform.claude.com',
  'Claude API (api.anthropic.com)': 'Claude API',
  'Claude Code': 'Claude Code',
  'Claude for Government': 'Claude for Government',
};

const OPENAI_COMPONENT_GROUPS = {
  'OpenAI APIs': [
    'Fine-tuning', 'Embeddings', 'Images', 'Batch', 'Audio', 'Moderations',
    'Compliance API', 'Codex API',
  ],
  'ChatGPT': [
    'Login', 'Conversations', 'Voice mode', 'GPTs', 'Image Generation',
    'Deep Research', 'Agent', 'Connectors/Apps', 'App', 'ChatGPT Atlas',
  ],
  'Codex': ['Codex Web', 'CLI', 'VS Code extension'],
  'Sora': ['Sora', 'Video viewing', 'Video generation'],
  'FedRAMP': [],
};

const CLAUDE_SERVICES = ['Claude API', 'claude.ai', 'Claude Code', 'platform.claude.com', 'Claude for Government'];
const OPENAI_SERVICES = ['OpenAI APIs', 'ChatGPT', 'Codex', 'Sora', 'FedRAMP'];

// --- Helpers ---
function dateKey(d) {
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function buildDateRange() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dates = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d);
  }
  return dates;
}

function worstStatusForDay(incidents, componentName, date) {
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  let worst = 'g';
  for (const inc of incidents) {
    const created = new Date(inc.created_at);
    const resolved = inc.resolved_at ? new Date(inc.resolved_at) : new Date();
    if (created < dayEnd && resolved > dayStart) {
      const affects = inc.components?.some(c => c.name === componentName) ?? false;
      if (affects || !inc.components?.length) {
        const code = IMPACT_MAP[inc.impact] || 'y';
        if ((PRIORITY[code] || 0) > (PRIORITY[worst] || 0)) worst = code;
      }
    }
  }
  return worst;
}

function downtimeMinutesForDay(incidents, componentName, date) {
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  let totalMs = 0;
  for (const inc of incidents) {
    const created = new Date(inc.created_at);
    const resolved = inc.resolved_at ? new Date(inc.resolved_at) : new Date();
    if (created < dayEnd && resolved > dayStart) {
      const affects = inc.components?.some(c => c.name === componentName) ?? false;
      if (affects || !inc.components?.length) {
        totalMs += Math.max(0, Math.min(resolved.getTime(), dayEnd.getTime()) - Math.max(created.getTime(), dayStart.getTime()));
      }
    }
  }
  return Math.round(totalMs / 60000);
}

function worstGroupStatus(incidents, subComponents, date) {
  let worst = 'g';
  for (const sub of subComponents) {
    const s = worstStatusForDay(incidents, sub, date);
    if ((PRIORITY[s] || 0) > (PRIORITY[worst] || 0)) worst = s;
  }
  // Also check incidents with no components listed (affects all)
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  for (const inc of incidents) {
    const created = new Date(inc.created_at);
    const resolved = inc.resolved_at ? new Date(inc.resolved_at) : new Date();
    if (created < dayEnd && resolved > dayStart && (!inc.components || inc.components.length === 0)) {
      const code = IMPACT_MAP[inc.impact] || 'y';
      if ((PRIORITY[code] || 0) > (PRIORITY[worst] || 0)) worst = code;
    }
  }
  return worst;
}

function computeUptime(statusStr) {
  if (!statusStr.length) return 100;
  let total = 0;
  for (const ch of statusStr) total += UPTIME_SCORES[ch] ?? 100;
  return +(total / statusStr.length).toFixed(2);
}

// --- Main ---
async function fetchJSON(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'thenines-action/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`${url} → ${res.status}`);
      return res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = 1000 * 2 ** (attempt - 1);
      console.warn(`  Attempt ${attempt}/${retries} failed for ${url}: ${err.message}, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function main() {
  console.log('Fetching status pages...');
  const [claudeSummary, claudeInc, openaiSummary, openaiInc] = await Promise.all([
    fetchJSON('https://status.claude.com/api/v2/summary.json'),
    fetchJSON('https://status.claude.com/api/v2/incidents.json'),
    fetchJSON('https://status.openai.com/api/v2/summary.json'),
    fetchJSON('https://status.openai.com/api/v2/incidents.json'),
  ]);

  const claudeIncidents = claudeInc.incidents || [];
  const openaiIncidents = openaiInc.incidents || [];
  const dates = buildDateRange();
  const claudeComponentNames = Object.keys(CLAUDE_COMPONENT_MAP);

  // --- Claude daily status strings ---
  const claudeDaily = {};
  for (const ourName of CLAUDE_SERVICES) {
    let s = '';
    for (const date of dates) {
      const spName = claudeComponentNames.find(k => CLAUDE_COMPONENT_MAP[k] === ourName) || ourName;
      s += worstStatusForDay(claudeIncidents, spName, date);
    }
    claudeDaily[ourName] = s;
  }

  // Update last char with real-time component status
  for (const comp of claudeSummary.components || []) {
    const ourName = CLAUDE_COMPONENT_MAP[comp.name];
    if (ourName && claudeDaily[ourName]) {
      claudeDaily[ourName] = claudeDaily[ourName].slice(0, -1) + (STATUS_MAP[comp.status] || 'g');
    }
  }

  // --- Claude downtime minutes ---
  const claudeMinutes = {};
  for (const date of dates) {
    let totalMins = 0;
    for (const spName of claudeComponentNames) {
      totalMins += downtimeMinutesForDay(claudeIncidents, spName, date);
    }
    if (totalMins > 0) claudeMinutes[dateKey(date)] = totalMins;
  }

  // --- OpenAI daily status strings ---
  const openaiDaily = {};
  for (const [groupName, subs] of Object.entries(OPENAI_COMPONENT_GROUPS)) {
    let s = '';
    for (const date of dates) {
      s += subs.length > 0 ? worstGroupStatus(openaiIncidents, subs, date) : 'g';
    }
    openaiDaily[groupName] = s;
  }

  // --- OpenAI incidents by day ---
  const oaiIncidents = {};
  const oldest = dates[0];
  for (const inc of openaiIncidents) {
    const created = new Date(inc.created_at);
    if (created >= oldest) {
      const dk = dateKey(created);
      if (!oaiIncidents[dk]) oaiIncidents[dk] = [];
      if (!oaiIncidents[dk].includes(inc.name)) oaiIncidents[dk].push(inc.name);
    }
  }

  // --- Uptime percentages ---
  const uptime = {};
  for (const name of CLAUDE_SERVICES) uptime[name] = computeUptime(claudeDaily[name]);
  for (const name of OPENAI_SERVICES) uptime[name] = computeUptime(openaiDaily[name]);

  const data = {
    updated: new Date().toISOString(),
    startDate: dateKey(dates[0]),
    claudeDaily,
    openaiDaily,
    uptime,
    oaiIncidents,
    claudeMinutes,
  };

  // --- Write output ---
  mkdirSync('public/data', { recursive: true });
  const outPath = 'public/data/status.json';

  // Check if data actually changed (skip commit noise)
  if (existsSync(outPath)) {
    const prev = JSON.parse(readFileSync(outPath, 'utf8'));
    // Compare everything except the `updated` timestamp
    const { updated: _a, ...prevData } = prev;
    const { updated: _b, ...newData } = data;
    if (JSON.stringify(prevData) === JSON.stringify(newData)) {
      console.log('No changes detected, skipping write.');
      process.exit(0);
    }
  }

  writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`Wrote ${outPath} (${(JSON.stringify(data).length / 1024).toFixed(1)} KB)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
