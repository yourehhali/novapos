import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ShellLayoutComponent } from './layout/shell-layout.component';
import { DashboardPageComponent } from './pages/dashboard/dashboard-page.component';
import { OrderHistoryPageComponent } from './pages/order-history/order-history-page.component';
import { PosPageComponent } from './pages/pos/pos-page.component';

const routes: Routes = [
  {
    path: '',
    component: ShellLayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardPageComponent },
      { path: 'pos', component: PosPageComponent },
      { path: 'orders', component: OrderHistoryPageComponent },
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
