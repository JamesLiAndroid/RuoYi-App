/**
 * 网络状态服务
 * 功能：监听网络状态变化、检测服务器连通性、提供上传策略控制
 * 支持：WiFi/移动网络检测、服务器健康检查、网络状态事件通知
 *
 * @author James (Developer Agent)
 * @date 2025-11-25
 */

import ApiService from '@/utils/ApiService'

class NetworkService {
  constructor() {
    this.isOnline = false
    this.networkType = 'none'
    this.serverReachable = false
    this.healthCheckInterval = null
    this.listeners = []
    this.init()
  }

  /**
   * 初始化网络状态服务
   */
  init() {
    // 获取当前网络状态
    this.getCurrentNetworkStatus()

    // 监听网络状态变化
    this.startNetworkStatusListener()

    // 启动服务器健康检查
    this.startServerHealthCheck()

    console.log('NetworkService初始化完成')
  }

  /**
   * 获取当前网络状态
   */
  getCurrentNetworkStatus() {
    //#ifdef APP-PLUS
    plus.device.getInfo({
      success: (e) => {
        // 获取网络类型
        uni.getNetworkType({
          success: (res) => {
            this.networkType = res.networkType
            this.isOnline = res.networkType !== 'none'
            console.log('网络状态变化:', res.networkType, '在线:', this.isOnline)
            this.notifyListeners()
          },
          fail: (err) => {
            console.error('获取网络类型失败:', err)
            this.isOnline = false
            this.networkType = 'none'
          }
        })
      },
      fail: (err) => {
        console.error('获取设备信息失败:', err)
      }
    })
    //#endif

    //#ifdef H5
    uni.getNetworkType({
      success: (res) => {
        this.networkType = res.networkType
        this.isOnline = res.networkType !== 'none'
        this.notifyListeners()
      }
    })
    //#endif
  }

  /**
   * 启动网络状态监听
   */
  startNetworkStatusListener() {
    uni.onNetworkStatusChange((res) => {
      console.log('网络状态变化事件:', res)
      this.isOnline = res.isConnected
      this.networkType = res.networkType

      // 如果网络断开，服务器不可达
      if (!this.isOnline) {
        this.serverReachable = false
      }

      this.notifyListeners()
    })
  }

  /**
   * 启动服务器健康检查
   * 每30秒检查一次服务器连通性
   */
  startServerHealthCheck() {
    // 清除之前的定时器
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    // 每30秒检查一次
    this.healthCheckInterval = setInterval(async () => {
      await this.checkServerHealth()
    }, 30000)

    // 立即执行一次健康检查
    this.checkServerHealth()
  }

  /**
   * 检查服务器健康状态
   */
  async checkServerHealth() {
    // 如果离线，不进行健康检查
    if (!this.isOnline) {
      this.serverReachable = false
      this.notifyListeners()
      return
    }

    try {
      console.log('检查服务器健康状态...')
      const startTime = Date.now()

      // 使用 ApiService 发送健康检查请求
      const response = await ApiService.get('/health')

      const duration = Date.now() - startTime
      console.log(`健康检查完成，耗时: ${duration}ms`, response)

      // 如果响应正常，标记为可达
      this.serverReachable = true
    } catch (error) {
      console.error('健康检查失败:', error)
      this.serverReachable = false
    }

    this.notifyListeners()
  }

  /**
   * 停止健康检查
   */
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
      console.log('健康检查已停止')
    }
  }

  /**
   * 获取网络状态
   * @returns {Object} 网络状态对象
   */
  getNetworkStatus() {
    return {
      isOnline: this.isOnline,
      networkType: this.networkType,
      serverReachable: this.serverReachable
    }
  }

  /**
   * 判断是否允许上传数据
   * @param {boolean} wifiOnly - 是否仅允许WiFi上传
   * @returns {boolean} 是否允许上传
   */
  canUpload(wifiOnly = false) {
    // 检查网络连接和服务器可达性
    if (!this.isOnline || !this.serverReachable) {
      return false
    }

    // 检查WiFi限制
    if (wifiOnly) {
      return this.networkType === 'wifi'
    }

    return true
  }

  /**
   * 监听网络状态变化
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消监听的函数
   */
  onNetworkStatusChange(callback) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback)
    }
  }

  /**
   * 通知所有监听器
   */
  notifyListeners() {
    const status = this.getNetworkStatus()
    this.listeners.forEach(callback => {
      try {
        callback(status)
      } catch (error) {
        console.error('网络状态监听器执行错误:', error)
      }
    })

    // 触发全局事件
    uni.$emit('networkStatusChanged', status)
  }

  /**
   * 获取网络状态描述
   * @returns {string} 状态描述
   */
  getStatusText() {
    if (!this.isOnline) {
      return '离线'
    }
    if (!this.serverReachable) {
      return '服务器不可达'
    }
    return '在线'
  }

  /**
   * 获取网络状态颜色
   * @returns {string} 状态颜色
   */
  getStatusColor() {
    if (!this.isOnline || !this.serverReachable) {
      return '#999999'
    }
    return '#4CAF50'
  }

  /**
   * 获取网络类型显示文本
   * @returns {string} 网络类型
   */
  getNetworkTypeText() {
    const typeMap = {
      'wifi': 'WiFi',
      '2g': '2G网络',
      '3g': '3G网络',
      '4g': '4G网络',
      '5g': '5G网络',
      'ethernet': '有线网络',
      'unknown': '未知网络',
      'none': '无网络'
    }
    return typeMap[this.networkType] || '未知'
  }
}

// 创建单例
const networkService = new NetworkService()

export default networkService
