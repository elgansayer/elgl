import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TopicFollowing } from './topic-following';

describe('TopicFollowing', () => {
  let component: TopicFollowing;
  let fixture: ComponentFixture<TopicFollowing>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopicFollowing],
    }).compileComponents();

    fixture = TestBed.createComponent(TopicFollowing);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
