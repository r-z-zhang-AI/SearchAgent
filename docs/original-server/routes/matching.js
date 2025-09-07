const express = require('express');
const router = express.Router();
const { matchProfessors } = require('../services/matchingService');

// 直接匹配接口
router.post('/match', async (req, res) => {
  try {
    const { query, filters = {} } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // 解析查询意图
    const intent = {
      originalQuery: query,
      techDomains: filters.techDomains || [],
      cooperationType: filters.cooperationType || 'general',
      requirements: filters.requirements || []
    };

    // 执行匹配
    const matches = await matchProfessors(intent);
    
    res.json({
      query: query,
      intent: intent,
      matches: matches,
      total: matches.length
    });
  } catch (error) {
    console.error('Matching error:', error);
    res.status(500).json({ error: 'Failed to perform matching' });
  }
});

// 获取匹配统计
router.get('/stats', async (req, res) => {
  try {
    // 这里可以返回匹配统计信息
    res.json({
      totalMatches: 0,
      popularQueries: [],
      topDepartments: []
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;