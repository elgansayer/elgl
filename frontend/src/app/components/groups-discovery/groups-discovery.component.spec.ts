import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GroupsDiscoveryComponent } from './groups-discovery.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('GroupsDiscoveryComponent', () => {
  let fixture: ComponentFixture<GroupsDiscoveryComponent>;
  let component: GroupsDiscoveryComponent;
  let httpTesting: HttpTestingController;

  const mockGroups = [
    {
      id: 'g1',
      name: 'Spanish Learners',
      owner_id: 'u1',
      max_members: 10,
      member_count: 5,
      is_member: false,
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupsDiscoveryComponent, MockTranslatePipe],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GroupsDiscoveryComponent);
    component = fixture.componentInstance;
  });

  it('should create and load groups from API', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne((r) => r.url.includes('/groups/discoverable'));
    req.flush(mockGroups);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component).toBeDefined();
  });

  it('should handle API error gracefully', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne((r) => r.url.includes('/groups/discoverable'));
    req.error(new ProgressEvent('network error'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['error']()).toBe('Failed to load groups');
  });
});