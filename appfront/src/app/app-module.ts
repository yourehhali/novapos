import { inject, NgModule, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { AuthService } from './core/services/auth.service';
import { ShellLayoutComponent } from './layout/shell-layout.component';
import { AdminBranchesPageComponent } from './pages/admin-branches/admin-branches-page.component';
import { AdminBusinessPageComponent } from './pages/admin-business/admin-business-page.component';
import { AdminUsersPageComponent } from './pages/admin-users/admin-users-page.component';
import { BranchSelectPageComponent } from './pages/branch-select/branch-select-page.component';
import { DashboardPageComponent } from './pages/dashboard/dashboard-page.component';
import { LoginPageComponent } from './pages/login/login-page.component';
import { OrderHistoryPageComponent } from './pages/order-history/order-history-page.component';
import { PosPageComponent } from './pages/pos/pos-page.component';
import { SettingsPageComponent } from './pages/settings/settings-page.component';
import { AppModalComponent } from './shared/components/app-modal/app-modal.component';

@NgModule({
  declarations: [
    App,
    ShellLayoutComponent,
    LoginPageComponent,
    BranchSelectPageComponent,
    DashboardPageComponent,
    PosPageComponent,
    OrderHistoryPageComponent,
    SettingsPageComponent,
    AppModalComponent,
    AdminBusinessPageComponent,
    AdminBranchesPageComponent,
    AdminUsersPageComponent,
  ],
  imports: [BrowserModule, AppRoutingModule, FormsModule],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideAppInitializer(() => inject(AuthService).restoreSession()),
  ],
  bootstrap: [App],
})
export class AppModule {}
