import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AppCurrency, AppLanguage, AppTheme, PreferencesService } from '../../core/services/preferences.service';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, RouterLink],
  template: `
    <div class="settings">
      <a routerLink="/">← {{ text('Back to households', 'परिवारों पर वापस जाएं') }}</a>
      <header><div class="avatar" aria-hidden="true">{{ initial }}</div><div><h1>{{ text('Profile & settings', 'प्रोफ़ाइल और सेटिंग्स') }}</h1><p>{{ user?.displayName }}</p></div></header>
      <section>
        <h2>{{ text('Profile', 'प्रोफ़ाइल') }}</h2>
        <dl><div><dt>{{ text('Name', 'नाम') }}</dt><dd>{{ user?.displayName }}</dd></div><div><dt>{{ text('Email', 'ईमेल') }}</dt><dd>{{ user?.email }}</dd></div><div><dt>{{ text('Roles', 'भूमिकाएं') }}</dt><dd>{{ user?.roles?.join(', ') }}</dd></div></dl>
        <p class="hint">{{ text('Identity details are managed by the central SSO account.', 'पहचान विवरण केंद्रीय SSO खाते द्वारा प्रबंधित किए जाते हैं।') }}</p>
      </section>
      <section>
        <h2>{{ text('Localization', 'भाषा और मुद्रा') }}</h2>
        <div class="grid"><label>{{ text('Language', 'भाषा') }}<select [(ngModel)]="language"><option value="en">English</option><option value="hi">हिन्दी</option></select></label><label>{{ text('Currency', 'मुद्रा') }}<select [(ngModel)]="currency"><option value="INR">INR (₹)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="GBP">GBP (£)</option></select></label><label>{{ text('Appearance', 'दिखावट') }}<select [(ngModel)]="theme"><option value="system">{{ text('System', 'सिस्टम') }}</option><option value="light">{{ text('Light', 'हल्का') }}</option><option value="dark">{{ text('Dark', 'गहरा') }}</option></select></label></div>
        <button (click)="save()">{{ text('Save preferences', 'सेटिंग्स सहेजें') }}</button>@if (saved) { <span class="saved" role="status">{{ text('Saved', 'सहेजा गया') }}</span> }
      </section>
      <section>
        <h2>{{ text('Session', 'सत्र') }}</h2>
        <dl><div><dt>{{ text('Status', 'स्थिति') }}</dt><dd>{{ auth.isAuthenticated() ? text('Active', 'सक्रिय') : text('Signed out', 'साइन आउट') }}</dd></div><div><dt>{{ text('Access expires', 'एक्सेस समाप्ति') }}</dt><dd>{{ auth.sessionExpiresAt() ? (auth.sessionExpiresAt() | date:'medium') : '—' }}</dd></div></dl>
        <button class="secondary" (click)="logout()">{{ text('Sign out', 'साइन आउट') }}</button>
      </section>
    </div>
  `,
  styles: [`
    .settings{max-width:760px;margin:0 auto}.settings>a{color:var(--muted);text-decoration:none;font-size:.85rem}header{display:flex;align-items:center;gap:1rem;margin:1rem 0}h1{font-size:1.6rem;margin:0}header p{margin:.25rem 0;color:var(--muted)}.avatar{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:var(--brand);color:var(--brand-text);font-size:1.3rem;font-weight:700}section{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:1.2rem;margin-bottom:1rem}h2{font-size:1rem;margin:0 0 1rem}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.8rem}label,dt{color:var(--muted);font-size:.78rem;font-weight:600}select{display:block;width:100%;margin-top:.35rem;padding:.55rem;border:1px solid var(--border);border-radius:5px;background:var(--surface);color:var(--text)}dl{margin:0}dl div{display:grid;grid-template-columns:140px 1fr;padding:.45rem 0;border-bottom:1px solid var(--border)}dd{margin:0}.hint{color:var(--muted);font-size:.8rem}button{margin-top:1rem;border:0;border-radius:5px;background:var(--brand);color:var(--brand-text);padding:.55rem .9rem;cursor:pointer}.secondary{background:transparent;color:var(--text);border:1px solid var(--border)}.saved{margin-left:.75rem;color:var(--muted);font-size:.85rem}@media(max-width:650px){.grid{grid-template-columns:1fr}dl div{grid-template-columns:1fr;gap:.2rem}}
  `],
})
export class SettingsComponent {
  readonly auth = inject(AuthService);
  private readonly preferences = inject(PreferencesService);
  readonly user = this.auth.user();
  readonly initial = (this.user?.displayName || this.user?.email || '?').charAt(0).toUpperCase();
  language: AppLanguage = this.preferences.value().language;
  currency: AppCurrency = this.preferences.value().currency;
  theme: AppTheme = this.preferences.value().theme;
  saved = false;

  text(english: string, hindi: string): string { return this.language === 'hi' ? hindi : english; }
  save(): void { this.preferences.save({ language: this.language, currency: this.currency, theme: this.theme }); this.saved = true; }
  logout(): void { this.auth.logout().subscribe({ next: () => this.auth.loginRedirect(location.origin) }); }
}