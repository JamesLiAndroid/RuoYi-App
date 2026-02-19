/**
 * 二维码服务类 - 解析和验证巡检二维码
 * 支持格式：INSPECT|P{point_id}|C{card_id}
 * 支持容错：大小写不敏感、老版本兼容、自动trim
 */

class QrCodeService {
  constructor() {
    this.lastScanTime = 0 // AC15: 防抖机制
  }

  /**
   * 解析二维码内容
   * @param {string} content - 二维码扫描内容
   * @returns {Object} 解析结果
   */
  parse(content) {
    try {
      // AC15: 防抖机制（500ms）
      const now = Date.now()
      if (now - this.lastScanTime < 500) {
        return {
          success: false,
          error: 'SCAN_TOO_FAST',
          message: '扫描过快，请稍后再试'
        }
      }
      this.lastScanTime = now

      // AC15: 超长二维码处理（限制200字符）
      if (content.length > 200) {
        return {
          success: false,
          error: 'CONTENT_TOO_LONG',
          message: '二维码内容过长，请检查二维码是否正确'
        }
      }

      // 容错处理：自动trim和大小写转换
      content = content.trim().toUpperCase()

      // AC15: 特殊字符过滤（保留字母、数字、分隔符）
      content = content.replace(/[^\w|,;]/g, '')

      // AC15: 多分隔符支持（统一转换为|）
      content = content.replace(/[,;]/g, '|')

      // 检查格式（大小写不敏感）
      if (!content.startsWith('INSPECT|') && !content.startsWith('INSPCT|')) {
        return {
          success: false,
          error: 'INVALID_PREFIX',
          message: '二维码格式不正确，必须以"INSPECT|"开头'
        }
      }

      // 支持多余字段：自动分割并取前3段
      const parts = content.split('|').slice(0, 3)
      if (parts.length < 2) {
        return {
          success: false,
          error: 'INVALID_FORMAT',
          message: '二维码格式不正确，应为：INSPECT|P点位ID|C卡ID'
        }
      }

      // 解析点位ID（支持P前缀或无前缀）
      const pointPart = parts[1]
      let pointId

      if (pointPart.startsWith('P') || pointPart.startsWith('p')) {
        pointId = parseInt(pointPart.substring(1), 10)
      } else {
        // 老版本兼容：直接是数字
        pointId = parseInt(pointPart, 10)
      }

      if (isNaN(pointId) || pointId <= 0) {
        return {
          success: false,
          error: 'INVALID_POINT_ID',
          message: '点位ID必须是正整数'
        }
      }

      // 解析卡ID
      const cardPart = parts[2]
      if (!cardPart || (!cardPart.startsWith('C') && !cardPart.startsWith('c'))) {
        return {
          success: false,
          error: 'MISSING_CARD_ID',
          message: '缺少卡ID字段，应以"C"开头'
        }
      }

      const cardId = cardPart.substring(1).toUpperCase()

      // 验证卡ID格式（十六进制，8-20位）
      if (!/^[0-9A-F]{8,20}$/.test(cardId)) {
        return {
          success: false,
          error: 'INVALID_CARD_ID_FORMAT',
          message: '卡ID必须是8-20位十六进制字符（0-9, A-F）'
        }
      }

      return {
        success: true,
        pointId: pointId,
        cardId: cardId,
        type: 'INSPECT',
        rawContent: content
      }
    } catch (error) {
      return {
        success: false,
        error: 'PARSE_ERROR',
        message: '解析二维码失败：' + (error.message || '未知错误')
      }
    }
  }

  /**
   * 生成测试二维码内容
   * @param {number} pointId - 点位ID
   * @param {string} cardId - 卡ID
   * @returns {string} 二维码内容
   */
  generate(pointId, cardId) {
    return `INSPECT|P${String(pointId).padStart(5, '0')}|C${cardId}`
  }

  /**
   * 验证二维码格式是否正确（不解析数据）
   * @param {string} content - 二维码内容
   * @returns {Object} 验证结果
   */
  validateFormat(content) {
    // 检查是否为空
    if (!content || content.trim() === '') {
      return {
        isValid: false,
        error: 'EMPTY',
        message: '请输入点位码'
      }
    }

    // 检查长度
    if (content.length > 50) {
      return {
        isValid: false,
        error: 'TOO_LONG',
        message: '点位码长度不能超过50个字符'
      }
    }

    // 检查格式（支持大小写和空格）
    const cleanValue = content.trim().toUpperCase()
    if (!cleanValue.startsWith('INSPECT|')) {
      return {
        isValid: false,
        error: 'INVALID_PREFIX',
        message: '点位码必须以"INSPECT|"开头（大小写不敏感）'
      }
    }

    // 检查字段数量（支持多余字段）
    const parts = cleanValue.split('|')
    if (parts.length < 2) {
      return {
        isValid: false,
        error: 'INVALID_FORMAT',
        message: '点位码格式不正确，应为：INSPECT|P点位ID|C卡ID'
      }
    }

    // 验证点位ID（支持P前缀或无前缀）
    const pointPart = parts[1]
    let pointId
    if (pointPart.startsWith('P') || pointPart.startsWith('p')) {
      pointId = parseInt(pointPart.substring(1), 10)
    } else {
      pointId = parseInt(pointPart, 10)
    }

    if (isNaN(pointId) || pointId <= 0) {
      return {
        isValid: false,
        error: 'INVALID_POINT_ID',
        message: '点位ID必须是正整数'
      }
    }

    // 验证卡ID（如果存在）
    if (parts.length >= 3 && parts[2]) {
      const cardPart = parts[2]
      if (!cardPart.startsWith('C')) {
        return {
          isValid: false,
          error: 'INVALID_CARD_ID_PREFIX',
          message: '卡ID必须以"C"开头'
        }
      }

      const cardId = cardPart.substring(1)
      if (!/^[0-9A-F]{8,20}$/.test(cardId)) {
        return {
          isValid: false,
          error: 'INVALID_CARD_ID_FORMAT',
          message: '卡ID必须是8-20位十六进制字符（0-9, A-F）'
        }
      }
    }

    return {
      isValid: true
    }
  }

  /**
   * 获取格式示例
   * @returns {string} 示例字符串
   */
  getFormatExample() {
    return 'INSPECT|P12345|C04A2B3C4D5E6F7'
  }

  /**
   * 解析错误代码转用户友好提示
   * @param {string} errorCode - 错误代码
   * @returns {string} 用户提示
   */
  getErrorMessage(errorCode) {
    const errorMessages = {
      'INVALID_PREFIX': '二维码格式不正确，必须以"INSPECT|"开头',
      'INVALID_FORMAT': '二维码格式不正确，应为：INSPECT|P点位ID|C卡ID',
      'INVALID_POINT_ID': '点位ID必须是正整数，例如：P12345',
      'MISSING_CARD_ID': '缺少卡ID字段，应以"C"开头',
      'INVALID_CARD_ID_FORMAT': '卡ID必须是8-20位十六进制字符（0-9, A-F）',
      'PARSE_ERROR': '解析二维码失败，请检查格式',
      'EMPTY': '请输入点位码',
      'TOO_LONG': '点位码长度不能超过50个字符',
      'INVALID_CARD_ID_PREFIX': '卡ID必须以"C"开头',
      'UNKNOWN': '未知错误'
    }

    return errorMessages[errorCode] || errorMessages['UNKNOWN']
  }
}

// 单例模式
const qrCodeService = new QrCodeService()
export default qrCodeService
