/**
 * RTL Logical CSS Property Verification for Video Classrooms
 *
 * Verifies that all Video Classroom components, services, and related screens
 * exclusively use RTL-aware logical CSS properties (ps-, pe-, ms-, me-, border-s,
 * border-e, etc.) and never use physical direction properties.
 *
 * This serves as a production-readiness gate for RTL support in the entire
 * Video Classrooms feature set (LiveKit video calls, audio rooms, VoIP, split
 * screen, live chat overlay, classrooms marketplace, incoming call UI, and room chat).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const PHYSICAL_CLASS_REGEX =
  /\b(pl-|pr-|ml-|mr-|left-|right-|border-l\b|border-r\b|text-left|text-right|float-left|float-right|rounded-l\b|rounded-r\b)/g;
const PHYSICAL_STYLE_INLINE_REGEX =
  /\b(margin-left|margin-right|padding-left|padding-right|border-left\b|border-right\b)\s*:/gi;

const LOGICAL_CLASS_REGEX =
  /\b(ps-|pe-|ms-|me-|border-s\b|border-e\b|text-start|text-end|float-start|float-end)/g;

/** All paths that constitute the Video Classrooms architecture. */
const VIDEO_CLASSROOMS_PATHS = [
  // Core video classroom components
  'src/app/components/video-call',
  'src/app/components/video-room',
  'src/app/components/video-classroom-error-boundary',
  'src/app/components/classrooms-marketplace',
  // Audio room components (part of the classroom ecosystem)
  'src/app/components/audio-room',
  'src/app/components/audio-stage',
  'src/app/audio-rooms',
  // VoIP call components
  'src/app/components/voip-call',
  'src/app/components/voip-active-call',
  // Incoming call UI
  'src/app/components/incoming-call',
  'src/app/components/incoming-call-modal',
  // Split-screen and live chat overlay
  'src/app/components/split-screen-video',
  'src/app/components/live-chat-overlay',
  // Room chat embedded in classroom views
  'src/app/components/room-chat',
  'src/app/rooms/room-chat',
  // Call logs page
  'src/app/pages/call-logs',
  // Core services
  'src/app/services/video-call.service.ts',
  'src/app/services/video-classroom-error-handler.service.ts',
  'src/app/services/livekit.service.ts',
  'src/app/services/audio-rooms.store.ts',
  'src/app/services/call-logs.service.ts',
  'src/app/services/quick-poll.service.ts',
  'src/app/services/livekit-e2ee.worker.ts',
  // Related component services
  'src/app/components/incoming-call-modal/index.ts',
  'src/app/components/incoming-call-modal/incoming-call-modal.service.ts',
  'src/app/components/voip-call/index.ts',
];

const TEMPLATE_EXTS = new Set(['.html', '.ts', '.scss', '.css']);

function collectFiles(rootPath: string): string[] {
  const files: string[] = [];
  if (!existsSync(rootPath)) return files;

  const s = statSync(rootPath);
  if (s.isFile() && TEMPLATE_EXTS.has(extname(rootPath))) {
    if (rootPath.endsWith('.spec.ts')) return [];
    return [rootPath];
  }
  if (s.isDirectory()) {
    for (const entry of readdirSync(rootPath)) {
      files.push(...collectFiles(join(rootPath, entry)));
    }
  }
  return files.filter((f) => !f.endsWith('.spec.ts') && TEMPLATE_EXTS.has(extname(f)));
}

describe('RTL Logical CSS Properties - Video Classrooms', () => {
  let allContent: string;
  let fileList: string[];

  beforeAll(() => {
    const allFiles: string[] = [];
    for (const p of VIDEO_CLASSROOMS_PATHS) {
      allFiles.push(...collectFiles(p));
    }
    fileList = [...new Set(allFiles)].sort();
    allContent = fileList
      .map((f) => {
        try {
          return readFileSync(f, 'utf-8');
        } catch {
          return '';
        }
      })
      .join('\n');
  });

  it('has discovered Video Classroom source files to scan', () => {
    expect(fileList.length).toBeGreaterThan(0);
  });

  it('uses logical direction utilities (ps-/pe-/ms-/me-/border-s/border-e) in Video Classroom files', () => {
    const logicalMatches = allContent.match(LOGICAL_CLASS_REGEX) ?? [];
    expect(logicalMatches.length).toBeGreaterThan(0);
  });

  it('does not contain physical direction Tailwind classes (pl-/pr-/ml-/mr-/left-/right-/border-l/border-r) in any Video Classroom file', () => {
    const physicalMatches = allContent.match(PHYSICAL_CLASS_REGEX);
    expect(physicalMatches ?? []).toEqual([]);
  });

  it('does not contain physical CSS direction properties (margin-left, margin-right, padding-left, padding-right, border-left, border-right) in inline styles', () => {
    const matches = allContent.match(PHYSICAL_STYLE_INLINE_REGEX);
    expect(matches ?? []).toEqual([]);
  });
});