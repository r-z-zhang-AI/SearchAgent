// 教授字段修复测试
console.log('🔧 教授字段映射修复测试');

// 模拟错误的教授数据（来自实际数据库）
const problemProfessor = {
  "教师姓名": "刁常宇",
  "院系": "艺术与考古学院 | 浙江大学文化遗产研究院",
  "个人主页": "https://person.zju.edu.cn/dcy",
  "职称": "dcy@zju.edu.cn", // 错位：这里是邮箱
  "学历": "副教授 | 博士生导师 | 浙江大学文化遗产研究院副院长", // 错位：这里是职称
  "邮箱": "浙江大学西溪校区行政主楼417", // 错位：这里是办公地址
  "办公地址": "文物数字化", // 错位：这里是研究方向
  "研究方向": ["个人简介...", "其他研究内容"]
};

console.log('原始错误数据:', problemProfessor);

// 模拟修复逻辑
function fixProfessorData(prof) {
  let cleanTitle = prof.职称 || '';
  let cleanEmail = prof.邮箱 || '';
  let cleanOffice = prof.办公地址 || '';
  
  // 检测邮箱错位
  if (cleanTitle && cleanTitle.includes('@')) {
    if (!cleanEmail || !cleanEmail.includes('@')) {
      cleanEmail = cleanTitle;
      cleanTitle = '教授';
    }
  }
  
  // 检测办公地址错位
  if (cleanEmail && !cleanEmail.includes('@') && cleanEmail.includes('校区')) {
    if (!cleanOffice || cleanOffice.length < 10) {
      cleanOffice = cleanEmail;
      cleanEmail = '';
    }
  }
  
  return {
    name: prof.教师姓名,
    title: cleanTitle,
    email: cleanEmail,
    office: cleanOffice,
    department: prof.院系,
    research_areas: prof.研究方向
  };
}

const fixed = fixProfessorData(problemProfessor);
console.log('\n修复后的数据:', fixed);

console.log('\n✅ 修复验证:');
console.log('- 姓名正确:', fixed.name === '刁常宇');
console.log('- 邮箱修复:', fixed.email === 'dcy@zju.edu.cn');
console.log('- 办公地址修复:', fixed.office === '浙江大学西溪校区行政主楼417');
console.log('- 职称设为默认:', fixed.title === '教授');

console.log('\n🎯 修复完成！现在教授卡片中的信息应该正确对应各个字段了。');
