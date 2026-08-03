import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WallpaperPickerComponent } from './wallpaper-picker.component';
import 'jasmine';
import { ChatService } from '../../services/chat.service';

describe('WallpaperPickerComponent', () => {
  let component: WallpaperPickerComponent;
  let fixture: ComponentFixture<WallpaperPickerComponent>;
  let chatServiceSpy: jasmine.SpyObj<ChatService>;

  beforeEach(async () => {
    chatServiceSpy = jasmine.createSpyObj<ChatService>('ChatService', ['setChatWallpaper']);
    await TestBed.configureTestingModule({
      imports: [WallpaperPickerComponent],
      providers: [{ provide: ChatService, useValue: chatServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(WallpaperPickerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('roomId', 'room-123');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
