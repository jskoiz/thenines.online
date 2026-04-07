#!/usr/bin/env node
// Fetches Claude & OpenAI status pages, normalizes into the data shape
// the frontend expects, and writes public/data/status.json.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import {
  OPENAI_COMPONENT_GROUPS,
  OPENAI_SERVICES,
  inferOpenAIIncidentGroups,
  liveOpenAIGroupStatus,
} from './openai-groups.js';

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

const CLAUDE_SERVICES = ['Claude API', 'claude.ai', 'Claude Code', 'platform.claude.com', 'Claude for Government'];

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

function incidentOverlapsDay(inc, date) {
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const created = new Date(inc.created_at);
  const resolved = inc.resolved_at ? new Date(inc.resolved_at) : new Date();
  return created < dayEnd && resolved > dayStart;
}

function worstStatusForDay(incidents, componentName, date) {
  let worst = 'g';
  for (const inc of incidents) {
    if (incidentOverlapsDay(inc, date)) {
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

function worstOpenAIGroupStatus(incidents, incidentGroups, groupName, date) {
  let worst = 'g';
  for (const inc of incidents) {
    if (incidentOverlapsDay(inc, date) && incidentGroups.get(inc)?.has(groupName)) {
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
  const openaiIncidentGroups = new Map(openaiIncidents.map(inc => [inc, inferOpenAIIncidentGroups(inc)]));
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
  for (const groupName of Object.keys(OPENAI_COMPONENT_GROUPS)) {
    let s = '';
    for (const date of dates) {
      s += worstOpenAIGroupStatus(openaiIncidents, openaiIncidentGroups, groupName, date);
    }
    openaiDaily[groupName] = s;
  }

  // Update last char with real-time group status so "today" matches the live page.
  for (const groupName of OPENAI_SERVICES) {
    if (openaiDaily[groupName]) {
      const current = liveOpenAIGroupStatus(openaiSummary.components || [], groupName, STATUS_MAP, PRIORITY);
      openaiDaily[groupName] = openaiDaily[groupName].slice(0, -1) + current;
    }
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

  // --- Merge with previous data ---
  // The Statuspage APIs only return recent incidents (50 for Claude, 25 for
  // OpenAI). For days outside that window, we preserve whatever was stored
  // in the previous snapshot so the 90-day view fills in over time.
  mkdirSync('public/data', { recursive: true });
  const outPath = 'public/data/status.json';

  if (existsSync(outPath)) {
    const prev = JSON.parse(readFileSync(outPath, 'utf8'));

    // Find the oldest date the API actually has incident data for
    const oldestClaude = claudeIncidents.length
      ? dateKey(new Date(claudeIncidents[claudeIncidents.length - 1].created_at))
      : null;
    const oldestOpenai = openaiIncidents.length
      ? dateKey(new Date(openaiIncidents[openaiIncidents.length - 1].created_at))
      : null;

    // Merge daily status strings: keep old chars for days before API coverage
    for (const svc of CLAUDE_SERVICES) {
      if (prev.claudeDaily?.[svc] && claudeDaily[svc]) {
        const merged = [...claudeDaily[svc]];
        for (let i = 0; i < dates.length; i++) {
          const dk = dateKey(dates[i]);
          // If this day is before the oldest API incident and we had prior data, keep it
          if (oldestClaude && dk < oldestClaude && merged[i] === 'g') {
            const prevChar = prev.claudeDaily[svc]?.[i];
            if (prevChar && prevChar !== 'g') merged[i] = prevChar;
          }
        }
        claudeDaily[svc] = merged.join('');
      }
    }

    for (const svc of OPENAI_SERVICES) {
      if (prev.openaiDaily?.[svc] && openaiDaily[svc]) {
        const merged = [...openaiDaily[svc]];
        for (let i = 0; i < dates.length; i++) {
          const dk = dateKey(dates[i]);
          if (oldestOpenai && dk < oldestOpenai && merged[i] === 'g') {
            const prevChar = prev.openaiDaily[svc]?.[i];
            if (prevChar && prevChar !== 'g') merged[i] = prevChar;
          }
        }
        openaiDaily[svc] = merged.join('');
      }
    }

    // Merge incident lists and downtime minutes (keep old entries, add new)
    for (const [dk, titles] of Object.entries(prev.oaiIncidents || {})) {
      if (!oaiIncidents[dk]) oaiIncidents[dk] = [];
      for (const t of titles) {
        if (!oaiIncidents[dk].includes(t)) oaiIncidents[dk].push(t);
      }
    }
    for (const [dk, mins] of Object.entries(prev.claudeMinutes || {})) {
      if (!claudeMinutes[dk]) claudeMinutes[dk] = mins;
    }

    // Recompute uptime after merge
    for (const name of CLAUDE_SERVICES) uptime[name] = computeUptime(claudeDaily[name]);
    for (const name of OPENAI_SERVICES) uptime[name] = computeUptime(openaiDaily[name]);

    console.log(`  Merged with previous snapshot (API covers: Claude from ${oldestClaude || 'n/a'}, OpenAI from ${oldestOpenai || 'n/a'})`);
  }

  const data = {
    updated: new Date().toISOString(),
    startDate: dateKey(dates[0]),
    claudeDaily,
    openaiDaily,
    uptime,
    oaiIncidents,
    claudeMinutes,
  };

  // Check if data actually changed (skip commit noise)
  if (existsSync(outPath)) {
    const prev = JSON.parse(readFileSync(outPath, 'utf8'));
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
