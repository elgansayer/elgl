import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TopicFollowingComponent } from './topic-following';

describe('TopicFollowingComponent', () => {
  let component: TopicFollowingComponent;
  let fixture: ComponentFixture<TopicFollowingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopicFollowingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TopicFollowingComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
