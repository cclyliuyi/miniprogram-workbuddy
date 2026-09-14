const { CARDS } = require('../method/method-data');
const { createDetail } = require('../../utils/learning-pages');
Page(createDetail({ cards: CARDS, key: 'method' }));
