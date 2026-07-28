import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterOutlet } from '@angular/router';
import { App } from './app';
import { AuthService } from './core/services/auth.service';
import { SyncService } from './core/services/sync.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterOutlet],
      declarations: [App],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            restoreSession: () => Promise.resolve(true),
          },
        },
        {
          provide: SyncService,
          useValue: {
            runSync: () => Promise.resolve(),
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
