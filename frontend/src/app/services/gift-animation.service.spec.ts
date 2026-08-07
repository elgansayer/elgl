import { TestBed } from '@angular/core/testing';
import { GiftAnimationService, GiftAnimationOverlay } from './gift-animation.service';

describe('GiftAnimationService', () => {
  let service: GiftAnimationService;

  const mockOverlay: GiftAnimationOverlay = {
    id: 'gift-1',
    giftName: 'Rose',
    giftIcon: '🌹',
    animationType: 'float',
    senderName: 'Alice',
    receiverName: 'Bob',
    coinValue: 10,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GiftAnimationService],
    });
    service = TestBed.inject(GiftAnimationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have null initial animation', () => {
    expect(service.currentAnimation()).toBeNull();
    expect(service.isVisible()).toBe(false);
  });

  it('should set animation and visibility when playAnimation is called', () => {
    service.playAnimation(mockOverlay);

    expect(service.isVisible()).toBe(true);
    const anim = service.currentAnimation();
    expect(anim).not.toBeNull();
    expect(anim?.giftName).toBe('Rose');
    expect(anim?.senderName).toBe('Alice');
    expect(anim?.receiverName).toBe('Bob');
    expect(anim?.coinValue).toBe(10);
    expect(anim?.animationType).toBe('float');
  });

  it('should generate a unique ID for each animation', () => {
    service.playAnimation(mockOverlay);
    const firstId = service.currentAnimation()?.id;

    service.playAnimation(mockOverlay);
    const secondId = service.currentAnimation()?.id;

    expect(firstId).toBeDefined();
    expect(secondId).toBeDefined();
    expect(firstId).not.toBe(secondId);
  });

  it('should dismiss animation immediately (isVisible set to false)', () => {
    service.playAnimation(mockOverlay);
    expect(service.isVisible()).toBe(true);

    service.dismiss();
    expect(service.isVisible()).toBe(false);
  });

  it('should set currentAnimation to null after dismiss cleanup timer', async () => {
    service.playAnimation(mockOverlay);
    service.dismiss();
    expect(service.currentAnimation()).not.toBeNull();

    // Wait for the 600ms cleanup timer
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(service.currentAnimation()).toBeNull();
  });

  it('should clear previous timer when new animation is played', () => {
    service.playAnimation(mockOverlay);

    const secondOverlay: GiftAnimationOverlay = { ...mockOverlay, giftName: 'Heart' };
    service.playAnimation(secondOverlay);

    expect(service.isVisible()).toBe(true);
    expect(service.currentAnimation()?.giftName).toBe('Heart');
  });
});