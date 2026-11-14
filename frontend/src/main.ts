import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

function dismissBootLoader(): void {
  const el = document.getElementById('boot-loader');
  if (!el) return;
  el.style.opacity = '0';
  setTimeout(() => el.remove(), 220);
}

bootstrapApplication(App, appConfig)
  .then(() => dismissBootLoader())
  .catch((err) => {
    dismissBootLoader();
    console.error(err);
  });
