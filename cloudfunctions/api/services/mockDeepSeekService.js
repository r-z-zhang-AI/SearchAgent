// DeepSeek API 服务 - 原生集成
const { OpenAI } = require('openai');

// DeepSeek API 配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-f02583dd00124c8992bb346c1391c518';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

// 初始化 DeepSeek 客户端
const deepseekClient = new OpenAI({
  apiKey: DEEPSEEK_API_KEY,
  baseURL: DEEPSEEK_BASE_URL,
});

/**
 * 原生 DeepSeek API 调用
 * @param {Array} messages - 消息数组，包含 role 和 content
 * @param {number} timeout - 超时时间(毫秒)
 * @param {Object} options - 额外配置选项
 * @returns {Object} API 响应
 */
async function callDeepSeekAPI(messages, timeout = 5000, options = {}) {
  try {
    console.log('🤖 调用原生 DeepSeek API...');
    
    const {
      model = 'deepseek-chat',
      temperature = 0.3,
      max_tokens = 800, // 减少token数量以提高速度
      stream = false
    } = options;

    // 设置更短的超时时间
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('DeepSeek API 调用超时')), timeout);
    });

    // 实际API调用，添加网络优化配置
    const apiPromise = deepseekClient.chat.completions.create({
      model: model,
      messages: messages,
      temperature: temperature,
      max_tokens: max_tokens,
      stream: stream,
      timeout: Math.max(timeout - 500, 2000) // 留出500ms缓冲，最少2秒
    });

    const response = await Promise.race([apiPromise, timeoutPromise]);

    if (response.choices && response.choices[0] && response.choices[0].message) {
      console.log('✅ DeepSeek API 调用成功');
      return {
        content: response.choices[0].message.content,
        usage: response.usage,
        model: response.model,
        success: true
      };
    } else {
      throw new Error('DeepSeek API 返回格式异常');
    }

  } catch (error) {
    console.error('❌ DeepSeek API 调用失败:', error.message);
    
    // 超时或网络错误时，使用智能备用方案
    if (error.message.includes('超时') || error.message.includes('timeout') || error.message.includes('network')) {
      console.log('🔄 API超时，使用智能备用方案...');
      return await generateSmartFallback(messages);
    }
    
    throw error;
  }
}

/**
 * 智能备用方案 - 当API不可用时使用
 * @param {Array} messages - 消息数组
 * @returns {Object} 备用响应
 */
async function generateSmartFallback(messages) {
  try {
    const userMessage = messages.find(msg => msg.role === 'user')?.content || '';
    const systemMessage = messages.find(msg => msg.role === 'system')?.content || '';
    
    console.log('🧠 生成智能备用响应...');

    // 根据系统提示词类型进行智能分析
    if (systemMessage.includes('意图分析') || systemMessage.includes('intent')) {
      return generateIntentAnalysisFallback(userMessage);
    }
    
    if (systemMessage.includes('相关性') || systemMessage.includes('relevance')) {
      return generateRelevanceFallback(userMessage);
    }
    
    if (systemMessage.includes('明确性') || systemMessage.includes('clarity')) {
      return generateClarityFallback(userMessage);
    }
    
    if (systemMessage.includes('学术建议') || systemMessage.includes('advice')) {
      return generateAdviceFallback(userMessage);
    }
    
    if (systemMessage.includes('对比') || systemMessage.includes('comparison')) {
      return generateComparisonFallback(userMessage);
    }
    
    // 通用备用响应
    return generateGeneralFallback(userMessage);

  } catch (error) {
    console.error('智能备用方案失败:', error);
    return {
      content: '系统暂时不可用，请稍后重试。',
      success: false,
      fallback: true
    };
  }
}

/**
 * 意图分析备用方案
 * @param {string} userMessage - 用户消息
 * @returns {Object} 备用意图分析
 */
function generateIntentAnalysisFallback(userMessage) {
  const lowerMessage = userMessage.toLowerCase();
  
  // 检测技术领域
  const techDomains = [];
  const techKeywords = {
    '人工智能': ['ai', '人工智能', '机器学习', '深度学习', 'ml', 'dl'],
    '计算机科学': ['计算机', '软件', '算法', '编程', 'computer'],
    '生物医学': ['生物', '医学', '基因', '蛋白质', '临床'],
    '材料科学': ['材料', '化学', '物理', '纳米'],
    '电子工程': ['电子', '电气', '通信', '芯片', '半导体']
  };
  
  Object.entries(techKeywords).forEach(([domain, keywords]) => {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      techDomains.push(domain);
    }
  });

  // 检测合作类型
  let cooperationType = 'general';
  if (lowerMessage.includes('咨询') || lowerMessage.includes('了解')) {
    cooperationType = 'consultation';
  } else if (lowerMessage.includes('合作') || lowerMessage.includes('项目')) {
    cooperationType = 'collaboration';
  } else if (lowerMessage.includes('申请') || lowerMessage.includes('导师')) {
    cooperationType = 'application';
  }

  // 判断是否是教授匹配需求
  const professorKeywords = ['教授', '专家', '老师', '导师', '推荐', '找', '寻找'];
  const isProfessorMatching = professorKeywords.some(keyword => lowerMessage.includes(keyword));

  const result = {
    "messageType": isProfessorMatching ? "professor_matching" : "general_query",
    "intent": {
      "techDomains": techDomains,
      "cooperationType": cooperationType,
      "isProfessorMatching": isProfessorMatching,
      "isVague": techDomains.length === 0 && cooperationType === 'general'
    }
  };

  return {
    content: JSON.stringify(result),
    success: true,
    fallback: true
  };
}

/**
 * 相关性检查备用方案
 * @param {string} userMessage - 用户消息
 * @returns {Object} 备用相关性检查
 */
function generateRelevanceFallback(userMessage) {
  const lowerMessage = userMessage.toLowerCase();
  
  const relevantKeywords = ['教授', '导师', '研究', '科研', '学术', '合作', '咨询', '申请'];
  const irrelevantKeywords = ['天气', '股票', '游戏', '娱乐', '购物', '旅游'];
  
  const hasRelevant = relevantKeywords.some(keyword => lowerMessage.includes(keyword));
  const hasIrrelevant = irrelevantKeywords.some(keyword => lowerMessage.includes(keyword));
  
  const isRelevant = hasRelevant && !hasIrrelevant;
  
  const result = {
    "isRelevant": isRelevant,
    "confidence": isRelevant ? 0.8 : 0.2,
    "reason": isRelevant ? "包含学术相关关键词" : "可能与学术无关"
  };

  return {
    content: JSON.stringify(result),
    success: true,
    fallback: true
  };
}

/**
 * 明确性检查备用方案
 * @param {string} userMessage - 用户消息
 * @returns {Object} 备用明确性检查
 */
function generateClarityFallback(userMessage) {
  const lowerMessage = userMessage.toLowerCase();
  
  // 检测技术领域和合作类型
  const hasTechDomain = ['ai', '人工智能', '计算机', '生物', '材料'].some(tech => lowerMessage.includes(tech));
  const hasCooperationType = ['咨询', '合作', '申请', '项目'].some(type => lowerMessage.includes(type));
  
  const isClear = hasTechDomain && hasCooperationType;
  
  const result = {
    "isClear": isClear,
    "clarity_score": isClear ? 0.8 : 0.3,
    "intent": {
      "type": "professor_matching",
      "techDomains": hasTechDomain ? ["人工智能"] : [],
      "cooperationType": hasCooperationType ? "consultation" : "general"
    },
    "ambiguity": {
      "missing_aspects": isClear ? [] : ["技术领域", "合作类型"],
      "vague_terms": []
    }
  };

  return {
    content: JSON.stringify(result),
    success: true,
    fallback: true
  };
}

/**
 * 学术建议备用方案
 * @param {string} userMessage - 用户消息
 * @returns {Object} 备用学术建议
 */
function generateAdviceFallback(userMessage) {
  const advice = "建议您明确研究方向和目标，主动联系相关领域的教授，了解他们的研究重点和合作需求。同时，提前准备好相关的学术背景材料和具体的合作方案。";
  
  return {
    content: advice,
    success: true,
    fallback: true
  };
}

/**
 * 对比分析备用方案
 * @param {string} userMessage - 用户消息
 * @returns {Object} 备用对比分析
 */
function generateComparisonFallback(userMessage) {
  const comparison = "根据提供的信息，各位教授在研究方向和专业背景上各有特色。建议您根据自己的具体研究兴趣和未来发展规划，选择最适合的合作导师。";
  
  return {
    content: comparison,
    success: true,
    fallback: true
  };
}

/**
 * 通用备用方案
 * @param {string} userMessage - 用户消息
 * @returns {Object} 通用备用响应
 */
function generateGeneralFallback(userMessage) {
  const response = "我是浙江大学科研合作助手。请告诉我您需要哪个技术领域的专家，或者您希望进行什么类型的科研合作，我会为您推荐合适的教授。";
  
  return {
    content: response,
    success: true,
    fallback: true
  };
}

/**
 * 流式响应支持
 * @param {Array} messages - 消息数组
 * @param {Function} onChunk - 流式数据回调
 * @param {Object} options - 配置选项
 * @returns {Promise} 流式响应Promise
 */
async function callDeepSeekAPIStream(messages, onChunk, options = {}) {
  try {
    console.log('🌊 开始 DeepSeek 流式调用...');
    
    const response = await deepseekClient.chat.completions.create({
      model: options.model || 'deepseek-chat',
      messages: messages,
      temperature: options.temperature || 0.3,
      max_tokens: options.max_tokens || 1000,
      stream: true
    });

    let fullContent = '';
    for await (const chunk of response) {
      if (chunk.choices[0]?.delta?.content) {
        const content = chunk.choices[0].delta.content;
        fullContent += content;
        onChunk(content);
      }
    }

    return {
      content: fullContent,
      success: true,
      stream: true
    };

  } catch (error) {
    console.error('❌ DeepSeek 流式调用失败:', error);
    throw error;
  }
}

module.exports = {
  callDeepSeekAPI,
  callDeepSeekAPIStream,
  generateSmartFallback,
  
  // 备用方案函数
  generateIntentAnalysisFallback,
  generateRelevanceFallback,
  generateClarityFallback,
  generateAdviceFallback,
  generateComparisonFallback,
  generateGeneralFallback
};
