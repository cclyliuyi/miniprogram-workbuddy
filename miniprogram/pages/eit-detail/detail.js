const { CARDS } = require('../eit/eit-data');
const { createDetail } = require('../../utils/learning-pages');
Page(createDetail({ cards: CARDS, key: 'eit' }));
