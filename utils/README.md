# 移动端工具类库

本文档说明移动端基础工具类的使用方法。

## 📦 工具类列表

### 1. StorageService - 本地存储服务

负责应用配置的本地存储和加密管理。

#### 导入
```javascript
import StorageService from '@/utils/StorageService'
```

#### 使用示例

**服务器配置管理**
```javascript
// 保存服务器地址
StorageService.setServerUrl('http://192.168.1.100:8080')

// 获取服务器地址
const serverUrl = StorageService.getServerUrl()

// 检查是否已配置服务器
if (StorageService.isServerConfigured()) {
  console.log('服务器已配置')
}
```

**用户凭据管理**
```javascript
// 保存用户名密码（密码会自动加密存储）
StorageService.setUsername('zhangsan')
StorageService.setPassword('123456')

// 获取用户名密码
const username = StorageService.getUsername()
const password = StorageService.getPassword()

// 清除用户凭据（Token、用户名、密码）
StorageService.clearCredentials()
```

**Token管理**
```javascript
// 保存Token
StorageService.setToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')

// 获取Token
const token = StorageService.getToken()

// 检查Token是否有效
if (StorageService.isTokenValid()) {
  console.log('Token有效')
}
```

**同步元数据管理**
```javascript
// 保存同步元数据
const metadata = {
  routes_version: '2025-11-25T10:00:00',
  points_version: '2025-11-25T10:30:00'
}
StorageService.setSyncMetadata(metadata)

// 获取同步元数据
const retrievedMetadata = StorageService.getSyncMetadata()
```

**数据清理**
```javascript
// 清除所有应用数据（但保留服务器配置）
StorageService.clearUserData()

// 清除所有数据
StorageService.clearAll()
```

---

### 2. ApiService - HTTP客户端

负责HTTP请求的发送，支持动态BaseURL配置。

#### 导入
```javascript
import ApiService from '@/utils/ApiService'
```

#### 使用示例

**配置服务器地址**
```javascript
// 设置服务器地址（会保存到StorageService）
ApiService.setBaseURL('http://192.168.1.100:8080')

// 获取当前BaseURL
const baseUrl = ApiService.getBaseURL()
```

**发送HTTP请求**
```javascript
// GET请求
ApiService.get('/api/mobile/data-version')
  .then(data => {
    console.log('数据版本:', data)
  })
  .catch(error => {
    console.error('请求失败:', error.message)
  })

// POST请求
ApiService.post('/auth/login', {
  username: 'zhangsan',
  password: '123456'
})
  .then(data => {
    console.log('登录成功:', data)
  })

// PUT请求
ApiService.put('/api/user/1001', {
  nickName: '张三'
})

// DELETE请求
ApiService.delete('/api/user/1001')
```

**请求配置**
```javascript
// 自定义请求头
ApiService.post('/api/test', data, {
  headers: {
    'X-Custom-Header': 'value'
  }
})

// 禁用Token自动添加
ApiService.get('/api/public', {}, {
  isToken: false
})

// 自定义超时时间
ApiService.get('/api/slow', {}, {
  timeout: 30000  // 30秒
})
```

**测试连接**
```javascript
// 测试当前服务器连接
ApiService.testConnection()
  .then(result => {
    if (result.success) {
      console.log('连接成功')
    } else {
      console.error('连接失败:', result.message)
    }
  })

// 测试指定服务器连接
ApiService.testConnection('http://192.168.1.100:8080')
  .then(result => {
    console.log(result)
  })
```

**获取完整URL（调试用）**
```javascript
const fullUrl = ApiService.getFullUrl('/api/health')
console.log('完整URL:', fullUrl) // http://192.168.1.100:8080/api/health
```

---

### 3. DatabaseService - SQLite数据库服务

负责巡检数据的本地存储和管理。

#### 导入
```javascript
import DatabaseService from '@/utils/DatabaseService'
```

#### 使用示例

**初始化数据库**
```javascript
// 初始化数据库（首次使用）
await DatabaseService.init()
```

**基础操作**

```javascript
// 批量插入数据
const routes = [
  { routeId: 1, routeName: '路线1', routeCode: 'R001', isEnabled: 1 },
  { routeId: 2, routeName: '路线2', routeCode: 'R002', isEnabled: 1 }
]
await DatabaseService.syncRoutes(routes)

// 查询数据
const allRoutes = await DatabaseService.getLocalRoutes()
console.log('本地路线:', allRoutes)

// 清空表
await DatabaseService.clearTable('inspection_route')
```

**高级操作**

```javascript
// 条件查询
const enabledRoutes = await DatabaseService.find('inspection_route', 'is_enabled = ?', [1])

// 统计查询
const routeCount = await DatabaseService.count('inspection_route')

// 更新同步元数据
await DatabaseService.updateSyncMetadata('routes', '2025-11-25T10:00:00')

// 获取同步元数据
const metadata = await DatabaseService.getSyncMetadata()
console.log('同步版本:', metadata.routes_version)
```

**事务支持**

```javascript
try {
  await DatabaseService.beginTransaction()

  // 执行多个操作
  await DatabaseService.clearTable('inspection_route')
  await DatabaseService.syncRoutes(routes)
  await DatabaseService.syncPoints(points)

  await DatabaseService.commit()
  console.log('事务提交成功')
} catch (error) {
  await DatabaseService.rollback()
  console.error('事务回滚:', error)
}
```

---

## 🔧 集成使用示例

### 登录后数据同步流程

```javascript
import ApiService from '@/utils/ApiService'
import DatabaseService from '@/utils/DatabaseService'
import StorageService from '@/utils/StorageService'

// 1. 登录
async function login(username, password) {
  try {
    // 调用登录API
    const result = await ApiService.post('/auth/login', {
      username,
      password
    })

    // 保存Token
    StorageService.setToken(result.token)

    // 获取用户信息
    const userInfo = await ApiService.get('/getInfo')
    StorageService.setUsername(userInfo.user.userName)

    return result
  } catch (error) {
    throw new Error('登录失败: ' + error.message)
  }
}

// 2. 数据同步
async function syncData() {
  try {
    // 初始化数据库
    await DatabaseService.init()

    // 检查数据版本
    const serverVersion = await ApiService.get('/api/mobile/data-version')
    const localMetadata = StorageService.getSyncMetadata()

    // 对比版本，决定同步哪些表
    if (serverVersion.routes_version !== localMetadata.routes_version) {
      // 同步路线数据
      const routes = await ApiService.get('/api/mobile/routes')
      await DatabaseService.syncRoutes(routes)
      await DatabaseService.updateSyncMetadata('routes', serverVersion.routes_version)
    }

    if (serverVersion.points_version !== localMetadata.points_version) {
      // 同步点位数据
      const points = await ApiService.get('/api/mobile/points')
      await DatabaseService.syncPoints(points)
      await DatabaseService.updateSyncMetadata('points', serverVersion.points_version)
    }

    // 更新本地同步元数据
    StorageService.setSyncMetadata(serverVersion)

    console.log('数据同步完成')
  } catch (error) {
    console.error('数据同步失败:', error)
    throw error
  }
}

// 3. 页面使用
export default {
  async onLoad() {
    try {
      // 登录
      await login('zhangsan', '123456')

      // 同步数据
      await syncData()

      // 跳转到首页
      uni.reLaunch({ url: '/pages/index' })
    } catch (error) {
      uni.showToast({
        title: error.message,
        icon: 'error'
      })
    }
  }
}
```

---

## ⚠️ 注意事项

1. **App端支持**: 所有服务都支持App端（使用HBuilderX编译）
2. **H5端限制**: DatabaseService在H5端不支持（uni-app限制）
3. **安全存储**: 生产环境中应使用专业加密库（如CryptoJS）进行密码加密
4. **错误处理**: 所有API调用都应使用try-catch进行错误处理
5. **性能优化**: 大量数据同步时建议使用批量操作和事务
6. **BaseURL配置**: 必须在登录前配置服务器地址

---

## 📝 测试

运行集成测试：

```javascript
import { runAllTests } from '@/utils/test-integration.js'

// 在应用启动时运行测试（开发环境）
runAllTests()
```

或者单独测试某个服务：

```javascript
import { testStorageService } from '@/utils/test-integration.js'

testStorageService()
```
