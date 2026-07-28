import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AuthSessionResponse,
  BootstrapSession,
  Category,
  DashboardSummary,
  PrinterConfig,
  Product,
  SyncBatchRequest,
  SyncBatchResponse,
  SyncStatus,
} from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://0k82kv9n-8080.uks1.devtunnels.ms';

  login(login: string, password: string): Observable<AuthSessionResponse> {
    return this.http.post<AuthSessionResponse>(`${this.baseUrl}/api/auth/login`, {
      login,
      password,
    });
  }

  me(token: string): Observable<AuthSessionResponse> {
    return this.http.get<AuthSessionResponse>(`${this.baseUrl}/api/auth/me`, {
      headers: this.authHeaders(token),
    });
  }

  bootstrapSession(
    token: string,
    branchId: string,
    deviceType: string,
    deviceCode?: string,
  ): Observable<BootstrapSession> {
    return this.http.get<BootstrapSession>(`${this.baseUrl}/api/bootstrap/session`, {
      headers: this.authHeaders(token),
      params: {
        branchId,
        deviceType,
        ...(deviceCode ? { deviceCode } : {}),
      },
    });
  }

  getProducts(token: string): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.baseUrl}/api/catalog/products`, {
      headers: this.authHeaders(token),
    });
  }

  getCategories(token: string): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.baseUrl}/api/catalog/categories`, {
      headers: this.authHeaders(token),
    });
  }

  getDashboard(token: string, branchId: string): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.baseUrl}/api/dashboard/summary`, {
      headers: this.authHeaders(token),
      params: { branchId },
    });
  }

  getPrinters(token: string): Observable<PrinterConfig[]> {
    return this.http.get<PrinterConfig[]>(`${this.baseUrl}/api/settings/printers`, {
      headers: this.authHeaders(token),
    });
  }

  getSyncStatus(token: string, branchId: string, deviceId: string): Observable<SyncStatus> {
    return this.http.get<SyncStatus>(`${this.baseUrl}/api/sync/status`, {
      headers: this.authHeaders(token),
      params: { branchId, deviceId },
    });
  }

  syncEvents(token: string, payload: SyncBatchRequest): Observable<SyncBatchResponse> {
    return this.http.post<SyncBatchResponse>(`${this.baseUrl}/api/sync/events`, payload, {
      headers: this.authHeaders(token),
    });
  }

  private authHeaders(token: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }
}
