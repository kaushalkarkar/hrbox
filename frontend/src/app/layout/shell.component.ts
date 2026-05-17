import { NgTemplateOutlet } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { AppNotification, NotificationType, Role } from '../core/models';
import { SafeHtmlPipe } from '../core/safe-html.pipe';
import { NotificationService } from '../core/notification.service';

interface NavItem {
  label: string;
  link: string;
  icon: string;
  roles?: Role[];
}

interface AppItem {
  label: string;
  link?: string;
  icon: string;
  comingSoon?: boolean;
  beta?: boolean;
  roles?: Role[];
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet, SafeHtmlPipe],
  template: `
    <div class="layout">
      <!-- Slim dark sidebar -->
      <aside class="sidebar">
        <button class="brand-link" (click)="toggleApps($event)" [class.active]="appsOpen()" title="All apps">
          <span class="brand-mark" [innerHTML]="icons.grid | safeHtml"></span>
        </button>

        <nav class="nav">
          @for (item of visibleNav(); track item.link) {
            <a [routerLink]="item.link" routerLinkActive="active"
               [routerLinkActiveOptions]="item.link === '/dashboard' ? { exact: true } : { exact: false }"
               class="nav-item" [title]="item.label">
              <span class="nav-icon" [innerHTML]="item.icon | safeHtml"></span>
            </a>
          }
        </nav>
      </aside>

      <div class="main-area">
        <header class="topbar">
          <a routerLink="/dashboard" class="logo" aria-label="HRMS home">HRMS</a>

          <div class="search">
            <span class="search-icon" [innerHTML]="icons.search | safeHtml"></span>
            <input class="search-input" placeholder="Search for people, modules…" type="text" />
          </div>

          <div class="topbar-right">
            <div class="bell-wrap" (click)="$event.stopPropagation()">
              <button class="bell" (click)="toggleBell()" [class.active]="bellOpen()" title="Notifications">
                <span [innerHTML]="icons.bell | safeHtml"></span>
                @if (unreadCount() > 0) {
                  <span class="bell-dot">{{ unreadCount() > 99 ? '99+' : unreadCount() }}</span>
                }
              </button>

              @if (bellOpen()) {
                <div class="bell-dropdown" (click)="$event.stopPropagation()">
                  <div class="bell-arrow"></div>
                  <div class="bell-header">
                    <h3>Notifications</h3>
                    @if (unreadCount() > 0) {
                      <button class="link-btn" (click)="markAllRead()">Mark all read</button>
                    }
                  </div>
                  @if (notifsLoading()) {
                    <div class="empty">Loading…</div>
                  } @else if (notifs().length === 0) {
                    <div class="empty">You're all caught up.</div>
                  } @else {
                    <div class="bell-list">
                      @for (n of notifs(); track n.id) {
                        <button class="notif" [class.unread]="!n.readAt" (click)="onNotifClick(n)">
                          <div class="notif-icon" [class]="'ni-' + n.type" [innerHTML]="iconForType(n.type) | safeHtml"></div>
                          <div class="notif-body">
                            <div class="notif-title">{{ n.title }}</div>
                            <div class="notif-msg">{{ n.message }}</div>
                            <div class="notif-time">{{ timeAgo(n.createdAt) }}</div>
                          </div>
                          @if (!n.readAt) { <div class="unread-dot"></div> }
                        </button>
                      }
                    </div>
                    <div class="bell-footer">
                      <button class="link-btn" (click)="closeAll()">Close</button>
                    </div>
                  }
                </div>
              }
            </div>

            <div class="profile-wrap" (click)="$event.stopPropagation()">
              <button class="user-avatar" (click)="toggleProfile()" [class.active]="profileOpen()" [title]="userName()">
                {{ initials() }}
              </button>

              @if (profileOpen()) {
                <div class="profile-dropdown" (click)="$event.stopPropagation()">
                  <div class="profile-arrow"></div>
                  <div class="profile-header">
                    <div class="profile-avatar">{{ initials() }}</div>
                    <div class="profile-name-block">
                      <div class="profile-name">{{ userName() }}</div>
                      <div class="profile-code">{{ employeeCode() }}</div>
                    </div>
                  </div>

                  <div class="profile-menu">
                    <button class="profile-item" (click)="gotoMyProfile()">
                      <span class="profile-item-icon" [innerHTML]="icons.profile | safeHtml"></span>
                      <span>My Profile</span>
                    </button>
                    <button class="profile-item" (click)="goto('/change-password')">
                      <span class="profile-item-icon" [innerHTML]="icons.key | safeHtml"></span>
                      <span>Change Password</span>
                    </button>
                    <div class="profile-divider"></div>
                    <button class="profile-item logout-item" (click)="logout()">
                      <span class="profile-item-icon" [innerHTML]="icons.logout | safeHtml"></span>
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        </header>

        <main class="content">
          <div class="content-inner">
            <router-outlet />
          </div>
        </main>
      </div>

      <!-- App launcher overlay -->
      @if (appsOpen()) {
        <div class="apps-backdrop" (click)="closeAll()"></div>
        <div class="apps-panel" (click)="$event.stopPropagation()">
          <div class="apps-header">
            <button class="apps-back" (click)="closeAll()" title="Close">
              <span [innerHTML]="icons.arrowLeft | safeHtml"></span>
            </button>
            <div class="apps-search">
              <input class="apps-search-input" placeholder="All Apps"
                     [value]="appQuery()"
                     (input)="appQuery.set($any($event.target).value)" />
              <span class="apps-search-icon" [innerHTML]="icons.search | safeHtml"></span>
            </div>
          </div>

          <div class="apps-body">
            @if (recentApps().length > 0) {
              <div class="apps-section-title">Recent Apps</div>
              <div class="apps-grid">
                @for (a of recentApps(); track a.label) {
                  <ng-container [ngTemplateOutlet]="appTpl" [ngTemplateOutletContext]="{ a }"></ng-container>
                }
              </div>
            }

            <div class="apps-section-title">All Apps</div>
            <div class="apps-grid">
              @for (a of filteredApps(); track a.label) {
                <ng-container [ngTemplateOutlet]="appTpl" [ngTemplateOutletContext]="{ a }"></ng-container>
              }
            </div>
            @if (filteredApps().length === 0) {
              <div class="apps-empty">No apps match "{{ appQuery() }}"</div>
            }
          </div>
        </div>

        <ng-template #appTpl let-a="a">
          @if (a.link && !a.comingSoon) {
            <a class="launch-tile" [routerLink]="a.link" (click)="closeAll()">
              <div class="launch-icon" [innerHTML]="a.icon | safeHtml"></div>
              @if (a.beta) { <span class="beta-flag">BETA</span> }
              <div class="launch-label">{{ a.label }}</div>
            </a>
          } @else {
            <div class="launch-tile disabled" title="Coming soon">
              <div class="launch-icon" [innerHTML]="a.icon | safeHtml"></div>
              @if (a.beta) { <span class="beta-flag">BETA</span> }
              <div class="launch-label">{{ a.label }}</div>
            </div>
          }
        </ng-template>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .layout { display: flex; min-height: 100vh; position: relative; }

    /* === Sidebar === */
    .sidebar {
      width: 64px;
      background: var(--sidebar-bg);
      color: var(--sidebar-text);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 0;
      position: sticky; top: 0;
      height: 100vh;
      z-index: 5;
    }
    .brand-link {
      width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 10px;
      background: rgba(255,255,255,0.06);
      color: #fff;
      margin-bottom: 16px;
      cursor: pointer;
      border: none;
      transition: background 0.12s;
    }
    .brand-link:hover, .brand-link.active { background: rgba(67,138,255,0.25); color: #fff; }
    .brand-mark ::ng-deep svg { width: 22px; height: 22px; }
    .nav {
      display: flex; flex-direction: column; gap: 4px;
      flex: 1; width: 100%; align-items: center;
      overflow-y: auto; padding: 8px 0;
    }
    .nav::-webkit-scrollbar { display: none; }
    .nav-item {
      width: 44px; height: 44px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      color: var(--sidebar-text-muted);
      cursor: pointer; border: none; background: transparent;
      text-decoration: none;
      transition: background 0.12s, color 0.12s;
      position: relative;
    }
    .nav-item:hover { background: var(--sidebar-bg-hover); color: #fff; text-decoration: none; }
    .nav-item.active {
      background: var(--sidebar-active-bg);
      color: #fff;
    }
    .nav-item.active::before {
      content: '';
      position: absolute;
      left: -12px; top: 8px; bottom: 8px;
      width: 3px;
      background: var(--sidebar-active-bar);
      border-radius: 0 3px 3px 0;
    }
    .nav-icon ::ng-deep svg { width: 20px; height: 20px; }

    /* === Top bar === */
    .main-area { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--bg); }
    .topbar {
      height: 64px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 24px; padding: 0 24px;
      position: sticky; top: 0; z-index: 4;
    }
    .logo {
      font-weight: 800; font-size: 22px; letter-spacing: 0.04em;
      background: linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%);
      -webkit-background-clip: text; background-clip: text; color: transparent;
      text-decoration: none;
    }
    .logo:hover { text-decoration: none; }
    .search { flex: 1; max-width: 540px; position: relative; display: flex; align-items: center; }
    .search-icon { position: absolute; left: 16px; color: var(--muted); display: flex; align-items: center; }
    .search-icon ::ng-deep svg { width: 18px; height: 18px; }
    .search-input {
      width: 100%;
      padding: 10px 16px 10px 44px;
      background: var(--surface-soft);
      border: 1px solid var(--border);
      border-radius: 999px;
      font-size: 14px; font-family: inherit; color: var(--text);
      transition: border-color 0.15s, background 0.15s;
    }
    .search-input::placeholder { color: var(--muted); }
    .search-input:focus { outline: none; border-color: var(--primary); background: #fff; box-shadow: var(--shadow-glow); }
    .topbar-right { display: flex; align-items: center; gap: 16px; margin-left: auto; }
    .bell {
      width: 40px; height: 40px;
      border-radius: 50%;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-soft);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      position: relative;
      transition: background 0.12s;
    }
    .bell:hover { background: var(--surface-soft); }
    .bell ::ng-deep svg { width: 20px; height: 20px; }
    .bell-dot {
      position: absolute; top: -2px; right: -2px;
      min-width: 18px; height: 18px;
      padding: 0 5px;
      border-radius: 9px;
      background: var(--danger);
      color: #fff;
      font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid var(--surface);
    }
    .bell-wrap { position: relative; }
    .profile-wrap { position: relative; }
    .user-avatar {
      width: 40px; height: 40px;
      border-radius: 50%;
      background: var(--gradient-primary);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 13px;
      cursor: pointer;
      border: none;
      transition: box-shadow 0.15s;
    }
    .user-avatar:hover, .user-avatar.active { box-shadow: 0 0 0 3px var(--primary-soft); }
    .bell.active { background: var(--surface-soft); border-color: var(--primary); }

    /* === Bell dropdown === */
    .bell-dropdown {
      position: absolute;
      top: calc(100% + 14px); right: 0;
      width: 380px;
      max-height: 70vh;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: var(--shadow-lg);
      z-index: 20;
      display: flex; flex-direction: column;
      overflow: hidden;
      animation: fadeUp 0.18s ease both;
    }
    .bell-arrow {
      position: absolute;
      top: -7px; right: 56px;
      width: 14px; height: 14px;
      background: #fff;
      border-left: 1px solid var(--border);
      border-top: 1px solid var(--border);
      transform: rotate(45deg);
    }
    .bell-header {
      padding: 16px 18px 12px 18px;
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid var(--border);
    }
    .bell-header h3 { margin: 0; font-size: 16px; }
    .link-btn {
      background: transparent;
      border: none;
      color: var(--primary);
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
      padding: 4px 8px;
      border-radius: 6px;
      font-family: inherit;
    }
    .link-btn:hover { background: var(--primary-soft); }

    .bell-list { flex: 1; overflow-y: auto; padding: 4px 0; }
    .notif {
      width: 100%;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      border: none;
      background: transparent;
      text-align: left;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.12s;
      border-bottom: 1px solid var(--border);
      position: relative;
    }
    .notif:hover { background: var(--surface-soft); }
    .notif:last-child { border-bottom: none; }
    .notif.unread { background: #f8faff; }
    .notif-icon {
      width: 36px; height: 36px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: var(--primary-soft);
      color: var(--primary);
    }
    .notif-icon.ni-PASSWORD_RESET, .notif-icon.ni-PASSWORD_CHANGED { background: #fde7ec; color: #c2185b; }
    .notif-icon.ni-PAYSLIP_RELEASED { background: #d4f5e2; color: #066b3b; }
    .notif-icon.ni-LEAVE_APPROVED { background: #d4f5e2; color: #066b3b; }
    .notif-icon.ni-LEAVE_REJECTED { background: #fde4e4; color: var(--danger); }
    .notif-icon.ni-LEAVE_APPLIED { background: var(--pastel-violet); color: var(--accent); }

    .notif-body { flex: 1; min-width: 0; }
    .notif-title { font-weight: 700; font-size: 14px; color: var(--text); }
    .notif-msg { font-size: 12.5px; color: var(--text-soft); margin-top: 2px; line-height: 1.4; }
    .notif-time { font-size: 11px; color: var(--muted); margin-top: 4px; }
    .unread-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--primary);
      flex-shrink: 0;
      margin-top: 6px;
    }
    .bell-footer { padding: 10px 16px; border-top: 1px solid var(--border); text-align: center; }

    /* === Profile dropdown === */
    .profile-dropdown {
      position: absolute;
      top: calc(100% + 14px); right: 0;
      min-width: 280px;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: var(--shadow-lg);
      z-index: 20;
      overflow: hidden;
      animation: fadeUp 0.18s ease both;
    }
    .profile-arrow {
      position: absolute;
      top: -7px; right: 14px;
      width: 14px; height: 14px;
      background: #fff;
      border-left: 1px solid var(--border);
      border-top: 1px solid var(--border);
      transform: rotate(45deg);
    }
    .profile-header {
      padding: 18px 18px 14px 18px;
      display: flex; align-items: center; gap: 12px;
      border-bottom: 1px solid var(--border);
    }
    .profile-avatar {
      width: 56px; height: 56px;
      border-radius: 50%;
      background: var(--gradient-primary);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 18px;
    }
    .profile-name-block { min-width: 0; }
    .profile-name { font-weight: 700; font-size: 15px; color: var(--primary); line-height: 1.2; }
    .profile-code { font-size: 12px; color: var(--muted); margin-top: 2px; font-weight: 500; }

    .profile-menu { padding: 8px; }
    .profile-item {
      width: 100%;
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px;
      border: none; background: transparent;
      cursor: pointer;
      border-radius: 8px;
      font-size: 13px; font-weight: 500; color: var(--text);
      font-family: inherit;
      text-align: left;
      transition: background 0.12s;
    }
    .profile-item:hover { background: var(--surface-soft); }
    .profile-item.logout-item { color: var(--danger); }
    .profile-item.logout-item:hover { background: #fde4e4; }
    .profile-item-icon {
      width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center;
      color: var(--muted);
    }
    .profile-item-icon ::ng-deep svg { width: 16px; height: 16px; }
    .logout-item .profile-item-icon { color: var(--danger); }
    .profile-divider {
      height: 1px;
      background: var(--border);
      margin: 6px 4px;
    }

    /* === App launcher === */
    .apps-backdrop {
      position: fixed; inset: 0;
      background: rgba(15, 21, 37, 0.45);
      z-index: 50;
      animation: fadeIn 0.15s ease both;
    }
    .apps-panel {
      position: fixed;
      top: 0; left: 64px; bottom: 0;
      width: min(720px, calc(100vw - 64px));
      background: linear-gradient(180deg, #0f1525 0%, #1a223e 100%);
      color: #e9ecf6;
      z-index: 51;
      display: flex; flex-direction: column;
      box-shadow: 18px 0 48px rgba(0,0,0,0.35);
      animation: slideRight 0.2s ease both;
    }
    .apps-header {
      display: flex; align-items: center; gap: 12px;
      padding: 18px 24px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .apps-back {
      width: 36px; height: 36px;
      border-radius: 8px;
      background: transparent;
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .apps-back:hover { background: rgba(255,255,255,0.08); }
    .apps-back ::ng-deep svg { width: 22px; height: 22px; }
    .apps-search { flex: 1; position: relative; display: flex; align-items: center; }
    .apps-search-input {
      width: 100%;
      padding: 10px 16px 10px 16px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      color: #fff;
      font-size: 14px;
      font-family: inherit;
    }
    .apps-search-input::placeholder { color: rgba(255,255,255,0.5); }
    .apps-search-input:focus { outline: none; border-color: var(--primary); }
    .apps-search-icon { position: absolute; right: 14px; color: rgba(255,255,255,0.5); display: flex; align-items: center; }
    .apps-search-icon ::ng-deep svg { width: 18px; height: 18px; }

    .apps-body {
      flex: 1;
      overflow-y: auto;
      padding: 22px 24px 28px 24px;
    }
    .apps-section-title {
      font-size: 18px;
      font-weight: 700;
      color: #fff;
      margin: 14px 0 12px 0;
    }
    .apps-section-title:first-child { margin-top: 0; }
    .apps-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px 8px;
    }
    @media (max-width: 600px) { .apps-grid { grid-template-columns: repeat(3, 1fr); } }

    .launch-tile {
      display: flex; flex-direction: column; align-items: center;
      text-align: center;
      gap: 10px;
      padding: 14px 8px 18px 8px;
      border-radius: 12px;
      text-decoration: none;
      color: #e9ecf6;
      cursor: pointer;
      transition: background 0.15s ease;
      position: relative;
    }
    .launch-tile:hover { background: rgba(255,255,255,0.06); text-decoration: none; }
    .launch-tile.disabled { opacity: 0.45; cursor: not-allowed; }
    .launch-icon {
      width: 56px; height: 56px;
      border-radius: 14px;
      background: linear-gradient(180deg, #2c5fd6 0%, #1e4cb8 100%);
      box-shadow: 0 4px 10px rgba(37, 102, 232, 0.35), inset 0 -2px 0 rgba(0,0,0,0.18);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
    }
    .launch-icon ::ng-deep svg { width: 28px; height: 28px; }
    .launch-label { font-size: 12px; font-weight: 600; line-height: 1.3; max-width: 110px; word-break: break-word; }
    .beta-flag {
      position: absolute;
      top: 8px; right: 14px;
      background: #f5b740;
      color: #4a2e00;
      font-size: 8px;
      font-weight: 800;
      padding: 2px 5px;
      border-radius: 3px;
      letter-spacing: 0.04em;
    }
    .apps-empty { padding: 32px; text-align: center; color: rgba(255,255,255,0.55); }

    /* === Content === */
    .content { flex: 1; padding: 24px 32px 40px 32px; overflow-x: hidden; }
    .content-inner { max-width: 1280px; margin: 0 auto; }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideRight { from { transform: translateX(-100%); } to { transform: translateX(0); } }

    @media (max-width: 768px) { .search { display: none; } .content { padding: 16px; } }
  `]
})
export class ShellComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  user = this.auth.user;

  private notif = inject(NotificationService);

  appsOpen = signal(false);
  profileOpen = signal(false);
  bellOpen = signal(false);
  appQuery = signal('');
  notifsLoading = signal(false);

  unreadCount = this.notif.unreadCount;
  notifs = this.notif.recent;

  userName = computed(() => {
    const e = this.auth.user()?.employee;
    return e ? `${e.firstName} ${e.lastName}` : (this.auth.user()?.email ?? '');
  });

  employeeCode = computed(() => this.auth.user()?.employee?.employeeCode ?? '');

  initials = computed(() => {
    const e = this.auth.user()?.employee;
    if (e) return (e.firstName[0] + e.lastName[0]).toUpperCase();
    const email = this.auth.user()?.email ?? '';
    return email.slice(0, 2).toUpperCase();
  });

  constructor() {
    if (this.auth.isAuthenticated()) {
      this.notif.refreshUnread().subscribe();
    }
  }

  toggleApps(ev: MouseEvent) {
    ev.stopPropagation();
    this.profileOpen.set(false);
    this.bellOpen.set(false);
    this.appsOpen.update(v => !v);
  }
  toggleProfile() {
    this.appsOpen.set(false);
    this.bellOpen.set(false);
    this.profileOpen.update(v => !v);
  }
  toggleBell() {
    this.appsOpen.set(false);
    this.profileOpen.set(false);
    const next = !this.bellOpen();
    this.bellOpen.set(next);
    if (next) {
      this.notifsLoading.set(true);
      this.notif.list(20).subscribe({
        next: () => this.notifsLoading.set(false),
        error: () => this.notifsLoading.set(false)
      });
    }
  }
  closeAll() { this.appsOpen.set(false); this.profileOpen.set(false); this.bellOpen.set(false); }
  goto(link: string) { this.closeAll(); this.router.navigateByUrl(link); }
  gotoMyProfile() {
    this.closeAll();
    const empId = this.auth.user()?.employee?.id;
    if (empId) this.router.navigate(['/employees', empId]);
    else this.router.navigateByUrl('/employees');
  }
  logout() { this.closeAll(); this.auth.logout(); }

  onNotifClick(n: AppNotification) {
    if (!n.readAt) this.notif.markRead(n.id).subscribe();
    if (n.link) {
      this.closeAll();
      this.router.navigateByUrl(n.link);
    }
  }

  markAllRead() { this.notif.markAllRead().subscribe(); }

  iconForType(t: NotificationType): string {
    switch (t) {
      case 'LEAVE_APPLIED':    return this.icons.apply;
      case 'LEAVE_APPROVED':   return this.icons.approvals;
      case 'LEAVE_REJECTED':   return this.icons.approvals;
      case 'PAYSLIP_RELEASED': return this.icons.payroll;
      case 'PASSWORD_RESET':
      case 'PASSWORD_CHANGED': return this.icons.key;
      default:                 return this.icons.bell;
    }
  }

  timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
    const d = Math.floor(hr / 24);
    if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
    const mo = Math.floor(d / 30);
    if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`;
    const y = Math.floor(d / 365);
    return `${y} year${y === 1 ? '' : 's'} ago`;
  }

  @HostListener('document:click') onDocClick() { this.closeAll(); }
  @HostListener('document:keydown.escape') onEsc() { this.closeAll(); }

  icons = {
    grid:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
    home:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/></svg>`,
    employees:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    attendance:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    leaves:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    apply:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
    approvals:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    team:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`,
    holidayCal:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="8" cy="15" r="1.5" fill="currentColor"/><circle cx="16" cy="15" r="1.5" fill="currentColor"/></svg>`,
    payroll:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>`,
    bell:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    search:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/></svg>`,
    arrowLeft:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
    key:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
    logout:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    profile:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>`,
    chart:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>`,
    docs:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    headset:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-7h3z"/><path d="M3 19a2 2 0 0 0 2 2h1v-7H3z"/></svg>`,
    users:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    book:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    plane:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    flows:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><path d="M6 9v3a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9"/><path d="M12 14v1"/></svg>`,
    checklist:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  };

  nav: NavItem[] = [
    { label: 'Dashboard',         link: '/dashboard',         icon: this.icons.home },
    { label: 'Employees',         link: '/employees',         icon: this.icons.employees },
    { label: 'My Attendance',     link: '/attendance/me',     icon: this.icons.attendance },
    { label: 'Apply Leave',       link: '/leaves/apply',      icon: this.icons.apply },
    { label: 'My Leaves',         link: '/leaves/me',         icon: this.icons.leaves },
    { label: 'Holidays',          link: '/holidays',          icon: this.icons.holidayCal },
    { label: 'Payroll',           link: '/payroll',           icon: this.icons.payroll },
    { label: 'Performance',       link: '/performance',       icon: this.icons.chart },
    { label: 'HR Documents',      link: '/documents',         icon: this.icons.docs },
    { label: 'Reimbursement',     link: '/reimbursement',     icon: this.icons.payroll },
    { label: 'HR Policies',       link: '/policies',          icon: this.icons.book },
    { label: 'Helpdesk',          link: '/helpdesk',          icon: this.icons.headset },
    { label: 'Travel',            link: '/travel',            icon: this.icons.plane },
    { label: 'Task Box',          link: '/taskbox',           icon: this.icons.checklist },
    { label: 'Recruitment',       link: '/recruitment',       icon: this.icons.users },
    { label: 'Vibe',              link: '/vibe',              icon: this.icons.bell },
    { label: 'Approvals',         link: '/leaves/approvals',  icon: this.icons.approvals, roles: ['ADMIN', 'MANAGER'] },
    { label: 'Team Attendance',   link: '/attendance/team',   icon: this.icons.team,      roles: ['MANAGER'] },
    { label: 'All Attendance',    link: '/attendance/all',    icon: this.icons.attendance, roles: ['ADMIN'] },
  ];

  // Apps shown in the launcher panel
  apps: AppItem[] = [
    // ✅ Live
    { label: 'Dashboard',          link: '/dashboard',          icon: this.icons.home },
    { label: 'Profile',            link: '/profile',            icon: this.icons.profile },
    { label: 'Employees',          link: '/employees',          icon: this.icons.employees },
    { label: 'Time Management',    link: '/attendance/me',      icon: this.icons.attendance },
    { label: 'My Leaves',          link: '/leaves/me',          icon: this.icons.leaves },
    { label: 'Apply Leave',        link: '/leaves/apply',       icon: this.icons.apply },
    { label: 'Holidays',           link: '/holidays',           icon: this.icons.holidayCal },
    { label: 'Approvals',          link: '/leaves/approvals',   icon: this.icons.approvals,  roles: ['ADMIN','MANAGER'] },
    { label: 'Team Attendance',    link: '/attendance/team',    icon: this.icons.team,       roles: ['MANAGER'] },
    { label: 'All Attendance',     link: '/attendance/all',     icon: this.icons.attendance, roles: ['ADMIN'] },
    { label: 'Compensation',       link: '/payroll',            icon: this.icons.payroll },
    { label: 'Org View',           link: '/profile',            icon: this.icons.team },
    // 🚧 Coming
    { label: 'Performance',        link: '/performance',        icon: this.icons.chart },
    { label: 'HR Documents',       link: '/documents',          icon: this.icons.docs },
    { label: 'Reimbursement',      link: '/reimbursement',      icon: this.icons.payroll },
    { label: 'HR Policies',        link: '/policies',           icon: this.icons.book },
    { label: 'Helpdesk',           link: '/helpdesk',           icon: this.icons.headset },
    { label: 'Travel',             link: '/travel',             icon: this.icons.plane },
    { label: 'Task Box',           link: '/taskbox',            icon: this.icons.checklist },
    { label: 'Recruitment',        link: '/recruitment',        icon: this.icons.users },
    { label: 'Calendar',           icon: this.icons.holidayCal, comingSoon: true },
    { label: 'Flows',              icon: this.icons.flows,      comingSoon: true },
    { label: 'Vibe',               link: '/vibe',               icon: this.icons.bell,       beta: true },
    // Utilities
    { label: 'Change Password',    link: '/change-password',    icon: this.icons.key },
  ];

  visibleNav = computed(() => {
    const role = this.auth.role();
    return this.nav.filter(n => !n.roles || (role !== null && (n.roles as Role[]).includes(role)));
  });

  visibleApps = computed(() => {
    const role = this.auth.role();
    return this.apps.filter(a => !a.roles || (role !== null && (a.roles as Role[]).includes(role)));
  });

  // Top 4 "recent" — for now we show first four visible non-disabled apps
  recentApps = computed(() => this.visibleApps().filter(a => !a.comingSoon).slice(0, 4));

  filteredApps = computed(() => {
    const q = this.appQuery().toLowerCase().trim();
    const list = this.visibleApps();
    if (!q) return list;
    return list.filter(a => a.label.toLowerCase().includes(q));
  });
}
