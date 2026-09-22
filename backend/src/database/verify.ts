import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { AssertionState, AssertCheckFn } from './verifiers/types';
import { verifyLingQ } from './verifiers/lingq.verifier';
import { verifyLinguistics } from './verifiers/linguistics.verifier';
import { verifyLiveKit } from './verifiers/livekit.verifier';
import { verifyVirtualGift } from './verifiers/virtual-gift.verifier';
import { verifyDatabase } from './verifiers/database.verifier';
import { verifyAchievements } from './verifiers/achievements.verifier';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function createAssertCheck(state: AssertionState): AssertCheckFn {
  return function assertCheck(
    name: string,
    condition: boolean,
    details?: string,
  ) {
    state.total++;
    if (condition) {
      console.log(`[PASS] ✅ ${name}`);
      state.passed++;
    } else {
      console.error(`[FAIL] ❌ ${name}${details ? ` -> ${details}` : ''}`);
    }
  };
}

async function runVerification() {
  console.log(
    '================================================================',
  );
  console.log(
    '🛡️ HelloTalk Open-Core Platform - Automated Verification & Health Diagnostic',
  );
  console.log(
    '================================================================\n',
  );

  const state: AssertionState = { passed: 0, total: 0 };
  const assertCheck = createAssertCheck(state);

  verifyLingQ(assertCheck);
  verifyLinguistics(assertCheck);
  verifyLiveKit(assertCheck);
  verifyVirtualGift(assertCheck);

  const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'mock-key';
  const supabase = createClient(supabaseUrl, supabaseKey);

  await verifyDatabase(assertCheck, supabase);
  await verifyAchievements(assertCheck, supabase);

  console.log(
    '\n================================================================',
  );
  console.log(
    `Diagnostic Summary: ${state.passed}/${state.total} checks passed successfully.`,
  );
  console.log(
    '================================================================\n',
  );

  if (state.passed === state.total) {
    console.log(
      '🎉 ALL SYSTEM HEALTH CHECKS PASSED. Platform is ready for 24/7 VPS Deployment!',
    );
  } else {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Verification diagnostic failure:', err);
  process.exit(1);
});
