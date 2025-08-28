const { OpenAI } = require('openai');

// DeepSeek API配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-f02583dd00124c8992bb346c1391c518';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

// 初始化DeepSeek客户端
const client = new OpenAI({
  apiKey: DEEPSEEK_API_KEY,
  baseURL: DEEPSEEK_BASE_URL,
});

// 解析用户意图
async function parseIntent(userInput, context = []) {
  try {
    console.log('开始调用DeepSeek API解析意图...');
    console.log('用户输入:', userInput);

    const prompt = `请分析以下用户输入，判断用户意图并提取关键信息：

用户输入：${userInput}

${context.length > 0 ? `对话上下文：
${context.map((msg, i) => `${i % 2 === 0 ? '用户' : '系统'}：${msg}`).join('\n')}
` : ''}

请以JSON格式返回以下信息：
{
  "isProfessorMatching": true/false, // 是否是寻找教授进行科研合作的需求
  "isAchievementQuery": true/false, // 是否是查询科研成果的需求
  "isVague": true/false, // 需求是否模糊，需要进一步澄清。只有当完全无法判断用户的技术领域和合作类型时才设为true
  "techDomains": ["技术领域1", "技术领域2"], // 用户提到的技术领域，尽可能从用户输入中提取，即使只是暗示或间接提及的领域
  "cooperationType": "合作类型", // 用户希望的合作类型，尽可能从用户输入中提取，如果用户提到"找专家"或"咨询"等词语，可以判断为"技术咨询"
  "requirements": ["具体要求1", "具体要求2"], // 用户的具体要求
  "query": "查询内容", // 如果是查询类请求，这里填写查询的具体内容
  "professorName": "教授姓名", // 如果用户提到了特定教授，填写教授姓名
  "urgency": "紧急程度",
  "budget": "预算范围"
}

技术领域包括：人工智能、机器学习、计算机视觉、自然语言处理、数据科学、生物信息学、材料科学、化学工程、机械工程、电子工程、环境科学、医学、经济学、管理学等。

合作类型包括：技术咨询、联合研发、人才培养、成果转化、专利申请等。

请确保返回的是有效的JSON格式。`;

    console.log('正在调用DeepSeek API...');
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的科研需求分析助手，能够准确解析企业用户的科研合作需求。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    console.log('DeepSeek API调用成功');
    const result = response.choices[0].message.content;
    console.log('DeepSeek返回结果:', result);

    // 尝试解析JSON
    try {
      // 处理可能包含Markdown代码块的情况
      let jsonStr = result;

      // 移除可能的Markdown代码块标记
      if (result.includes('```json')) {
        jsonStr = result.replace(/```json\n|\n```/g, '');
      } else if (result.includes('```')) {
        jsonStr = result.replace(/```\n|\n```/g, '');
      }

      // 尝试找到JSON对象的开始和结束位置
      const startIdx = jsonStr.indexOf('{');
      const endIdx = jsonStr.lastIndexOf('}') + 1;

      if (startIdx >= 0 && endIdx > startIdx) {
        jsonStr = jsonStr.substring(startIdx, endIdx);
      }

      const parsed = JSON.parse(jsonStr);
      console.log('意图解析结果:', JSON.stringify(parsed, null, 2));
      return {
        originalQuery: userInput,
        ...parsed
      };
    } catch (parseError) {
      console.error('JSON解析失败:', parseError);
      console.log('原始回复:', result);
      // 如果JSON解析失败，返回默认结构
      return {
        originalQuery: userInput,
        techDomains: [],
        cooperationType: 'general',
        requirements: [],
        urgency: 'normal',
        budget: 'unknown'
      };
    }
  } catch (error) {
    console.error('DeepSeek API调用失败:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
    // 如果API调用失败，返回默认结构
    return {
      originalQuery: userInput,
      isProfessorMatching: userInput.includes('教授') || userInput.includes('导师') || userInput.includes('老师'),
      isAchievementQuery: userInput.includes('成果') || userInput.includes('论文') || userInput.includes('专利'),
      isVague: true,
      techDomains: [],
      cooperationType: 'unknown',
      requirements: [],
      query: '',
      professorName: '',
      urgency: '未指定',
      budget: '未指定'
    };
  }
}

// 简单的内存缓存
const reasonsCache = new Map();

// 生成匹配理由
async function generateMatchReasons(intent, professor) {
  // 生成缓存键
  const cacheKey = `${intent.originalQuery}-${professor.id || professor.name}`;

  // 检查缓存
  if (reasonsCache.has(cacheKey)) {
    return reasonsCache.get(cacheKey);
  }

  try {
    const prompt = `请为以下匹配生成理由：

企业需求：${intent.originalQuery}
技术领域：${(intent.techDomains || []).join(', ') || '未指定'}
合作类型：${intent.cooperationType || '未指定'}

教授信息：
姓名：${professor.name}
院系：${professor.department}
研究方向：${(professor.research_areas || []).join(', ') || '未提供'}
代表性成果：${(professor.achievements || []).slice(0, 3).map(a => a.title).join(', ') || '未提供'}

请生成2-3条匹配理由，用中文回答，每条理由用分号分隔。`;

    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的科研匹配助手，能够为教授匹配生成合理的理由。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 300
    });

    const result = response.choices[0].message.content;
    const reasons = result.split(';').map(reason => reason.trim()).filter(reason => reason);

    // 缓存结果
    reasonsCache.set(cacheKey, reasons);

    // 限制缓存大小，避免内存泄漏
    if (reasonsCache.size > 1000) {
      const firstKey = reasonsCache.keys().next().value;
      reasonsCache.delete(firstKey);
    }

    return reasons;
  } catch (error) {
    console.error('Generate reasons error:', error);
    const fallbackReasons = [`${professor.name}教授的研究方向与您的需求相关`];

    // 也缓存失败的结果，避免重复请求
    reasonsCache.set(cacheKey, fallbackReasons);

    return fallbackReasons;
  }
}

module.exports = {
  parseIntent,
  generateMatchReasons
};