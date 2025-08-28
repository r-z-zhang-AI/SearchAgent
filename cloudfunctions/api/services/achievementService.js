// 查询科研成果
async function queryAchievements(intent, db) {
  try {
    const { query, professorName, techDomains } = intent;
    
    let searchQuery = {};
    
    const _ = db.command;

    // 如果指定了教授姓名
    if (professorName) {
      // 先查找教授
      const professorResult = await db.collection('professors')
        .where({ name: _.like(professorName) })
        .get();

      if (professorResult.data.length > 0) {
        const professorIds = professorResult.data.map(p => p._id);
        searchQuery.professor_id = _.in(professorIds);
      } else {
        return []; // 没找到教授
      }
    }

    // 如果有查询关键词
    if (query) {
      searchQuery = _.or([
        { title: _.like(query) },
        { description: _.like(query) },
        { journal: _.like(query) }
      ]);
    }

    // 如果有技术领域
    if (techDomains && techDomains.length > 0) {
      const domainConditions = [];
      techDomains.forEach(domain => {
        domainConditions.push({ title: _.like(domain) });
        domainConditions.push({ description: _.like(domain) });
      });

      if (query) {
        searchQuery = _.and([
          searchQuery,
          _.or(domainConditions)
        ]);
      } else {
        searchQuery = _.or(domainConditions);
      }
    }
    
    // 查询成果
    const achievementsResult = await db.collection('achievements')
      .where(searchQuery)
      .orderBy('year', 'desc')
      .limit(20)
      .get();
    
    const achievements = achievementsResult.data;
    
    // 为每个成果获取教授信息
    for (const achievement of achievements) {
      const professorResult = await db.collection('professors')
        .doc(achievement.professor_id)
        .get();
      
      if (professorResult.data.length > 0) {
        achievement.professor = professorResult.data[0];
      }
    }
    
    return achievements;
  } catch (error) {
    console.error('Achievement query error:', error);
    return [];
  }
}

module.exports = {
  queryAchievements
};
