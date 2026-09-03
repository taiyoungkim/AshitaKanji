import { describe, expect, it } from 'vitest';
import {
  buildOnboardingParticles,
  ONBOARDING_CONFETTI_COLORS,
} from './onboardingMotion';

describe('onboarding confetti', () => {
  it('creates a stable seeded pattern', () => {
    expect(buildOnboardingParticles(5)).toEqual(buildOnboardingParticles(5));
    expect(buildOnboardingParticles(5, 1)).not.toEqual(buildOnboardingParticles(5, 2));
  });

  it('keeps particles inside the authored palette and timing bounds', () => {
    for (const particle of buildOnboardingParticles()) {
      expect(ONBOARDING_CONFETTI_COLORS).toContain(particle.color);
      expect(particle.xRatio).toBeGreaterThanOrEqual(0.02);
      expect(particle.xRatio).toBeLessThanOrEqual(0.98);
      expect(particle.delayRatio).toBeGreaterThanOrEqual(0.05);
      expect(particle.endRatio).toBeLessThanOrEqual(0.98);
      expect(particle.endRatio).toBeGreaterThan(particle.delayRatio);
    }
  });
});
