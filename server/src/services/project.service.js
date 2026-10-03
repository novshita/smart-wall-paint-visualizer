const crypto = require('crypto');
const { Project } = require('../models');
const ApiError = require('../utils/api-error');
const { storage } = require('./storage.service');
const { processUpload } = require('./image.service');
const { getSetting } = require('./settings.service');

function imageResponse(image) {
  if (!image?.storageKey) return undefined;
  const { storageKey, ...rest } = image;
  return { ...rest, url: storage.signedUrl(storageKey) };
}

/** Shapes a project for the API: storage keys are replaced by short-lived signed URLs. */
function toResponse(doc) {
  const p = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const { __v, originalImage, workingImage, thumbnail, ...rest } = p;
  return {
    ...rest,
    originalImage: imageResponse(originalImage),
    workingImage: imageResponse(workingImage),
    thumbnailUrl: thumbnail ? storage.signedUrl(thumbnail.storageKey) : undefined,
  };
}

function storageKeys(project) {
  const keys = [
    project.originalImage?.storageKey,
    project.workingImage?.storageKey,
    project.thumbnail?.storageKey,
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

async function deleteProject(project) {
  await project.deleteOne();
  await Promise.all(storageKeys(project).map((k) => storage.remove(k).catch(() => undefined)));
}

module.exports = { toResponse, createFromUpload, findAccessible, deleteProject, storageKeys };
