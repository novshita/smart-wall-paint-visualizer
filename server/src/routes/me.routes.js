const { Router } = require('express');
const fav = require('../controllers/favorite.controller');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { idParam } = require('../validators/common.validators');

const router = Router();

router.use(authenticate);

router.get('/favorites', fav.list);
router.post('/favorites/colors/:id', validate(idParam, 'params'), fav.add('colors'));
router.delete('/favorites/colors/:id', validate(idParam, 'params'), fav.remove('colors'));
router.post('/favorites/patterns/:id', validate(idParam, 'params'), fav.add('patterns'));
router.delete('/favorites/patterns/:id', validate(idParam, 'params'), fav.remove('patterns'));

module.exports = router;
