/**
 * NFC服务类 - 基于uni-app最佳实践重写
 * 参考：https://ask.dcloud.net.cn/article/35690
 */

import qrCodeService from './QrCodeService'
import pointMatchingService from './PointMatchingService'
import antiSpamService from './AntiSpamService'

class NfcService {
  constructor() {
    this.isSupported = false
    this.isEnabled = false
    this.currentCard = null
    this.platform = ''
    this.nfcAdapter = null
    this.pendingIntent = null
    this.intentFilters = []
    this.techLists = []
    this.readCallback = null
    this.errorCallback = null
    this.nfcPollingTimer = null // NFC轮询定时器
    this.readerModeEnabled = false // Reader Mode 是否已启用
    this.readerCallback = null // Reader Mode 回调

    // 扫码模式相关
    this.scanMode = uni.getStorageSync('scan_mode') || 'nfc'
    this.currentRouteId = null

    // 检测平台
    this.checkPlatform()

    //#ifdef APP-PLUS
    if (this.platform === 'android') {
      this.initNfc()
    }
    //#endif
  }

  /**
   * 检测平台
   */
  checkPlatform() {
    try {
      const systemInfo = uni.getSystemInfoSync()
      this.platform = systemInfo.platform || 'unknown'
      console.log('[NFC] 当前平台:', this.platform)
    } catch (error) {
      console.error('[NFC] 平台检测失败:', error)
      this.platform = 'unknown'
    }
  }

  /**
   * 初始化NFC
   */
  //#ifdef APP-PLUS
  initNfc() {
    try {
      const main = plus.android.runtimeMainActivity()
      const NfcAdapter = plus.android.importClass('android.nfc.NfcAdapter')

      this.nfcAdapter = NfcAdapter.getDefaultAdapter(main)

      if (!this.nfcAdapter) {
        console.log('[NFC] 设备不支持NFC')
        this.isSupported = false
        return
      }

      this.isSupported = true
      this.isEnabled = plus.android.invoke(this.nfcAdapter, 'isEnabled')

      console.log('[NFC] 初始化成功, 支持:', this.isSupported, ', 启用:', this.isEnabled)

      // 创建PendingIntent
      this.createPendingIntent()

      // 创建IntentFilter
      this.createIntentFilters()

    } catch (error) {
      console.error('[NFC] 初始化失败:', error)
      this.isSupported = false
    }
  }
  //#endif

  /**
   * 创建PendingIntent
   */
  //#ifdef APP-PLUS
  createPendingIntent() {
    try {
      const main = plus.android.runtimeMainActivity()
      const Intent = plus.android.importClass('android.content.Intent')
      const PendingIntent = plus.android.importClass('android.app.PendingIntent')

      const intent = new Intent(main, main.getClass())
      intent.addFlags(0x20000000) // Intent.FLAG_ACTIVITY_SINGLE_TOP

      // 根据Android版本设置flags
      const Build = plus.android.importClass('android.os.Build')
      let flags = 0
      if (Build.VERSION.SDK_INT >= 31) {
        flags = 0x04000000 // PendingIntent.FLAG_IMMUTABLE
      }

      this.pendingIntent = PendingIntent.getActivity(main, 0, intent, flags)
      console.log('[NFC] PendingIntent创建成功')

    } catch (error) {
      console.error('[NFC] PendingIntent创建失败:', error)
    }
  }
  //#endif

  /**
   * 创建IntentFilter
   */
  //#ifdef APP-PLUS
  createIntentFilters() {
    try {
      const IntentFilter = plus.android.importClass('android.content.IntentFilter')
      const NfcAdapter = plus.android.importClass('android.nfc.NfcAdapter')

      // 创建3个过滤器
      const filter1 = new IntentFilter(NfcAdapter.ACTION_TAG_DISCOVERED)
      const filter2 = new IntentFilter(NfcAdapter.ACTION_TECH_DISCOVERED)
      const filter3 = new IntentFilter(NfcAdapter.ACTION_NDEF_DISCOVERED)

      // 转换为Java数组
      this.intentFilters = [filter1, filter2, filter3]

      console.log('[NFC] IntentFilter创建成功')

    } catch (error) {
      console.error('[NFC] IntentFilter创建失败:', error)
      this.intentFilters = []
    }
  }
  //#endif

  /**
   * 检查NFC是否可用
   */
  isNfcAvailable() {
    //#ifdef APP-PLUS
    if (this.platform === 'android' && this.nfcAdapter) {
      this.isEnabled = plus.android.invoke(this.nfcAdapter, 'isEnabled')
      return this.isSupported && this.isEnabled
    }
    //#endif
    return false
  }

  /**
   * 检查设备是否支持NFC（不检查是否启用）
   */
  isNfcSupported() {
    //#ifdef APP-PLUS
    if (this.platform === 'android') {
      return this.isSupported
    }
    //#endif
    return false
  }

  /**
   * 开始NFC读取
   */
  startReading(callback, errorCallback) {
    console.log('[NFC] 开始NFC读取')

    this.readCallback = callback
    this.errorCallback = errorCallback

    //#ifdef APP-PLUS
    if (this.platform !== 'android') {
      const error = '当前平台不支持NFC'
      console.error('[NFC]', error)
      if (errorCallback) errorCallback(error)
      return
    }

    if (!this.isNfcAvailable()) {
      const error = 'NFC未启用或不可用'
      console.error('[NFC]', error)
      if (errorCallback) errorCallback(error)

      // 提示用户开启NFC
      uni.showModal({
        title: 'NFC未启用',
        content: '请在系统设置中开启NFC功能',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) {
            this.openNfcSettings()
          }
        }
      })
      return
    }

    console.log('[NFC] NFC适配器可用，启动读卡模式')

    // 尝试使用 Reader Mode API（Android 4.4+，更可靠）
    const readerModeSuccess = this.enableReaderMode(callback, errorCallback)

    if (readerModeSuccess) {
      console.log('[NFC] 使用 Reader Mode API')
    } else {
      console.log('[NFC] Reader Mode 不可用，使用轮询检测')
      // 降级方案：使用轮询
      this.checkCurrentIntent(callback, errorCallback)
      this.startPollingForNfc(callback, errorCallback)
    }

    //#endif
  }

  /**
   * 启用 Reader Mode API（Android 4.4+）
   * 这是更可靠的 NFC 读取方式，不需要处理复杂的 Intent 机制
   * @returns {boolean} 是否成功启用
   */
  //#ifdef APP-PLUS
  enableReaderMode(callback, errorCallback) {
    try {
      console.log('[NFC] 尝试启用 Reader Mode API')

      const main = plus.android.runtimeMainActivity()
      const NfcAdapter = plus.android.importClass('android.nfc.NfcAdapter')

      // 检查 Android 版本是否支持 Reader Mode (API 19+, Android 4.4+)
      const Build = plus.android.importClass('android.os.Build')
      if (Build.VERSION.SDK_INT < 19) {
        console.log('[NFC] Android 版本过低，不支持 Reader Mode')
        return false
      }

      // 创建 ReaderCallback 接口实现
      const ReaderCallback = plus.android.implements('android.nfc.NfcAdapter$ReaderCallback', {
        onTagDiscovered: (tag) => {
          console.log('[NFC] Reader Mode 检测到标签!')

          // 读取 UID
          const uid = this.getTagId(tag)

          if (uid) {
            console.log('[NFC] Reader Mode 读取 UID 成功:', uid)

            this.currentCard = {
              uid: uid,
              timestamp: Date.now()
            }

            if (callback) {
              callback(uid)
            }

            // 停止读取
            this.stopReading()
          } else {
            console.error('[NFC] Reader Mode 读取 UID 失败')
            if (errorCallback) {
              errorCallback('读取UID失败')
            }
          }
        }
      })

      // Reader Mode 标志
      // FLAG_READER_NFC_A: 支持 NFC-A (ISO 14443-3A)
      // FLAG_READER_SKIP_NDEF_CHECK: 跳过 NDEF 检查，加快读取速度
      const FLAG_READER_NFC_A = 0x1
      const FLAG_READER_SKIP_NDEF_CHECK = 0x80
      const flags = FLAG_READER_NFC_A | FLAG_READER_SKIP_NDEF_CHECK

      // 启用 Reader Mode
      plus.android.invoke(
        this.nfcAdapter,
        'enableReaderMode',
        main,
        ReaderCallback,
        flags,
        null  // extras
      )

      console.log('[NFC] Reader Mode 已启用')
      this.readerModeEnabled = true
      this.readerCallback = ReaderCallback

      return true

    } catch (error) {
      console.error('[NFC] 启用 Reader Mode 失败:', error)
      console.error('[NFC] 错误详情:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
      return false
    }
  }
  //#endif

  /**
   * 禁用 Reader Mode
   */
  //#ifdef APP-PLUS
  disableReaderMode() {
    try {
      if (!this.readerModeEnabled || !this.nfcAdapter) {
        return
      }

      const main = plus.android.runtimeMainActivity()
      plus.android.invoke(this.nfcAdapter, 'disableReaderMode', main)

      this.readerModeEnabled = false
      this.readerCallback = null

      console.log('[NFC] Reader Mode 已禁用')

    } catch (error) {
      console.error('[NFC] 禁用 Reader Mode 失败:', error)
    }
  }
  //#endif

  /**
   * 检查当前Intent（应用启动或恢复时可能已经有NFC Intent）
   */
  //#ifdef APP-PLUS
  checkCurrentIntent(callback, errorCallback) {
    console.log('[NFC] 检查当前Intent')

    try {
      const main = plus.android.runtimeMainActivity()
      const intent = plus.android.invoke(main, 'getIntent')

      if (!intent) {
        console.log('[NFC] 当前Intent为空')
        return
      }

      const action = plus.android.invoke(intent, 'getAction')
      console.log('[NFC] Intent Action:', action)

      // 检查是否是NFC相关的Intent
      if (action && action.startsWith('android.nfc.action.')) {
        console.log('[NFC] 检测到NFC Intent，立即处理')
        this.processNfcIntent(intent, callback, errorCallback)
      } else {
        console.log('[NFC] Intent Action不是NFC相关:', action)
      }
    } catch (error) {
      console.error('[NFC] 检查当前Intent失败:', error)
    }
  }
  //#endif

  /**
   * 启动NFC轮询检测
   * 因为plus.globalEvent的newintent事件不可靠（Intent.getAction()返回null）
   * 采用主动轮询的方式检测Intent变化
   */
  //#ifdef APP-PLUS
  startPollingForNfc(callback, errorCallback) {
    console.log('[NFC] 启动轮询检测模式')

    // 清除之前的轮询
    if (this.nfcPollingTimer) {
      clearInterval(this.nfcPollingTimer)
    }

    let lastIntentHash = null

    // 每500ms检查一次Intent（优化性能和电池续航）
    this.nfcPollingTimer = setInterval(() => {
      try {
        const main = plus.android.runtimeMainActivity()
        const intent = plus.android.invoke(main, 'getIntent')

        if (!intent) {
          return
        }

        // 计算Intent的简单哈希（用于检测Intent是否变化）
        const action = plus.android.invoke(intent, 'getAction')
        const dataString = plus.android.invoke(intent, 'getDataString')
        const intentHash = action + '_' + dataString

        // 如果Intent没有变化，跳过
        if (intentHash === lastIntentHash) {
          return
        }

        lastIntentHash = intentHash
        console.log('[NFC] 检测到Intent变化，Action:', action)

        // 检查是否是NFC相关的Intent
        if (action && action.startsWith('android.nfc.action.')) {
          console.log('[NFC] 检测到NFC Action，尝试处理')
          const success = this.processNfcIntent(intent, callback, errorCallback)
          if (success) {
            // 成功读取，停止轮询
            this.stopReading()
          }
        }
      } catch (error) {
        console.error('[NFC] 轮询检测失败:', error)
      }
    }, 500)

    console.log('[NFC] NFC轮询检测已启动，请靠近NFC卡片')
  }
  //#endif

  /**
   * 处理NFC Intent，提取TAG和UID
   * @returns {boolean} 是否成功处理
   */
  //#ifdef APP-PLUS
  processNfcIntent(intent, callback, errorCallback) {
    try {
      if (!intent) {
        console.warn('[NFC] Intent为空')
        return false
      }

      // 获取Tag
      const NfcAdapter = plus.android.importClass('android.nfc.NfcAdapter')
      const tag = plus.android.invoke(intent, 'getParcelableExtra', NfcAdapter.EXTRA_TAG)

      if (!tag) {
        console.warn('[NFC] 无法获取Tag')
        if (errorCallback) {
          errorCallback('无法读取NFC标签')
        }
        return false
      }

      console.log('[NFC] 成功获取Tag对象')

      // 读取UID
      const uid = this.getTagId(tag)

      if (uid) {
        console.log('[NFC] 读取UID成功:', uid)

        this.currentCard = {
          uid: uid,
          timestamp: Date.now()
        }

        if (callback) {
          callback(uid)
        }

        return true
      } else {
        console.error('[NFC] 读取UID失败')
        if (errorCallback) {
          errorCallback('读取UID失败')
        }
        return false
      }

    } catch (error) {
      console.error('[NFC] 处理NFC Intent失败:', error)
      console.error('[NFC] 错误详情:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
      if (errorCallback) {
        errorCallback('处理NFC事件失败: ' + error.message)
      }
      return false
    }
  }
  //#endif

  /**
   * 启用前台分发
   * 注意：当前未使用此方法，优先使用Reader Mode API
   * 保留此方法作为备用方案
   */
  //#ifdef APP-PLUS
  enableForegroundDispatch() {
    try {
      const main = plus.android.runtimeMainActivity()

      if (!this.nfcAdapter || !this.pendingIntent) {
        console.error('[NFC] NFC适配器或PendingIntent未初始化')
        return
      }

      // 直接传null作为filters和techLists，这样会接收所有NFC标签
      // 这是最简单可靠的方式
      plus.android.invoke(this.nfcAdapter, 'enableForegroundDispatch', main, this.pendingIntent, null, null)

      console.log('[NFC] 前台分发已启用（接收所有NFC标签）')

    } catch (error) {
      console.error('[NFC] 启用前台分发失败:', error)
    }
  }
  //#endif

  /**
   * 开始监听NFC事件
   * 使用自定义的 onNewIntent 监听器来正确处理 Intent
   * 注意：当前未使用此方法，优先使用Reader Mode API
   * 保留此方法作为备用方案
   */
  //#ifdef APP-PLUS
  startListening() {
    // 先移除旧的监听器
    this.stopListening()

    try {
      const main = plus.android.runtimeMainActivity()

      // 创建一个 Java 接口实现，用于监听 onNewIntent
      // 这样可以直接获取到新的 Intent 对象
      const ActivityListener = plus.android.implements('io.dcloud.feature.internal.reflect.JavaInterface', {
        onNewIntent: (intent) => {
          console.log('[NFC] onNewIntent 回调触发')

          // 手动更新 Activity 的 Intent
          plus.android.invoke(main, 'setIntent', intent)

          // 处理 NFC Intent
          const action = plus.android.invoke(intent, 'getAction')
          console.log('[NFC] 新 Intent Action:', action)

          if (action && action.startsWith('android.nfc.action.')) {
            console.log('[NFC] 检测到 NFC Action，处理中...')
            this.processNfcIntent(intent, this.readCallback, this.errorCallback)
            this.stopReading()
          }
        }
      })

      // 注册监听器
      plus.android.invoke(main, 'setOnNewIntentListener', ActivityListener)
      console.log('[NFC] 已注册 onNewIntent 监听器')

    } catch (error) {
      console.error('[NFC] 注册监听器失败:', error)

      // 降级方案：使用 globalEvent
      plus.globalEvent.addEventListener('newintent', this.onNewIntent.bind(this))
      console.log('[NFC] 使用 globalEvent 作为降级方案')
    }
  }
  //#endif

  /**
   * 处理newintent事件
   */
  //#ifdef APP-PLUS
  onNewIntent() {
    console.log('[NFC] newintent事件触发')

    try {
      const main = plus.android.runtimeMainActivity()
      const intent = main.getIntent()

      if (!intent) {
        console.warn('[NFC] 无法获取Intent')
        return
      }

      // 获取action
      const action = plus.android.invoke(intent, 'getAction')
      console.log('[NFC] Action:', action)

      // 检查是否是NFC action
      if (!action || !action.startsWith('android.nfc.action.')) {
        console.log('[NFC] 非NFC action')
        return
      }

      // 获取Tag
      const NfcAdapter = plus.android.importClass('android.nfc.NfcAdapter')
      const tag = plus.android.invoke(intent, 'getParcelableExtra', NfcAdapter.EXTRA_TAG)

      if (!tag) {
        console.warn('[NFC] 无法获取Tag')
        if (this.errorCallback) {
          this.errorCallback('无法读取NFC标签')
        }
        return
      }

      console.log('[NFC] 成功获取Tag对象')

      // 读取UID
      const uid = this.getTagId(tag)

      if (uid) {
        console.log('[NFC] 读取UID成功:', uid)

        this.currentCard = {
          uid: uid,
          timestamp: Date.now()
        }

        if (this.readCallback) {
          this.readCallback(uid)
        }

        // 停止读取
        this.stopReading()
      } else {
        console.error('[NFC] 读取UID失败')
        if (this.errorCallback) {
          this.errorCallback('读取UID失败')
        }
      }

    } catch (error) {
      console.error('[NFC] 处理newintent失败:', error)
      if (this.errorCallback) {
        this.errorCallback('处理NFC事件失败: ' + error.message)
      }
    }
  }
  //#endif

  /**
   * 获取Tag ID (优先使用正序UID)
   */
  //#ifdef APP-PLUS
  getTagId(tag) {
    try {
      console.log('[NFC] 开始读取卡片数据')

      // 1. 先尝试读取NDEF数据中的序列号
      const serialNumber = this.readNdefSerialNumber(tag)
      if (serialNumber) {
        console.log('[NFC] 成功从NDEF读取序列号:', serialNumber)
        return serialNumber
      }

      // 2. 读取UID（正序）
      console.log('[NFC] NDEF读取失败，使用UID（正序）')
      const uid = this.readUid(tag)

      if (uid) {
        console.log('[NFC] 读取UID（正序）成功:', uid)
        return uid
      }

      console.error('[NFC] 无法读取卡片数据')
      return null

    } catch (error) {
      console.error('[NFC] 获取Tag ID失败:', error)
      console.error('[NFC] 错误详情:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
      return null
    }
  }
  //#endif

  /**
   * 从NDEF数据中读取序列号
   */
  //#ifdef APP-PLUS
  readNdefSerialNumber(tag) {
    try {
      console.log('[NFC] 尝试读取NDEF数据')

      // 导入相关类
      const Ndef = plus.android.importClass('android.nfc.tech.Ndef')
      const NdefRecord = plus.android.importClass('android.nfc.NdefRecord')

      // 获取Ndef技术对象
      const ndef = plus.android.invoke(Ndef, 'get', tag)

      if (!ndef) {
        console.log('[NFC] 卡片不支持NDEF格式')
        return null
      }

      // 连接到标签
      plus.android.invoke(ndef, 'connect')
      console.log('[NFC] 已连接到NDEF标签')

      // 读取NDEF消息
      const ndefMessage = plus.android.invoke(ndef, 'getNdefMessage')

      if (!ndefMessage) {
        console.log('[NFC] NDEF消息为空')
        plus.android.invoke(ndef, 'close')
        return null
      }

      // 获取NDEF记录
      const records = plus.android.invoke(ndefMessage, 'getRecords')

      if (!records || records.length === 0) {
        console.log('[NFC] NDEF记录为空')
        plus.android.invoke(ndef, 'close')
        return null
      }

      console.log('[NFC] NDEF记录数量:', records.length)

      // 遍历记录，查找文本记录
      for (let i = 0; i < records.length; i++) {
        const record = records[i]
        const tnf = plus.android.invoke(record, 'getTnf')

        // TNF_WELL_KNOWN = 0x01
        if (tnf === 0x01) {
          const type = plus.android.invoke(record, 'getType')

          // RTD_TEXT = "T" 的字节数组
          // 检查是否是文本记录
          if (type && type.length > 0 && type[0] === 0x54) { // 'T' = 0x54
            const payload = plus.android.invoke(record, 'getPayload')

            if (payload && payload.length > 0) {
              // 文本记录格式：
              // 第一个字节是状态字节（包含语言代码长度）
              const languageCodeLength = payload[0] & 0x3F

              // 防御性检查：确保payload长度足够
              if (payload.length < 1 + languageCodeLength) {
                console.warn('[NFC] NDEF payload长度不足，跳过此记录')
                continue
              }

              // 跳过状态字节和语言代码，提取文本
              const textBytes = []
              for (let j = 1 + languageCodeLength; j < payload.length; j++) {
                textBytes.push(payload[j])
              }

              // 防御性检查：确保有文本内容
              if (textBytes.length === 0) {
                console.warn('[NFC] NDEF文本内容为空，跳过此记录')
                continue
              }

              // 转换为字符串
              const String = plus.android.importClass('java.lang.String')
              const serialNumber = plus.android.newObject(String, textBytes, 'UTF-8')

              console.log('[NFC] 从NDEF文本记录读取到:', serialNumber)
              plus.android.invoke(ndef, 'close')
              return serialNumber
            }
          }
        }
      }

      plus.android.invoke(ndef, 'close')
      console.log('[NFC] 未找到有效的文本记录')
      return null

    } catch (error) {
      console.error('[NFC] 读取NDEF数据失败:', error)
      console.error('[NFC] 错误详情:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
      return null
    }
  }
  //#endif

  /**
   * 读取卡片UID（正序）
   */
  //#ifdef APP-PLUS
  readUid(tag) {
    try {
      // 使用 plus.android.invoke 调用 Java 方法
      const idBytes = plus.android.invoke(tag, 'getId')

      if (!idBytes || idBytes.length === 0) {
        console.error('[NFC] Tag ID为空')
        return null
      }

      // 将字节数组转换为16进制字符串（正序）
      let uid = ''
      for (let i = 0; i < idBytes.length; i++) {
        const byte = idBytes[i] & 0xFF
        const hex = byte.toString(16).toUpperCase()
        uid += (hex.length === 1 ? '0' + hex : hex)
      }

      return uid

    } catch (error) {
      console.error('[NFC] 读取UID失败:', error)
      return null
    }
  }
  //#endif

  /**
   * 停止NFC读取
   */
  stopReading() {
    console.log('[NFC] 停止NFC读取')

    //#ifdef APP-PLUS
    try {
      // 禁用 Reader Mode
      if (this.readerModeEnabled) {
        this.disableReaderMode()
      }

      // 清除轮询定时器
      if (this.nfcPollingTimer) {
        clearInterval(this.nfcPollingTimer)
        this.nfcPollingTimer = null
        console.log('[NFC] NFC轮询检测已停止')
      }

      // 清空回调
      this.readCallback = null
      this.errorCallback = null
    } catch (error) {
      console.error('[NFC] stopReading失败:', error)
    }
    //#endif
  }

  /**
   * 停止监听NFC事件
   */
  //#ifdef APP-PLUS
  stopListening() {
    try {
      plus.globalEvent.removeEventListener('newintent', this.onNewIntent.bind(this))
      console.log('[NFC] 停止监听newintent事件')
    } catch (error) {
      console.error('[NFC] 停止监听失败:', error)
    }
  }
  //#endif

  /**
   * 禁用前台分发
   * 注意：当前未使用此方法，优先使用Reader Mode API
   * 保留此方法作为备用方案
   */
  //#ifdef APP-PLUS
  disableForegroundDispatch() {
    try {
      if (!this.nfcAdapter) {
        return
      }

      const main = plus.android.runtimeMainActivity()
      plus.android.invoke(this.nfcAdapter, 'disableForegroundDispatch', main)

      console.log('[NFC] 前台分发已禁用')

    } catch (error) {
      console.error('[NFC] 禁用前台分发失败:', error)
    }
  }
  //#endif

  /**
   * 打开NFC设置
   */
  openNfcSettings() {
    //#ifdef APP-PLUS
    try {
      const Intent = plus.android.importClass('android.content.Intent')
      const Settings = plus.android.importClass('android.provider.Settings')

      const intent = new Intent(Settings.ACTION_NFC_SETTINGS)
      const main = plus.android.runtimeMainActivity()
      main.startActivity(intent)

    } catch (error) {
      console.error('[NFC] 打开NFC设置失败:', error)
      uni.showToast({
        title: '无法打开NFC设置',
        icon: 'none'
      })
    }
    //#endif
  }

  /**
   * 检查NFC是否启用（兼容旧版本API）
   */
  isNfcEnabled() {
    return this.isNfcAvailable()
  }

  /**
   * 获取当前扫码模式
   */
  getScanMode() {
    return this.scanMode
  }

  /**
   * 切换扫码模式
   */
  switchScanMode(mode) {
    this.scanMode = mode
    uni.setStorageSync('scan_mode', mode)
    uni.$emit('scanModeChanged', mode)
    console.log('[NFC] 扫码模式切换为:', mode)
    return true
  }

  /**
   * AC10: 启动时检测NFC状态并返回建议
   */
  getStartupRecommendation() {
    if (!this.isSupported) {
      return { action: 'auto_qrcode', message: '设备不支持NFC，将使用二维码扫描' }
    }
    if (!this.isEnabled) {
      return { action: 'prompt_choice', message: '检测到NFC未开启，请选择验证方式' }
    }
    return { action: 'use_nfc', message: 'NFC已就绪' }
  }

  /**
   * 设置当前路线ID
   */
  setCurrentRoute(routeId) {
    this.currentRouteId = routeId
    console.log('[NFC] 设置当前路线ID:', routeId)
  }

  /**
   * 处理扫码成功（二维码扫描）
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
}

// 单例模式
const nfcService = new NfcService()
export default nfcService
