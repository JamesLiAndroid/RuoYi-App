/**
 * NFC服务类 - 处理NFC卡读取、验证和状态管理
 * 支持条件编译：APP-PLUS（原生NFC插件）vs H5（模拟实现）
 * 集成二维码扫描功能
 */

import qrCodeService from './QrCodeService'
import pointMatchingService from './PointMatchingService'
import cameraPermissionService from './CameraPermissionService'
import antiSpamService from './AntiSpamService'

class NfcService {
  constructor() {
    this.isSupported = false
    this.isEnabled = false
    this.currentCard = null
    this.listeners = []

    // 扫码模式相关
    this.scanMode = uni.getStorageSync('scan_mode') || 'nfc'
    this.currentRouteId = null

    //#ifdef APP-PLUS
    this.initNfc()
    //#endif

    //#ifdef H5
    // H5环境下默认支持（模拟）
    this.isSupported = true
    this.isEnabled = true
    //#endif
  }

  /**
   * 初始化NFC服务（APP-PLUS环境）
   */
  //#ifdef APP-PLUS
  initNfc() {
    const context = plus.android.runtimeMainActivity()
    const nfcAdapter = plus.android.invoke('android.nfc.NfcAdapter', 'getDefaultAdapter', context)

    if (nfcAdapter) {
      this.isSupported = true
      this.isEnabled = nfcAdapter.isEnabled()
    }
  }
  //#endif

  /**
   * 检测设备是否支持NFC
   */
  isNfcSupported() {
    return this.isSupported
  }

  /**
   * 检测NFC是否已启用
   */
  isNfcEnabled() {
    //#ifdef APP-PLUS
    if (this.isSupported) {
      const context = plus.android.runtimeMainActivity()
      const nfcAdapter = plus.android.invoke('android.nfc.NfcAdapter', 'getDefaultAdapter', context)
      this.isEnabled = nfcAdapter.isEnabled()
    }
    //#endif

    return this.isEnabled
  }

  /**
   * 打开NFC设置页面
   */
  openNfcSettings() {
    //#ifdef APP-PLUS
    plus.android.invoke('android.content.Intent', 'setClassName',
      ['android.settings.NFC_SETTINGS'])
    //#endif

    //#ifdef H5
    uni.showToast({
      title: 'H5环境模拟：打开NFC设置',
      icon: 'none'
    })
    //#endif
  }

  /**
   * 开始NFC读卡
   * @param {Function} callback - 读卡成功回调
   * @param {Function} errorCallback - 读卡失败回调
   */
  startReading(callback, errorCallback) {
    //#ifdef APP-PLUS
    try {
      const context = plus.android.runtimeMainActivity()
      const nfcAdapter = plus.android.invoke('android.nfc.NfcAdapter', 'getDefaultAdapter', context)

      if (!nfcAdapter || !nfcAdapter.isEnabled()) {
        if (errorCallback) {
          errorCallback('NFC未启用，请先打开NFC功能')
        }
        return
      }

      // 创建NFC前台调度
      const intent = new plus.android.Intent('android.nfc.action.TAG_DISCOVERED')
      nfcAdapter.enableForegroundDispatch(context, intent, null, null)

      // 监听NFC卡片
      const onNewIntent = (intent) => {
        const tag = intent.getParcelableExtra('android.nfc.extra.TAG')
        if (tag) {
          const uid = this.extractUid(tag)
          this.currentCard = {
            uid: uid,
            timestamp: Date.now()
          }

          if (callback) {
            callback(uid)
          }

          // 清理前台调度
          nfcAdapter.disableForegroundDispatch(context)
        }
      }

      // 注册Intent监听
      plus.android.currentWebView().onActivityResult = (requestCode, resultCode, intent) => {
        if (intent) {
          onNewIntent(intent)
        }
      }

    } catch (error) {
      console.error('NFC读卡失败:', error)
      if (errorCallback) {
        errorCallback(error.message || '读卡失败')
      }
    }
    //#endif

    //#ifdef H5
    // H5环境模拟：随机生成一个UID
    const uid = this.generateMockUid()
    setTimeout(() => {
      if (callback) {
        callback(uid)
      }
    }, 2000)
    //#endif
  }

  /**
   * 停止NFC读卡
   */
  stopReading() {
    //#ifdef APP-PLUS
    const context = plus.android.runtimeMainActivity()
    const nfcAdapter = plus.android.invoke('android.nfc.NfcAdapter', 'getDefaultAdapter', context)
    if (nfcAdapter) {
      nfcAdapter.disableForegroundDispatch(context)
    }
    //#endif
  }

  /**
   * 提取NFC卡UID
   */
  //#ifdef APP-PLUS
  extractUid(tag) {
    try {
      const uidBytes = tag.getId()
      const uid = Array.from(uidBytes)
        .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
        .join('')
      return uid.toUpperCase()
    } catch (error) {
      console.error('提取UID失败:', error)
      return null
    }
  }
  //#endif

  /**
   * 生成模拟UID（H5环境）
   */
  //#ifdef H5
  generateMockUid() {
    const chars = '0123456789ABCDEF'
    let uid = ''
    for (let i = 0; i < 8; i++) {
      uid += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return uid
  }
  //#endif

  /**
   * 添加监听器
   */
  addListener(listener) {
    this.listeners.push(listener)
  }

  /**
   * 移除监听器
   */
  removeListener(listener) {
    const index = this.listeners.indexOf(listener)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  /**
   * 设置当前路线ID（用于扫码匹配）
   */
  setCurrentRoute(routeId) {
    this.currentRouteId = routeId
  }

  /**
   * 处理扫码结果（二维码和NFC统一处理）
   */
  async handleScanResult(scanResult, method = 'QRCODE') {
    try {
      let cardId, pointId

      if (method === 'QRCODE') {
        // 解析二维码
        const parseResult = qrCodeService.parse(scanResult)

        if (!parseResult.success) {
          return {
            success: false,
            error: parseResult.error,
            message: parseResult.message
          }
        }

        cardId = parseResult.cardId
        pointId = parseResult.pointId
      } else if (method === 'NFC') {
        // NFC直接返回卡ID
        cardId = scanResult
      }

      // 使用点位匹配服务
      if (!this.currentRouteId) {
        return {
          success: false,
          error: 'NO_ROUTE_SET',
          message: '未设置当前路线，无法匹配点位'
        }
      }

      const matchResult = await pointMatchingService.matchPoint(cardId, this.currentRouteId)

      if (matchResult.success) {
        return {
          success: true,
          point: matchResult.point,
          verificationMethod: method,
          cardId: cardId,
          pointId: pointId,
          fromCache: matchResult.fromCache
        }
      } else {
        return matchResult
      }
    } catch (error) {
      console.error('扫码处理失败:', error)
      return {
        success: false,
        error: 'SCAN_PROCESS_ERROR',
        message: '扫码处理失败：' + (error.message || '未知错误')
      }
    }
  }

  /**
   * 处理扫码成功回调
   */
  async onScanSuccess(scanResult, method = 'QRCODE') {
    // 防刷检查
    const limitCheck = antiSpamService.checkScanLimit()
    if (!limitCheck.allowed) {
      return {
        success: false,
        error: 'ANTI_SPAM',
        message: limitCheck.message
      }
    }

    // 记录扫码
    antiSpamService.recordScan(scanResult)

    // 处理扫码结果
    const result = await this.handleScanResult(scanResult, method)

    // 触发监听器
    this.listeners.forEach(listener => {
      listener(result)
    })

    return result
  }

  /**
   * 处理扫码错误回调
   */
  onScanError(error) {
    console.error('扫码错误:', error)

    // 触发监听器
    this.listeners.forEach(listener => {
      listener({
        success: false,
        error: 'SCAN_ERROR',
        message: error.message || '扫码失败',
        error: error
      })
    })
  }

  /**
   * 切换扫码模式
   */
  switchScanMode(mode) {
    this.scanMode = mode
    uni.setStorageSync('scan_mode', mode)
    uni.$emit('scanModeChanged', mode)

    console.log('扫码模式切换为:', mode)
  }

  /**
   * 获取当前扫码模式
   */
  getScanMode() {
    return this.scanMode
  }

  /**
   * 检查是否可以切换到NFC模式
   */
  canSwitchToNfc() {
    return this.isNfcSupported() && this.isNfcEnabled()
  }

  /**
   * 检查是否可以切换到扫码模式
   */
  canSwitchToQrCode() {
    return true // 扫码模式总是可用
  }

  /**
   * 获取扫码统计信息
   */
  getScanStats() {
    return antiSpamService.getScanStats()
  }

  /**
   * 获取扫码使用警告
   */
  getUsageWarning() {
    return antiSpamService.getUsageWarningMessage()
  }
}

// 单例模式
const nfcService = new NfcService()
export default nfcService
