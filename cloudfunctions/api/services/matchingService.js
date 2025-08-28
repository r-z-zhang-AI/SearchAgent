const { getProfessors } = require('./professorService');
const { generateMatchReasons } = require('./intentParser');

// 匹配教授
async function matchProfessors(intent, db) {
  try {
    // 获取所有教授数据
    console.log('开始获取教授数据...');
    const allProfessors = await getProfessors({ page: 1, limit: 1000 }, db);
    console.log('获取到教授数量:', allProfessors.data.length);

    if (allProfessors.data.length > 0) {
      console.log('第一个教授数据:', JSON.stringify(allProfessors.data[0], null, 2));
    }

    const matches = [];

    for (const professor of allProfessors.data) {
      // 计算匹配分数
      const score = calculateMatchScore(intent, professor);

      if (score > 0.3) { // 只返回匹配度大于30%的结果
        matches.push({
          professor: professor,
          score: score,
          reasons: [] // 先不生成理由，提高响应速度
        });
      }
    }

    // 按分数排序
    const sortedMatches = matches.sort((a, b) => b.score - a.score);

    // 只为前5个匹配结果生成理由，提高响应速度
    const topMatches = sortedMatches.slice(0, 5);
    for (const match of topMatches) {
      try {
        match.reasons = await generateMatchReasons(intent, match.professor);
      } catch (error) {
        console.error('生成匹配理由失败:', error);
        match.reasons = [`${match.professor.name}教授的研究方向与您的需求相关`];
      }
    }

    // 返回所有匹配结果，但只有前5个有详细理由
    return [...topMatches, ...sortedMatches.slice(5)];
  } catch (error) {
    console.error('Matching error:', error);
    return [];
  }
}

// 计算匹配分数
function calculateMatchScore(intent, professor) {
  let score = 0;

  // 研究方向匹配 (40%)
  const researchMatch = calculateResearchMatch(intent, professor);
  score += researchMatch * 0.4;

  // 成果相关性 (40%)
  const achievementMatch = calculateAchievementMatch(intent, professor);
  score += achievementMatch * 0.4;

  // 项目经历匹配 (20%)
  const projectMatch = calculateProjectMatch(intent, professor);
  score += projectMatch * 0.2;

  return Math.min(score, 1.0); // 确保分数不超过1
}

// 计算研究方向匹配度
function calculateResearchMatch(intent, professor) {
  if (!intent.techDomains || intent.techDomains.length === 0) {
    return 0.5; // 如果没有指定技术领域，给中等分数
  }

  const professorAreas = professor.research_areas || [];
  let matchCount = 0;

  for (const techDomain of intent.techDomains) {
    for (const researchArea of professorAreas) {
      if (researchArea.toLowerCase().includes(techDomain.toLowerCase()) ||
          techDomain.toLowerCase().includes(researchArea.toLowerCase())) {
        matchCount++;
        break;
      }
    }
  }

  return matchCount / intent.techDomains.length;
}

// 计算成果相关性
function calculateAchievementMatch(intent, professor) {
  const achievements = professor.achievements || [];
  if (achievements.length === 0) {
    return 0.3; // 没有成果信息时给较低分数
  }

  let relevantCount = 0;
  const totalCount = achievements.length;

  for (const achievement of achievements) {
    const title = achievement.title.toLowerCase();
    const description = (achievement.description || '').toLowerCase();

    // 检查是否与用户需求相关
    for (const techDomain of intent.techDomains || []) {
      if (title.includes(techDomain.toLowerCase()) ||
          description.includes(techDomain.toLowerCase())) {
        relevantCount++;
        break;
      }
    }
  }

  return relevantCount / totalCount;
}

// 计算项目经历匹配度
function calculateProjectMatch(intent, professor) {
  const projects = professor.projects || [];
  if (projects.length === 0) {
    return 0.3; // 没有项目信息时给较低分数
  }

  let relevantCount = 0;
  const totalCount = projects.length;

  for (const project of projects) {
    const name = project.name.toLowerCase();
    const description = (project.description || '').toLowerCase();

    // 检查是否与用户需求相关
    for (const techDomain of intent.techDomains || []) {
      if (name.includes(techDomain.toLowerCase()) ||
          description.includes(techDomain.toLowerCase())) {
        relevantCount++;
        break;
      }
    }
  }

  return relevantCount / totalCount;
}

module.exports = {
  matchProfessors,
  calculateMatchScore
};