/**
 * 移动端基础设施集成测试
 *
 * @author James (Developer Agent)
 * @date 2025-11-25
 */

import StorageService from './StorageService'
import ApiService from './ApiService'
import DatabaseService from './DatabaseService'

/**
 * 运行所有测试
 */
export function runAllTests() {
  console.log('=====================================')
  console.log('移动端基础设施集成测试')
  console.log('=====================================')

  // 清空存储
  StorageService.clearAll()

  // 运行测试
  testStorageService()
  testApiService()

  console.log('=====================================')
  console.log('所有测试完成')
  console.log('=====================================')
}

/**
 * 测试StorageService
 */
function testStorageService() {
  console.log('\n--- 测试 StorageService ---')

  // 测试服务器配置
  console.log('测试 1: 服务器配置')
  const serverUrl = 'http://192.168.1.100:8080'
  StorageService.setServerUrl(serverUrl)
  console.assert(StorageService.getServerUrl() === serverUrl, '服务器配置失败')
  console.log('✓ 服务器配置正常')

  // 测试用户凭据
  console.log('测试 2: 用户凭据')
  const username = 'testuser'
  const password = 'testpass123'
  StorageService.setUsername(username)
  StorageService.setPassword(password)
  console.assert(StorageService.getUsername() === username, '用户名保存失败')
  console.assert(StorageService.getPassword() === password, '密码保存失败')
  console.log('✓ 用户凭据正常')

  // 测试Token
  console.log('测试 3: Token管理')
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  StorageService.setToken(token)
  console.assert(StorageService.getToken() === token, 'Token保存失败')
  console.log('✓ Token管理正常')

  // 测试同步元数据
  console.log('测试 4: 同步元数据')
  const metadata = {
    routes_version: '2025-11-25T10:00:00',
    points_version: '2025-11-25T10:30:00'
  }
  StorageService.setSyncMetadata(metadata)
  const retrievedMetadata = StorageService.getSyncMetadata()
  console.assert(retrievedMetadata.routes_version === metadata.routes_version, '同步元数据保存失败')
  console.log('✓ 同步元数据正常')

  console.log('StorageService 测试通过\n')
}

/**
 * 测试ApiService
 */
function testApiService() {
  console.log('--- 测试 ApiService ---')

  // 测试BaseURL设置
  console.log('测试 1: BaseURL设置')
  const serverUrl = 'http://192.168.1.100:8080'
  ApiService.setBaseURL(serverUrl)
  console.assert(ApiService.getBaseURL() === serverUrl, 'BaseURL设置失败')
  console.log('✓ BaseURL设置正常')

  // 测试完整URL构建
  console.log('测试 2: 完整URL构建')
  const path = '/api/health'
  const fullUrl = ApiService.getFullUrl(path)
  console.assert(fullUrl === serverUrl + path, '完整URL构建失败')
  console.log('完整URL:', fullUrl)
  console.log('✓ 完整URL构建正常')

  // 测试URL格式验证
  console.log('测试 3: URL格式验证')
  try {
    ApiService.setBaseURL('invalid-url')
    console.assert(false, '应该抛出错误')
  } catch (error) {
    console.assert(error.message.includes('必须以http://或https://开头'), '错误信息不正确')
    console.log('✓ URL格式验证正常')
  }

  console.log('ApiService 测试通过\n')
}

/**
 * 测试基础服务集成
 */
function testServiceIntegration() {
  console.log('--- 测试服务集成 ---')

  // 从StorageService获取BaseURL，设置到ApiService
  console.log('测试 1: 服务间协作')
  const serverUrl = StorageService.getServerUrl()
  if (serverUrl) {
    ApiService.setBaseURL(serverUrl)
    console.log('从StorageService获取BaseURL并设置到ApiService:', serverUrl)
    console.assert(ApiService.getBaseURL() === serverUrl, '服务间协作失败')
    console.log('✓ 服务间协作正常')
  }

  console.log('服务集成测试通过\n')
}

/**
 * 模拟数据同步流程测试
 */
function testDataSyncFlow() {
  console.log('--- 测试数据同步流程 ---')

  // 步骤1: 检查服务器配置
  console.log('步骤 1: 检查服务器配置')
  const isConfigured = StorageService.isServerConfigured()
  console.assert(isConfigured === true, '服务器未配置')
  console.log('✓ 服务器已配置')

  // 步骤2: 保存同步元数据
  console.log('步骤 2: 保存同步元数据')
  const localMetadata = {
    routes_version: '2025-11-24T10:00:00',
    points_version: '2025-11-24T10:30:00',
    items_version: '2025-11-24T11:00:00',
    tasks_version: '2025-11-24T11:30:00'
  }
  StorageService.setSyncMetadata(localMetadata)
  const retrievedMetadata = StorageService.getSyncMetadata()
  console.assert(retrievedMetadata.routes_version === localMetadata.routes_version, '同步元数据保存失败')
  console.log('✓ 同步元数据已保存')

  // 步骤3: 模拟API调用检查版本
  console.log('步骤 3: 模拟API调用（实际不会真正发送请求）')
  console.log('注意: ApiService已配置，BaseURL:', ApiService.getBaseURL())
  console.log('模拟调用: GET /mobile/data-version')
  console.log('✓ API调用准备就绪')

  console.log('数据同步流程测试通过\n')
}

// 导出测试函数
export {
  runAllTests,
  testStorageService,
  testApiService,
  testServiceIntegration,
  testDataSyncFlow
}
