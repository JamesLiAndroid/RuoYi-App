/**
 * ApiService 测试用例
 *
 * @author James (Developer Agent)
 * @date 2025-11-25
 */

import ApiService from './ApiService'
import StorageService from './StorageService'

// 清空存储用于测试
StorageService.clearAll()

function testApiService() {
  console.log('=== 开始测试 ApiService ===')

  // 测试 1: 默认BaseURL
  console.log('测试 1: 默认BaseURL')
  const defaultUrl = ApiService.getBaseURL()
  console.log('默认BaseURL:', defaultUrl)
  console.assert(defaultUrl !== '', '默认BaseURL不应为空')
  console.log('✓ 默认BaseURL正常')

  // 测试 2: 设置BaseURL
  console.log('测试 2: 设置BaseURL')
  const newUrl = 'http://192.168.1.100:8080'
  ApiService.setBaseURL(newUrl)
  const retrievedUrl = ApiService.getBaseURL()
  console.assert(retrievedUrl === newUrl, 'BaseURL设置失败')
  console.log('✓ BaseURL设置正常')

  // 测试 3: 构建完整URL
  console.log('测试 3: 构建完整URL')
  const path = '/api/test'
  const fullUrl = ApiService.getFullUrl(path)
  console.assert(fullUrl === newUrl + path, '完整URL构建失败')
  console.log('完整URL:', fullUrl)
  console.log('✓ 完整URL构建正常')

  // 测试 4: BaseURL格式验证
  console.log('测试 4: BaseURL格式验证')
  try {
    ApiService.setBaseURL('invalid-url')
    console.assert(false, '应该抛出错误')
  } catch (error) {
    console.assert(error.message.includes('必须以http://或https://开头'), '错误信息不正确')
    console.log('✓ BaseURL格式验证正常')
  }

  // 测试 5: 去除尾斜杠
  console.log('测试 5: 去除尾斜杠')
  ApiService.setBaseURL('http://test.com/')
  const urlWithoutSlash = ApiService.getBaseURL()
  console.assert(!urlWithoutSlash.endsWith('/'), '尾斜杠未去除')
  console.log('✓ 去除尾斜杠正常')

  console.log('=== ApiService 测试完成 ===')
}

export default testApiService
