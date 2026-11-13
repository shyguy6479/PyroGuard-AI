import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceConsecutiveFrameState,
  computeAnalytics,
  deriveSystemStatus,
  filterAllowedHazardDetections,
  filterIncidents,
  formatIncidentsCsv,
  MultiFrameAlertTracker,
  summarizeDetectionType,
} from './detectionLogic';
import type { IncidentRecord } from '../types/detection';

test('TEST 1: Normal room objects (person, red shirt, switchboard, picture, furniture) are strictly discarded', () => {
  const predictions = [
    { label: 'person', classId: 0, confidence: 0.98, x: 0.1, y: 0.1, width: 0.3, height: 0.6 },
    { label: 'red shirt', classId: 0, confidence: 0.94, x: 0.2, y: 0.3, width: 0.2, height: 0.3 },
    { label: 'switchboard', confidence: 0.91, x: 0.7, y: 0.4, width: 0.12, height: 0.15 },
    { label: 'picture', confidence: 0.88, x: 0.4, y: 0.1, width: 0.2, height: 0.2 },
    { label: 'chair', confidence: 0.95, x: 0.5, y: 0.5, width: 0.25, height: 0.35 },
    { label: 'wildfire', classId: 0, confidence: 0.95, x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
    { label: 'smoke detector', classId: 1, confidence: 0.92, x: 0.1, y: 0.1, width: 0.1, height: 0.1 },
  ];

  const valid = filterAllowedHazardDetections(predictions);
  assert.equal(valid.length, 0);
  assert.equal(deriveSystemStatus(valid), 'normal');
});

test('TEST 2 & 3: Strict allowlist accepts only exact fire/smoke predictions with confidence >= 0.75 and real box dimensions', () => {
  const filtered = filterAllowedHazardDetections([
    { label: 'fire', classId: 4, confidence: 0.94, x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
    { label: 'fire', classId: 0, confidence: 0.749, x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
    { label: 'smoke', classId: 1, confidence: 74, x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
    { label: 'fire', classId: 0, confidence: 0.89, x: 0.2, y: 0.3, width: 0, height: 0.2 }, // invalid empty box
    { label: 'fire', classId: 0, confidence: 0.88, x: 0.35, y: 0.42, width: 0.22, height: 0.28 },
    { label: 'smoke', class_id: 1, confidence: 81, x: 0.25, y: 0.12, width: 0.34, height: 0.24 },
  ]);

  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].label, 'Fire');
  assert.equal(filtered[0].confidence, 88);
  assert.equal(filtered[0].x, 0.35);
  assert.equal(filtered[0].y, 0.42);
  assert.equal(filtered[0].width, 0.22);
  assert.equal(filtered[0].height, 0.28);

  assert.equal(filtered[1].label, 'Smoke');
  assert.equal(filtered[1].confidence, 81);
  assert.equal(summarizeDetectionType(filtered), 'Fire & Smoke');
  assert.equal(deriveSystemStatus(filtered), 'fire_emergency');
  assert.equal(deriveSystemStatus([filtered[1]]), 'smoke_warning');
});

test('advanceConsecutiveFrameState requires 5 consecutive valid AI detections and resets immediately to 0 on empty/non-hazard frame', () => {
  const validFire = filterAllowedHazardDetections([
    { label: 'fire', classId: 0, confidence: 0.9, x: 0.2, y: 0.3, width: 0.2, height: 0.25 },
  ]);
  const validSmoke = filterAllowedHazardDetections([
    { label: 'smoke', classId: 1, confidence: 0.85, x: 0.3, y: 0.1, width: 0.35, height: 0.22 },
  ]);

  let count = 0;
  for (let frame = 1; frame <= 4; frame++) {
    const step = advanceConsecutiveFrameState(count, validFire, 5);
    count = step.consecutiveCount;
    assert.equal(count, frame);
    assert.equal(step.verified, false);
    assert.equal(step.statusToEmit, 'normal');
  }

  // Safe / empty frame resets counter immediately to 0
  const resetStep = advanceConsecutiveFrameState(count, [], 5);
  assert.equal(resetStep.consecutiveCount, 0);
  assert.equal(resetStep.verified, false);
  assert.equal(resetStep.statusToEmit, 'normal');

  // Re-accumulate 5 consecutive smoke frames (and verify switching from fire to smoke restarts at 1)
  count = resetStep.consecutiveCount;
  let activeClass: 'fire' | 'smoke' | null = resetStep.activeHazardClass;
  const f1Fire = advanceConsecutiveFrameState(count, validFire, 5, activeClass);
  const fSwitchSmoke = advanceConsecutiveFrameState(
    f1Fire.consecutiveCount,
    validSmoke,
    5,
    f1Fire.activeHazardClass
  );
  assert.equal(fSwitchSmoke.consecutiveCount, 1);
  assert.equal(fSwitchSmoke.activeHazardClass, 'smoke');

  count = 0;
  activeClass = null;
  for (let frame = 1; frame <= 4; frame++) {
    const step = advanceConsecutiveFrameState(count, validSmoke, 5, activeClass);
    count = step.consecutiveCount;
    activeClass = step.activeHazardClass;
    assert.equal(step.statusToEmit, 'normal');
  }
  const fifthSmoke = advanceConsecutiveFrameState(count, validSmoke, 5, activeClass);
  assert.equal(fifthSmoke.consecutiveCount, 5);
  assert.equal(fifthSmoke.verified, true);
  assert.equal(fifthSmoke.statusToEmit, 'smoke_warning');

  const fifthFire = advanceConsecutiveFrameState(4, validFire, 5, 'fire');
  assert.equal(fifthFire.consecutiveCount, 5);
  assert.equal(fifthFire.verified, true);
  assert.equal(fifthFire.statusToEmit, 'fire_emergency');
});

test('MultiFrameAlertTracker enforces 5 consecutive verified frames, resets on clear, and respects cooldown', () => {
  const tracker = new MultiFrameAlertTracker();

  for (let i = 1; i <= 4; i++) {
    const evalRes = tracker.evaluateFrame(true, 5, 15, i * 200);
    assert.equal(evalRes.alertTriggered, false);
    assert.equal(evalRes.verifiedActive, false);
    assert.equal(evalRes.consecutiveDetections, i);
  }

  const resetRes = tracker.evaluateFrame(false, 5, 15, 1000);
  assert.equal(resetRes.consecutiveDetections, 0);
  assert.equal(resetRes.verifiedActive, false);

  for (let i = 1; i <= 4; i++) {
    tracker.evaluateFrame(true, 5, 15, 1000 + i * 200);
  }
  const f5 = tracker.evaluateFrame(true, 5, 15, 2000);
  assert.equal(f5.alertTriggered, true);
  assert.equal(f5.verifiedActive, true);

  const f6 = tracker.evaluateFrame(true, 5, 15, 2500);
  assert.equal(f6.alertTriggered, false);
  assert.equal(f6.verifiedActive, true);
  assert.equal(f6.suppressedByCooldown, true);
  assert.equal(deriveSystemStatus([]), 'normal');
});

test('filterIncidents, computeAnalytics, and formatIncidentsCsv behave accurately', () => {
  const sample: IncidentRecord[] = [
    {
      id: 'INC-1001',
      timestamp: '2026-11-10T10:15:00.000Z',
      detectionType: 'Fire',
      confidence: 92,
      screenshotUrl: '/img1.png',
      status: 'Active',
      source: 'Live Camera',
      emailSent: true,
      notes: 'Warehouse aisle 3, north pallet',
    },
    {
      id: 'INC-1002',
      timestamp: '2026-11-11T14:20:00.000Z',
      detectionType: 'Smoke',
      confidence: 78,
      screenshotUrl: '/img2.png',
      status: 'Resolved',
      source: 'Image Upload',
      emailSent: false,
    },
  ];

  assert.equal(filterIncidents(sample, 'warehouse', 'All', 'All').length, 1);
  assert.equal(filterIncidents(sample, '', 'Smoke', 'Resolved').length, 1);

  const stats = computeAnalytics(sample);
  assert.equal(stats.totalDetections, 2);
  assert.equal(stats.fireDetections, 1);
  assert.equal(stats.smokeDetections, 1);
  assert.equal(stats.activeAlerts, 1);
  assert.equal(stats.avgConfidence, 85);

  const csv = formatIncidentsCsv(sample);
  assert.ok(csv.includes('Incident ID,Timestamp,Detection Type'));
  assert.ok(csv.includes('"Warehouse aisle 3, north pallet"'));
});
