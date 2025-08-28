const express = require('express');
const router = express.Router();
const { getProfessors, getProfessorById } = require('../services/professorService');

// 获取所有教授列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, department, research_area } = req.query;
    const professors = await getProfessors({
      page: parseInt(page),
      limit: parseInt(limit),
      department,
      research_area
    }, req.db);
    res.json(professors);
  } catch (error) {
    console.error('Get professors error:', error);
    res.status(500).json({ error: 'Failed to get professors' });
  }
});

// 获取单个教授详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const professor = await getProfessorById(id, req.db);

    if (!professor) {
      return res.status(404).json({ error: 'Professor not found' });
    }

    res.json(professor);
  } catch (error) {
    console.error('Get professor error:', error);
    res.status(500).json({ error: 'Failed to get professor' });
  }
});

// 搜索教授
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const professors = await getProfessors({
      page: parseInt(page),
      limit: parseInt(limit),
      search: query
    }, req.db);

    res.json(professors);
  } catch (error) {
    console.error('Search professors error:', error);
    res.status(500).json({ error: 'Failed to search professors' });
  }
});

module.exports = router;