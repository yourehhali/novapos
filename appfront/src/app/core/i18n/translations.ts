import { ADMIN_DE, ADMIN_FR } from './sections/admin';
import { BRANCH_DE, BRANCH_FR } from './sections/branch';
import { COMMON_DE, COMMON_FR } from './sections/common';
import { DASHBOARD_DE, DASHBOARD_FR } from './sections/dashboard';
import { LOGIN_DE, LOGIN_FR } from './sections/login';
import { MANAGEMENT_DE, MANAGEMENT_FR } from './sections/management';
import { MODAL_DE, MODAL_FR } from './sections/modal';
import { ORDERS_DE, ORDERS_FR } from './sections/orders';
import { POS_DE, POS_FR } from './sections/pos';
import { SERVICES_DE, SERVICES_FR } from './sections/services';
import { SERVICE_DE, SERVICE_FR } from './sections/service';
import { SETTINGS_DE, SETTINGS_FR } from './sections/settings';
import { SHELL_DE, SHELL_FR } from './sections/shell';

export type AppLanguage = 'fr' | 'de';

export type TranslationParams = Record<string, string | number>;

export const FR_TRANSLATIONS: Record<string, string> = {
  ...SHELL_FR,
  ...COMMON_FR,
  ...LOGIN_FR,
  ...BRANCH_FR,
  ...DASHBOARD_FR,
  ...POS_FR,
  ...SERVICE_FR,
  ...ORDERS_FR,
  ...MANAGEMENT_FR,
  ...SETTINGS_FR,
  ...ADMIN_FR,
  ...MODAL_FR,
  ...SERVICES_FR,
};

export const DE_TRANSLATIONS: Record<string, string> = {
  ...SHELL_DE,
  ...COMMON_DE,
  ...LOGIN_DE,
  ...BRANCH_DE,
  ...DASHBOARD_DE,
  ...POS_DE,
  ...SERVICE_DE,
  ...ORDERS_DE,
  ...MANAGEMENT_DE,
  ...SETTINGS_DE,
  ...ADMIN_DE,
  ...MODAL_DE,
  ...SERVICES_DE,
};

export const TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  fr: FR_TRANSLATIONS,
  de: DE_TRANSLATIONS,
};
