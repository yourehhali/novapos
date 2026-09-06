import { Injectable, inject, signal } from '@angular/core';
import { BusinessSettings, DemoSeedingMode, LogoType, TicketLayoutConfig } from '../models/app.models';
import { NovaPosDbService } from '../../offline/novapos-db.service';

export function defaultTicketLayoutConfig(kind: 'payment' | 'kitchen'): TicketLayoutConfig {
  if (kind === 'kitchen') {
    return {
      showBusinessInfo: false,
      logoType: 'TEXT',
      logoText: '',
      logoImageDataUrl: '',
      heading: 'Ticket Cuisine',
      subheading: '',
      footerLine1: '',
      footerLine2: '',
      footerLine3: '',
    };
  }
  return {
    showBusinessInfo: true,
    logoType: 'TEXT',
    logoText: '',
    logoImageDataUrl: '',
    heading: 'Ticket Commande',
    subheading: '',
    footerLine1: 'Merci pour votre visite',
    footerLine2: 'A bientot',
    footerLine3: '',
  };
}

export function mergeTicketLayoutConfig(
  settings: BusinessSettings | null | undefined,
  kind: 'payment' | 'kitchen',
): TicketLayoutConfig {
  const base = defaultTicketLayoutConfig(kind);
  if (!settings) return base;
  const override = kind === 'kitchen' ? settings.kitchenTicket : settings.paymentTicket;
  const topFallback: TicketLayoutConfig = kind === 'kitchen'
    ? {
        showBusinessInfo: false,
        logoType: settings.logoType ?? base.logoType,
        logoText: settings.logoText ?? base.logoText,
        logoImageDataUrl: settings.logoImageDataUrl ?? base.logoImageDataUrl,
        heading: 'Ticket Cuisine',
        subheading: '',
        footerLine1: '',
        footerLine2: '',
        footerLine3: '',
      }
    : {
        showBusinessInfo: true,
        logoType: settings.logoType ?? base.logoType,
        logoText: settings.logoText ?? base.logoText,
        logoImageDataUrl: settings.logoImageDataUrl ?? base.logoImageDataUrl,
        heading: settings.ticketHeading ?? base.heading,
        subheading: settings.ticketSubheading ?? base.subheading,
        footerLine1: settings.footerLine1 ?? base.footerLine1,
        footerLine2: settings.footerLine2 ?? base.footerLine2,
        footerLine3: settings.footerLine3 ?? base.footerLine3,
      };
  return {
    showBusinessInfo: override?.showBusinessInfo ?? topFallback.showBusinessInfo,
    logoType: ((override?.logoType ?? topFallback.logoType) || 'TEXT') as LogoType,
    logoText: override?.logoText ?? topFallback.logoText,
    logoImageDataUrl: override?.logoImageDataUrl ?? topFallback.logoImageDataUrl,
    heading: override?.heading ?? topFallback.heading,
    subheading: override?.subheading ?? topFallback.subheading,
    footerLine1: override?.footerLine1 ?? topFallback.footerLine1,
    footerLine2: override?.footerLine2 ?? topFallback.footerLine2,
    footerLine3: override?.footerLine3 ?? topFallback.footerLine3,
  };
}

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  id: 'current',
  businessName: 'Hole Mole',
  addressLine1: '',
  addressLine2: '',
  phone: '',
  taxLabel: 'IF',
  taxNumber: '',
  logoType: 'TEXT' as LogoType,
  logoText: 'HM',
  logoImageDataUrl: '',
  ticketHeading: 'Ticket Commande',
  ticketSubheading: '',
  footerLine1: 'Merci pour votre visite',
  footerLine2: 'A bientot',
  footerLine3: '',
  paymentTicket: defaultTicketLayoutConfig('payment'),
  kitchenTicket: defaultTicketLayoutConfig('kitchen'),
  demoSeedingMode: 'DEMO' as DemoSeedingMode,
  receiptPrinterName: 'Impression navigateur',
  receiptQueueName: 'default-receipt',
  receiptPrinterIp: '',
  receiptPaperWidthMm: 80,
  kitchenPrinterName: 'Impression navigateur',
  kitchenQueueName: 'default-kitchen',
  kitchenPrinterIp: '',
  kitchenPaperWidthMm: 80,
  currency: 'DH',
  updatedAt: new Date(0).toISOString(),
};

function normalizeBusinessSettings(row: Partial<BusinessSettings> | BusinessSettings): BusinessSettings {
  return {
    ...DEFAULT_BUSINESS_SETTINGS,
    ...row,
    demoSeedingMode: (row?.demoSeedingMode ?? DEFAULT_BUSINESS_SETTINGS.demoSeedingMode) as DemoSeedingMode,
    paymentTicket: { ...defaultTicketLayoutConfig('payment'), ...((row?.paymentTicket ?? {}) as Partial<TicketLayoutConfig>) } as TicketLayoutConfig,
    kitchenTicket: { ...defaultTicketLayoutConfig('kitchen'), ...((row?.kitchenTicket ?? {}) as Partial<TicketLayoutConfig>) } as TicketLayoutConfig,
  };
}

@Injectable({ providedIn: 'root' })
export class BusinessSettingsService {
  private readonly db = inject(NovaPosDbService);
  private readonly cached = signal<BusinessSettings | null>(null);

  snapshot(): BusinessSettings | null {
    return this.cached();
  }

  async load(): Promise<BusinessSettings> {
    const row = await this.db.businessSettings.get('current');
    const merged: BusinessSettings = row
      ? normalizeBusinessSettings(row)
      : normalizeBusinessSettings({
          ...DEFAULT_BUSINESS_SETTINGS,
          updatedAt: new Date().toISOString(),
        });
    if (!row) {
      try {
        await this.db.businessSettings.put(merged);
      } catch {
        // ignore write error; still return defaults
      }
    }
    this.cached.set(merged);
    return merged;
  }

  async save(settings: BusinessSettings): Promise<BusinessSettings> {
    const toSave: BusinessSettings = normalizeBusinessSettings({
      ...settings,
      id: 'current',
      updatedAt: new Date().toISOString(),
    });
    await this.db.businessSettings.put(toSave);
    this.cached.set(toSave);
    return toSave;
  }

  async setDemoSeedingMode(mode: DemoSeedingMode): Promise<BusinessSettings> {
    const current = this.cached() ?? (await this.load());
    const next: BusinessSettings = { ...current, demoSeedingMode: mode };
    return this.save(next);
  }
}
