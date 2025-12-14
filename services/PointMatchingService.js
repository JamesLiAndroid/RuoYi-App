/**
 * 点位匹配服务 - 根据NFC卡ID匹配对应巡检点位
 * 验证巡检顺序，检查点位是否有效
 */

import TaskService from './TaskService'

class PointMatchingService {
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
      // H5环境使用浏览器本地存储
      this.db = 'sqlite'
      //#endif
    }
  }

  /**
   * 根据NFC卡UID匹配点位
   * @param {string} nfcUid - NFC卡UID
   * @param {number} routeId - 路线ID
   * @returns {Object} 匹配结果
   */
  async matchPoint(nfcUid, routeId) {
    try {
      await this.initDatabase()

      // 查询该路线下对应卡ID的点位
      const point = await this.findPointByCardId(nfcUid, routeId)

      if (!point) {
        return {
          success: false,
          error: '该卡ID未绑定到当前路线的任何点位',
          code: 'CARD_NOT_BOUND'
        }
      }

      // 验证巡检顺序
      const orderCheck = await this.checkPointOrder(point, routeId)

      if (!orderCheck.isValid) {
        return {
          success: false,
          error: orderCheck.message,
          code: 'ORDER_INVALID',
          expectedPoint: orderCheck.expectedPoint
        }
      }

      return {
        success: true,
        point: point,
        isCorrectOrder: orderCheck.isCorrectOrder
      }

    } catch (error) {
      console.error('点位匹配失败:', error)
      return {
        success: false,
        error: '匹配失败: ' + (error.message || '未知错误'),
        code: 'MATCH_ERROR'
      }
    }
  }

  /**
   * 根据卡ID查找点位
   */
  async findPointByCardId(cardId, routeId) {
    //#ifdef APP-PLUS
    const sql = `
      SELECT p.point_id, p.point_name, p.point_code, p.card_id,
             rrp.point_order, rrp.route_id
      FROM inspection_point p
      LEFT JOIN inspection_route_point rrp ON p.point_id = rrp.point_id
      WHERE p.card_id = ? AND rrp.route_id = ?
    `

    const result = plus.sqlite.selectSqlSync({
      db: this.db,
      sql: sql,
      'arguments': [cardId, routeId]
    })

    return result.length > 0 ? result[0] : null
    //#endif

    //#ifdef H5
    // H5环境模拟数据
    return {
      point_id: 1,
      point_name: '模拟点位1号',
      point_code: 'P001',
      card_id: cardId,
      point_order: 1,
      route_id: routeId
    }
    //#endif
  }

  /**
   * 检查巡检顺序是否正确
   */
  async checkPointOrder(point, routeId) {
    try {
      // 获取当前任务已完成的点位
      const completedPoints = await this.getCompletedPoints(routeId)

      // 获取当前路线总点数
      const totalPoints = await this.getTotalPoints(routeId)

      // 获取下一点位序号
      const expectedOrder = completedPoints.length + 1

      // 如果当前点位不是下一点位，则顺序错误
      if (point.point_order !== expectedOrder) {
        // 查找期望的点位信息
        const expectedPoint = await this.getPointByOrder(routeId, expectedOrder)

        return {
          isValid: false,
          isCorrectOrder: false,
          message: `请按顺序巡检，当前应巡检第${expectedOrder}个点位（${expectedPoint?.point_name || '未知'}），您扫描的是第${point.point_order}个点位`,
          expectedPoint: expectedPoint
        }
      }

      return {
        isValid: true,
        isCorrectOrder: true
      }

    } catch (error) {
      console.error('检查顺序失败:', error)
      return {
        isValid: false,
        isCorrectOrder: false,
        message: '检查顺序失败: ' + (error.message || '未知错误')
      }
    }
  }

  /**
   * 获取已完成的点位列表
   */
  async getCompletedPoints(routeId) {
    //#ifdef APP-PLUS
    const sql = `
      SELECT DISTINCT rrp.point_id, rrp.point_order
      FROM inspection_record ir
      LEFT JOIN inspection_task it ON ir.task_id = it.task_id
      LEFT JOIN inspection_route_point rrp ON ir.point_id = rrp.point_id
      WHERE it.route_id = ?
        AND ir.sync_status = 'SYNCED'
      ORDER BY rrp.point_order
    `

    const result = plus.sqlite.selectSqlSync({
      db: this.db,
      sql: sql,
      'arguments': [routeId]
    })

    return result || []
    //#endif

    //#ifdef H5
    return []
    //#endif
  }

  /**
   * 获取路线总点数
   */
  async getTotalPoints(routeId) {
    //#ifdef APP-PLUS
    const sql = `
      SELECT COUNT(*) as total
      FROM inspection_route_point
      WHERE route_id = ?
    `

    const result = plus.sqlite.selectSqlSync({
      db: this.db,
      sql: sql,
      'arguments': [routeId]
    })

    return result[0]?.total || 0
    //#endif

    //#ifdef H5
    return 10
    //#endif
  }

  /**
   * 根据序号获取点位信息
   */
  async getPointByOrder(routeId, order) {
    //#ifdef APP-PLUS
    const sql = `
      SELECT p.point_id, p.point_name, p.point_code,
             rrp.point_order
      FROM inspection_point p
      LEFT JOIN inspection_route_point rrp ON p.point_id = rrp.point_id
      WHERE rrp.route_id = ? AND rrp.point_order = ?
    `

    const result = plus.sqlite.selectSqlSync({
      db: this.db,
      sql: sql,
      'arguments': [routeId, order]
    })

    return result.length > 0 ? result[0] : null
    //#endif

    //#ifdef H5
    return {
      point_id: order,
      point_name: `模拟点位${order}号`,
      point_code: `P${order.toString().padStart(3, '0')}`,
      point_order: order
    }
    //#endif
  }

  /**
   * 强制跳转到指定点位（允许跳过）
   * @param {number} fromPointId - 当前点位ID
   * @param {number} toPointId - 目标点位ID
   * @returns {Object} 跳转结果
   */
  async jumpToPoint(fromPointId, toPointId) {
    try {
      const fromPoint = await this.getPointById(fromPointId)
      const toPoint = await this.getPointById(toPointId)

      if (!fromPoint || !toPoint) {
        return {
          success: false,
          error: '点位不存在'
        }
      }

      // 记录跳检日志（可选）
      console.log(`跳检: ${fromPoint.point_name} -> ${toPoint.point_name}`)

      return {
        success: true,
        fromPoint: fromPoint,
        toPoint: toPoint
      }

    } catch (error) {
      console.error('跳检失败:', error)
      return {
        success: false,
        error: '跳检失败: ' + (error.message || '未知错误')
      }
    }
  }

  /**
   * 根据ID获取点位信息
   */
  async getPointById(pointId) {
    //#ifdef APP-PLUS
    const sql = `
      SELECT p.point_id, p.point_name, p.point_code, p.card_id,
             rrp.point_order, rrp.route_id
      FROM inspection_point p
      LEFT JOIN inspection_route_point rrp ON p.point_id = rrp.point_id
      WHERE p.point_id = ?
    `

    const result = plus.sqlite.selectSqlSync({
      db: this.db,
      sql: sql,
      'arguments': [pointId]
    })

    return result.length > 0 ? result[0] : null
    //#endif

    //#ifdef H5
    return {
      point_id: pointId,
      point_name: `模拟点位${pointId}号`,
      point_code: `P${pointId.toString().padStart(3, '0')}`,
      point_order: pointId,
      route_id: 1,
      card_id: `CARD${pointId.toString().padStart(8, '0')}`
    }
    //#endif
  }
}

// 单例模式
const pointMatchingService = new PointMatchingService()
export default pointMatchingService
