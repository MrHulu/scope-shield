# Scope Shield vNext — 飞书 URL 初始化需求设计方案

## 背景

当前 Scope Shield 的需求初始化依赖手动填写“需求名称 + 初始工期 + 依赖”。本次迭代希望支持粘贴飞书项目中的某个需求 URL，尽量从飞书读取需求信息，并把该飞书链接保存在需求上，形成后续变更证据链的来源。

本项目是个人化本地工具，不引入独立后端或重型“连接器”架构。第一版允许在前端本地保存飞书项目 API 凭证，并直接调用飞书项目 OpenAPI。

## 目标

- 在添加需求时支持输入飞书项目需求 URL。
- 能从 URL 中解析飞书项目工作项定位信息。
- 有 API 凭证时，尝试自动读取需求名称、排期、负责人、预估工期等字段。
- 没有 API 凭证或读取失败时，仍允许保存 URL 来源并手动填写需求。
- 需求列表展示飞书来源入口，方便跳回原需求。

## 非目标

- 不做团队级 OAuth 授权。
- 不做云端同步。
- 不做飞书 webhook 自动同步。
- 不做后台服务或复杂连接器抽象。
- 不保证适配所有企业自定义字段；第一版以常见字段和手动修正为主。

## 关键约束

飞书项目 OpenAPI 请求通常需要：

- `X-PLUGIN-TOKEN`
- `X-USER-KEY`

根据飞书项目 OpenAPI FAQ，调用 Open API 前需要创建插件、申请权限并安装到对应空间；`user_key` 可在飞书项目左下角头像弹窗中双击头像复制；使用 `X-USER-KEY` 请求 API 时，该用户需要具备目标空间里的对应权限。

参考：

- 飞书项目 OpenAPI FAQ: https://www.feishu.cn/content/60bl79n2
- 飞书项目快捷键清单: https://www.feishu.cn/content/5l84vlik

## 产品流程

### Flow A: 无 Token 降级流程

```
点击添加需求
  -> 输入飞书需求 URL
  -> 点击解析
  -> 前端解析 URL
  -> 保存 projectKey / workItemTypeKey / workItemId / 原始 URL
  -> 用户手动填写名称、工期、依赖
  -> 保存需求
```

结果：

- 需求可正常参与排期计算。
- 需求保留飞书来源链接。
- 后续导出报告可引用该来源。

### Flow B: 有 Token 自动读取流程

```
设置页填写 Plugin Token + User Key
  -> 点击添加需求
  -> 输入飞书需求 URL
  -> 点击解析
  -> 前端解析 URL
  -> 前端请求飞书项目 OpenAPI
  -> 自动填充名称、工期、负责人、排期
  -> 用户确认或修正
  -> 保存需求
```

结果：

- 用户仍保留最终确认权。
- API 返回字段不可靠时，可手动修正。

## UI 设计

### 设置页

新增“飞书项目”配置区：

- API 地址，默认 `https://project.feishu.cn`
- Plugin Token
- User Key
- 保存按钮
- 简短提示：凭证仅保存在当前浏览器本地。

API 地址只允许官方飞书项目域名或本机开发地址，避免把 `Plugin Token` / `User Key` 发到非预期域名。

### 添加需求表单

在现有需求名称字段附近增加：

- 飞书需求 URL 输入框
- 解析按钮
- 解析状态提示

解析成功时：

- 自动填充需求名称。
- 自动填充初始工期。
- 若读取到负责人，在提示行展示。
- 若读取到起止日期，在提示行展示。

解析失败时：

- 不阻断手动添加。
- 提示“已保存来源链接，可手动填写需求”或显示具体错误。

### 需求行

有来源 URL 的需求展示一个轻量链接：

```
飞书需求 · 张三、李四
```

点击后新窗口打开飞书项目原页面。

## 数据模型

在 `Requirement` 上增加可选来源字段：

```ts
type RequirementSourceProvider = 'feishu_project';

interface RequirementSource {
  provider: RequirementSourceProvider;
  url: string;
  projectKey?: string | null;
  workItemTypeKey?: string | null;
  workItemId?: string | null;
  rawTitle?: string | null;
  ownerNames?: string[];
  startDate?: string | null;
  endDate?: string | null;
  fetchedAt?: string | null;
}

interface Requirement {
  ...
  source?: RequirementSource | null;
}
```

`CreateRequirementInput` 同步增加：

```ts
interface CreateRequirementInput {
  projectId: string;
  name: string;
  originalDays: number;
  dependsOn?: string | null;
  source?: RequirementSource | null;
}
```

## URL 解析策略

解析器只做 best effort，不绑定单一 URL 形态。

解析器只接受 `https` 的飞书项目相关域名，并按完整域名边界判断，不能把 `evilfeishu.cn` 一类伪造域名识别成飞书。URL path/hash 解码失败时按无效 URL 处理。

优先从 query/hash query 中读取：

- `project_key`
- `work_item_type_key`
- `work_item_id`

如果 URL 形态不同，再从 path/hash path 中尝试识别：

- 空间或项目 key
- 工作项类型 key
- 工作项 ID

解析失败时：

- 如果不是飞书域名，提示“当前仅支持飞书项目 URL”。
- 如果是飞书域名但缺少必要 ID，仍可保存原始 URL，但不尝试 API 读取。

## API 调用策略

第一版前端直连：

```ts
fetch(`${baseUrl}/open_api/${projectKey}/work_item/${workItemTypeKey}/${workItemId}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-PLUGIN-TOKEN': pluginToken,
    'X-USER-KEY': userKey,
  },
  body: JSON.stringify({}),
});
```

注意：具体 endpoint 以实际飞书项目 OpenAPI 文档和当前空间配置为准。实现时需要保留可调整 `baseUrl` 和必要参数的能力。

如果浏览器出现 CORS 错误：

- 第一版先提示用户“飞书接口不允许浏览器直连”。
- 后续再考虑 Vite 本地 proxy，不把它作为当前版本的首要方案。

接口返回非 2xx、网络错误或 CORS 错误时，不中断创建流程；前端降级为 URL-only 草稿，并提示用户可手动填写。

## 字段映射策略

飞书项目字段可能是企业自定义字段，因此第一版采用宽松映射：

名称候选：

- `name`
- `title`
- `summary`
- `requirement_name`

工期候选：

- `estimate`
- `estimated_days`
- `story_points`
- `dev_days`
- `工期`

负责人候选：

- `owner`
- `assignee`
- `developer`

排期候选：

- `start_date`
- `start_time`
- `plan_start`
- `end_date`
- `due_date`
- `deadline`
- `plan_end`

映射不到时：

- 名称保留用户手填。
- 工期默认不自动覆盖，或使用 `1` 天作为草稿默认值。
- 负责人和排期只作为来源信息，不参与当前排期计算。

## 安全与隐私

由于本项目是个人本地工具，第一版允许将 Plugin Token 和 User Key 存在 `localStorage`。风险说明：

- 不适合部署为公开站点。
- 不适合多人共用浏览器。
- 不应把含 token 的浏览器数据导出给别人。
- JSON 备份不应包含 Plugin Token 和 User Key。
- 导入/导出需求来源时只保留来源白名单字段，丢弃任何额外字段；来源 URL 必须重新通过飞书 URL 解析校验。

## 插件注册与安装步骤

### 获取 User Key

1. 打开飞书项目。
2. 点击左下角头像。
3. 在弹出的个人信息窗口中双击小头像。
4. 复制得到 `user_key`。

### 获取 Project Key

1. 打开飞书项目空间。
2. 双击空间名称或空间名称前的图标。
3. 复制得到空间 ID / `project_key`。

### 创建并安装插件

1. 打开飞书项目。
2. 从左下角头像或相关入口进入“开发者后台”。
3. 创建插件。
4. 在插件权限中申请读取工作项详情所需权限。
5. 将插件安装到目标飞书项目空间。
6. 在插件基本信息或凭证页面复制 Plugin Token。
7. 确认用于 `X-USER-KEY` 的用户在目标空间内有读取该需求的权限。

如果无权限创建插件：

- 本功能仍按 Flow A 工作。
- 只能保存飞书 URL 来源，不能自动读取详情。
- 用户手动填写名称和工期。

## 验收标准

- 无 Token 时，粘贴飞书 URL 可以保存为需求来源。
- 无 Token 时，用户可继续手动填写并保存需求。
- 有 Token 时，点击解析可以尝试读取飞书需求详情。
- API 失败不会导致添加需求流程卡死。
- 需求行可以跳转回飞书原需求。
- JSON 导出包含需求来源字段，但不包含 Plugin Token / User Key。

## 后续扩展

- 支持字段映射配置。
- 支持批量粘贴多个飞书 URL 初始化需求。
- 支持从飞书 URL 创建“新增需求”变更。
- 支持导出报告展示飞书来源链接。
