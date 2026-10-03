const crypto = require('crypto');
const { Project } = require('../models');
const ApiError = require('../utils/api-error');
const { storage } = require('./storage.service');
const { processUpload, processRender } = require('./image.service');
const { getSetting } = require('./settings.service');

function imageResponse(image) {
  if (!image?.storageKey) return undefined;
  const { storageKey, ...rest } = image;
  return { ...rest, url: storage.signedUrl(storageKey) };
}

/** Shapes a project for the API: storage keys are replaced by short-lived signed URLs. */
function toResponse(doc) {
  const p = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const { __v, originalImage, workingImage, thumbnail, variants, ...rest } = p;
  return {
    ...rest,
    originalImage: imageResponse(originalImage),
    workingImage: imageResponse(workingImage),
    thumbnailUrl: thumbnail ? storage.signedUrl(thumbnail.storageKey) : undefined,
    variants: (variants ?? []).map(({ renderKey, ...v }) => ({
      ...v,
      renderUrl: renderKey ? storage.signedUrl(renderKey) : undefined,
    })),
  };
}

function folderOf(project) {
  return project.originalImage.storageKey.split('/').slice(0, -1).join('/');
}

function storageKeys(project) {
  const keys = [
    project.originalImage?.storageKey,
    project.workingImage?.storageKey,
    project.thumbnail?.storageKey,
    ...(project.variants ?? []).map((v) => v.renderKey),
  ];
  return keys.filter(Boolean);
}

async function createFromUpload(userId, file, title) {
  const allowedMimes = await getSetting('allowedFormats');
  const img = await processUpload(file.buffer, { allowedMimes });

  // Random folder per project; nothing user-supplied ends up in a path (spec §12)
  const folder = `projects/${crypto.randomUUID()}`;
  const keys = {
    original: `${folder}/original.${img.ext}`,
    working: `${folder}/working.${img.ext}`,
    thumbnail: `${folder}/thumb.jpg`,
  };

  try {
    await storage.put(keys.original, img.original.buffer);
    await storage.put(keys.working, img.working.buffer);
    await storage.put(keys.thumbnail, img.thumbnail.buffer);

    return await Project.create({
      userId,
      title: title || 'My room',
      originalImage: {
        storageKey: keys.original,
        width: img.original.width,
        height: img.original.height,
        mimeType: img.mime,
        sizeBytes: img.original.sizeBytes,
      },
      workingImage: {
        storageKey: keys.working,
        width: img.working.width,
        height: img.working.height,
        mimeType: img.mime,
        sizeBytes: img.working.sizeBytes,
      },
      thumbnail: {
        storageKey: keys.thumbnail,
        width: img.thumbnail.width,
        height: img.thumbnail.height,
        mimeType: 'image/jpeg',
        sizeBytes: img.thumbnail.sizeBytes,
      },
      variants: [{ variantId: crypto.randomUUID(), name: 'Design 1', regions: [] }],
      status: 'draft',
    });
  } catch (err) {
    // Don't leave orphaned files behind if anything fails part-way (spec §21)
    await Promise.all(Object.values(keys).map((k) => storage.remove(k).catch(() => undefined)));
    throw err;
  }
}

/**
 * Loads a project the user may access. Others' projects return 404 (not 403) so
 * project ids can't be probed (spec §12 authorisation).
 */
async function findAccessible(id, user, { allowAdmin = true } = {}) {
  const project = await Project.findById(id);
  const isOwner = project && project.userId.equals(user._id);
  const isAdmin = allowAdmin && user.role === 'admin';
  if (!project || !(isOwner || isAdmin)) throw ApiError.notFound('Project not found');
  return project;
}

/**
 * Replaces a project's variants, keeping each surviving variant's stored render and
 * deleting renders of variants that were removed.
 */
async function replaceVariants(project, variants) {
  const renders = new Map(project.variants.map((v) => [v.variantId, v.renderKey]));
  const kept = new Set(variants.map((v) => v.variantId));
  project.variants = variants.map((v) => ({ ...v, renderKey: renders.get(v.variantId) }));
  return [...renders].filter(([id, key]) => key && !kept.has(id)).map(([, key]) => key);
}

/** Stores a client-rendered preview for one variant (shown on the Saved Designs grid). */
async function saveRender(project, variantId, buffer) {
  const variant = project.variants.find((v) => v.variantId === variantId);
  if (!variant) throw ApiError.notFound('Design variant not found');

  const render = await processRender(buffer);
  const key = `${folderOf(project)}/render-${crypto.randomUUID()}.jpg`;
  await storage.put(key, render.buffer);
  const previous = variant.renderKey;
  variant.renderKey = key;
  try {
    await project.save();
  } catch (err) {
    await storage.remove(key).catch(() => undefined);
    throw err;
  }
  if (previous) await storage.remove(previous).catch(() => undefined);
  return project;
}

/** Copies a project and its files into a new draft owned by the same user. */
async function duplicateProject(project) {
  const folder = `projects/${crypto.randomUUID()}`;
  const copied = [];
  const copy = async (key) => {
    if (!key) return undefined;
    const target = `${folder}/${key.split('/').pop()}`;
    await storage.copy(key, target);
    copied.push(target);
    return target;
  };

  try {
    const src = project.toObject();
    const image = async (img) => img && { ...img, storageKey: await copy(img.storageKey) };
    const variants = [];
    for (const v of src.variants) variants.push({ ...v, renderKey: await copy(v.renderKey) });

    return await Project.create({
      userId: src.userId,
      title: `Copy of ${src.title}`.slice(0, 150),
      originalImage: await image(src.originalImage),
      workingImage: await image(src.workingImage),
      thumbnail: await image(src.thumbnail),
      variants,
      status: 'draft',
    });
  } catch (err) {
    await Promise.all(copied.map((k) => storage.remove(k).catch(() => undefined)));
    throw err;
  }
}

async function deleteProject(project) {
  await project.deleteOne();
  await Promise.all(storageKeys(project).map((k) => storage.remove(k).catch(() => undefined)));
}

module.exports = {
  toResponse,
  createFromUpload,
  findAccessible,
  replaceVariants,
  saveRender,
  duplicateProject,
  deleteProject,
  storageKeys,
};
