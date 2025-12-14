/**
 * StorageService 测试用例
 *
 * @author James (Developer Agent)
 * @date 2025-11-25
 */

// 注意：这是一个示例测试文件
// 实际测试中可以使用 uni-app 的测试框架

import StorageService from './StorageService'

// 清空存储用于测试
StorageService.clearAll()

// 测试用例
function testStorageService() {
  console.log('=== 开始测试 StorageService ===')

  // 测试 1: 设置和获取服务器地址
  console.log('测试 1: 服务器地址')
  const serverUrl = 'http://192.168.1.100:8080'
  StorageService.setServerUrl(serverUrl)
  const retrievedUrl = StorageService.getServerUrl()
  console.assert(retrievedUrl === serverUrl, '服务器地址保存/获取失败')
  console.log('✓ 服务器地址保存/获取正常')

  // 测试 2: 用户名密码
  console.log('测试 2: 用户名密码')
  const username = 'testuser'
  const password = 'testpass123'
  StorageService.setUsername(username)
  StorageService.setPassword(password)
  const retrievedUsername = StorageService.getUsername()
  const retrievedPassword = StorageService.getPassword()
  console.assert(retrievedUsername === username, '用户名保存/获取失败')
  console.assert(retrievedPassword === password, '密码保存/获取失败')
  console.log('✓ 用户名密码保存/获取正常')

  // 测试 3: Token
  console.log('测试 3: Token')
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  StorageService.setToken(token)
  const retrievedToken = StorageService.getToken()
  console.assert(retrievedToken === token, 'Token保存/获取失败')
  console.log('✓ Token保存/获取正常')

  // 测试 4: 同步元数据
  console.log('测试 4: 同步元数据')
  const metadata = {
    routes_version: '2025-11-25T10:00:00',
    points_version: '2025-11-25T10:30:00'
  }
  StorageService.setSyncMetadata(metadata)
  const retrievedMetadata = StorageService.getSyncMetadata()
  console.assert(retrievedMetadata.routes_version === metadata.routes_version, '同步元数据保存/获取失败')
  console.log('✓ 同步元数据保存/获取正常')

  // 测试 5: 服务器配置检查
  console.log('测试 5: 服务器配置检查')
  const isConfigured = StorageService.isServerConfigured()
  console.assert(isConfigured === true, '服务器配置检查失败')
  console.log('✓ 服务器配置检查正常')

  // 测试 6: 清除凭据
  console.log('测试 6: 清除凭据')
  StorageService.clearCredentials()
  const clearedUsername = StorageService.getUsername()
  const clearedPassword = StorageService.getPassword()
  console.assert(clearedUsername === '', '用户名清除失败')
  console.assert(clearedPassword === '', '密码清除失败')
  console.log('✓ 清除凭据正常')

  // 测试 7: 清除用户数据
  console.log('测试 7: 清除用户数据（保留服务器配置）')
  StorageService.clearUserData()
  const serverUrlAfterClear = StorageService.getServerUrl()
  console.assert(serverUrlAfterClear === serverUrl, '清除用户数据后服务器配置被误删')
  console.log('✓ 清除用户数据正常')

  console.log('=== StorageService 测试完成 ===')
}

export default testStorageService
