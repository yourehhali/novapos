import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ShellLayoutComponent } from './layout/shell-layout.component';
import { DashboardPageComponent } from './pages/dashboard/dashboard-page.component';
import { ManagementPageComponent } from './pages/management/management-page.component';
import { OrderHistoryPageComponent } from './pages/order-history/order-history-page.component';
import { PosPageComponent } from './pages/pos/pos-page.component';
import { ServicePageComponent } from './pages/service/service-page.component';

const routes: Routes = [
  {
    path: '',
    component: ShellLayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardPageComponent },
      { path: 'pos', component: PosPageComponent },
      { path: 'service', component: ServicePageComponent },
      { path: 'orders', component: OrderHistoryPageComponent },
      { path: 'management', component: ManagementPageComponent },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
