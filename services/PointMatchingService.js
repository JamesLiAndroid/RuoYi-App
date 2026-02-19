/**
 * 点位匹配服务 - 根据NFC卡ID匹配对应巡检点位
 * 验证巡检顺序，检查点位是否有效
 * 包含缓存机制，提升匹配性能
 */

import TaskService from './TaskService'
import DatabaseService from '@/utils/DatabaseService'

/**
 * 点位匹配缓存类
 * 使用Map存储cardId到点位信息的映射，提升匹配性能
 */
class PointMatchingCache {
  constructor() {
    this.cache = new Map() // cardId -> pointInfo
    this.maxSize = 1000 // 最大缓存1000个点位
    this.hits = 0 // 缓存命中次数
    this.misses = 0 // 缓存未命中次数
  }

  /**
   * 从缓存获取点位信息
   * @param {string} cardId - 卡ID
   * @returns {Object|null} 点位信息或null
   */
  get(cardId) {
    if (this.cache.has(cardId)) {
      this.hits++
      return this.cache.get(cardId)
    }
    this.misses++
    return null
  }

  /**
   * 设置缓存
   * @param {string} cardId - 卡ID
   * @param {Object} pointInfo - 点位信息
   */
  set(cardId, pointInfo) {
    // 如果缓存已满，清除最早的条目（LRU策略简化版）
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    this.cache.set(cardId, pointInfo)
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  /**
   * 获取缓存命中率
   * @returns {number} 命中率（0-1之间）
   */
  getHitRate() {
    const total = this.hits + this.misses
    return total > 0 ? (this.hits / total) : 0
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate()
    }
  }
}

class PointMatchingService {
  constructor() {
    this.cache = new PointMatchingCache() // 初始化缓存
  }

  /**
   * 初始化数据库（使用DatabaseService，不需要手动初始化）
   */
  async initDatabase() {
    // DatabaseService 在应用启动时已初始化，这里不需要额外操作
    console.log('[PointMatching] 使用全局DatabaseService')
  }

  /**
   * 根据NFC卡UID匹配点位
   * 优先从缓存查找，缓存未命中再查数据库
   * @param {string} nfcUid - NFC卡UID
   * @param {number} routeId - 路线ID
   * @returns {Object} 匹配结果
   */
  async matchPoint(nfcUid, routeId) {
    try {
      await this.initDatabase()

      console.log('[PointMatching] 开始匹配点位:', nfcUid, 'routeId:', routeId)

      // 先从缓存查找
      let point = this.cache.get(nfcUid)
      let fromCache = false

      if (point) {
        console.log('[PointMatching] 缓存命中:', point.point_name)
        fromCache = true

        // 验证点位是否属于当前路线
        if (point.route_id !== routeId) {
          console.warn('[PointMatching] 缓存中的点位不属于当前路线')
          point = null // 重新查询
        }
      }

      // 缓存未命中或路线不匹配，从数据库查询
      if (!point) {
        console.log('[PointMatching] 缓存未命中，从数据库查询')
        point = await this.findPointByCardId(nfcUid, routeId)

        // 查询成功，加入缓存
        if (point) {
          this.cache.set(nfcUid, point)
          console.log('[PointMatching] 点位已加入缓存:', point.point_name)
        }
      }

      if (!point) {
        console.warn('[PointMatching] 未找到匹配的点位')
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
          expectedPoint: orderCheck.expectedPoint,
          point: point, // 返回匹配到的点位信息
          fromCache: fromCache
        }
      }

      return {
        success: true,
        point: point,
        isCorrectOrder: orderCheck.isCorrectOrder,
        fromCache: fromCache
      }

    } catch (error) {
      console.error('[PointMatching] 点位匹配失败:', error)
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
    try {
      const sql = `
        SELECT p.point_id, p.point_name, p.point_code, p.card_id,
               rrp.point_order, rrp.route_id
        FROM inspection_point p
        LEFT JOIN inspection_route_point rrp ON p.point_id = rrp.point_id
        WHERE p.card_id = ? AND rrp.route_id = ?
      `

      const result = await DatabaseService._query(sql, [cardId, routeId])

      return result.length > 0 ? result[0] : null

    } catch (error) {
      console.error('[PointMatching] 查询点位失败:', error)
      return null
    }
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

    const result = await DatabaseService._query(sql, [routeId])

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

    const result = await DatabaseService._query(sql, [routeId])

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

    const result = await DatabaseService._query(sql, [routeId, order])

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

    const result = await DatabaseService._query(sql, [pointId])

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

  /**
   * 预加载路线的所有点位到缓存
   * @param {number} routeId - 路线ID
   * @returns {Object} 加载结果
   */
  async preloadCache(routeId) {
    try {
      await this.initDatabase()

      console.log('[PointMatching] 开始预加载路线缓存, routeId:', routeId)

      //#ifdef APP-PLUS
      const sql = `
        SELECT p.point_id, p.point_name, p.point_code, p.card_id,
               rrp.point_order, rrp.route_id
        FROM inspection_point p
        INNER JOIN inspection_route_point rrp ON p.point_id = rrp.point_id
        WHERE rrp.route_id = ?
        ORDER BY rrp.point_order
      `

      const result = await DatabaseService._query(sql, [routeId])

      // 将所有点位加入缓存
      let loadedCount = 0
      if (result && result.length > 0) {
        result.forEach(point => {
          if (point.card_id) {
            this.cache.set(point.card_id, point)
            loadedCount++
          }
        })
      }

      console.log(`[PointMatching] 缓存预加载完成，共加载 ${loadedCount} 个点位`)

      return {
        success: true,
        loadedCount: loadedCount,
        totalPoints: result.length
      }
      //#endif

      //#ifdef H5
      // H5环境模拟数据
      console.log('[PointMatching] H5环境，模拟缓存预加载')
      for (let i = 1; i <= 10; i++) {
        const point = {
          point_id: i,
          point_name: `模拟点位${i}号`,
          point_code: `P${i.toString().padStart(3, '0')}`,
          point_order: i,
          route_id: routeId,
          card_id: `CARD${i.toString().padStart(8, '0')}`
        }
        this.cache.set(point.card_id, point)
      }

      return {
        success: true,
        loadedCount: 10,
        totalPoints: 10
      }
      //#endif

    } catch (error) {
      console.error('[PointMatching] 预加载缓存失败:', error)
      return {
        success: false,
        error: '预加载缓存失败: ' + (error.message || '未知错误')
      }
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    const stats = this.cache.getStats()
    console.log('[PointMatching] 缓存统计:', stats)
    return stats
  }

  /**
   * 清空缓存
   */
  clearCache() {
    console.log('[PointMatching] 清空缓存')
    this.cache.clear()
  }
}

// 单例模式
const pointMatchingService = new PointMatchingService()
export default pointMatchingService
