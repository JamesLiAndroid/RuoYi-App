/**
 * 跳检管理服务
 * 功能：处理巡检点位的跳检操作
 * 支持：跳检记录保存、重新巡检、跳检统计、批量跳检
 */

import { PointStatus, SKIP_REASON_MAX_LENGTH } from '@/constants/PointStatus'

class SkipService {
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
   * 跳检点位
   * @param {Object} skipData - 跳检数据
   * @param {number} skipData.taskId - 任务ID
   * @param {number} skipData.pointId - 点位ID
   * @param {number} skipData.inspectorId - 巡检员ID
   * @param {string} skipData.skipReason - 跳检原因代码
   * @param {string} skipData.skipRemark - 跳检备注
   * @returns {Object} 操作结果
   */
  async skipPoint(skipData) {
    try {
      await this.initDatabase()

      const {
        taskId,
        pointId,
        inspectorId = 1,
        skipReason,
        skipRemark = null
      } = skipData

      // 验证跳检数据
      const validation = this.validateSkipData(skipData)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        }
      }

      const now = new Date().toISOString()

      //#ifdef APP-PLUS
      // 检查是否已有巡检记录
      const existingRecords = plus.sqlite.selectSqlSync({
        db: this.db,
        sql: `
          SELECT record_id, status
          FROM inspection_record
          WHERE task_id = ? AND point_id = ?
        `,
        arguments: [taskId, pointId]
      })

      if (existingRecords && existingRecords.length > 0) {
        // 已有记录，更新为跳检状态
        const recordId = existingRecords[0].record_id

        await plus.sqlite.executeSqlSync({
          db: this.db,
          sql: `
            UPDATE inspection_record
            SET status = ?, skip_reason = ?, skip_remark = ?, skip_time = ?, update_time = ?
            WHERE record_id = ?
          `,
          arguments: [PointStatus.SKIPPED, skipReason, skipRemark, now, now, recordId]
        })

        console.log('更新跳检记录成功:', { recordId, pointId, skipReason })

        return {
          success: true,
          recordId: recordId,
          message: '跳检记录更新成功'
        }
      } else {
        // 没有记录，插入新的跳检记录
        const result = plus.sqlite.executeSqlSync({
          db: this.db,
          sql: `
            INSERT INTO inspection_record (
              task_id, point_id, inspector_id, verification_method,
              status, skip_reason, skip_remark, skip_time,
              sync_status, create_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
          `,
          arguments: [
            taskId, pointId, inspectorId, 'SKIP',
            PointStatus.SKIPPED, skipReason, skipRemark, now, now
          ]
        })

        const recordId = result.id || this.getLastInsertRowId()

        console.log('插入跳检记录成功:', { recordId, pointId, skipReason })

        return {
          success: true,
          recordId: recordId,
          message: '跳检记录保存成功'
        }
      }
      //#endif

      //#ifdef H5
      const recordId = Date.now()
      console.log('H5模拟跳检:', { recordId, taskId, pointId, skipReason })
      return {
        success: true,
        recordId: recordId,
        message: '跳检记录保存成功'
      }
      //#endif

    } catch (error) {
      console.error('跳检操作失败:', error)
      return {
        success: false,
        error: '跳检操作失败: ' + (error.message || '未知错误')
      }
    }
  }

  /**
   * 重新巡检（清除跳检状态）
   * @param {number} recordId - 巡检记录ID
   * @returns {Object} 操作结果
   */
  async resetSkip(recordId) {
    try {
      await this.initDatabase()

      const now = new Date().toISOString()

      //#ifdef APP-PLUS
      // 检查记录状态
      const records = plus.sqlite.selectSqlSync({
        db: this.db,
        sql: `SELECT status FROM inspection_record WHERE record_id = ?`,
        arguments: [recordId]
      })

      if (!records || records.length === 0) {
        return {
          success: false,
          error: '记录不存在'
        }
      }

      if (records[0].status !== PointStatus.SKIPPED) {
        return {
          success: false,
          error: '只能重新巡检已跳检的点位'
        }
      }

      // 清除跳检状态，恢复为待巡检
      await plus.sqlite.executeSqlSync({
        db: this.db,
        sql: `
          UPDATE inspection_record
          SET status = ?, skip_reason = NULL, skip_remark = NULL, skip_time = NULL, update_time = ?
          WHERE record_id = ?
        `,
        arguments: [PointStatus.PENDING, now, recordId]
      })
      //#endif

      console.log('重新巡检成功:', recordId)

      return {
        success: true,
        message: '已清除跳检状态，可以重新巡检'
      }

    } catch (error) {
      console.error('重新巡检失败:', error)
      return {
        success: false,
        error: '重新巡检失败: ' + (error.message || '未知错误')
      }
    }
  }

  /**
   * 获取跳检统计信息
   * @param {number} taskId - 任务ID
   * @returns {Object} 统计信息
   */
  async getSkipStatistics(taskId) {
    try {
      await this.initDatabase()

      //#ifdef APP-PLUS
      // 统计跳检数量
      const skipCount = plus.sqlite.selectSqlSync({
        db: this.db,
        sql: `
          SELECT COUNT(*) as count
          FROM inspection_record
          WHERE task_id = ? AND status = ?
        `,
        arguments: [taskId, PointStatus.SKIPPED]
      })

      // 按原因统计
      const reasonStats = plus.sqlite.selectSqlSync({
        db: this.db,
        sql: `
          SELECT skip_reason, COUNT(*) as count
          FROM inspection_record
          WHERE task_id = ? AND status = ?
          GROUP BY skip_reason
        `,
        arguments: [taskId, PointStatus.SKIPPED]
      })

      return {
        success: true,
        totalSkipped: skipCount[0]?.count || 0,
        reasonBreakdown: reasonStats || []
      }
      //#endif

      //#ifdef H5
      return {
        success: true,
        totalSkipped: 0,
        reasonBreakdown: []
      }
      //#endif

    } catch (error) {
      console.error('获取跳检统计失败:', error)
      return {
        success: false,
        error: '获取统计失败: ' + (error.message || '未知错误')
      }
    }
  }

  /**
   * 获取跳检记录列表
   * @param {number} taskId - 任务ID
   * @returns {Array} 跳检记录列表
   */
  async getSkippedPoints(taskId) {
    try {
      await this.initDatabase()

      //#ifdef APP-PLUS
      const result = plus.sqlite.selectSqlSync({
        db: this.db,
        sql: `
          SELECT ir.record_id, ir.point_id, ir.skip_reason, ir.skip_remark, ir.skip_time,
                 p.point_name, p.point_code
          FROM inspection_record ir
          LEFT JOIN inspection_point p ON ir.point_id = p.point_id
          WHERE ir.task_id = ? AND ir.status = ?
          ORDER BY ir.skip_time DESC
        `,
        arguments: [taskId, PointStatus.SKIPPED]
      })

      return result || []
      //#endif

      //#ifdef H5
      return []
      //#endif

    } catch (error) {
      console.error('获取跳检记录失败:', error)
      return []
    }
  }

  /**
   * 批量跳检
   * @param {Array} skipDataList - 跳检数据列表
   * @returns {Object} 操作结果
   */
  async batchSkip(skipDataList) {
    try {
      await this.initDatabase()

      const results = []
      const errors = []

      //#ifdef APP-PLUS
      await plus.sqlite.executeSqlSync({
        db: this.db,
        sql: 'BEGIN TRANSACTION'
      })

      try {
        for (const skipData of skipDataList) {
          const result = await this.skipPoint(skipData)
          if (result.success) {
            results.push(result.recordId)
          } else {
            errors.push({
              pointId: skipData.pointId,
              error: result.error
            })
          }
        }

        await plus.sqlite.executeSqlSync({
          db: this.db,
          sql: 'COMMIT'
        })
      } catch (error) {
        await plus.sqlite.executeSqlSync({
          db: this.db,
          sql: 'ROLLBACK'
        })
        throw error
      }
      //#endif

      console.log(`批量跳检完成: 成功${results.length}个, 失败${errors.length}个`)

      return {
        success: errors.length === 0,
        successCount: results.length,
        errorCount: errors.length,
        errors: errors
      }

    } catch (error) {
      console.error('批量跳检失败:', error)
      return {
        success: false,
        error: '批量跳检失败: ' + (error.message || '未知错误')
      }
    }
  }

  /**
   * 验证跳检数据
   * @param {Object} skipData - 跳检数据
   * @returns {Object} 验证结果
   */
  validateSkipData(skipData) {
    const { taskId, pointId, skipReason, skipRemark } = skipData

    if (!taskId || !pointId) {
      return {
        valid: false,
        error: '任务ID和点位ID不能为空'
      }
    }

    if (!skipReason) {
      return {
        valid: false,
        error: '请选择跳检原因'
      }
    }

    if (skipRemark && skipRemark.length > SKIP_REASON_MAX_LENGTH) {
      return {
        valid: false,
        error: `跳检备注不能超过${SKIP_REASON_MAX_LENGTH}个字符`
      }
    }

    return {
      valid: true
    }
  }

  /**
   * 获取数据库最后插入的行ID（APP-PLUS）
   */
  //#ifdef APP-PLUS
  getLastInsertRowId() {
    try {
      const result = plus.sqlite.selectSqlSync({
        db: this.db,
        sql: 'SELECT last_insert_rowid() as id'
      })
      return result[0]?.id || 0
    } catch (error) {
      return 0
    }
  }
  //#endif
}

// 单例模式
const skipService = new SkipService()
export default skipService
