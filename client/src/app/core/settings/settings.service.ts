import { httpResource } from '@angular/common/http';
import { Injectable, computed } from '@angular/core';
import { environment } from '../../../environments/environment';
import { PublicSettings } from '../../shared/models/settings.model';

const DEFAULTS: PublicSettings = {
  maxUploadMb: 10,
  allowedFormats: ['image/jpeg', 'image/png'],
  defaultFinish: 'matte',
  disclaimerText:
    'Previews are a visual guide only. Actual colours may vary due to lighting, screen calibration, and wall texture.',
};

/** Admin-configurable public settings (FR-AD6), with safe defaults until loaded. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly resource = httpResource<{ settings: PublicSettings }>(
    () => `${environment.apiUrl}/settings/public`,
  );

  readonly settings = computed<PublicSettings>(() =>
    this.resource.hasValue() ? { ...DEFAULTS, ...this.resource.value().settings } : DEFAULTS,
  );
}
