import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { Signal, WritableSignal } from '@angular/core';
import { Subject } from 'rxjs';
import { Upload } from './upload';
import { ProjectService } from '../../core/projects/project.service';
import { UploadEvent } from '../../shared/models/project.model';

/** The protected members these tests drive directly */
interface UploadInternals {
  select(file: File): Promise<void>;
  upload(): void;
  selected: WritableSignal<{
    file: File;
    previewUrl: string;
    width: number;
    height: number;
  } | null>;
  progress: Signal<number | null>;
  title: string;
  ownershipConfirmed: boolean;
}

describe('Upload page', () => {
  let events: Subject<UploadEvent>;
  const upload = vi.fn();

  beforeEach(() => {
    events = new Subject<UploadEvent>();
    upload.mockReset().mockReturnValue(events);
    TestBed.configureTestingModule({
      imports: [Upload],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ProjectService, useValue: { upload } },
      ],
    });
  });

  async function setup() {
    const fixture = TestBed.createComponent(Upload);
    fixture.detectChanges();
    TestBed.tick();
    // Answer the public-settings request with a 1 MB limit
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/settings/public')
      .flush({ settings: { maxUploadMb: 1, allowedFormats: ['image/jpeg'] } });
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      fixture,
      page: fixture.componentInstance as unknown as UploadInternals,
      el: fixture.nativeElement as HTMLElement,
    };
  }

  it('shows the drop zone with the configured size limit', async () => {
    const { el } = await setup();
    expect(el.textContent).toContain('Drag a photo here');
    expect(el.textContent).toContain('up to 1 MB');
  });

  it('rejects files that are not JPG/PNG before uploading', async () => {
    const { fixture, page, el } = await setup();
    await page.select(new File(['<svg/>'], 'room.jpg', { type: 'image/jpeg' }));
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Only JPG and PNG');
    expect(upload).not.toHaveBeenCalled();
  });

  it('rejects files over the size limit', async () => {
    const { fixture, page, el } = await setup();
    const big = new Uint8Array(2 * 1024 * 1024);
    big.set([0xff, 0xd8, 0xff]);
    await page.select(new File([big], 'room.jpg'));
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('maximum size is 1 MB');
  });

  it('requires the ownership checkbox, then uploads and opens the project', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { fixture, page, el } = await setup();
    page.selected.set({
      file: new File(['x'], 'room.jpg'),
      previewUrl: 'blob:x',
      width: 800,
      height: 600,
    });
    page.title = 'Lounge';
    fixture.detectChanges();

    const submit = el.querySelector<HTMLButtonElement>('button[type=submit]')!;
    expect(submit.disabled).toBe(true);
    page.upload();
    expect(upload).not.toHaveBeenCalled();

    page.ownershipConfirmed = true;
    page.upload();
    expect(upload).toHaveBeenCalledWith(expect.any(File), 'Lounge');

    events.next({ kind: 'progress', percent: 40 });
    fixture.detectChanges();
    expect(el.textContent).toContain('Uploading… 40%');

    events.next({ kind: 'done', project: { _id: 'p1' } as never });
    expect(navigate).toHaveBeenCalledWith(['/projects', 'p1', 'select'], { queryParams: {} });
  });

  it('shows server errors and lets the user retry', async () => {
    const { fixture, page, el } = await setup();
    page.selected.set({
      file: new File(['x'], 'a.jpg'),
      previewUrl: 'blob:x',
      width: 800,
      height: 600,
    });
    page.ownershipConfirmed = true;
    page.upload();
    events.error({
      status: 400,
      message: 'This file is not a valid image or is damaged.',
      errors: [],
    });
    fixture.detectChanges();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('not a valid image');
    expect(page.progress()).toBeNull();
  });
});
