import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { EmployeeService } from '../core/employee.service';
import { VibeService } from '../core/vibe.service';
import {
  Employee, PostCategory, ReactionType, VibeComment, VibePost
} from '../core/models';
import { AvatarComponent } from '../employees/avatar.component';
import { SafeHtmlPipe } from '../core/safe-html.pipe';

const CATEGORY_META: Record<PostCategory, { label: string; emoji: string; color: string; }> = {
  ANNOUNCEMENT: { label: 'Announcement', emoji: '📣', color: '#2566e8' },
  KUDOS:        { label: 'Kudos',        emoji: '🎉', color: '#f5a623' },
  EVENT:        { label: 'Event',        emoji: '📅', color: '#5e35b1' },
  QUESTION:     { label: 'Question',     emoji: '❓', color: '#388e3c' },
  GENERAL:      { label: 'General',      emoji: '💬', color: '#6b7280' },
};

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'LIKE',       emoji: '👍', label: 'Like' },
  { type: 'CELEBRATE',  emoji: '🎉', label: 'Celebrate' },
  { type: 'INSIGHTFUL', emoji: '💡', label: 'Insightful' },
  { type: 'HEART',      emoji: '❤️', label: 'Love' },
];

@Component({
  selector: 'app-vibe-page',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, AvatarComponent, SafeHtmlPipe],
  template: `
    <div class="page-bar">
      <h2>Vibe</h2>
      <div class="muted small">Your company feed — share, celebrate, and ask.</div>
    </div>

    <div class="layout">
      <!-- Left: category filter -->
      <aside class="left">
        <div class="card cat-card">
          <div class="cat-title">Filter</div>
          <button class="cat-row" [class.active]="filter() == null" (click)="setFilter(null)">
            <span class="cat-emoji">🌐</span>
            <span>All posts</span>
          </button>
          @for (c of categoryOrder; track c) {
            <button class="cat-row" [class.active]="filter() === c" (click)="setFilter(c)">
              <span class="cat-emoji">{{ meta(c).emoji }}</span>
              <span>{{ meta(c).label }}</span>
            </button>
          }
        </div>
      </aside>

      <!-- Middle: composer + feed -->
      <div class="feed">
        <!-- Composer -->
        <div class="card composer">
          <div class="composer-head">
            <div class="composer-avatar">{{ initials() }}</div>
            <form [formGroup]="form" style="flex: 1; display: flex; flex-direction: column; gap: 8px;" (ngSubmit)="post()">
              <textarea class="composer-text" formControlName="body"
                        rows="3"
                        placeholder="What's happening? Drop kudos, share an update, ask a question…"></textarea>
              <div class="composer-row">
                <select class="select select-sm" formControlName="category">
                  @for (c of categoryOrder; track c) {
                    <option [value]="c">{{ meta(c).emoji }} {{ meta(c).label }}</option>
                  }
                </select>
                @if (form.value.category === 'KUDOS' || form.value.category === 'QUESTION') {
                  <select class="select select-sm" formControlName="subjectEmployeeId">
                    <option [ngValue]="null">— Pick a person —</option>
                    @for (e of mentionables(); track e.id) {
                      <option [ngValue]="e.id">{{ e.firstName }} {{ e.lastName }}</option>
                    }
                  </select>
                }
                @if (isAdmin()) {
                  <label class="pin-toggle">
                    <input type="checkbox" formControlName="pinned" /> Pin
                  </label>
                }
                <span style="flex: 1;"></span>
                <button class="btn btn-primary" type="submit" [disabled]="form.invalid || busy()">
                  {{ busy() ? 'Posting…' : 'Post' }}
                </button>
              </div>
              @if (errorMsg()) { <div class="error">{{ errorMsg() }}</div> }
            </form>
          </div>
        </div>

        <!-- Feed -->
        @if (loading()) {
          <div class="empty">Loading feed…</div>
        } @else if (posts().length === 0) {
          <div class="empty">No posts yet. Be the first to share something.</div>
        } @else {
          @for (p of posts(); track p.id) {
            <article class="card post">
              <header class="post-head">
                <app-avatar [employeeId]="p.author.id" [photoFilename]="p.author.photoFilename"
                            [firstName]="firstNameOf(p.author.name)" [lastName]="lastNameOf(p.author.name)" [size]="44" />
                <div class="post-meta">
                  <div class="post-author">
                    <strong>{{ p.author.name }}</strong>
                    @if (p.pinned) { <span class="pin-badge" title="Pinned">📌 Pinned</span> }
                  </div>
                  <div class="muted small">
                    {{ p.author.designation || '' }}
                    @if (p.author.departmentName) { · {{ p.author.departmentName }} }
                    · {{ timeAgo(p.createdAt) }}
                  </div>
                </div>
                <span class="cat-pill" [style.background]="meta(p.category).color">{{ meta(p.category).emoji }} {{ meta(p.category).label }}</span>
              </header>

              @if (p.subject && (p.category === 'KUDOS' || p.category === 'QUESTION')) {
                <div class="subject-line">
                  @if (p.category === 'KUDOS') { Kudos to } @else { Question for }
                  <strong>{{ p.subject.name }}</strong>
                  @if (p.subject.designation) { · {{ p.subject.designation }} }
                </div>
              }

              <p class="post-body">{{ p.body }}</p>

              <!-- Reactions row -->
              <div class="reactions-row">
                @for (r of reactionList; track r.type) {
                  <button class="reaction-btn"
                          [class.active]="p.myReactions.includes(r.type)"
                          (click)="onReact(p, r.type)"
                          [title]="r.label">
                    <span class="rxn-emoji">{{ r.emoji }}</span>
                    <span class="rxn-count">{{ p.reactionCounts[r.type] || 0 }}</span>
                  </button>
                }
                <span class="comment-summary">
                  💬 {{ p.commentCount }} {{ p.commentCount === 1 ? 'comment' : 'comments' }}
                </span>
                <span style="flex: 1;"></span>
                @if (isAdmin()) {
                  <button class="link-btn" (click)="togglePin(p)">{{ p.pinned ? 'Unpin' : 'Pin' }}</button>
                }
                @if (canDelete(p)) {
                  <button class="link-btn danger" (click)="deletePost(p)">Delete</button>
                }
                <button class="link-btn" (click)="toggleComments(p.id)">
                  {{ openId() === p.id ? 'Hide comments' : 'Show comments' }}
                </button>
              </div>

              <!-- Comments -->
              @if (openId() === p.id) {
                <div class="comments">
                  @if (commentsLoading()) {
                    <div class="muted small" style="padding: 6px 0;">Loading comments…</div>
                  } @else {
                    @for (c of commentsFor(p.id); track c.id) {
                      <div class="comment">
                        <app-avatar [employeeId]="c.author.id" [photoFilename]="c.author.photoFilename"
                                    [firstName]="firstNameOf(c.author.name)" [lastName]="lastNameOf(c.author.name)" [size]="32" />
                        <div class="comment-body">
                          <div class="comment-head">
                            <strong>{{ c.author.name }}</strong>
                            <span class="muted small">· {{ timeAgo(c.createdAt) }}</span>
                            @if (canDeleteComment(c)) {
                              <button class="link-btn danger" (click)="deleteComment(p, c)">Delete</button>
                            }
                          </div>
                          <div class="comment-text">{{ c.body }}</div>
                        </div>
                      </div>
                    }
                  }
                  <div class="comment-composer">
                    <app-avatar [employeeId]="meEmpId() ?? 0" [firstName]="meFirstName()" [lastName]="meLastName()" [size]="32" />
                    <input class="input" placeholder="Write a comment…"
                           [(ngModel)]="draftComment[p.id]"
                           (keyup.enter)="submitComment(p)" />
                    <button class="btn btn-sm btn-primary" (click)="submitComment(p)" [disabled]="!draftComment[p.id]">Send</button>
                  </div>
                </div>
              }
            </article>
          }
        }
      </div>

      <!-- Right: highlights -->
      <aside class="right">
        <div class="card highlight-card">
          <div class="hl-title">📣 What is Vibe?</div>
          <p class="muted small">
            Share announcements, celebrate wins, ask questions, and stay connected with everyone at the company.
          </p>
          <div class="hl-tip">💡 Pick <strong>Kudos</strong> + tag someone to send them a public shout-out.</div>
        </div>
        @if (pinned().length > 0) {
          <div class="card highlight-card">
            <div class="hl-title">📌 Pinned</div>
            @for (p of pinned(); track p.id) {
              <button class="pin-row" (click)="scrollTo(p.id)">
                <span class="cat-emoji">{{ meta(p.category).emoji }}</span>
                <span class="pin-text">{{ truncate(p.body, 80) }}</span>
              </button>
            }
          </div>
        }
      </aside>
    </div>
  `,
  styles: [`
    .page-bar { display: flex; align-items: center; gap: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--border); margin-bottom: 18px; }
    .page-bar h2 { margin: 0; }
    .small { font-size: 12px; }

    .layout { display: grid; grid-template-columns: 220px minmax(0, 1fr) 280px; gap: 18px; align-items: flex-start; }
    @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } .left, .right { display: none; } }

    /* Left rail */
    .cat-card { padding: 10px; }
    .cat-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 4px 8px 8px 8px; }
    .cat-row {
      width: 100%;
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px;
      border: none; background: transparent;
      cursor: pointer; font-family: inherit;
      border-radius: 8px;
      font-size: 13px; color: var(--text);
      text-align: left;
      transition: background 0.12s;
    }
    .cat-row:hover { background: var(--surface-soft); }
    .cat-row.active { background: var(--primary-soft); color: var(--primary-deep); font-weight: 600; }
    .cat-emoji { font-size: 18px; }

    /* Feed column */
    .feed { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
    .composer { padding: 16px; }
    .composer-head { display: flex; gap: 12px; align-items: flex-start; }
    .composer-avatar {
      width: 44px; height: 44px;
      border-radius: 50%;
      background: var(--gradient-primary);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; flex-shrink: 0;
    }
    .composer-text {
      width: 100%; border: 1px solid var(--border); border-radius: 10px;
      padding: 10px 12px; resize: vertical;
    }
    .composer-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .select-sm { padding: 6px 10px; font-size: 13px; }
    .pin-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-soft); }

    /* Post card */
    .post { padding: 16px 20px; }
    .post-head { display: flex; gap: 12px; align-items: center; }
    .post-meta { flex: 1; min-width: 0; }
    .post-author { font-size: 14px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .pin-badge { background: var(--primary-soft); color: var(--primary-deep); padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
    .cat-pill {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 10px;
      border-radius: 999px;
      color: #fff;
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.02em;
    }
    .subject-line {
      margin: 10px 0 4px 0;
      padding: 8px 12px;
      background: var(--surface-soft);
      border-left: 3px solid var(--accent);
      border-radius: 4px;
      font-size: 13px;
    }
    .post-body { margin: 12px 0; line-height: 1.55; white-space: pre-wrap; color: var(--text); font-size: 15px; }

    .reactions-row { display: flex; align-items: center; gap: 6px; padding-top: 10px; border-top: 1px dashed var(--border); flex-wrap: wrap; }
    .reaction-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px;
      border: 1px solid var(--border);
      background: var(--surface);
      border-radius: 999px;
      cursor: pointer; font-family: inherit;
      font-size: 13px;
      transition: background 0.12s, border-color 0.12s;
    }
    .reaction-btn:hover { background: var(--surface-soft); }
    .reaction-btn.active { background: var(--primary-soft); border-color: var(--primary); color: var(--primary-deep); font-weight: 700; }
    .rxn-emoji { font-size: 15px; }
    .rxn-count { min-width: 12px; text-align: right; }
    .comment-summary { color: var(--muted); font-size: 13px; margin-left: 6px; }
    .link-btn {
      background: transparent; border: none; color: var(--primary);
      cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 600;
      padding: 4px 6px; border-radius: 4px;
    }
    .link-btn:hover { background: var(--primary-soft); }
    .link-btn.danger { color: var(--danger); }
    .link-btn.danger:hover { background: #fde4e4; }

    /* Comments */
    .comments { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; }
    .comment { display: flex; gap: 10px; }
    .comment-body { flex: 1; min-width: 0; background: var(--surface-soft); padding: 8px 12px; border-radius: 10px; }
    .comment-head { display: flex; gap: 8px; align-items: center; font-size: 13px; }
    .comment-text { font-size: 13px; margin-top: 2px; white-space: pre-wrap; }
    .comment-composer { display: flex; gap: 8px; align-items: center; padding-top: 6px; }

    /* Right rail */
    .right { display: flex; flex-direction: column; gap: 14px; }
    .highlight-card { padding: 16px; }
    .hl-title { font-weight: 700; margin-bottom: 6px; }
    .hl-tip { margin-top: 10px; padding: 8px 10px; background: var(--surface-soft); border-radius: 8px; font-size: 12px; }
    .pin-row {
      width: 100%; display: flex; gap: 8px; align-items: flex-start;
      padding: 8px; border: none; background: transparent; cursor: pointer; text-align: left;
      font-family: inherit; border-radius: 6px;
    }
    .pin-row:hover { background: var(--surface-soft); }
    .pin-text { font-size: 12px; color: var(--text-soft); line-height: 1.4; }
  `]
})
export class VibePageComponent {
  private svc = inject(VibeService);
  private auth = inject(AuthService);
  private employeeSvc = inject(EmployeeService);
  private fb = inject(FormBuilder);

  filter = signal<PostCategory | null>(null);
  posts = signal<VibePost[]>([]);
  loading = signal(true);
  busy = signal(false);
  errorMsg = signal<string | null>(null);
  openId = signal<number | null>(null);
  commentsLoading = signal(false);
  commentsByPost = signal<Record<number, VibeComment[]>>({});
  mentionables = signal<Employee[]>([]);

  draftComment: Record<number, string> = {};

  form = this.fb.group({
    body: ['', [Validators.required, Validators.maxLength(5000)]],
    category: ['GENERAL' as PostCategory, Validators.required],
    subjectEmployeeId: [null as number | null],
    pinned: [false]
  });

  categoryOrder: PostCategory[] = ['ANNOUNCEMENT', 'KUDOS', 'EVENT', 'QUESTION', 'GENERAL'];
  reactionList = REACTIONS;

  isAdmin = computed(() => this.auth.hasRole('ADMIN'));
  meEmpId = computed(() => this.auth.user()?.employee?.id ?? null);
  meFirstName = computed(() => this.auth.user()?.employee?.firstName ?? '?');
  meLastName  = computed(() => this.auth.user()?.employee?.lastName ?? '');
  initials = computed(() => {
    const f = this.meFirstName(); const l = this.meLastName();
    return ((f?.[0] ?? '?') + (l?.[0] ?? '')).toUpperCase();
  });

  pinned = computed(() => this.posts().filter(p => p.pinned));

  constructor() {
    this.refresh();
    this.employeeSvc.list().subscribe(list => this.mentionables.set(list.slice(0, 200)));
  }

  meta(c: PostCategory) { return CATEGORY_META[c]; }

  setFilter(c: PostCategory | null) {
    this.filter.set(c);
    this.refresh();
  }

  refresh() {
    this.loading.set(true);
    this.svc.feed(this.filter() ?? undefined).subscribe({
      next: r => { this.posts.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  post() {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.errorMsg.set(null);
    const v = this.form.value;
    this.svc.create({
      body: v.body!,
      category: v.category as PostCategory,
      subjectEmployeeId: v.subjectEmployeeId,
      pinned: this.isAdmin() ? !!v.pinned : false
    }).subscribe({
      next: () => {
        this.busy.set(false);
        this.form.reset({ body: '', category: 'GENERAL' as PostCategory, subjectEmployeeId: null, pinned: false });
        this.refresh();
      },
      error: (err) => { this.errorMsg.set(err?.error?.message ?? 'Post failed'); this.busy.set(false); }
    });
  }

  onReact(p: VibePost, type: ReactionType) {
    this.svc.react(p.id, type).subscribe({
      next: (updated) => {
        this.posts.update(list => list.map(x => x.id === updated.id ? updated : x));
      },
      error: (err) => alert(err?.error?.message ?? 'Failed')
    });
  }

  togglePin(p: VibePost) {
    this.svc.togglePin(p.id).subscribe(() => this.refresh());
  }

  deletePost(p: VibePost) {
    if (!confirm('Delete this post?')) return;
    this.svc.delete(p.id).subscribe(() => this.refresh());
  }

  toggleComments(postId: number) {
    if (this.openId() === postId) {
      this.openId.set(null);
      return;
    }
    this.openId.set(postId);
    this.commentsLoading.set(true);
    this.svc.get(postId).subscribe({
      next: (d) => {
        this.commentsByPost.update(map => ({ ...map, [postId]: d.comments }));
        this.commentsLoading.set(false);
        // Also update the post in feed to reflect any fresh counts
        this.posts.update(list => list.map(x => x.id === postId ? d.post : x));
      },
      error: () => this.commentsLoading.set(false)
    });
  }

  commentsFor(postId: number): VibeComment[] {
    return this.commentsByPost()[postId] ?? [];
  }

  submitComment(p: VibePost) {
    const body = (this.draftComment[p.id] ?? '').trim();
    if (!body) return;
    this.svc.comment(p.id, body).subscribe({
      next: () => {
        this.draftComment[p.id] = '';
        // Refresh comments + count
        this.svc.get(p.id).subscribe(d => {
          this.commentsByPost.update(map => ({ ...map, [p.id]: d.comments }));
          this.posts.update(list => list.map(x => x.id === p.id ? d.post : x));
        });
      },
      error: (err) => alert(err?.error?.message ?? 'Failed')
    });
  }

  canDelete(p: VibePost): boolean {
    if (this.isAdmin()) return true;
    return this.meEmpId() === p.author.id;
  }
  canDeleteComment(c: VibeComment): boolean {
    if (this.isAdmin()) return true;
    return this.meEmpId() === c.author.id;
  }
  deleteComment(p: VibePost, c: VibeComment) {
    if (!confirm('Delete this comment?')) return;
    this.svc.deleteComment(c.id).subscribe(() => {
      // Refresh
      this.svc.get(p.id).subscribe(d => {
        this.commentsByPost.update(map => ({ ...map, [p.id]: d.comments }));
        this.posts.update(list => list.map(x => x.id === p.id ? d.post : x));
      });
    });
  }

  scrollTo(postId: number) {
    // Just open its comments + flash; smooth-scroll could be added later
    this.openId.set(postId);
    this.toggleComments(postId);
  }

  firstNameOf(name: string): string { return (name || '').split(' ')[0] || '?'; }
  lastNameOf(name: string): string { const parts = (name || '').split(' '); return parts.slice(1).join(' ') || ''; }

  timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24);
    if (d < 7) return d + 'd ago';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  truncate(s: string, n: number): string {
    return s.length <= n ? s : s.slice(0, n) + '…';
  }
}
