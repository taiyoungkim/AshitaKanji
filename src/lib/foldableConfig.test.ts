import { describe, expect, it } from 'vitest';

// Expo config plugin은 Node가 직접 로드하는 CommonJS 모듈이다.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const foldablePlugin = require('../../plugins/withFoldableConfigChanges') as {
  applyFoldableConfigChanges: (manifest: TestManifest) => TestManifest;
  FOLDABLE_CONFIG_CHANGES: string[];
};
const { applyFoldableConfigChanges, FOLDABLE_CONFIG_CHANGES } = foldablePlugin;

interface TestManifest {
  manifest: {
    application?: {
      activity?: {
        $?: Record<string, string>;
      }[];
    }[];
  };
}

function manifestWith(configChanges = 'keyboard|screenSize'): TestManifest {
  return {
    manifest: {
      application: [
        {
          activity: [
            {
              $: {
                'android:name': '.MainActivity',
                'android:configChanges': configChanges,
              },
            },
          ],
        },
      ],
    },
  };
}

describe('withFoldableConfigChanges', () => {
  it('폴드 접기·펼치기에 필요한 구성 변경을 MainActivity가 직접 처리한다', () => {
    const manifest = applyFoldableConfigChanges(manifestWith());
    const attrs = manifest.manifest.application?.[0]?.activity?.[0]?.$;
    const flags = attrs?.['android:configChanges']?.split('|') ?? [];

    expect(flags).toEqual(expect.arrayContaining(FOLDABLE_CONFIG_CHANGES));
    expect(attrs?.['android:resizeableActivity']).toBe('true');
  });

  it('클린 빌드를 반복해도 configChanges 항목을 중복시키지 않는다', () => {
    const manifest = manifestWith('keyboard|smallestScreenSize|density');

    applyFoldableConfigChanges(manifest);
    applyFoldableConfigChanges(manifest);

    const flags =
      manifest.manifest.application?.[0]?.activity?.[0]?.$?.[
        'android:configChanges'
      ]?.split('|') ?? [];
    expect(new Set(flags).size).toBe(flags.length);
  });

  it('MainActivity가 없으면 잘못된 네이티브 빌드를 조용히 만들지 않는다', () => {
    expect(() => applyFoldableConfigChanges({ manifest: { application: [{}] } })).toThrow(
      'MainActivity not found',
    );
  });
});
