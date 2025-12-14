/**
 * 防刷服务类 - 防止异常扫码行为
 * 包括频率限制、日扫码限制、异常行为检测
 */

class AntiSpamService {
  constructor() {
    this.dailyLimit = 500  // 每日最大扫码次数
    this.scanInterval = 500  // 扫码间隔（毫秒）
    this.recentScans = []  // 最近扫码记录
    this.dailyCount = 0  // 当日扫码次数
    this.lastScanTime = 0  // 上次扫码时间
    this.lastResetDate = this.getTodayString()

    // 从本地存储加载数据
    this.loadFromStorage()
  }

  /**
   * 获取今天的日期字符串
   * @returns {string} 格式：YYYY-MM-DD
   */
  getTodayString() {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * 检查扫码限制
   * @returns {Object} 检查结果
   */
  checkScanLimit() {
    const now = Date.now()
    const today = this.getTodayString()

    // 检查日扫码次数
    if (this.dailyCount >= this.dailyLimit) {
      return {
        allowed: false,
        reason: 'DAILY_LIMIT_EXCEEDED',
        message: `今日扫码次数已达上限（${this.dailyLimit}次），请明天再试或联系管理员`
      }
    }

    // 检查扫码频率（防抖）
    if (now - this.lastScanTime < this.scanInterval) {
      return {
        allowed: false,
        reason: 'FREQUENCY_TOO_HIGH',
        message: `扫码过于频繁，请间隔${this.scanInterval}ms后再试`
      }
    }

    // 检查异常高频扫码
    const recentCount = this.recentScans.filter(
      time => now - time < 60000  // 最近1分钟
    ).length

    if (recentCount > 10) {
      // 1分钟内扫码超过10次，可能为恶意刷数据
      this.triggerSpamAlert(recentCount)
      return {
        allowed: false,
        reason: 'SUSPICIOUS_ACTIVITY',
        message: '检测到异常扫码行为，请联系管理员'
      }
    }

    return { allowed: true }
  }

  /**
   * 记录扫码
   * @param {string} content - 二维码内容
   * @param {Object} location - 位置信息（可选）
   */
  recordScan(content, location = null) {
    const now = Date.now()
    const today = this.getTodayString()

    // 重置日计数（新的一天）
    if (this.lastResetDate !== today) {
      this.dailyCount = 0
      this.lastResetDate = today
    }

    this.lastScanTime = now
    this.recentScans.push(now)

    // 清理1小时前的记录
    this.recentScans = this.recentScans.filter(
      time => now - time < 3600000
    )

    this.dailyCount++

    // 保存到本地存储
    this.saveToStorage()

    // 记录扫码日志
    this.logScan(content, location)
  }

  /**
   * 记录扫码日志
   * @param {string} content - 二维码内容
   * @param {Object} location - 位置信息
   */
  logScan(content, location) {
    const log = {
      timestamp: new Date().toISOString(),
      content: content.substring(0, 50), // 避免存储完整内容
      location: location,
      deviceInfo: this.getDeviceInfo()
    }

    const logs = uni.getStorageSync('scanLogs') || []
    logs.unshift(log)

    // 只保留最近100条日志
    if (logs.length > 100) {
      logs.splice(100)
    }

    uni.setStorageSync('scanLogs', logs)
  }

  /**
   * 获取设备信息
   * @returns {Object} 设备信息
   */
  getDeviceInfo() {
    try {
      const systemInfo = uni.getSystemInfoSync()
      return {
        platform: systemInfo.platform,
        system: systemInfo.system,
        model: systemInfo.model,
        brand: systemInfo.brand || 'unknown'
      }
    } catch (error) {
      return {
        platform: 'unknown',
        system: 'unknown',
        model: 'unknown',
        brand: 'unknown'
      }
    }
  }

  /**
   * 触发异常告警
   * @param {number} count - 异常次数
   */
  triggerSpamAlert(count) {
    const alertData = {
      timestamp: new Date().toISOString(),
      scanCount: count,
      deviceInfo: this.getDeviceInfo(),
      location: null  // 可选：获取当前位置
    }

    console.warn('[防刷] 检测到异常扫码:', alertData)

    // 本地存储告警记录
    const alerts = uni.getStorageSync('spamAlerts') || []
    alerts.push(alertData)

    // 只保留最近50条告警
    if (alerts.length > 50) {
      alerts.splice(50)
    }

    uni.setStorageSync('spamAlerts', alerts)

    // 提示用户
    uni.showToast({
      title: '检测到异常扫码行为，请联系管理员',
      icon: 'none',
      duration: 3000
    })
  }

  /**
   * 保存数据到本地存储
   */
  saveToStorage() {
    try {
      uni.setStorageSync('dailyScanCount', this.dailyCount)
      uni.setStorageSync('lastResetDate', this.lastResetDate)
      uni.setStorageSync('recentScans', this.recentScans)
      uni.setStorageSync('lastScanTime', this.lastScanTime)
    } catch (error) {
      console.error('保存防刷数据失败:', error)
    }
  }

  /**
   * 从本地存储加载数据
   */
  loadFromStorage() {
    try {
      this.dailyCount = uni.getStorageSync('dailyScanCount') || 0
      this.lastResetDate = uni.getStorageSync('lastResetDate') || this.getTodayString()
      this.recentScans = uni.getStorageSync('recentScans') || []
      this.lastScanTime = uni.getStorageSync('lastScanTime') || 0

      // 检查是否是新的一天，如果是则重置计数
      const today = this.getTodayString()
      if (this.lastResetDate !== today) {
        this.dailyCount = 0
        this.lastResetDate = today
        this.recentScans = []
        this.saveToStorage()
      }
    } catch (error) {
      console.error('加载防刷数据失败:', error)
    }
  }

  /**
   * 获取扫码统计
   * @returns {Object} 统计信息
   */
  getScanStats() {
    return {
      dailyCount: this.dailyCount,
      dailyLimit: this.dailyLimit,
      recentCount: this.recentScans.length,
      lastScanTime: this.lastScanTime,
      remaining: this.dailyLimit - this.dailyCount,
      usageRate: Math.round((this.dailyCount / this.dailyLimit) * 100)
    }
  }

  /**
   * 获取扫码日志
   * @param {number} limit - 限制条数
   * @returns {Array} 日志数组
   */
  getScanLogs(limit = 20) {
    try {
      const logs = uni.getStorageSync('scanLogs') || []
      return logs.slice(0, limit)
    } catch (error) {
      console.error('获取扫码日志失败:', error)
      return []
    }
  }

  /**
   * 清除历史数据
   * @param {string} type - 清除类型：'logs' | 'alerts' | 'all'
   */
  clearHistory(type = 'all') {
    try {
      if (type === 'logs' || type === 'all') {
        uni.removeStorageSync('scanLogs')
      }

      if (type === 'alerts' || type === 'all') {
        uni.removeStorageSync('spamAlerts')
      }

      if (type === 'all') {
        // 保留统计数据，只清除临时数据
        this.recentScans = []
        uni.removeStorageSync('recentScans')
      }
    } catch (error) {
      console.error('清除历史数据失败:', error)
    }
  }

  /**
   * 重置每日计数（管理员功能）
   */
  resetDailyCount() {
    this.dailyCount = 0
    this.lastResetDate = this.getTodayString()
    this.saveToStorage()
  }

  /**
   * 检查是否需要显示使用率警告
   * @returns {boolean} 是否需要警告
   */
  shouldWarnUsage() {
    const usageRate = (this.dailyCount / this.dailyLimit) * 100
    return usageRate >= 80  // 达到80%时警告
  }

  /**
   * 获取使用率警告消息
   * @returns {string} 警告消息或空字符串
   */
  getUsageWarningMessage() {
    if (this.dailyCount >= this.dailyLimit) {
      return `今日扫码次数已达上限（${this.dailyCount}/${this.dailyLimit}）`
    }

    if (this.shouldWarnUsage()) {
      return `今日已扫码${this.dailyCount}次，剩余${this.dailyLimit - this.dailyCount}次`
    }

    return ''
  }
}

// 单例模式
const antiSpamService = new AntiSpamService()
export default antiSpamService
