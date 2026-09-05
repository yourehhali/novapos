import { Injectable, inject } from '@angular/core';
import { BusinessSettings, LogoType } from '../models/app.models';
import { NovaPosDbService } from '../../offline/novapos-db.service';

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

@Injectable({ providedIn: 'root' })
export class BusinessSettingsService {
  private readonly db = inject(NovaPosDbService);

  async load(): Promise<BusinessSettings> {
    const row = await this.db.businessSettings.get('current');
    if (row) return row;
    const defaults: BusinessSettings = {
      ...DEFAULT_BUSINESS_SETTINGS,
      updatedAt: new Date().toISOString(),
    };
    try {
      await this.db.businessSettings.put(defaults);
    } catch {
      // ignore write error; still return defaults
    }
    return defaults;
  }

  async save(settings: BusinessSettings): Promise<BusinessSettings> {
    const toSave: BusinessSettings = {
      ...settings,
      id: 'current',
      updatedAt: new Date().toISOString(),
    };
    await this.db.businessSettings.put(toSave);
    return toSave;
  }
}
