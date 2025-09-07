const { OpenAI } = require('openai');

// DeepSeek API配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-f02583dd00124c8992bb346c1391c518';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

// 初始化DeepSeek客户端
const client = new OpenAI({
  apiKey: DEEPSEEK_API_KEY,
  baseURL: DEEPSEEK_BASE_URL,
});

// 生成通用回复
async function generateGeneralReply(message, context = []) {
  try {
    const prompt = `你是浙江大学科研合作智能助手，专门帮助企业用户找到合适的教授进行科研合作。

用户问题：${message}

${context.length > 0 ? `对话历史：
${context.map((msg, i) => `${i % 2 === 0 ? '用户' : '助手'}：${msg}`).join('\n')}
` : ''}

请根据用户问题提供有帮助的回答。如果问题与科研合作、教授信息、学术研究相关，请提供专业的建议。如果问题比较宽泛，请引导用户提供更具体的需求。

回答要求：
1. 简洁明了，不超过200字
2. 专业友好的语调
3. 如果可能，提供具体的建议或下一步行动
4. 避免过于技术性的术语`;

    // 设置超时处理
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI响应超时')), 15000); // 15秒超时
    });

    const apiPromise = client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是浙江大学科研合作智能助手，专门帮助企业用户找到合适的教授进行科研合作。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    const response = await Promise.race([apiPromise, timeoutPromise]);

    return response.choices[0].message.content;
  } catch (error) {
    console.error('General response generation error:', error);
    return "感谢您的问题。我是浙江大学科研合作智能助手，可以帮助您找到合适的教授进行科研合作。请告诉我您的具体需求，比如技术领域、合作类型等，我会为您推荐最合适的专家。";
  }
}

module.exports = {
  generateGeneralReply
};