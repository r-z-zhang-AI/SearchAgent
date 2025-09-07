// 教授信息简化服务
const { callDeepSeekAPI } = require('./mockDeepSeekService');

/**
 * 使用AI简化教授信息
 * @param {Object} professor - 教授信息
 * @param {string} prompt - 简化提示词（可选）
 * @returns {Object} 简化后的教授信息
 */
async function simplifyProfessorInfo(professor, prompt) {
  try {
    console.log('🔄 开始AI简化教授信息:', professor.name);

    // 构建AI简化提示词
    const systemPrompt = `你是专业的学术信息提炼专家。请将教授信息简化为适合移动端卡片显示的格式。

要求：
1. 职位：保留最重要头衔（教授/副教授/博导等）
2. 研究方向：3-5个核心关键词，用顿号（、）分隔，不超过60字
3. 个人简介：30-50字精炼描述，突出专业特色
4. 学历：最高学历和重要院校
5. 成就：2-3个重要学术成就，每个不超过15字

必须严格按JSON格式返回，不要其他内容：
{
  "title": "简化职位",
  "research": "核心研究方向", 
  "bio": "精炼简介",
  "education": "主要学历",
  "achievements": ["成就1", "成就2", "成就3"]
}`;

    const userMessage = `教授信息：
姓名：${professor.name || '未知'}
职位：${professor.title || ''}
研究方向：${professor.research_areas || ''}  
个人简介：${professor.bio || ''}
学历：${professor.education || ''}`;

    try {
      console.log('📡 调用DeepSeek API进行简化...');
      // 尝试AI简化
      const aiResponse = await callDeepSeekAPI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ], 10000); // 10秒超时

      if (aiResponse && aiResponse.success && aiResponse.content) {
        const cleanContent = aiResponse.content.trim();
        console.log('🤖 AI响应内容:', cleanContent);
        
        // 尝试解析JSON
        const simplified = JSON.parse(cleanContent);
        
        // 验证必要字段
        if (simplified.title && simplified.research && simplified.bio) {
          console.log('✅ AI简化成功:', simplified);
          return simplified;
        } else {
          console.log('❌ AI结果格式不完整，使用备用方案');
        }
      } else {
        console.log('❌ AI调用失败，使用备用方案');
      }
    } catch (aiError) {
      console.log('❌ AI简化失败，使用备用方案:', aiError.message);
    }

    // AI失败时返回备用简化结果
    console.log('🔄 使用备用简化方案...');
    return createFallbackSimplification(professor);

  } catch (error) {
    console.error('❌ 简化教授信息失败:', error);
    return createFallbackSimplification(professor);
  }
}

/**
 * 创建备用简化方案
 * @param {Object} professor - 教授信息
 * @returns {Object} 简化后的教授信息
 */
function createFallbackSimplification(professor) {
  console.log('📝 创建备用简化信息...');
  
  // 简化职位
  let title = professor.title || '教师';
  if (title.includes('教授')) {
    title = title.includes('副') ? '副教授' : '教授';
  } else if (title.includes('博导') || title.includes('博士生导师')) {
    title = '博导';
  }

  // 简化研究方向
  let research = professor.research_areas || '学术研究';
  if (Array.isArray(research)) {
    research = research.join('、');
  }
  // 提取关键词，去除冗余表达
  research = research
    .replace(/等[方面向领域]*/g, '')
    .replace(/相关.*?研究/g, '')
    .replace(/.*?方面的?/g, '')
    .replace(/.*?领域的?/g, '')
    .replace(/研究$/g, '')
    .replace(/技术$/g, '');
  
  // 限制长度
  if (research.length > 60) {
    const parts = research.split(/[，,；;、]/);
    research = parts.slice(0, 3).join('、');
  }

  // 简化个人简介
  let bio = professor.bio || '';
  if (bio.length > 50) {
    // 提取关键信息
    const sentences = bio.split(/[。！？.!?]/);
    bio = sentences[0] || bio.slice(0, 50);
  }
  if (!bio) {
    bio = '专业学者，在相关领域有深入研究';
  }

  // 简化学历
  let education = professor.education || '博士学位';
  if (education.length > 30) {
    // 提取最高学历和学校
    const match = education.match(/(博士|硕士|学士).*?(大学|学院)/);
    education = match ? match[0] : education.slice(0, 30);
  }

  // 提取成就
  const achievements = extractBasicAchievements(professor.bio || '');

  return {
    title: title,
    research: research || '学术研究',
    bio: bio,
    education: education,
    achievements: achievements
  };
}

/**
 * 提取基本成就信息
 * @param {string} text - 文本内容
 * @returns {Array} 成就列表
 */
function extractBasicAchievements(text) {
  const achievements = [];
  
  if (!text) {
    return ['专业领域研究学者'];
  }

  // 检测各种成就
  if (text.includes('教授') || text.includes('博导')) {
    achievements.push('资深教授');
  }
  if (text.includes('博士') && !text.includes('博士生')) {
    achievements.push('博士学位');
  }
  if (text.includes('期刊') || text.includes('论文') || text.includes('发表')) {
    achievements.push('发表学术论文');
  }
  if (text.includes('项目') || text.includes('基金')) {
    achievements.push('主持科研项目');
  }
  if (text.includes('奖') && !text.includes('奖学金')) {
    achievements.push('获得学术奖项');
  }
  if (text.includes('专利')) {
    achievements.push('拥有发明专利');
  }
  
  // 如果没有提取到成就，根据研究方向添加默认成就
  if (achievements.length === 0) {
    if (text.includes('人工智能') || text.includes('机器学习')) {
      achievements.push('人工智能领域专家');
    } else if (text.includes('计算机') || text.includes('软件')) {
      achievements.push('计算机科学专家');
    } else {
      achievements.push('专业领域研究学者');
    }
  }

  // 最多返回3个成就，确保简洁
  return achievements.slice(0, 3);
}

/**
 * 备用简化方案（不依赖AI）
 * @param {Object} professor - 教授信息
 * @returns {Object} 简化后的教授信息
 */
function fallbackSimplify(professor) {
  console.log('使用备用简化方案:', professor.name);
  
  // 简化职位
  let title = professor.title || '教授';
  // 提取关键职位信息
  if (title.includes('博士生导师')) title = '博导教授';
  else if (title.includes('教授')) title = '教授';
  else if (title.includes('副教授')) title = '副教授';
  else if (title.includes('讲师')) title = '讲师';
  else if (title.includes('研究员')) title = '研究员';
  else if (title.length > 15) title = title.slice(0, 15) + '...';

  // 简化研究方向
  let research = professor.research_areas || '计算机科学相关研究';
  if (research.length > 80) {
    // 尝试按标点符号分割，保留前几个关键方向
    const parts = research.split(/[，,；;、]/);
    if (parts.length > 3) {
      research = parts.slice(0, 3).join('、') + '等';
    } else {
      research = research.slice(0, 80) + '...';
    }
  }

  // 简化个人简介
  let bio = professor.bio || '专业学者，在相关领域有深入研究和专业经验。';
  if (bio.length > 100) {
    // 尝试提取最重要的信息
    const sentences = bio.split(/[。！？.!?]/);
    let shortBio = '';
    for (const sentence of sentences) {
      if (shortBio.length + sentence.length < 100) {
        shortBio += sentence + '。';
      } else {
        break;
      }
    }
    bio = shortBio || bio.slice(0, 100) + '...';
  }

  // 简化学历
  let education = professor.education || '博士学位';
  if (education.length > 50) {
    // 尝试保留最高学历信息
    const parts = education.split(/[，,；;]/);
    // 优先保留包含博士、硕士等关键词的部分
    const importantParts = parts.filter(part => 
      part.includes('博士') || part.includes('硕士') || part.includes('学士') ||
      part.includes('PhD') || part.includes('Master') || part.includes('大学')
    );
    education = importantParts.length > 0 ? importantParts[0] : parts[0] || education.slice(0, 50) + '...';
  }

  // 提取主要成就
  const achievements = extractAchievements(professor.bio || '', professor.research_areas || '');

  const result = {
    title,
    research,
    bio,
    education,
    achievements
  };
  
  console.log('备用简化结果:', result);
  return result;
}

/**
 * 从个人简介中提取主要成就
 * @param {string} bio - 个人简介
 * @param {string} research - 研究方向（可选）
 * @returns {Array} 成就列表
 */
function extractAchievements(bio, research = '') {
  const achievements = [];
  const text = (bio + ' ' + research).toLowerCase();

  // 学术论文相关（更精确的匹配）
  if (text.match(/(\d+)\s*篇.*论文/) || text.includes('sci') || text.includes('发表') || text.includes('期刊')) {
    const match = text.match(/(\d+)\s*篇/);
    if (match && parseInt(match[1]) > 10) {
      achievements.push(`发表${match[1]}篇学术论文`);
    } else {
      achievements.push('发表高质量学术论文');
    }
  }

  // 科研项目相关
  if (text.includes('主持') || text.includes('负责') || text.includes('承担')) {
    if (text.includes('国家') || text.includes('973') || text.includes('863') || text.includes('自然科学基金')) {
      achievements.push('主持国家级科研项目');
    } else if (text.includes('省') || text.includes('市')) {
      achievements.push('主持省部级科研项目');
    } else {
      achievements.push('主持重要科研项目');
    }
  }

  // 获奖相关
  if (text.includes('奖') && !text.includes('奖学金')) {
    if (text.includes('国家') || text.includes('中国')) {
      achievements.push('获得国家级奖项');
    } else {
      achievements.push('获得学术奖项');
    }
  }

  // 专利相关
  const patentMatch = text.match(/(\d+)\s*项.*专利/);
  if (patentMatch || text.includes('专利') || text.includes('发明')) {
    if (patentMatch && parseInt(patentMatch[1]) > 5) {
      achievements.push(`获得${patentMatch[1]}项专利`);
    } else {
      achievements.push('拥有发明专利');
    }
  }

  // 国际合作与影响力
  if (text.includes('国际') && (text.includes('合作') || text.includes('会议') || text.includes('期刊'))) {
    achievements.push('活跃于国际学术界');
  }

  // 学术职务
  if (text.includes('主编') || text.includes('编委') || text.includes('审稿')) {
    achievements.push('担任学术期刊编委');
  }

  // 学位指导
  if (text.includes('博士生导师') || text.includes('博导')) {
    achievements.push('博士生导师');
  }

  // 如果没有提取到成就，根据研究方向添加默认成就
  if (achievements.length === 0) {
    if (text.includes('人工智能') || text.includes('机器学习')) {
      achievements.push('人工智能领域专家');
    } else if (text.includes('计算机') || text.includes('软件')) {
      achievements.push('计算机科学专家');
    } else {
      achievements.push('专业领域研究学者');
    }
  }

  // 最多返回4个成就，确保简洁
  return achievements.slice(0, 4);
}

/**
 * 简化匹配理由
 * @param {string} reason - 原始匹配理由
 * @returns {string} 简化后的匹配理由（不超过80字）
 */
function simplifyMatchReason(reason) {
  if (!reason || typeof reason !== 'string') {
    return '研究方向匹配';
  }
  
  // 如果已经足够短，直接返回
  if (reason.length <= 80) {
    return reason;
  }
  
  // 移除冗余词汇
  let simplified = reason
    .replace(/等多个?方面的?深入研究/g, '等领域研究')
    .replace(/在.*?方面有着?丰富的?经验/g, '专业经验')
    .replace(/具有.*?的研究背景/g, '研究背景匹配')
    .replace(/，匹配度:?\s*[\d.]+%?/g, '') // 移除匹配度数字
    .replace(/教授在/g, '在')
    .replace(/等领域有深入研究/g, '等领域研究')
    .replace(/相关的?研究/g, '研究')
    .replace(/方面的?工作/g, '工作')
    .trim();
  
  // 如果仍然太长，进行截断
  if (simplified.length > 80) {
    simplified = simplified.slice(0, 77) + '...';
  }
  
  return simplified;
}

module.exports = {
  simplifyProfessorInfo,
  simplifyResearchAreas,
  simplifyMatchReason,
  fallbackSimplify,
  extractAchievements
};
