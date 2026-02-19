[根目录](../CLAUDE.md) > **RuoYi-App**

---

# 移动端 (RuoYi-App)

> 最后更新：2026-02-16

## 变更记录 (Changelog)

### 2026-02-16
- 初始化移动端文档
- 完成Story 4.4开发：照片拍摄与巡查项目填写功能
  - 新建PhotoGallery.vue组件（3列网格布局）
  - 重构PhotoCapture.vue组件（集成PhotoGallery）
  - 完成StatusItemDialog.vue（状态型项目填写，400行）
  - 完成NumberItemDialog.vue（数值型项目填写，510行）
  - 完成TextItemDialog.vue（文本型项目填写，392行）
  - 完成InspectionItemService.js（巡查项目服务，398行）
  - 验证InspectionPage.vue集成（所有组件正确集成）
- 完成Story 4.5开发：备注功能与跳检处理
  - 验证RemarkDialog.vue（备注输入对话框，348行）
  - 验证SkipDialog.vue（跳检确认对话框，500行）
  - 验证RemarkService.js（备注管理服务，242行）
  - 验证SkipService.js（跳检管理服务，416行）
  - 验证SkipValidationService.js（跳检验证服务，342行）
  - 验证PointStatus.js（常量定义，70行）
  - 所有13个验收标准全部满足
  - 生成Story 4.5完成报告

---

## 模块职责

RuoYi-App是设备巡检管理系统的移动端应用，基于UniApp框架开发，支持Android平台（含NFC功能）。

**核心功能**：
- 用户登录与身份认证
- 通信配置（服务器地址配置）
- 巡检任务列表查看
- NFC读卡识别点位
- 二维码扫描（替代方案）
- 强制拍照与巡查项目填写
- 备注功能（文本+图片+视频）
- 跳检处理
- 离线数据存储与同步
- 巡检记录查询

---

## 入口与启动

**入口文件**：`main.js`

**启动方式**：
1. 使用HBuilderX打开项目
2. 连接Android设备（需支持NFC）
3. 运行到设备

**环境要求**：
- HBuilderX 3.x+
- Android SDK
- Node.js 16+（用于依赖安装）

**配置文件**：
- `manifest.json`：应用配置（权限、版本号）
- `pages.json`：页面路由配置
- `config.js`：全局配置（API地址等）

---

## 对外接口

### 页面路由

| 路径 | 页面 | 功能 |
|-----|------|------|
| /pages/login | 登录页 | 用户登录 |
| /pages/communication-config | 通信配置 | 配置服务器地址 |
| /pages/data-sync | 数据同步 | 手动同步离线数据 |
| /pages/index/TaskList | 任务列表 | 查看巡检任务 |
| /pages/inspection/InspectionPage | 巡检执行 | NFC扫描、拍照、填写项目 |
| /pages/record/RecordList | 巡检记录 | 查看历史记录 |
| /pages/mine/index | 我的 | 个人中心 |

### API接口（与后端交互）

**登录接口**：
```javascript
// api/login.js
export function login(username, password) {
  return request({
    url: '/login',
    method: 'post',
    data: { username, password }
  })
}
```

**任务接口**：
```javascript
// services/TaskService.js
export async function fetchTasks(userId) {
  // 获取用户的巡检任务列表
}
```

**记录提交接口**：
```javascript
// services/InspectionRecordService.js
export async function submitRecord(recordData) {
  // 提交巡检记录
}
```

---

## 关键依赖与配置

### 依赖包

```json
// package.json（主要依赖）
{
  "dependencies": {
    "uni-app": "^3.x",
    "uni-ui": "^1.x"
  }
}
```

### 权限配置

```json
// manifest.json
{
  "app-plus": {
    "distribute": {
      "android": {
        "permissions": [
          "android.permission.CAMERA",
          "android.permission.NFC",
          "android.permission.ACCESS_NETWORK_STATE",
          "android.permission.WRITE_EXTERNAL_STORAGE"
        ]
      }
    }
  }
}
```

### 全局配置

```javascript
// config.js
export default {
  baseUrl: 'http://localhost:8080', // 默认服务器地址
  timeout: 30000,
  offlineMode: true // 是否启用离线模式
}
```

---

## 数据模型

### 本地存储（SQLite）

**表结构**：
- `tasks`：巡检任务
- `records`：巡检记录
- `item_results`：巡查项目结果
- `photos`：照片（Base64）
- `sync_queue`：待同步队列

**存储服务**：`utils/DatabaseService.js`

### 数据同步策略

**同步流程**：
1. 检测网络状态
2. 查询待同步数据
3. 按优先级上传（记录 > 照片 > 视频）
4. 上传成功后标记为已同步
5. 定期清理已同步数据

**同步服务**：`services/DataSyncService.js`

---

## 测试与质量

### 单元测试

**测试文件**：
- `utils/ApiService.test.js`
- `utils/StorageService.test.js`

**运行测试**：
```bash
npm test
```

### 集成测试

**测试场景**：
1. NFC读卡功能（真机测试）
2. 离线数据存储与同步
3. 照片压缩与上传
4. 跨天时段任务显示

**测试工具**：
- `utils/DatabaseDiagnostic.js`（数据库诊断）
- `utils/QuickDiagnostic.js`（快速诊断）

---

## 常见问题 (FAQ)

### Q1: NFC读卡失败怎么办？
A:
1. 检查设备是否支持NFC（设置 > NFC）
2. 确保NFC已开启
3. 卡片距离手机背面1-3cm
4. 参考 `docs/10.others/nfc-debug-guide.md`

### Q2: 离线数据如何同步？
A:
1. 自动同步：有网络时自动上传
2. 手动同步：进入"数据同步"页面，点击"立即同步"
3. 查看同步状态：`services/DataSyncService.js`

### Q3: 如何配置服务器地址？
A:
1. 进入"通信配置"页面
2. 输入服务器地址（如：http://192.168.1.100:8080）
3. 点击"测试连接"
4. 保存配置

### Q4: 照片上传失败怎么办？
A:
1. 检查网络连接
2. 检查照片大小（自动压缩到1920x1080）
3. 查看上传队列：`services/UploadService.js`
4. 手动重试上传

---

## 相关文件清单

### 核心页面（pages/）
- `login.vue`：登录页
- `communication-config.vue`：通信配置
- `data-sync.vue`：数据同步
- `index/TaskList.vue`：任务列表
- `inspection/InspectionPage.vue`：巡检执行
- `record/RecordList.vue`：巡检记录

### 服务层（services/）
- `NfcService.js`：NFC读卡服务
- `QrCodeService.js`：二维码扫描服务
- `TaskService.js`：任务服务
- `InspectionService.js`：巡检服务
- `InspectionRecordService.js`：记录服务
- `DataSyncService.js`：数据同步服务
- `OfflineDataService.js`：离线数据服务
- `UploadService.js`：文件上传服务
- `PhotoCompressionService.js`：照片压缩服务
- `NetworkService.js`：网络状态服务

### 工具类（utils/）
- `DatabaseService.js`：数据库服务
- `StorageService.js`：本地存储服务
- `ApiService.js`：API请求封装
- `request.js`：HTTP请求封装
- `auth.js`：认证工具
- `common.js`：通用工具
- `validate.js`：校验工具

### 组件（components/）
- `TaskCard.vue`：任务卡片
- `EmptyState.vue`：空状态
- `ScanModeSwitch.vue`：扫描模式切换
- `NfcGuide.vue`：NFC引导
- `QrCodeScanner.vue`：二维码扫描器
- `PhotoCapture.vue`：拍照组件（已重构，集成PhotoGallery）
- `PhotoGallery.vue`：照片展示组件（新建，3列网格布局）
- `StatusItemDialog.vue`：状态型项目对话框（完整实现，400行）
- `NumberItemDialog.vue`：数值型项目对话框（完整实现，510行）
- `TextItemDialog.vue`：文本型项目对话框（完整实现，392行）
- `RemarkDialog.vue`：备注对话框
- `SkipDialog.vue`：跳检对话框
- `NetworkIndicator.vue`：网络状态指示器
- `UploadProgressDialog.vue`：上传进度对话框

---

## 开发指引

### 添加新页面
1. 在 `pages/` 下创建页面文件（.vue）
2. 在 `pages.json` 中注册路由
3. 使用 `uni.navigateTo()` 跳转

### 调用后端API
1. 在 `api/` 或 `services/` 中定义接口方法
2. 使用 `utils/request.js` 发起请求
3. 处理响应数据

### 离线数据存储
1. 使用 `utils/DatabaseService.js` 操作SQLite
2. 数据结构参考 `services/OfflineDataService.js`
3. 同步逻辑参考 `services/DataSyncService.js`

### 调试技巧
- 使用 `console.log()` 打印日志
- 使用HBuilderX的真机调试功能
- 使用 `utils/DatabaseDiagnostic.js` 诊断数据库问题

---

## 相关文档

- [移动端组件设计](../docs/3.architecture/shard/mobile-components/)
- [用户故事 - Epic4（移动端巡检）](../docs/4.userStory/epic4/)
- [NFC调试指南](../docs/10.others/nfc-debug-guide.md)
- [Story 4.1 开发总结](../docs/4.userStory/epic4/story-4.1-integration-test-report.md)
- [Story 4.2 开发总结](../docs/4.userStory/epic4/story-4.2-development-summary.md)
- [Story 4.3 开发总结](../docs/4.userStory/epic4/story-4.3-development-summary.md)
- [Story 4.4 完成报告](../docs/4.userStory/epic4/story-4.4-completion-report.md)
