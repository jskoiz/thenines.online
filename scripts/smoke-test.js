#!/usr/bin/env node
// Smoke test: validates public/data/status.json against live Statuspage APIs.
// Checks structural integrity, component coverage, status-code validity,
// uptime math, incident attribution, and real-time status alignment.

import { readFileSync } from 'fs';
import {
  OPENAI_SERVICES,
  TRACKED_OPENAI_COMPONENT_NAMES,
  liveOpenAIGroupStatus,
} from './openai-groups.js';

const VALID_STATUS_CHARS = new Set(['g', 'y', 'o', 'r', 'b']);
const DAYS = 90;

const CLAUDE_SERVICES = ['Claude API', 'claude.ai', 'Claude Code', 'platform.claude.com', 'Claude for Government'];

const CLAUDE_COMPONENT_MAP = {
  'claude.ai': 'claude.ai',
  'platform.claude.com (formerly console.anthropic.com)': 'platform.claude.com',
  'Claude API (api.anthropic.com)': 'Claude API',
  'Claude Code': 'Claude Code',
  'Claude for Government': 'Claude for Government',
};

const STATUS_MAP = {
  operational: 'g',
  degraded_performance: 'y',
  partial_outage: 'o',
  major_outage: 'r',
  under_maintenance: 'b',
};
const PRIORITY = { g: 0, b: 1, y: 2, o: 3, r: 4 };

const UPTIME_SCORES = { g: 100, y: 99.5, o: 98, r: 95, b: 99 };

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'thenines-smoketest/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

function computeUptime(statusStr) {
  if (!statusStr || !statusStr.length) return 100;
  let total = 0;
  for (const ch of statusStr) total += UPTIME_SCORES[ch] ?? 100;
  return +(total / statusStr.length).toFixed(2);
}

async function main() {
  console.log('Loading status.json...');
  const raw = readFileSync('public/data/status.json', 'utf8');
  const data = JSON.parse(raw);

  console.log('\n── Structure ──');
  assert(typeof data.updated === 'string' && data.updated.length > 0, 'updated is non-empty string');
  assert(typeof data.startDate === 'string' && /^\d{2}-\d{2}$/.test(data.startDate), 'startDate is MM-DD format');
  assert(typeof data.claudeDaily === 'object', 'claudeDaily is object');
  assert(typeof data.openaiDaily === 'object', 'openaiDaily is object');
  assert(typeof data.uptime === 'object', 'uptime is object');
  assert(typeof data.oaiIncidents === 'object', 'oaiIncidents is object');
  assert(typeof data.claudeMinutes === 'object', 'claudeMinutes is object');

  console.log('\n── Claude Services ──');
  for (const svc of CLAUDE_SERVICES) {
    const str = data.claudeDaily[svc];
    assert(typeof str === 'string', `${svc} exists in claudeDaily`);
    assert(str.length === DAYS, `${svc} has ${DAYS} days (got ${str?.length})`);
    const allValid = [...(str || '')].every(ch => VALID_STATUS_CHARS.has(ch));
    assert(allValid, `${svc} contains only valid status chars`);
  }

  console.log('\n── OpenAI Services ──');
  for (const svc of OPENAI_SERVICES) {
    const str = data.openaiDaily[svc];
    assert(typeof str === 'string', `${svc} exists in openaiDaily`);
    assert(str.length === DAYS, `${svc} has ${DAYS} days (got ${str?.length})`);
    const allValid = [...(str || '')].every(ch => VALID_STATUS_CHARS.has(ch));
    assert(allValid, `${svc} contains only valid status chars`);
  }

  console.log('\n── Uptime Math ──');
  const allServices = [...CLAUDE_SERVICES, ...OPENAI_SERVICES];
  for (const svc of allServices) {
    const str = data.claudeDaily[svc] || data.openaiDaily[svc];
    const expected = computeUptime(str);
    const actual = data.uptime[svc];
    assert(typeof actual === 'number', `${svc} has numeric uptime`);
    assert(actual === expected, `${svc} uptime matches: expected ${expected}, got ${actual}`);
  }

  console.log('\n── Incident Keys ──');
  const dateKeyRe = /^\d{2}-\d{2}$/;
  for (const [key, list] of Object.entries(data.oaiIncidents)) {
    assert(dateKeyRe.test(key), `oaiIncidents key "${key}" is MM-DD`);
    assert(Array.isArray(list) && list.length > 0, `oaiIncidents["${key}"] is non-empty array`);
    for (const title of list) {
      assert(typeof title === 'string' && title.length > 0, `incident title is non-empty string`);
    }
  }

  for (const [key, mins] of Object.entries(data.claudeMinutes)) {
    assert(dateKeyRe.test(key), `claudeMinutes key "${key}" is MM-DD`);
    assert(typeof mins === 'number' && mins > 0, `claudeMinutes["${key}"] is positive number (${mins})`);
  }

  console.log('\n── Cross-check: Live API Component Status ──');
  console.log('Fetching live APIs...');
  const [claudeSummary, openaiSummary] = await Promise.all([
    fetchJSON('https://status.claude.com/api/v2/summary.json'),
    fetchJSON('https://status.openai.com/api/v2/summary.json'),
  ]);

  // Verify every Claude component from the API is mapped
  const claudeApiComponents = (claudeSummary.components || [])
    .filter(c => !c.group && c.showcase !== false)
    .map(c => c.name);

  for (const apiName of claudeApiComponents) {
    const ourName = CLAUDE_COMPONENT_MAP[apiName];
    if (ourName) {
      assert(data.claudeDaily[ourName] !== undefined, `Claude component "${apiName}" → "${ourName}" is tracked`);
    }
  }

  // Verify today's status (last char) matches current API status for Claude
  console.log('\n── Real-time Status Alignment (Claude) ──');
  for (const comp of claudeSummary.components || []) {
    const ourName = CLAUDE_COMPONENT_MAP[comp.name];
    if (ourName && data.claudeDaily[ourName]) {
      const lastChar = data.claudeDaily[ourName].slice(-1);
      const expected = STATUS_MAP[comp.status] || 'g';
      assert(lastChar === expected,
        `${ourName} today: data="${lastChar}" api="${expected}" (${comp.status})`);
    }
  }

  // Verify today's grouped OpenAI status matches the live component summary.
  console.log('\n── Real-time Status Alignment (OpenAI) ──');
  for (const groupName of OPENAI_SERVICES) {
    if (data.openaiDaily[groupName]) {
      const lastChar = data.openaiDaily[groupName].slice(-1);
      const expected = liveOpenAIGroupStatus(openaiSummary.components || [], groupName, STATUS_MAP, PRIORITY);
      assert(lastChar === expected,
        `${groupName} today: data="${lastChar}" api="${expected}"`);
    }
  }

  // Verify OpenAI component coverage — check that we know about all API components
  console.log('\n── OpenAI Component Coverage ──');
  const openaiApiComponents = (openaiSummary.components || []).map(c => c.name);
  const unmapped = openaiApiComponents.filter(name => !TRACKED_OPENAI_COMPONENT_NAMES.includes(name));
  if (unmapped.length > 0) {
    console.warn(`  WARN: ${unmapped.length} OpenAI component(s) not in any tracked group: ${unmapped.join(', ')}`);
  }

  // Verify no non-green days have zero corresponding incidents/minutes
  console.log('\n── Incident Consistency ──');
  let claudeNonGreenDays = 0;
  let claudeDaysWithMinutes = 0;
  for (let i = 0; i < DAYS; i++) {
    let hasNonGreen = false;
    for (const svc of CLAUDE_SERVICES) {
      if (data.claudeDaily[svc][i] !== 'g') hasNonGreen = true;
    }
    if (hasNonGreen) claudeNonGreenDays++;
  }
  claudeDaysWithMinutes = Object.keys(data.claudeMinutes).length;
  // Not every non-green day needs minutes (could be degraded with 0 downtime),
  // but minutes should never exceed non-green days
  assert(claudeDaysWithMinutes <= claudeNonGreenDays + 1,
    `Claude downtime days (${claudeDaysWithMinutes}) ≤ non-green days (${claudeNonGreenDays})`);

  // Freshness — warn if stale, but don't fail (manual runs may lag)
  console.log('\n── Freshness ──');
  const age = Date.now() - new Date(data.updated).getTime();
  const ageHours = (age / 3600000).toFixed(1);
  if (age > 2 * 3600000) {
    console.warn(`  WARN: Data is ${ageHours}h old (> 2h) — may be stale`);
  } else {
    passed++;
    console.log(`  OK: Data is ${ageHours}h old`);
  }

  // Verify daily string consistency across related services
  console.log('\n── Status String Sanity ──');
  // FedRAMP should be mostly green (it's a stable service)
  const fedRampNonGreen = [...data.openaiDaily['FedRAMP']].filter(c => c !== 'g').length;
  assert(fedRampNonGreen <= 5, `FedRAMP has few non-green days (${fedRampNonGreen})`);

  // Summary
  console.log(`\n${'═'.repeat(40)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(40)}`);

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
