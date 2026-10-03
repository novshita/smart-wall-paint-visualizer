import { TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProjectService } from './project.service';
import { UploadEvent } from '../../shared/models/project.model';

describe('ProjectService.upload', () => {
  it('sends multipart form data with ownership confirmed and reports progress', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(ProjectService);
    const http = TestBed.inject(HttpTestingController);

    const events: UploadEvent[] = [];
    const file = new File(['x'], 'room.jpg', { type: 'image/jpeg' });
    service.upload(file, 'Lounge').subscribe((e) => events.push(e));

    const req = http.expectOne('/api/v1/projects');
    const body = req.request.body as FormData;
    expect(body.get('image')).toBe(file);
    expect(body.get('title')).toBe('Lounge');
    expect(body.get('ownershipConfirmed')).toBe('true');

    req.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 200 });
    req.flush({ project: { _id: 'p1' } });

    expect(events[0]).toEqual({ kind: 'progress', percent: 25 });
    expect(events.at(-1)).toEqual({ kind: 'done', project: { _id: 'p1' } });
    http.verify();
  });
});
