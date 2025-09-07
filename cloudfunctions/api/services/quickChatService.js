// 快速聊天服务 - 避免超时，提供基本功能

/**
 * 快速处理用户消息，避免复杂AI调用
 * @param {string} message 用户消息
 * @param {Array} context 对话上下文
 * @returns {Object} 处理结果
 */
async function quickProcessMessage(message, context = []) {
  try {
    console.log('快速处理消息:', message);

    // 基础意图识别
    const intent = analyzeBasicIntent(message);
    console.log('基础意图:', intent);

    let response = {
      messageType: intent.type,
      intent: intent,
      followupQuestions: []
    };

    switch (intent.type) {
      case 'professor_matching':
        // 简化的教授匹配
        response.message = `正在为您查找${intent.domain || '相关领域'}的专家教授...`;
        response.professors = getSampleProfessors(intent.domain);
        response.followupQuestions = [
          "您希望了解哪位教授的详细信息？",
          "您更关注哪个研究方向？",
          "需要查看教授的联系方式吗？"
        ];
        break;

      case 'professor_inquiry':
        response.message = "请问您想了解哪位教授的具体信息？比如研究方向、项目经历或学术成果？";
        response.followupQuestions = [
          "研究方向和专业领域",
          "代表性项目和成果",
          "联系方式和合作机会"
        ];
        break;

      case 'general_query':
      default:
        response.message = "我是浙江大学科研合作助手，可以帮您：\n\n1. 寻找合适的教授和专家\n2. 了解教授的研究方向\n3. 获取科研合作建议\n\n请告诉我您的具体需求！";
        response.followupQuestions = [
          "我需要找人工智能方面的专家",
          "查看某位教授的详细信息",
          "了解如何开展科研合作"
        ];
        break;
    }

    return response;

  } catch (error) {
    console.error('快速处理失败:', error);
    return {
      messageType: 'general_query',
      intent: { type: 'general_query' },
      message: "抱歉，系统暂时繁忙，请稍后再试。您可以告诉我您的具体需求，我会为您提供帮助。",
      followupQuestions: [
        "我需要找专业教授",
        "查看教授信息",
        "科研合作咨询"
      ]
    };
  }
}

/**
 * 基础意图分析
 * @param {string} message 用户消息
 * @returns {Object} 意图信息
 */
function analyzeBasicIntent(message) {
  const msg = message.toLowerCase();

  // 教授匹配关键词
  const matchingKeywords = ['找', '推荐', '寻找', '需要', '专家', '教授', '导师'];
  const isMatching = matchingKeywords.some(keyword => msg.includes(keyword));

  // 技术领域关键词
  const domains = {
    '人工智能': ['ai', '人工智能', '机器学习', 'ml', '深度学习', 'dl', '神经网络'],
    '计算机': ['计算机', '软件', '程序', '编程', '算法'],
    '生物医学': ['生物', '医学', '药物', '基因', '蛋白质'],
    '材料科学': ['材料', '化学', '物理', '纳米'],
    '工程': ['工程', '机械', '电子', '自动化']
  };

  let detectedDomain = null;
  for (const [domain, keywords] of Object.entries(domains)) {
    if (keywords.some(keyword => msg.includes(keyword))) {
      detectedDomain = domain;
      break;
    }
  }

  if (isMatching) {
    return {
      type: 'professor_matching',
      domain: detectedDomain,
      techDomains: detectedDomain ? [detectedDomain] : [],
      originalQuery: message
    };
  }

  // 深入询问关键词
  const inquiryKeywords = ['详细', '具体', '研究方向', '项目', '成果'];
  const isInquiry = inquiryKeywords.some(keyword => msg.includes(keyword));

  if (isInquiry) {
    return {
      type: 'professor_inquiry',
      aspects: inquiryKeywords.filter(keyword => msg.includes(keyword)),
      originalQuery: message
    };
  }

  return {
    type: 'general_query',
    originalQuery: message
  };
}

/**
 * 获取示例教授数据
 * @param {string} domain 领域
 * @returns {Array} 教授列表
 */
function getSampleProfessors(domain) {
  const sampleData = {
    '人工智能': [
      {
        name: "张三",
        department: "计算机科学与技术学院",
        research: "深度学习、计算机视觉、自然语言处理",
        title: "教授、博士生导师"
      },
      {
        name: "李四", 
        department: "人工智能研究所",
        research: "机器学习、强化学习、智能系统",
        title: "副教授、硕士生导师"
      }
    ],
    '生物医学': [
      {
        name: "王五",
        department: "生物医学工程学院",
        research: "生物信息学、药物设计、基因工程",
        title: "教授、博士生导师"
      }
    ]
  };

  return sampleData[domain] || [
    {
      name: "专业教授",
      department: "相关学院",
      research: "专业研究领域",
      title: "教授"
    }
  ];
}

module.exports = {
  quickProcessMessage
};
