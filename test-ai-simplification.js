// 测试AI简化功能的简单调试代码
// 可以在开发者工具的控制台中运行

async function testAISimplification() {
  console.log('开始测试AI简化功能...');
  
  const testProfessor = {
    name: '张三',
    title: '教授、博导、IEEE会员',
    research_areas: '人工智能、机器学习、深度学习、自然语言处理、计算机视觉等相关领域的研究工作，专注于神经网络算法优化',
    bio: '张三教授，博士学位，现任计算机学院教授、博士生导师。长期从事人工智能相关研究，发表SCI论文50余篇，主持国家自然科学基金项目3项，获得省部级科技进步奖2项，拥有发明专利10余项。',
    education: '清华大学博士、北京大学硕士、上海交通大学学士',
    department: '计算机学院'
  };

  try {
    // 使用app.request调用云函数
    const result = await app.request({
      url: '/chat/simplify',
      method: 'POST',
      data: {
        professor: testProfessor
      }
    });

    console.log('AI简化结果:', result);
    
    if (result && result.simplified) {
      console.log('✅ AI简化成功！');
      console.log('简化后的标题:', result.simplified.title);
      console.log('简化后的研究方向:', result.simplified.research);
      console.log('简化后的个人简介:', result.simplified.bio);
      console.log('简化后的成就:', result.simplified.achievements);
    } else {
      console.log('❌ AI简化失败，检查返回数据结构');
    }
  } catch (error) {
    console.error('❌ 调用失败:', error);
    console.log('将使用备用简化方案');
  }
}

// 在控制台中调用: testAISimplification()
console.log('测试函数已加载，请在控制台中运行: testAISimplification()');
