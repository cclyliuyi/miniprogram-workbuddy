// Run after all original illustrations have been generated and uploaded.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const content = require('./cards.json');
const uploaded = require('./uploaded.json');
const sources = {
  mimo: { label: 'Tse 与 Viswanath · 无线通信基础，第 7 章：MIMO 空间复用', url: 'https://web.stanford.edu/~dntse/Chapters_PDF/Fundamentals_Wireless_Communication_chapter7.pdf' },
  antenna: { label: 'MIT · Electromagnetics and Applications，天线与口径', url: 'https://ocw.mit.edu/courses/6-013-electromagnetics-and-applications-spring-2009/d3be4ea78b036a6362230fb41780cf54_MIT6_013S09_notes.pdf' },
  dof: { label: 'Poon、Brodersen、Tse · 多天线信道自由度（2005）', url: 'https://doi.org/10.1109/TIT.2004.840892' },
  eit: { label: '电磁信息论：基础、建模、应用与开放问题（2022）', url: 'https://arxiv.org/abs/2212.02882' },
  scatter: { label: '复杂空间中 MIMO 的电磁信息论建模（2023）', url: 'https://arxiv.org/abs/2301.05536' },
  capa: { label: '连续口径视角的电磁信号与信息论（2026 预印本）', url: 'https://arxiv.org/abs/2605.12910' },
  agents: { label: 'Anthropic · Building effective agents（2024）', url: 'https://www.anthropic.com/engineering/building-effective-agents' },
  context: { label: 'Anthropic · Effective context engineering（2025）', url: 'https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents' },
  tools: { label: 'Anthropic · Writing tools for agents（2025）', url: 'https://www.anthropic.com/engineering/writing-tools-for-agents' },
  nist: { label: 'NIST AI 600-1 · 生成式 AI 风险管理（2024）', url: 'https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence' }
};
const config = {
  eit: { title: '从天线到电磁信息论', intro: '从熟悉的天线与传播出发，逐步理解：场怎样被观测，模式怎样形成，信息又受什么限制。', stages: [
    {title:'口径与观测',description:'先理解天线怎样把空间中的场变成信号。'},
    {title:'传播与散射',description:'再看环境怎样改变场的结构与可观测性。'},
    {title:'模式与自由度',description:'把复杂场拆成模式，分清数量、强弱与独立性。'},
    {title:'从场到信息',description:'加入噪声和资源约束，走向容量与联合设计。'}
  ]},
  method: { title: '把专业方法带到 AI 时代', intro: '建模、信号、测量、控制与优化，都是你已有的能力。从熟悉的专业方法出发，逐步建立可验证的 AI 工作习惯。', stages: [
    {title:'重新认识专业能力',description:'把经验转成清晰的任务、条件与证据。'},
    {title:'测量与反馈',description:'用核验和闭环，让协作结果可以检查、可以修正。'},
    {title:'约束与实验',description:'明确边界，比较方案，把失败沉淀为方法。'},
    {title:'在真实工作中迁移',description:'从一个小任务开始，让专业判断与 AI 协作落地。'}
  ]}
};
const sourceKeys = {
  eit: [ ['antenna'],['antenna','dof'],['antenna'],['antenna'],['eit'],['dof','scatter'],['mimo','dof'],['mimo','eit'],['capa'],['eit'],['eit','scatter'],['dof','eit'],['dof'],['capa'],['eit'],['eit'],['scatter','eit'],['capa'] ],
  method: [ ['agents'],['context','tools'],['context'],['nist'],['nist','tools'],['tools'],['agents'],['tools'],['nist'],['agents'],['tools'],['tools'],['agents'],['context'],['nist'],['agents','tools'] ]
};
const methods = [
  '系统建模：把复杂对象写成输入、输出、约束与评价量。专业经验可以先转成清楚的任务定义。',
  '电磁建模：对象、激励、边界条件和观测量不清楚，求解结果就难以解释。',
  '信号处理：围绕任务保留有效成分，辨别噪声、冗余和来源差异。',
  '模型近似：远场、线性、小信号等条件决定一个结论能用在哪里。',
  '测量校准：用参考量和独立手段检查读数，区分精密、准确与看起来合理。',
  '误差分析：沿处理链定位来源，优先解决主导误差，而非盲目提高每一环节的精度。',
  '反馈控制：观察目标与实际结果的差距，再决定下一步调整。',
  '系统诊断：关键节点有记录，才容易从异常现象追到问题环节。',
  '工程约束：设计必须满足可行域，约束需要由实际机制落实。',
  '多目标设计：性能、功耗和成本常常互相制约，最优取决于任务优先级。',
  '对照实验：保持其他条件尽量一致，考察某项改变是否真正改善结果。',
  '可靠性分析：记录失效模式，用检查与复测防止同一错误反复发生。',
  '分级调试：先让一个小系统稳定可用，再增加模块与复杂度。',
  '工程知识管理：记录参数、条件、依据和例外，使经验可以复用和核查。',
  '工程判断：识别异常、核对物理边界，并对最终技术决定负责。',
  '原型验证：先做一个可测量的小实验，再用结果决定是否扩大应用。'
];
const formulas = {
  3: ['Aₑ = λ²G / (4π)', '对互易天线，在同一方向、极化匹配与共轭匹配条件下成立。G 为线性增益，λ 为波长；Aₑ 是有效口径，不是任意几何面积。'],
  5: ['y = Hx + n', '在线性离散模型中，x 是发射激励，y 是接收观测，H 汇集天线与传播响应，n 表示噪声。连续场模型则用传播算子描述。'],
  11: ['H = UΣVᴴ', '奇异值分解把线性信道写成模式耦合。Σ 中的奇异值描述强弱；比较不同模型时要统一功率归一化和噪声度量。'],
  16: ['η = Σᵢ log₂(1 + γᵢ)', '理想独立复高斯子信道、给定功率分配下，γᵢ 为第 i 个模式的信噪比，η 单位为 bit/s/Hz。最大化可行功率分配才得到容量；固定平坦带宽 B 下速率为 Bη。']
};
function write(rel, value) { fs.writeFileSync(path.join(root,rel), value); }
const prepared = {};
for (const key of ['eit','method']) {
  prepared[key] = content[key].map((card,index)=>{
    const asset = uploaded.find(x=>x.key === card.image.replace('.png',''));
    if (!asset || !asset.fileID) throw new Error('Missing uploaded image: '+card.id);
    const {labels,scene,image,...data} = card;
    data.imageSrc = asset.fileID;
    data.sources = sourceKeys[key][index].map(id=>sources[id]);
    data.sections = key === 'eit'
      ? [{label:'从熟悉的概念出发',text:card.knownConcept},{label:'向信息视角迈一步',text:card.frontierConcept}]
      : [{label:'你熟悉的方法',text:methods[index]},{label:'迁移到 AI 协作',text:card.coreProposition}];
    data.exerciseLabel = key === 'eit' ? '想一想' : '在工作中试一次';
    if (key === 'eit' && formulas[card.number]) [data.keyFormula,data.formulaNote] = formulas[card.number];
    return data;
  });
}
// Validate all content before replacing any active page.
for (const key of ['eit','method']) {
  const cards = prepared[key];
  const cfg = config[key];
  write(`pages/${key}/${key}-data.js`, '// 图解新版；编辑源与生成记录见 tools/content-v2。\nconst CARDS = '+JSON.stringify(cards,null,2)+';\nmodule.exports = { CARDS };\n');
  write(`pages/${key}/${key}.js`, `const { CARDS } = require('./${key}-data');\nconst { createList } = require('../../utils/learning-pages');\nPage(createList({ cards: CARDS, key: '${key}', ...${JSON.stringify(cfg,null,2)} }));\n`);
  write(`pages/${key}-detail/detail.js`, `const { CARDS } = require('../${key}/${key}-data');\nconst { createDetail } = require('../../utils/learning-pages');\nPage(createDetail({ cards: CARDS, key: '${key}' }));\n`);
  for (const ext of ['wxml','wxss']) {
    fs.copyFileSync(path.join(__dirname,'list.'+ext),path.join(root,`pages/${key}/${key}.${ext}`));
    fs.copyFileSync(path.join(__dirname,'detail.'+ext),path.join(root,`pages/${key}-detail/detail.${ext}`));
  }
  const pageConfig = {navigationBarTitleText:key==='eit'?'电磁信息论':'方法论迁移',navigationBarBackgroundColor:'#f6f1e7',navigationBarTextStyle:'black',backgroundColor:'#f6f1e7',usingComponents:{}};
  write(`pages/${key}-detail/detail.json`, JSON.stringify(pageConfig,null,2)+'\n');
}
fs.writeFileSync(path.join(__dirname,'sources.json'),JSON.stringify(sources,null,2));
console.log('Integrated '+prepared.eit.length+' EIT and '+prepared.method.length+' methodology cards.');
