/**
 * 跳检验证服务
 * 功能：验证跳检操作的业务规则
 * 包括：状态转换验证、顺序验证、配置验证
 */

import { PointStatus } from '@/constants/PointStatus'

class SkipValidationService {
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
   * 验证是否可以跳检
   * @param {number} taskId - 任务ID
   * @param {number} pointId - 点位ID
   * @returns {Object} 验证结果
   */
  async canSkipPoint(taskId, pointId) {
    try {
      await this.initDatabase()

      //#ifdef APP-PLUS
      // 检查点位当前状态
      const records = plus.sqlite.selectSqlSync({
        db: this.db,
        sql: `
          SELECT record_id, status, inspection_time
          FROM inspection_record
          WHERE task_id = ? AND point_id = ?
        `,
        arguments: [taskId, pointId]
      })

      if (records && records.length > 0) {
        const record = records[0]

        // 已完成的点位不能跳检
        if (record.status === PointStatus.COMPLETED && record.inspection_time) {
          return {
            valid: false,
            error: '该点位已完成巡检，不能跳检'
          }
        }

        // 已跳检的点位可以重复跳检（更新原因）
        if (record.status === PointStatus.SKIPPED) {
          return {
            valid: true,
            message: '可以更新跳检原因',
            isUpdate: true
          }
        }
      }

      // 待巡检的点位可以跳检
      return {
        valid: true,
        message: '可以跳检',
        isUpdate: false
      }
      //#endif

      //#ifdef H5
      return {
        valid: true,
        message: '可以跳检',
        isUpdate: false
      }
      //#endif

    } catch (error) {
      console.error('验证跳检权限失败:', error)
      return {
        valid: false,
        error: '验证失败: ' + (error.message || '未知错误')
      }
    }
  }

  /**
   * 验证是否可以重新巡检
   * @param {number} recordId - 巡检记录ID
   * @returns {Object} 验证结果
   */
  async canResetSkip(recordId) {
    try {
      await this.initDatabase()

      //#ifdef APP-PLUS
      const records = plus.sqlite.selectSqlSync({
        db: this.db,
        sql: `SELECT status, sync_status FROM inspection_record WHERE record_id = ?`,
        arguments: [recordId]
      })

      if (!records || records.length === 0) {
        return {
          valid: false,
          error: '记录不存在'
        }
      }

      const record = records[0]

      // 只有跳检状态才能重新巡检
      if (record.status !== PointStatus.SKIPPED) {
        return {
          valid: false,
          error: '只能重新巡检已跳检的点位'
        }
      }

      // 已同步的记录不能重新巡检（可选限制）
      if (record.sync_status === 'SYNCED') {
        return {
          valid: false,
          error: '该记录已同步到服务器，不能重新巡检'
        }
      }

      return {
        valid: true,
        message: '可以重新巡检'
      }
      //#endif

      //#ifdef H5
      return {
        valid: true,
        message: '可以重新巡检'
      }
      //#endif

    } catch (error) {
      console.error('验证重新巡检权限失败:', error)
      return {
        valid: false,
        error: '验证失败: ' + (error.message || '未知错误')
      }
    }
  }

  /**
   * 验证路线配置是否允许跳检
   * @param {number} routeId - 路线ID
   * @returns {Object} 验证结果
   */
  async checkRouteSkipConfig(routeId) {
    try {
      await this.initDatabase()

      //#ifdef APP-PLUS
      // 查询路线配置
      const routes = plus.sqlite.selectSqlSync({
        db: this.db,
        sql: `SELECT allow_skip FROM inspection_route WHERE route_id = ?`,
        arguments: [routeId]
      })

      if (!routes || routes.length === 0) {
        return {
          valid: false,
          error: '路线不存在'
        }
      }

      // 检查是否允许跳检（字段可能不存在，默认允许）
      const allowSkip = routes[0].allow_skip !== undefined ? routes[0].allow_skip : true

      if (!allowSkip) {
        return {
          valid: false,
          error: '该路线配置不允许跳检'
        }
      }

      return {
        valid: true,
        message: '路线允许跳检'
      }
      //#endif

      //#ifdef H5
      return {
        valid: true,
        message: '路线允许跳检'
      }
      //#endif

    } catch (error) {
      console.error('检查路线配置失败:', error)
      // 如果查询失败，默认允许跳检
      return {
        valid: true,
        message: '默认允许跳检'
      }
    }
  }

  /**
   * 检查跳检比例限制
   * @param {number} taskId - 任务ID
   * @returns {Object} 检查结果
   */
  async checkSkipRatio(taskId) {
    try {
      await this.initDatabase()

      //#ifdef APP-PLUS
      // 统计任务的点位总数和已跳检数量
      const stats = plus.sqlite.selectSqlSync({
        db: this.db,
        sql: `
          SELECT
            COUNT(*) as total_points,
            SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as skipped_points
          FROM inspection_record
          WHERE task_id = ?
        `,
        arguments: [PointStatus.SKIPPED, taskId]
      })

      if (stats && stats.length > 0) {
        const totalPoints = stats[0].total_points || 0
        const skippedPoints = stats[0].skipped_points || 0

        if (totalPoints === 0) {
          return {
            valid: true,
            ratio: 0,
            message: '无点位数据'
          }
        }

        const skipRatio = (skippedPoints / totalPoints) * 100

        // 跳检比例超过50%时给出警告
        if (skipRatio > 50) {
          return {
            valid: false,
            ratio: skipRatio.toFixed(2),
            error: `跳检比例过高（${skipRatio.toFixed(2)}%），建议重新安排巡检任务`
          }
        }

        return {
          valid: true,
          ratio: skipRatio.toFixed(2),
          message: `跳检比例正常（${skipRatio.toFixed(2)}%）`
        }
      }
      //#endif

      //#ifdef H5
      return {
        valid: true,
        ratio: 0,
        message: '跳检比例正常'
      }
      //#endif

      return {
        valid: true,
        ratio: 0,
        message: '跳检比例正常'
      }

    } catch (error) {
      console.error('检查跳检比例失败:', error)
      // 如果检查失败，默认允许跳检
      return {
        valid: true,
        ratio: 0,
        message: '默认允许跳检'
      }
    }
  }

  /**
   * 综合验证跳检操作
   * @param {number} taskId - 任务ID
   * @param {number} pointId - 点位ID
   * @param {number} routeId - 路线ID
   * @returns {Object} 综合验证结果
   */
  async validateSkipOperation(taskId, pointId, routeId) {
    try {
      // 1. 验证点位状态
      const statusCheck = await this.canSkipPoint(taskId, pointId)
      if (!statusCheck.valid) {
        return statusCheck
      }

      // 2. 验证路线配置
      const routeCheck = await this.checkRouteSkipConfig(routeId)
      if (!routeCheck.valid) {
        return routeCheck
      }

      // 3. 检查跳检比例（仅警告）
      const ratioCheck = await this.checkSkipRatio(taskId)

      return {
        valid: true,
        message: '验证通过，可以跳检',
        isUpdate: statusCheck.isUpdate,
        warnings: !ratioCheck.valid ? [ratioCheck.error] : []
      }

    } catch (error) {
      console.error('综合验证失败:', error)
      return {
        valid: false,
        error: '验证失败: ' + (error.message || '未知错误')
      }
    }
  }
}

// 单例模式
const skipValidationService = new SkipValidationService()
export default skipValidationService
