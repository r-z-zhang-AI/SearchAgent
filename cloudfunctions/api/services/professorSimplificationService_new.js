// 教授信息AI简化服务 - 重新设计版本
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
      ], 15000); // 15秒超时

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
 * 专门简化研究方向的AI服务
 * @param {string|Array} researchAreas - 研究方向数据
 * @returns {string} 简化后的研究方向（不超过60字）
 */
async function simplifyResearchAreas(researchAreas) {
  try {
    console.log('🔄 开始AI简化研究方向:', researchAreas);

    // 处理输入数据
    let researchText = '';
    if (Array.isArray(researchAreas)) {
      researchText = researchAreas.join('、');
    } else if (typeof researchAreas === 'string') {
      researchText = researchAreas;
    } else {
      console.log('❌ 无效的研究方向数据类型');
      return '学术研究';
    }

    // 如果研究方向已经很短，直接返回
    if (researchText.length <= 60) {
      console.log('✅ 研究方向已经足够简洁，直接返回');
      return researchText;
    }

    // 构建AI简化提示词
    const systemPrompt = `你是专业的学术研究方向提炼专家。请将教授的研究方向简化为关键词。

要求：
1. 提炼最核心的3-5个研究领域关键词
2. 使用专业术语，简洁明了
3. 用顿号（、）分隔关键词
4. 总字数不超过60字
5. 只返回简化后的研究方向文本，不要其他内容

示例：
输入：人工智能技术在医疗影像处理中的应用研究，包括深度学习模型设计、图像分割算法优化等
输出：人工智能、医疗影像、深度学习、图像分割`;

    const userMessage = `研究方向：${researchText}`;

    try {
      console.log('📡 调用AI简化研究方向...');
      const aiResponse = await callDeepSeekAPI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ], 10000);

      if (aiResponse && aiResponse.success && aiResponse.content) {
        const simplified = aiResponse.content.trim();
        console.log('✅ AI简化研究方向成功:', simplified);
        
        if (simplified.length <= 60 && simplified.length > 0) {
          return simplified;
        }
      }
    } catch (aiError) {
      console.log('❌ AI简化研究方向失败:', aiError.message);
    }

    // AI失败时返回备用简化
    return createFallbackResearch(researchText);

  } catch (error) {
    console.error('❌ 简化研究方向失败:', error);
    return createFallbackResearch(researchAreas);
  }
}

/**
 * 简化匹配理由
 * @param {string} reason - 原始匹配理由
 * @returns {string} 简化后的匹配理由（不超过80字）
 */
async function simplifyMatchReason(reason) {
  if (!reason || typeof reason !== 'string') {
    return '研究方向匹配';
  }
  
  if (reason.length <= 80) {
    return reason;
  }

  try {
    console.log('🔄 开始AI简化匹配理由...');
    
    const systemPrompt = `你是专业的文本简化专家。请将匹配理由简化为80字以内的精炼表达。

要求：
1. 保留核心匹配信息
2. 使用简洁专业的表达
3. 不超过80字
4. 只返回简化后的文本，不要其他内容`;

    const userMessage = `匹配理由：${reason}`;

    const aiResponse = await callDeepSeekAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ], 8000);

    if (aiResponse && aiResponse.success && aiResponse.content) {
      const simplified = aiResponse.content.trim();
      if (simplified.length <= 80 && simplified.length > 0) {
        console.log('✅ AI简化匹配理由成功:', simplified);
        return simplified;
      }
    }
  } catch (error) {
    console.log('❌ AI简化匹配理由失败:', error.message);
  }

  // 备用简化
  let simplified = reason
    .replace(/等多个?方面的?深入研究/g, '等领域研究')
    .replace(/在.*?方面有着?丰富的?经验/g, '专业经验')
    .replace(/具有.*?的研究背景/g, '研究背景匹配')
    .replace(/，匹配度:?\s*[\d.]+%?/g, '')
    .replace(/教授在/g, '在')
    .trim();
  
  if (simplified.length > 80) {
    simplified = simplified.slice(0, 77) + '...';
  }
  
  return simplified;
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
 * 创建备用研究方向简化
 * @param {string} researchText - 研究方向文本
 * @returns {string} 简化后的研究方向
 */
function createFallbackResearch(researchText) {
  if (!researchText || typeof researchText !== 'string') {
    return '学术研究';
  }
  
  // 按标点符号分割，提取关键词
  const parts = researchText.split(/[，,；;、\n\r]/);
  const keywords = [];
  
  for (const part of parts) {
    let keyword = part.trim()
      .replace(/等[方面向领域]*/g, '')
      .replace(/相关.*?研究/g, '')
      .replace(/.*?方面的?/g, '')
      .replace(/.*?领域的?/g, '')
      .replace(/研究$/g, '')
      .replace(/技术$/g, '')
      .trim();
    
    if (keyword.length > 0 && keyword.length <= 15) {
      keywords.push(keyword);
    }
    
    if (keywords.length >= 4) break;
  }
  
  let result = keywords.join('、');
  return result || '学术研究';
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

module.exports = {
  simplifyProfessorInfo,
  simplifyResearchAreas,
  simplifyMatchReason
};
