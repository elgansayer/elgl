import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';

import { CreatePrivatePartyComponent } from './create-private-party.component';
import { AudioRoomsStore } from '../../services/audio-rooms.store';
import { DiscoveryService } from '../../services/discovery.service';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

describe('CreatePrivatePartyComponent', () => {
  let component: CreatePrivatePartyComponent;
  let fixture: ComponentFixture<CreatePrivatePartyComponent>;

  const mockAuthService = {
    currentUser: signal({ id: 'user-1' }),
    getAccessToken: vi.fn().mockReturnValue('mock-token'),
  };

  const mockStore = {
    createPrivateParty: vi.fn().mockResolvedValue({ id: 'room-new', title: 'Test Party' }),
    privateRooms: signal([]),
  };

  const mockDiscoveryService = {
    findPartners: vi.fn().mockResolvedValue([]),
  };

  const mockRouter = {
    navigate: vi.fn().mockResolvedValue(true),
  };

  const mockI18n = {
    translate: vi.fn().mockReturnValue('translated'),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreatePrivatePartyComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: AudioRoomsStore, useValue: mockStore },
        { provide: DiscoveryService, useValue: mockDiscoveryService },
        { provide: Router, useValue: mockRouter },
        { provide: I18nService, useValue: mockI18n },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CreatePrivatePartyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default values set', () => {
    expect(component.languagePair).toBe('en-es');
    expect(component.topicTag).toBe('conversation');
    expect(component.inviteeCount()).toBe(0);
    expect(component.canAddMore()).toBe(true);
  });

  it('should not allow creating party without title or invitees', async () => {
    component.title = '';
    component.selectedInvitees.set([]);
    await component.createParty();
    expect(mockStore.createPrivateParty).not.toHaveBeenCalled();
  });

  it('should add and remove invitees correctly', () => {
    const profile = { id: 'user-2', display_name: 'Test User' } as any;
    component.addInvitee(profile);
    expect(component.inviteeCount()).toBe(1);
    expect(component.selectedInviteeIds()).toContain('user-2');

    component.removeInvitee(profile);
    expect(component.inviteeCount()).toBe(0);
  });

  it('should not add duplicate invitees', () => {
    const profile = { id: 'user-2', display_name: 'Test User' } as any;
    component.addInvitee(profile);
    component.addInvitee(profile);
    expect(component.inviteeCount()).toBe(1);
  });

  it('should enforce MAX_INVITEES limit', () => {
    component.MAX_INVITEES;
    for (let i = 0; i < 10; i++) {
      component.addInvitee({ id: `user-${i}`, display_name: `User ${i}` } as any);
    }
    expect(component.canAddMore()).toBe(false);
    component.addInvitee({ id: 'user-extra', display_name: 'Extra' } as any);
    expect(component.inviteeCount()).toBe(10);
  });

  it('should create party and navigate on success', async () => {
    component.title = 'Private Study';
    component.languagePair = 'en-es';
    component.topicTag = 'conversation';
    component.addInvitee({ id: 'user-2', display_name: 'Friend' } as any);

    await component.createParty();

    expect(mockStore.createPrivateParty).toHaveBeenCalledWith(
      'Private Study',
      'en-es',
      'conversation',
      ['user-2'],
    );
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should set error on create failure', async () => {
    mockStore.createPrivateParty.mockRejectedValueOnce(new Error('Forbidden'));
    component.title = 'Test';
    component.addInvitee({ id: 'user-2' } as any);

    await component.createParty();

    expect(component.error()).toBeTruthy();
  });
});