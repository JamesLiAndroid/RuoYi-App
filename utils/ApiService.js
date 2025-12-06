/**
 * API服务
 * 支持动态BaseURL配置的HTTP客户端
 *
 * @author James (Developer Agent)
 * @date 2025-11-25
 */

import StorageService from './StorageService'

class ApiService {
  constructor() {
    // 动态BaseURL，从本地存储读取
    this.baseURL = this._getBaseURL()
    // 默认超时时间（10秒）
    this.timeout = 10000
  }

  /**
   * 获取BaseURL
   * 优先从本地存储读取，未配置则使用默认值
   */
  _getBaseURL() {
    const serverUrl = StorageService.getServerUrl()
    if (serverUrl && serverUrl !== '') {
      return serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl
    }
    // 默认URL（开发环境使用）
    return 'http://localhost:8080'
  }

  /**
   * 设置BaseURL
   * @param url 服务器地址
   */
  setBaseURL(url) {
    if (!url) {
      throw new Error('服务器地址不能为空')
    }

    // 验证URL格式
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('服务器地址必须以http://或https://开头')
    }

    // 去除尾部的斜杠
    this.baseURL = url.endsWith('/') ? url.slice(0, -1) : url

    // 保存到本地存储
    StorageService.setServerUrl(url)
  }

  /**
   * 获取当前BaseURL
   */
  getBaseURL() {
    return this._getBaseURL()
  }

  /**
   * 构建完整URL
   * @param path 接口路径
   */
  _buildUrl(path) {
    if (!path.startsWith('/')) {
      path = '/' + path
    }
    return this.baseURL + path
  }

  /**
   * 获取请求头
   * @param options 请求选项
   */
  _getHeaders(options = {}) {
    const headers = options.headers || {}

    // 自动添加Token（除非显式禁用）
    if (options.isToken !== false) {
      const token = StorageService.getToken()
      if (token) {
        headers['Authorization'] = 'Bearer ' + token
      }
    }

    // 默认Content-Type
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json'
    }

    return headers
  }

  /**
   * 处理请求参数
   * @param data 请求数据
   * @param method 请求方法
   */
  _processRequestData(data, method) {
    const upperMethod = method.toUpperCase()

    if (upperMethod === 'GET' || upperMethod === 'DELETE') {
      // GET和DELETE请求，参数放在URL中
      return { params: data }
    } else {
      // POST、PUT等请求，数据放在body中
      return { data: data }
    }
  }

  /**
   * 处理响应数据
   * @param response 响应对象
   */
  _handleResponse(response) {
    // uni.request返回的数据结构
    const { statusCode, data } = response

    // HTTP状态码检查
    if (statusCode === 401) {
      // Token过期，跳转到登录页
      this._handleUnauthorized()
      throw new Error('登录已过期，请重新登录')
    }

    if (statusCode !== 200) {
      throw new Error(`HTTP ${statusCode}: 请求失败`)
    }

    // 业务状态码检查
    const code = data.code || 200
    const msg = data.msg || data.message || '未知错误'

    if (code !== 200) {
      throw new Error(msg)
    }

    return data.data || data
  }

  /**
   * 处理未授权
   */
  _handleUnauthorized() {
    // 清除用户凭据
    StorageService.clearCredentials()

    // 跳转到登录页
    uni.reLaunch({ url: '/pages/login' })
  }

  /**
   * 网络错误处理
   * @param error 错误信息
   */
  _handleNetworkError(error) {
    let message = '网络请求失败'

    if (error.errMsg) {
      if (error.errMsg.includes('timeout')) {
        message = '请求超时，请检查网络连接'
      } else if (error.errMsg.includes('fail')) {
        message = '网络连接失败，请检查服务器地址'
      }
    }

    throw new Error(message)
  }

  /**
   * 发送HTTP请求
   * @param options 请求选项
   */
  async request(options) {
    const {
      url,
      method = 'GET',
      data,
      headers = {},
      timeout = this.timeout,
      isToken = true
    } = options

    const requestUrl = this._buildUrl(url)
    const requestHeaders = this._getHeaders({ headers, isToken })
    const requestData = this._processRequestData(data, method)

    return new Promise((resolve, reject) => {
      uni.request({
        url: requestUrl,
        method: method.toUpperCase(),
        timeout,
        ...requestData,
        header: requestHeaders,
        success: (response) => {
          try {
            const result = this._handleResponse(response)
            resolve(result)
          } catch (error) {
            reject(error)
          }
        },
        fail: (error) => {
          try {
            this._handleNetworkError(error)
          } catch (err) {
            reject(err)
          }
        }
      })
    })
  }

  /**
   * GET请求
   */
  get(url, params, options = {}) {
    return this.request({
      url,
      method: 'GET',
      data: params,
      ...options
    })
  }

  /**
   * POST请求
   */
  post(url, data, options = {}) {
    return this.request({
      url,
      method: 'POST',
      data,
      ...options
    })
  }

  /**
   * PUT请求
   */
  put(url, data, options = {}) {
    return this.request({
      url,
      method: 'PUT',
      data,
      ...options
    })
  }

  /**
   * DELETE请求
   */
  delete(url, params, options = {}) {
    return this.request({
      url,
      method: 'DELETE',
      data: params,
      ...options
    })
  }

  /**
   * 测试服务器连接
   * @param url 服务器地址（可选）
   */
  async testConnection(url = null) {
    try {
      const originalBaseURL = this.baseURL
      const testUrl = url || this.baseURL

      // 临时设置BaseURL（如果提供了url参数）
      if (url && url !== this.baseURL) {
        this.baseURL = url.endsWith('/') ? url.slice(0, -1) : url
      }

      // 尝试访问健康检查接口
      await this.get('/health', {}, { isToken: false })

      // 恢复原始BaseURL
      if (url && url !== originalBaseURL) {
        this.baseURL = originalBaseURL
      }

      return {
        success: true,
        message: '连接成功'
      }
    } catch (error) {
      return {
        success: false,
        message: error.message || '连接失败'
      }
    }
  }

  /**
   * 获取完整URL（用于调试）
   * @param path 接口路径
   */
  getFullUrl(path) {
    return this._buildUrl(path)
  }
}

// 导出单例
export default new ApiService()
