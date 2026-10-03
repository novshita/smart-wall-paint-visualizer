import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EditorStore } from './editor.store';
import { Project } from '../../shared/models/project.model';
import { Selection } from './editor.model';

const square: Selection = {
  type: 'polygon',
  points: [
    [0.1, 0.1],
    [0.5, 0.1],
    [0.5, 0.5],
  ],
  feather: 2,
};

function project(): Project {
  return {
    _id: 'p1',
    userId: 'u1',
    title: 'Room',
    status: 'draft',
    originalImage: { url: '', width: 100, height: 100 },
    workingImage: { url: '', width: 100, height: 100 },
    thumbnailUrl: '',
    createdAt: '',
    updatedAt: '',
    variants: [
      { variantId: 'v1', name: 'Design 1', regions: [] },
      { variantId: 'v2', name: 'Design 2', regions: [] },
    ],
  };
}

describe('EditorStore', () => {
  let store: EditorStore;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [EditorStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(EditorStore);
    http = TestBed.inject(HttpTestingController);
    store.load(project());
  });

  afterEach(() => vi.useRealTimers());

  it('adds walls with sequential names to every variant, and selects the new wall', () => {
    const a = store.addWall();
    store.addWall();
    expect(store.regions().map((r) => r.name)).toEqual(['Wall 1', 'Wall 2']);
    expect(store.variants()[1].regions.map((r) => r.regionId)).toContain(a);
    expect(store.activeRegionId()).not.toBe(a);
  });

  it('shares selections across variants but keeps styles per variant', () => {
    const id = store.addWall();
    store.setSelection(id, square);
    store.setStyle(id, { customHex: '#FF0000' });

    const [v1, v2] = store.variants();
    expect(v1.regions[0].selection.points).toHaveLength(3);
    expect(v2.regions[0].selection.points).toHaveLength(3);
    expect(v1.regions[0].style.customHex).toBe('#FF0000');
    expect(v2.regions[0].style.customHex).toBeUndefined();
  });

  it('undoes and redoes, restoring the selected wall', () => {
    const id = store.addWall();
    store.setSelection(id, square);
    store.undo();
    expect(store.regions()[0].selection.points).toBeUndefined();
    store.undo();
    expect(store.regions()).toHaveLength(0);
    expect(store.activeRegionId()).toBeNull();
    store.redo();
    store.redo();
    expect(store.regions()[0].selection.points).toHaveLength(3);
    expect(store.canRedo()).toBe(false);
  });

  it('groups a slider drag into one undo step', () => {
    const id = store.addWall();
    for (const opacity of [90, 80, 70]) store.setStyle(id, { opacity }, { history: false });
    store.setStyle(id, { opacity: 60 });
    store.endGesture();
    expect(store.activeRegion()?.style.opacity).toBe(60);
    store.undo();
    expect(store.activeRegion()?.style.opacity).toBeUndefined();
  });

  it('auto-saves once after edits pause, then reports saved', async () => {
    const id = store.addWall();
    store.setSelection(id, square);
    expect(store.saveState()).toBe('unsaved');
    TestBed.tick();

    await vi.advanceTimersByTimeAsync(500);
    http.expectNone('/api/v1/projects/p1');
    await vi.advanceTimersByTimeAsync(1000);

    const req = http.expectOne({ method: 'PUT', url: '/api/v1/projects/p1' });
    expect(req.request.body.variants[0].regions[0].selection.points).toHaveLength(3);
    req.flush({ project: { ...project(), updatedAt: 'now' } });
    await vi.runAllTimersAsync();
    expect(store.saveState()).toBe('saved');
    expect(store.isDirty()).toBe(false);
  });

  it('marks the design saved explicitly and surfaces save errors', async () => {
    const saved = store.save('saved');
    http
      .expectOne('/api/v1/projects/p1')
      .flush({ status: 500, message: 'Server down', errors: [] }, { status: 500, statusText: '' });
    await expect(saved).rejects.toBeTruthy();
    expect(store.saveState()).toBe('error');

    const retry = store.save('saved');
    const req = http.expectOne('/api/v1/projects/p1');
    expect(req.request.body.status).toBe('saved');
    req.flush({ project: { ...project(), status: 'saved' } });
    await retry;
    expect(store.project()?.status).toBe('saved');
  });

  it('deleting the active wall selects a neighbour', () => {
    const a = store.addWall();
    const b = store.addWall();
    store.activeRegionId.set(a);
    store.deleteWall(a);
    expect(store.activeRegionId()).toBe(b);
  });
});

describe('EditorStore variants', () => {
  let store: EditorStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EditorStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(EditorStore);
    store.load({ ...project(), variants: [{ variantId: 'v1', name: 'Design 1', regions: [] }] });
  });

  it('adds a variant copying the current colours, and switches to it', () => {
    const wall = store.addWall();
    store.setStyle(wall, { customHex: '#FF0000' });
    const id = store.addVariant()!;
    expect(store.variant()?.variantId).toBe(id);
    expect(store.variant()?.name).toBe('Design 2');
    expect(store.regions()[0].style.customHex).toBe('#FF0000');

    store.setStyle(wall, { customHex: '#0000FF' });
    store.selectVariant('v1');
    expect(store.regions()[0].style.customHex).toBe('#FF0000'); // independent colours
  });

  it('renames and deletes variants but always keeps one', () => {
    const id = store.addVariant()!;
    store.renameVariant(id, '  Bold option ');
    expect(store.variant()?.name).toBe('Bold option');
    store.deleteVariant(id);
    expect(store.variants().map((v) => v.variantId)).toEqual(['v1']);
    expect(store.variant()?.variantId).toBe('v1');
    store.deleteVariant('v1');
    expect(store.variants()).toHaveLength(1);
  });

  it('undoes adding a variant', () => {
    store.addVariant();
    store.undo();
    expect(store.variants()).toHaveLength(1);
    expect(store.variant()?.variantId).toBe('v1');
  });
});
