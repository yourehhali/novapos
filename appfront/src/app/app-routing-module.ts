import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
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

const routes: Routes = [
  { path: 'login', component: LoginPageComponent },
  { path: 'select-branch', component: BranchSelectPageComponent, canActivate: [authGuard] },
  {
    path: '',
    component: ShellLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardPageComponent },
      { path: 'pos', component: PosPageComponent },
      { path: 'orders', component: OrderHistoryPageComponent },
      { path: 'settings', component: SettingsPageComponent },
      { path: 'admin/business', component: AdminBusinessPageComponent },
      { path: 'admin/branches', component: AdminBranchesPageComponent },
      { path: 'admin/users', component: AdminUsersPageComponent },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
