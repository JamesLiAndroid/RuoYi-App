/**
 * 巡查项目服务类 - 处理巡查项目加载、保存和验证
 * 支持状态型、数值型、文本型三种项目类型
 */

import DatabaseService from '@/utils/DatabaseService'

class InspectionItemService {
  constructor() {
    this.db = DatabaseService
  }

  /**
   * 获取点位的巡查项目列表
   * @param {Number} pointId - 点位ID
   * @returns {Promise<Array>} - 巡查项目列表
   */
  async getItemsByPoint(pointId) {
    const sql = `
      SELECT *
      FROM inspection_item
      WHERE point_id = ?
        AND deleted = 0
      ORDER BY order_num ASC
    `

    try {
      const results = await this.db._query(sql, [pointId])
      return results || []
    } catch (error) {
      console.error('[InspectionItemService] 获取巡查项目失败:', error)
      throw error
    }
  }

  /**
   * 保存项目结果
   * @param {Object} itemResult - 项目结果对象
   * @returns {Promise<Number>} - 新插入的result_id
   */
  async saveItemResult(itemResult) {
    const {
      recordId,
      itemId,
      itemName,
      itemType,
      actualValue,
      isAbnormal = 0,
      abnormalRemark = null
    } = itemResult

    const sql = `
      INSERT INTO inspection_item_result (
        record_id, item_id, item_name, item_type,
        actual_value, is_abnormal, abnormal_remark,
        sync_status, deleted, create_time, update_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `

    try {
      await this.db._executeSQL(sql, [recordId, itemId, itemName, itemType, actualValue, isAbnormal, abnormalRemark])

      // 获取最后插入的ID
      const result = await this.db._query('SELECT last_insert_rowid() as id')
      return result[0].id
    } catch (error) {
      console.error('[InspectionItemService] 保存项目结果失败:', error)
      throw error
    }
  }

  /**
   * 批量保存项目结果
   * @param {Array<Object>} itemResults - 项目结果数组
   * @returns {Promise<Array<Number>>} - 新插入的result_id数组
   */
  async batchSaveItemResults(itemResults) {
    const resultIds = []

    for (const itemResult of itemResults) {
      const resultId = await this.saveItemResult(itemResult)
      resultIds.push(resultId)
    }

    return resultIds
  }

  /**
   * 更新项目结果
   * @param {Number} resultId - 结果ID
   * @param {Object} updates - 更新字段
   * @returns {Promise<Boolean>} - 是否成功
   */
  async updateItemResult(resultId, updates) {
    const fields = []
    const values = []

    // 动态构建UPDATE语句
    Object.keys(updates).forEach(key => {
      fields.push(`${key} = ?`)
      values.push(updates[key])
    })

    // 添加更新时间
    fields.push('update_time = datetime(\'now\', \'localtime\')')

    // 添加WHERE条件参数
    values.push(resultId)

    const sql = `
      UPDATE inspection_item_result
      SET ${fields.join(', ')}
      WHERE result_id = ?
    `

    try {
      await this.db._executeSQL(sql, values)
      return true
    } catch (error) {
      console.error('[InspectionItemService] 更新项目结果失败:', error)
      throw error
    }
  }

  /**
   * 获取记录的所有项目结果
   * @param {Number} recordId - 记录ID
   * @returns {Promise<Array>} - 项目结果列表
   */
  async getResultsByRecord(recordId) {
    const sql = `
      SELECT *
      FROM inspection_item_result
      WHERE record_id = ?
        AND deleted = 0
      ORDER BY create_time ASC
    `

    try {
      const results = await this.db._query(sql, [recordId])
      return results || []
    } catch (error) {
      console.error('[InspectionItemService] 获取项目结果失败:', error)
      throw error
    }
  }

  /**
   * 验证状态型项目
   * @param {Object} item - 项目定义
   * @param {String} value - 填写值
   * @returns {Object} - 验证结果 { valid, error, isAbnormal }
   */
  validateStatusItem(item, value) {
    // 必填项检查
    if (item.required && !value) {
      return {
        valid: false,
        error: '该项为必填项',
        isAbnormal: false
      }
    }

    // 选项验证
    const options = item.options ? item.options.split(',') : []
    if (value && !options.includes(value)) {
      return {
        valid: false,
        error: '请选择有效的选项',
        isAbnormal: false
      }
    }

    // 判断是否异常（假设包含"异常"、"故障"、"损坏"等关键词为异常）
    const abnormalKeywords = ['异常', '故障', '损坏', '失效', '泄漏', '破损']
    const isAbnormal = value && abnormalKeywords.some(keyword => value.includes(keyword))

    return {
      valid: true,
      error: null,
      isAbnormal: isAbnormal
    }
  }

  /**
   * 验证数值型项目
   * @param {Object} item - 项目定义
   * @param {String|Number} value - 填写值
   * @returns {Object} - 验证结果 { valid, error, isAbnormal }
   */
  validateNumericItem(item, value) {
    // 必填项检查
    if (item.required && (value === null || value === undefined || value === '')) {
      return {
        valid: false,
        error: '该项为必填项',
        isAbnormal: false
      }
    }

    // 数值格式检查
    const numValue = parseFloat(value)
    if (isNaN(numValue)) {
      return {
        valid: false,
        error: '请输入有效的数值',
        isAbnormal: false
      }
    }

    // 范围检查
    let isAbnormal = false
    if (item.minValue !== null && item.minValue !== undefined && numValue < item.minValue) {
      isAbnormal = true
    }
    if (item.maxValue !== null && item.maxValue !== undefined && numValue > item.maxValue) {
      isAbnormal = true
    }

    return {
      valid: true,
      error: null,
      isAbnormal: isAbnormal
    }
  }

  /**
   * 验证文本型项目
   * @param {Object} item - 项目定义
   * @param {String} value - 填写值
   * @returns {Object} - 验证结果 { valid, error, isAbnormal }
   */
  validateTextItem(item, value) {
    // 必填项检查
    if (item.required && !value) {
      return {
        valid: false,
        error: '该项为必填项',
        isAbnormal: false
      }
    }

    // 长度检查（最大500字符）
    if (value && value.length > 500) {
      return {
        valid: false,
        error: '文本内容不能超过500字符',
        isAbnormal: false
      }
    }

    // 文本型项目通常不判断异常，除非包含特定关键词
    const abnormalKeywords = ['异常', '故障', '损坏', '失效', '问题', '错误']
    const isAbnormal = value && abnormalKeywords.some(keyword => value.includes(keyword))

    return {
      valid: true,
      error: null,
      isAbnormal: isAbnormal
    }
  }

  /**
   * 验证项目结果
   * @param {Object} item - 项目定义
   * @param {String} value - 填写值
   * @returns {Object} - 验证结果
   */
  validateItem(item, value) {
    switch (item.itemType || item.item_type) {
      case 'status':
        return this.validateStatusItem(item, value)
      case 'numeric':
        return this.validateNumericItem(item, value)
      case 'text':
        return this.validateTextItem(item, value)
      default:
        return {
          valid: false,
          error: '未知的项目类型',
          isAbnormal: false
        }
    }
  }

  /**
   * 计算项目完成进度
   * @param {Array} items - 项目定义数组
   * @param {Array} results - 已填写结果数组
   * @returns {Object} - 进度信息 { total, completed, percentage }
   */
  calculateProgress(items, results) {
    const total = items.filter(item => item.required).length
    const completedItemIds = new Set(results.map(r => r.item_id))
    const completed = items.filter(item => item.required && completedItemIds.has(item.item_id)).length

    return {
      total: total,
      completed: completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 100
    }
  }

  /**
   * 获取未同步的项目结果
   * @returns {Promise<Array>} - 未同步结果列表
   */
  async getUnsyncedResults() {
    const sql = `
      SELECT *
      FROM inspection_item_result
      WHERE sync_status = 0
        AND deleted = 0
      ORDER BY create_time ASC
    `

    try {
      const results = await this.db._query(sql)
      return results || []
    } catch (error) {
      console.error('[InspectionItemService] 获取未同步项目结果失败:', error)
      throw error
    }
  }

  /**
   * 标记结果为已同步
   * @param {Number} resultId - 结果ID
   * @returns {Promise<Boolean>} - 是否成功
   */
  async markAsSynced(resultId) {
    return this.updateItemResult(resultId, { sync_status: 1 })
  }

  /**
   * 批量标记结果为已同步
   * @param {Array<Number>} resultIds - 结果ID数组
   * @returns {Promise<Boolean>} - 是否成功
   */
  async batchMarkAsSynced(resultIds) {
    if (!resultIds || resultIds.length === 0) {
      return true
    }

    const placeholders = resultIds.map(() => '?').join(',')
    const sql = `
      UPDATE inspection_item_result
      SET sync_status = 1,
          update_time = datetime('now', 'localtime')
      WHERE result_id IN (${placeholders})
    `

    try {
      await this.db._executeSQL(sql, resultIds)
      return true
    } catch (error) {
      console.error('[InspectionItemService] 批量标记项目结果为已同步失败:', error)
      throw error
    }
  }

  /**
   * 删除项目结果（软删除）
   * @param {Number} resultId - 结果ID
   * @returns {Promise<Boolean>} - 是否成功
   */
  async deleteResult(resultId) {
    return this.updateItemResult(resultId, { deleted: 1 })
  }

  /**
   * 统计异常项目数量
   * @param {Number} recordId - 记录ID
   * @returns {Promise<Number>} - 异常数量
   */
  async countAbnormalItems(recordId) {
    const sql = `
      SELECT COUNT(*) as count
      FROM inspection_item_result
      WHERE record_id = ?
        AND is_abnormal = 1
        AND deleted = 0
    `

    try {
      const results = await this.db._query(sql, [recordId])
      return results && results[0] ? results[0].count : 0
    } catch (error) {
      console.error('[InspectionItemService] 统计异常项目失败:', error)
      throw error
    }
  }
}

// 单例模式
const inspectionItemService = new InspectionItemService()
export default inspectionItemService
