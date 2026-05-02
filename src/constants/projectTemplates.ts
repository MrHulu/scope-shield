/**
 * Wave 4 W4.2 — built-in project templates. Each template ships a typed
 * scaffolding of requirements (with dependsOn pointing at sibling indices).
 * Sidebar exposes them when creating a new project so users land on a
 * pre-filled chain instead of an empty list.
 *
 * Indices in dependsOn refer to position in the template's `requirements`
 * array; the createProject flow translates them to real ids on apply.
 */

export interface TemplateRequirement {
  name: string;
  days: number;
  /** Index of the requirement in the same array that this depends on, or null. */
  dependsOnIndex: number | null;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  requirements: TemplateRequirement[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'mobile-app-v1',
    name: '移动 App · 0→1',
    description: '从 0 起步的原生 App：登录 → 主流程 → 支付 → 上架',
    requirements: [
      { name: '设计系统 + 原型', days: 4, dependsOnIndex: null },
      { name: '账号体系（登录/注册/找回）', days: 5, dependsOnIndex: 0 },
      { name: '首页 + 列表 + 详情', days: 6, dependsOnIndex: 1 },
      { name: '搜索 + 个人中心', days: 4, dependsOnIndex: 2 },
      { name: '支付集成（微信/支付宝）', days: 5, dependsOnIndex: 3 },
      { name: '消息推送 + 内推', days: 3, dependsOnIndex: 3 },
      { name: '内测 + 应用商店上架', days: 4, dependsOnIndex: 4 },
    ],
  },
  {
    id: 'saas-dashboard',
    name: 'SaaS Dashboard',
    description: '后台管理界面：登录、租户、看板、报表、计费',
    requirements: [
      { name: '登录 + RBAC 权限', days: 4, dependsOnIndex: null },
      { name: '租户管理 + 邀请', days: 4, dependsOnIndex: 0 },
      { name: '主看板 + 关键指标卡', days: 5, dependsOnIndex: 1 },
      { name: '数据明细表 + 筛选', days: 4, dependsOnIndex: 2 },
      { name: '导出 PDF / Excel', days: 3, dependsOnIndex: 3 },
      { name: '订阅 + 计费 + 续费', days: 5, dependsOnIndex: 1 },
      { name: '管理员审计日志', days: 2, dependsOnIndex: 5 },
    ],
  },
  {
    id: 'internal-tool',
    name: '内部工具',
    description: '后台流程工具：表单录入 + 审批 + 通知',
    requirements: [
      { name: '需求拉通 + 表单设计', days: 2, dependsOnIndex: null },
      { name: '主表单 + 校验', days: 3, dependsOnIndex: 0 },
      { name: '审批工作流（多级）', days: 5, dependsOnIndex: 1 },
      { name: '飞书 / 钉钉通知', days: 2, dependsOnIndex: 2 },
      { name: '查询 + 导出', days: 3, dependsOnIndex: 1 },
    ],
  },
  {
    id: 'data-board',
    name: '数据看板',
    description: '业务数据展示：埋点 → 入仓 → 加工 → 看板',
    requirements: [
      { name: '埋点方案 + SDK', days: 3, dependsOnIndex: null },
      { name: '数据采集服务', days: 4, dependsOnIndex: 0 },
      { name: '入仓 + 清洗 + 主题模型', days: 5, dependsOnIndex: 1 },
      { name: '指标定义 + SQL', days: 3, dependsOnIndex: 2 },
      { name: '看板组件库', days: 3, dependsOnIndex: null },
      { name: '主看板 + 拼装', days: 4, dependsOnIndex: 3 },
      { name: '权限 + 分享', days: 2, dependsOnIndex: 5 },
    ],
  },
  {
    id: 'ecommerce-admin',
    name: 'E-commerce 后台',
    description: '电商管理后台：商品 / 订单 / 营销 / 会员',
    requirements: [
      { name: '类目 + 商品 CRUD', days: 5, dependsOnIndex: null },
      { name: '订单 + 履约状态机', days: 6, dependsOnIndex: 0 },
      { name: '会员体系 + 等级', days: 4, dependsOnIndex: null },
      { name: '营销活动（满减/折扣/优惠券）', days: 5, dependsOnIndex: 2 },
      { name: '财务对账 + 退款', days: 4, dependsOnIndex: 1 },
      { name: '数据统计 + 看板', days: 3, dependsOnIndex: 4 },
    ],
  },
];
