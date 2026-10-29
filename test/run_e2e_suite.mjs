#!/usr/bin/env node
/**
 * TypesetOK (TOK) - Master E2E Test Suite Runner
 *
 * Coordinates execution of the comprehensive 4-tier requirement-driven E2E test suite:
 * - Tier 1: Feature Coverage (30 tests across 6 features)
 * - Tier 2: Boundary & Corner Cases (30 tests across 6 categories)
 * - Tier 3: Cross-Feature Combinations (6 pairwise interaction tests)
 * - Tier 4: Real-World Application Scenarios (5 workload tests)
 * Total: 71 exhaustive opaque-box tests executing tok-cli and document models.
 *
 * Usage:
 *   node test/run_e2e_suite.mjs
 *   node test/run_e2e_suite.mjs --tier 1
 *   node test/run_e2e_suite.mjs --tier 2
 *   node test/run_e2e_suite.mjs --tier 3
 *   node test/run_e2e_suite.mjs --tier 4
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findTokCli, cleanupTempFiles } from './e2e/cli_helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const TIERS = [
  {
    tier: 1,
    id: 'T1',
    name: 'Feature Coverage (F1 - F6)',
    file: 'test/e2e/tier1_feature_coverage.test.mjs',
    expectedTests: 30
  },
  {
    tier: 2,
    id: 'T2',
    name: 'Boundary & Corner Cases (B1 - B6)',
    file: 'test/e2e/tier2_boundary_corner.test.mjs',
    expectedTests: 30
  },
  {
    tier: 3,
    id: 'T3',
    name: 'Cross-Feature Combinations (P1 - P6)',
    file: 'test/e2e/tier3_pairwise_combinations.test.mjs',
    expectedTests: 6
  },
  {
    tier: 4,
    id: 'T4',
    name: 'Real-World Application Scenarios',
    file: 'test/e2e/tier4_real_world_scenarios.test.mjs',
    expectedTests: 5
  }
];

function parseArguments() {
  const args = process.argv.slice(2);
  let targetTier = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tier' && args[i + 1]) {
      targetTier = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { targetTier };
}

async function runTier(tierConfig) {
  const testFileAbs = path.join(rootDir, tierConfig.file);
  if (!fs.existsSync(testFileAbs)) {
    throw new Error(`Test file not found: ${testFileAbs}`);
  }

  console.log(`\n>>> Running [${tierConfig.id}] ${tierConfig.name}...`);
  const startTime = Date.now();

  return new Promise((resolve) => {
    let output = '';
    const child = spawn(process.execPath, ['--test', tierConfig.file], {
      cwd: rootDir,
      windowsHide: true,
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    child.stdout.on('data', (data) => {
      const chunk = data.toString('utf-8');
      output += chunk;
      process.stdout.write(chunk);
    });

    child.stderr.on('data', (data) => {
      const chunk = data.toString('utf-8');
      output += chunk;
      process.stderr.write(chunk);
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - startTime;

      // Extract test counts from standard node:test output
      const passMatch = output.match(/ℹ pass (\d+)/);
      const failMatch = output.match(/ℹ fail (\d+)/);
      const testsMatch = output.match(/ℹ tests (\d+)/);

      const passed = passMatch ? parseInt(passMatch[1], 10) : (code === 0 ? tierConfig.expectedTests : 0);
      const failed = failMatch ? parseInt(failMatch[1], 10) : (code !== 0 ? 1 : 0);
      const total = testsMatch ? parseInt(testsMatch[1], 10) : (passed + failed);

      resolve({
        tier: tierConfig.tier,
        id: tierConfig.id,
        name: tierConfig.name,
        expectedTests: tierConfig.expectedTests,
        passed,
        failed,
        total,
        exitCode: code,
        durationMs
      });
    });
  });
}

async function main() {
  const { targetTier } = parseArguments();

  console.log('='.repeat(88));
  console.log('  TypesetOK (TOK) - Comprehensive 4-Tier Requirement-Driven E2E Test Suite');
  console.log('='.repeat(88));

  let cliPath;
  try {
    cliPath = findTokCli();
    console.log(`  Engine Binary: ${cliPath}`);
  } catch (err) {
    console.error(`\n[FATAL] ${err.message}`);
    process.exit(1);
  }

  console.log(`  Node.js:       ${process.version} (${process.arch})`);
  console.log(`  Platform:      ${process.platform}`);
  console.log(`  Working Dir:   ${rootDir}`);

  const tiersToRun = targetTier
    ? TIERS.filter((t) => t.tier === targetTier)
    : TIERS;

  if (tiersToRun.length === 0) {
    console.error(`[ERROR] Unknown tier: ${targetTier}. Valid tiers are 1, 2, 3, 4.`);
    process.exit(1);
  }

  const results = [];
  const suiteStartTime = Date.now();

  for (const tierConfig of tiersToRun) {
    const res = await runTier(tierConfig);
    results.push(res);
  }

  const totalDurationMs = Date.now() - suiteStartTime;
  cleanupTempFiles();

  // Print Summary Table
  console.log('\n' + '='.repeat(88));
  console.log('                                E2E TEST RESULTS SUMMARY');
  console.log('='.repeat(88));
  console.log(
    ' ' +
    'Tier'.padEnd(6) +
    'Description'.padEnd(40) +
    'Planned'.padStart(8) +
    'Passed'.padStart(8) +
    'Failed'.padStart(8) +
    'Duration'.padStart(10) +
    '   Status'
  );
  console.log('-'.repeat(88));

  let totalPlanned = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  for (const r of results) {
    totalPlanned += r.expectedTests;
    totalPassed += r.passed;
    totalFailed += r.failed;

    const durSec = (r.durationMs / 1000).toFixed(1) + 's';
    const statusStr = r.failed === 0 && r.passed >= r.expectedTests ? '✔ PASS' : '✖ FAIL';

    console.log(
      ' ' +
      r.id.padEnd(6) +
      r.name.padEnd(40) +
      String(r.expectedTests).padStart(8) +
      String(r.passed).padStart(8) +
      String(r.failed).padStart(8) +
      durSec.padStart(10) +
      '   ' + statusStr
    );
  }

  console.log('-'.repeat(88));
  const totalDurSec = (totalDurationMs / 1000).toFixed(1) + 's';
  const overallStatus = totalFailed === 0 && totalPassed === totalPlanned ? '✔ PASS' : '✖ FAIL';

  console.log(
    ' ' +
    'TOTAL'.padEnd(46) +
    String(totalPlanned).padStart(8) +
    String(totalPassed).padStart(8) +
    String(totalFailed).padStart(8) +
    totalDurSec.padStart(10) +
    '   ' + overallStatus
  );
  console.log('='.repeat(88));

  if (overallStatus === '✔ PASS') {
    console.log(
      `\n[RESULT] All ${totalPassed} E2E tests PASSED with 100% success rate across all ${results.length} active tiers.`
    );
    process.exit(0);
  } else {
    console.error(
      `\n[FAIL] E2E test suite failed: ${totalFailed} failure(s) detected out of ${totalPlanned} planned tests.`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n[UNHANDLED ERROR]', err);
  cleanupTempFiles();
  process.exit(1);
});
