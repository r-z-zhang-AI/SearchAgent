const tcb = require('@cloudbase/node-sdk');
const xlsx = require('xlsx');

// 初始化云开发环境
const app = tcb.init({
  env: 'cloud1-6g8dk2rk74e3d4e9'
});
const db = app.database();

// Excel 文件在云存储中的路径
const FILE_PATH_IN_STORAGE = 'data/professors.xlsx';

/**
 * 将 Excel 中的数据导入到云数据库
 * @param {object} event 云函数调用时传入的参数
 * @param {object} context 云函数上下文
 */
exports.main = async (event, context) => {
  try {
    console.log('开始添加测试教授数据...');

    const collection = db.collection('professors');

    // 先清空现有数据
    try {
      const existingData = await collection.get();
      console.log('现有数据条数:', existingData.data.length);

      // 删除现有数据
      for (const item of existingData.data) {
        await collection.doc(item._id).remove();
      }
      console.log('已清空现有数据');
    } catch (error) {
      console.log('清空数据时出错:', error.message);
    }

    // 创建测试数据
    const testProfessors = [
      {
        '教师姓名': '张三',
        '院系': '计算机科学与技术学院',
        '职称': '教授',
        '邮箱': 'zhangsan@zju.edu.cn',
        '研究方向': '人工智能,机器学习,深度学习',
        '个人简介': '张三教授是人工智能领域的专家，主要研究方向包括机器学习、深度学习等。在顶级会议和期刊发表论文100余篇。',
        '学历': '博士',
        '毕业院校': '清华大学'
      },
      {
        '教师姓名': '李四',
        '院系': '计算机科学与技术学院',
        '职称': '副教授',
        '邮箱': 'lisi@zju.edu.cn',
        '研究方向': '计算机视觉,图像处理,模式识别',
        '个人简介': '李四副教授专注于计算机视觉和图像处理研究，在图像识别和模式识别方面有深入研究。',
        '学历': '博士',
        '毕业院校': '北京大学'
      },
      {
        '教师姓名': '王五',
        '院系': '软件学院',
        '职称': '教授',
        '邮箱': 'wangwu@zju.edu.cn',
        '研究方向': '软件工程,系统架构,云计算',
        '个人简介': '王五教授在软件工程和系统架构方面有丰富经验，主导多个大型软件项目的设计和开发。',
        '学历': '博士',
        '毕业院校': '浙江大学'
      },
      {
        '教师姓名': '赵六',
        '院系': '网络空间安全学院',
        '职称': '副教授',
        '邮箱': 'zhaoliu@zju.edu.cn',
        '研究方向': '网络安全,密码学,区块链',
        '个人简介': '赵六副教授专注于网络安全和密码学研究，在区块链技术方面有重要贡献。',
        '学历': '博士',
        '毕业院校': '中科院'
      },
      {
        '教师姓名': '孙七',
        '院系': '计算机科学与技术学院',
        '职称': '教授',
        '邮箱': 'sunqi@zju.edu.cn',
        '研究方向': '自然语言处理,知识图谱,智能问答',
        '个人简介': '孙七教授在自然语言处理领域有深入研究，主要关注知识图谱构建和智能问答系统。',
        '学历': '博士',
        '毕业院校': '复旦大学'
      }
    ];

    let successCount = 0;
    let failCount = 0;

    // 插入测试数据
    for (const professorData of testProfessors) {
      try {
        const result = await collection.add(professorData);
        successCount++;
        console.log(`成功导入: ${professorData['教师姓名']}, ID: ${result._id}`);
      } catch (e) {
        console.error(`导入失败: ${professorData['教师姓名']}`, e);
        failCount++;
      }
    }

    const resultMessage = `测试数据导入完成！成功: ${successCount} 条, 失败: ${failCount} 条。`;
    console.log(resultMessage);

    return {
      success: true,
      message: resultMessage,
      data: {
        total: testProfessors.length,
        successCount,
        failCount,
      }
    };

  } catch (error) {
    console.error('导入过程中发生错误:', error);
    return {
      success: false,
      message: '导入失败: ' + error.message,
      error: error.toString()
    };
  }
};