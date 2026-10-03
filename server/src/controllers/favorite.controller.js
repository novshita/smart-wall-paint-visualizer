const { User, Color, Pattern } = require('../models');
const ApiError = require('../utils/api-error');

const KINDS = {
  colors: { field: 'favoriteColors', model: Color, label: 'Colour' },
  patterns: { field: 'favoritePatterns', model: Pattern, label: 'Pattern' },
};

/** Favourites, with inactive (admin-removed) items filtered out. */
async function list(req, res) {
  const user = await User.findById(req.user._id)
    .populate({ path: 'favoriteColors', match: { isActive: true }, select: '-__v' })
    .populate({ path: 'favoritePatterns', match: { isActive: true }, select: '-__v' });

  res.json({
    colors: user.favoriteColors.filter(Boolean),
    patterns: user.favoritePatterns.filter(Boolean),
  });
}

function add(kind) {
  const { field, model, label } = KINDS[kind];
  return async (req, res) => {
    const exists = await model.exists({ _id: req.params.id, isActive: true });
    if (!exists) throw ApiError.notFound(`${label} not found`);

    // $addToSet keeps this idempotent: favouriting twice is not an error
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { [field]: req.params.id } },
      { returnDocument: 'after' },
    );
    res.json({ ids: user[field] });
  };
}

function remove(kind) {
  const { field } = KINDS[kind];
  return async (req, res) => {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { [field]: req.params.id } },
      { returnDocument: 'after' },
    );
    res.json({ ids: user[field] });
  };
}

module.exports = { list, add, remove };
