/**
 * 备注管理服务
 * 功能：处理巡检记录的备注信息
 * 支持：添加备注、更新备注、删除备注、查询备注
 */

import { REMARK_MAX_LENGTH } from '@/constants/PointStatus'

class RemarkService {
  constructor() {
    this.db = null
  }

  /**
   * 初始化数据库
   */
  async initDatabase() {
    if (!this.db) {
      //#ifdef APP-PLUS
      this.db = plus.sqlite.openDatabaseSync({
        name: 'inspection.db'
      })
      //#endif

      //#ifdef H5
      this.db = 'sqlite'
      //#endif
    }
  }

  /**
   * 添加或更新备注
   * @param {number} recordId - 巡检记录ID
   * @param {string} remark - 备注内容
   * @returns {Object} 操作结果
   */
  async saveRemark(recordId, remark) {
    try {
      await this.initDatabase()

      // 验证备注内容
      const validation = this.validateRemark(remark)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        }
      }

      const now = new Date().toISOString()

      //#ifdef APP-PLUS
      // 更新巡检记录的备注字段
      await plus.sqlite.executeSqlSync({
        db: this.db,
        sql: `
          UPDATE inspection_record
          SET remark = ?, update_time = ?
          WHERE record_id = ?
        `,
        arguments: [remark, now, recordId]
      })
      //#endif

      //#ifdef H5
      // H5环境模拟
      console.log('H5模拟保存备注:', { recordId, remark })
      //#endif

      console.log('备注保存成功:', { recordId, remarkLength: remark.length })

      return {
        success: true,
        message: '备注保存成功'
      }

    } catch (error) {
      console.error('保存备注失败:', error)
      return {
        success: false,
        error: '保存备注失败: ' + (error.message || '未知错误')
      }
    }
  }

  /**
   * 获取备注内容
   * @param {number} recordId - 巡检记录ID
   * @returns {Object} 备注信息
   */
  async getRemark(recordId) {
    try {
      await this.initDatabase()

      //#ifdef APP-PLUS
      const result = plus.sqlite.selectSqlSync({
        db: this.db,
        sql: `
          SELECT remark, update_time
          FROM inspection_record
          WHERE record_id = ?
        `,
        arguments: [recordId]
      })

      if (result && result.length > 0) {
        return {
          success: true,
          remark: result[0].remark || '',
          updateTime: result[0].update_time
        }
      }
      //#endif

      //#ifdef H5
      return {
        success: true,
        remark: '',
        updateTime: null
      }
      //#endif

      return {
        success: true,
        remark: '',
        updateTime: null
      }

    } catch (error) {
      console.error('获取备注失败:', error)
      return {
        success: false,
        error: '获取备注失败: ' + (error.message || '未知错误')
      }
    }
  }

  /**
   * 删除备注
   * @param {number} recordId - 巡检记录ID
   * @returns {Object} 操作结果
   */
  async deleteRemark(recordId) {
    try {
      await this.initDatabase()

      const now = new Date().toISOString()

      //#ifdef APP-PLUS
      await plus.sqlite.executeSqlSync({
        db: this.db,
        sql: `
          UPDATE inspection_record
          SET remark = NULL, update_time = ?
          WHERE record_id = ?
        `,
        arguments: [now, recordId]
      })
      //#endif

      console.log('备注删除成功:', recordId)

      return {
        success: true,
        message: '备注删除成功'
      }

    } catch (error) {
      console.error('删除备注失败:', error)
      return {
        success: false,
        error: '删除备注失败: ' + (error.message || '未知错误')
      }
    }
  }

  /**
   * 验证备注内容
   * @param {string} remark - 备注内容
   * @returns {Object} 验证结果
   */
  validateRemark(remark) {
    // 检查是否为空
    if (!remark || remark.trim().length === 0) {
      return {
        valid: false,
        error: '备注内容不能为空'
      }
    }

    // 检查长度
    if (remark.length > REMARK_MAX_LENGTH) {
      return {
        valid: false,
        error: `备注内容不能超过${REMARK_MAX_LENGTH}个字符`
      }
    }

    return {
      valid: true
    }
  }

  /**
   * 批量获取备注（用于任务列表显示）
   * @param {number} taskId - 任务ID
   * @returns {Array} 备注列表
   */
  async getRemarksByTask(taskId) {
    try {
      await this.initDatabase()

      //#ifdef APP-PLUS
      const result = plus.sqlite.selectSqlSync({
        db: this.db,
        sql: `
          SELECT record_id, point_id, remark, update_time
          FROM inspection_record
          WHERE task_id = ? AND remark IS NOT NULL
          ORDER BY inspection_time DESC
        `,
        arguments: [taskId]
      })

      return result || []
      //#endif

      //#ifdef H5
      return []
      //#endif

    } catch (error) {
      console.error('批量获取备注失败:', error)
      return []
    }
  }
}

// 单例模式
const remarkService = new RemarkService()
export default remarkService
