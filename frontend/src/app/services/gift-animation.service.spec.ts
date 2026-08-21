import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { GiftAnimationService, GiftAnimationOverlay } from './gift-animation.service';

describe('GiftAnimationService', () => {
  const mockOverlay: GiftAnimationOverlay = {
    id: 'gift-1',
    giftName: 'Rose',
    giftIcon: '🌹',
    animationType: 'float',
    senderName: 'Alice',
    receiverName: 'Bob',
    coinValue: 10,
  };

  it('should be created', () => {
    TestBed.configureTestingModule({});
    const s = TestBed.inject(GiftAnimationService);
    expect(s).toBeTruthy();
  });

  it('should have null initial animation', () => {
    const service = TestBed.inject(GiftAnimationService);
    expect(service.currentAnimation()).toBeNull();
    expect(service.isVisible()).toBe(false);
    expect(service.particles()).toEqual([]);
    expect(service.elapsed()).toBe(0);
  });

  it('should set animation and visibility when playAnimation is called', () => {
    const service = TestBed.inject(GiftAnimationService);
    service.playAnimation(mockOverlay);

    expect(service.isVisible()).toBe(true);
    const anim = service.currentAnimation();
    expect(anim).not.toBeNull();
    expect(anim?.giftName).toBe('Rose');
    expect(anim?.senderName).toBe('Alice');
    expect(anim?.receiverName).toBe('Bob');
    expect(anim?.coinValue).toBe(10);
    expect(anim?.animationType).toBe('float');
    expect(service.particles().length).toBeGreaterThan(0);
  });

  it('should generate a unique ID for each animation', () => {
    const service = TestBed.inject(GiftAnimationService);
    service.playAnimation(mockOverlay);
    const firstId = service.currentAnimation()?.id;

    service.playAnimation(mockOverlay);
    const secondId = service.currentAnimation()?.id;

    expect(firstId).toBeDefined();
    expect(secondId).toBeDefined();
    expect(firstId).not.toBe(secondId);
  });

  it('should dismiss animation immediately (isVisible set to false)', () => {
    const service = TestBed.inject(GiftAnimationService);
    service.playAnimation(mockOverlay);
    expect(service.isVisible()).toBe(true);

    service.dismiss();
    expect(service.isVisible()).toBe(false);
  });

  it('should set currentAnimation to null after dismiss cleanup timer', async () => {
    const service = TestBed.inject(GiftAnimationService);
    service.playAnimation(mockOverlay);
    service.dismiss();
    expect(service.currentAnimation()).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(service.currentAnimation()).toBeNull();
  });

  it('should clear previous timer when new animation is played', () => {
    const service = TestBed.inject(GiftAnimationService);
    service.playAnimation(mockOverlay);

    const secondOverlay: GiftAnimationOverlay = { ...mockOverlay, giftName: 'Heart' };
    service.playAnimation(secondOverlay);

    expect(service.isVisible()).toBe(true);
    expect(service.currentAnimation()?.giftName).toBe('Heart');
  });

  it('should track elapsed time during animation', () => {
    const service = TestBed.inject(GiftAnimationService);
    service.playAnimation(mockOverlay);
    expect(service.elapsed()).toBeGreaterThanOrEqual(0);
  });

  it('should set premium animation for 500+ coin tips', () => {
    const service = TestBed.inject(GiftAnimationService);
    const premiumOverlay: GiftAnimationOverlay = {
      ...mockOverlay,
      giftName: '500 Coins',
      giftIcon: '💎',
      animationType: 'premium',
      coinValue: 500,
    };
    service.playAnimation(premiumOverlay);

    expect(service.isVisible()).toBe(true);
    const anim = service.currentAnimation();
    expect(anim?.animationType).toBe('premium');
    expect(anim?.giftIcon).toBe('💎');
    expect(anim?.coinValue).toBe(500);
  });

  it('should set confetti animation for 100+ coin tips', () => {
    const service = TestBed.inject(GiftAnimationService);
    const confettiOverlay: GiftAnimationOverlay = {
      ...mockOverlay,
      giftName: '100 Coins',
      giftIcon: '🎁',
      animationType: 'confetti',
      coinValue: 100,
    };
    service.playAnimation(confettiOverlay);

    expect(service.isVisible()).toBe(true);
    const anim = service.currentAnimation();
    expect(anim?.animationType).toBe('confetti');
  });

  it('should set hearts animation for 50+ coin tips', () => {
    const service = TestBed.inject(GiftAnimationService);
    const heartsOverlay: GiftAnimationOverlay = {
      ...mockOverlay,
      giftName: '50 Coins',
      giftIcon: '💝',
      animationType: 'hearts',
      coinValue: 50,
    };
    service.playAnimation(heartsOverlay);

    expect(service.isVisible()).toBe(true);
    const anim = service.currentAnimation();
    expect(anim?.animationType).toBe('hearts');
  });

  it('should set sparkle animation for small tips', () => {
    const service = TestBed.inject(GiftAnimationService);
    const sparkleOverlay: GiftAnimationOverlay = {
      ...mockOverlay,
      giftName: '10 Coins',
      giftIcon: '🪙',
      animationType: 'sparkle',
      coinValue: 10,
    };
    service.playAnimation(sparkleOverlay);

    expect(service.isVisible()).toBe(true);
    const anim = service.currentAnimation();
    expect(anim?.animationType).toBe('sparkle');
  });
});
