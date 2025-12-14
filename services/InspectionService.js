/**
 * 巡检操作服务
 * 负责巡检过程中的所有操作
 *
 * @author James (Developer Agent)
 * @date 2025-11-25
 */

import DatabaseService from '@/utils/DatabaseService'
import ApiService from '@/utils/ApiService'

class InspectionService {
  /**
   * 开始巡检
   * 更新任务状态为进行中
   *
   * @param {number} taskId - 任务ID
   * @returns {Promise<boolean>}
   */
  async startInspection(taskId) {
    console.log('[InspectionService] startInspection 被调用，taskId:', taskId)

    try {
      console.log('[InspectionService] 准备调用 API: POST /mobile/tasks/' + taskId + '/start')

      const response = await ApiService.post(`/mobile/tasks/${taskId}/start`)

      console.log('[InspectionService] API 响应:', response)

      if (response) {
        console.log('[InspectionService] API 调用成功，准备跳转到巡检页面')

        // 跳转到巡检页面
        uni.navigateTo({
          url: `/pages/inspection/InspectionPage?taskId=${taskId}`,
          success: () => {
            console.log('[InspectionService] 页面跳转成功')
          },
          fail: (err) => {
            console.error('[InspectionService] 页面跳转失败:', err)
          }
        })

        return true
      } else {
        console.error('[InspectionService] API 返回响应为空或失败')
        uni.showToast({
          title: '开始巡检失败',
          icon: 'error'
        })
        return false
      }
    } catch (error) {
      console.error('[InspectionService] 开始巡检失败，捕获异常:', error)
      console.error('[InspectionService] 错误详情:', JSON.stringify(error))
      uni.showToast({
        title: '网络错误，开始巡检失败',
        icon: 'error'
      })
      return false
    }
  }

  /**
   * 继续巡检
   * 获取上次巡检的点位信息，直接跳转巡检页面
   *
   * @param {number} taskId - 任务ID
   * @returns {Promise<boolean>}
   */
  async continueInspection(taskId) {
    try {
      const response = await ApiService.get(`/mobile/tasks/${taskId}/continue`)

      if (response) {
        // 跳转到巡检页面，携带当前点位信息
        uni.navigateTo({
          url: `/pages/inspection/InspectionPage?taskId=${taskId}&currentPointIndex=${response.currentPointIndex || 1}`
        })
        return true
      } else {
        uni.showToast({
          title: '继续巡检失败',
          icon: 'error'
        })
        return false
      }
    } catch (error) {
      console.error('继续巡检失败:', error)
      uni.showToast({
        title: '网络错误，继续巡检失败',
        icon: 'error'
      })
      return false
    }
  }

  /**
   * 退出巡检
   * 保持任务状态为进行中，记录当前进度
   *
   * @param {number} taskId - 任务ID
   * @returns {Promise<boolean>}
   */
  async exitInspection(taskId) {
    try {
      const response = await ApiService.post(`/mobile/tasks/${taskId}/exit`)

      if (response) {
        uni.showToast({
          title: '已退出巡检',
          icon: 'success'
        })
        // 返回任务列表页面
        setTimeout(() => {
          uni.navigateBack()
        }, 1000)
        return true
      } else {
        uni.showToast({
          title: '退出巡检失败',
          icon: 'error'
        })
        return false
      }
    } catch (error) {
      console.error('退出巡检失败:', error)
      uni.showToast({
        title: '网络错误，退出巡检失败',
        icon: 'error'
      })
      return false
    }
  }

  /**
   * 获取当前点位信息
   *
   * @param {number} taskId - 任务ID
   * @param {number} currentPointIndex - 当前点位序号（从1开始）
   * @returns {Promise<Object>}
   */
  async getCurrentPoint(taskId, currentPointIndex = 1) {
    try {
      // 从本地数据库获取路线点位信息
      const route = await this.getRouteByTask(taskId)
      if (!route) {
        throw new Error('未找到任务对应的路线')
      }

      // 从points_json解析点位数组
      let points = []
      try {
        points = route.points_json ? JSON.parse(route.points_json) : []
      } catch (e) {
        console.error('解析points_json失败:', e)
        throw new Error('路线点位数据格式错误')
      }

      if (currentPointIndex < 1 || currentPointIndex > points.length) {
        throw new Error('点位序号超出范围')
      }

      // 获取当前点位ID
      const pointId = points[currentPointIndex - 1]

      // 获取点位详细信息
      const point = await this.getPointById(pointId)
      if (!point) {
        throw new Error('未找到对应的点位')
      }

      // 获取该点位的巡查项目
      const items = await this.getInspectionItems(point.point_id)

      return {
        route,
        point,
        items,
        currentPointIndex,
        totalPoints: points.length
      }
    } catch (error) {
      console.error('获取当前点位信息失败:', error)
      throw error
    }
  }

  /**
   * 根据任务ID获取路线信息
   *
   * @param {number} taskId - 任务ID
   * @returns {Promise<Object>}
   */
  async getRouteByTask(taskId) {
    const sql = `
      SELECT r.*
      FROM inspection_task t
      LEFT JOIN inspection_route r ON t.route_id = r.route_id
      WHERE t.task_id = ?
    `
    const results = await DatabaseService._query(sql, [taskId])
    return results.length > 0 ? results[0] : null
  }

  /**
   * 根据点位ID获取点位信息
   *
   * @param {number} pointId - 点位ID
   * @returns {Promise<Object>}
   */
  async getPointById(pointId) {
    const sql = 'SELECT * FROM inspection_point WHERE point_id = ?'
    const results = await DatabaseService._query(sql, [pointId])
    return results.length > 0 ? results[0] : null
  }

  /**
   * 获取点位的巡查项目
   *
   * @param {number} pointId - 点位ID
   * @returns {Promise<Array>}
   */
  async getInspectionItems(pointId) {
    const sql = `
      SELECT *
      FROM inspection_item
      WHERE point_id = ?
      ORDER BY order_num
    `
    return await DatabaseService._query(sql, [pointId])
  }

  /**
   * 获取路线点位列表
   *
   * @param {number} taskId - 任务ID
   * @param {number} routeId - 路线ID
   * @returns {Promise<Array>}
   */
  async getRoutePoints(taskId, routeId) {
    try {
      console.log('[InspectionService] getRoutePoints 开始')
      console.log('[InspectionService]   - taskId:', taskId, '(类型:', typeof taskId, ')')
      console.log('[InspectionService]   - routeId:', routeId, '(类型:', typeof routeId, ')')

      // 先查询所有路线看看数据库里有什么
      console.log('[InspectionService] 先查询所有路线...')
      const allRoutes = await DatabaseService.findAll('inspection_route')
      console.log('[InspectionService] 数据库中的所有路线:')
      allRoutes.forEach((r, index) => {
        console.log(`  [${index + 1}] route_id: ${r.route_id} (类型: ${typeof r.route_id}), route_name: ${r.route_name}`)
      })

      // 获取路线信息
      const sql = 'SELECT * FROM inspection_route WHERE route_id = ?'
      console.log('[InspectionService] 执行SQL:', sql, '参数:', [routeId])
      const routes = await DatabaseService._query(sql, [routeId])

      console.log('[InspectionService] 查询路线结果:', routes)
      console.log('[InspectionService] 查询结果数量:', routes.length)

      if (routes.length === 0) {
        console.warn('[InspectionService] ⚠️ 未找到路线记录！')
        console.warn('[InspectionService] 可能原因：')
        console.warn('[InspectionService]   1. 数据库中没有该route_id的数据')
        console.warn('[InspectionService]   2. route_id类型不匹配 (查询用的:', typeof routeId, ')')
        return []
      }

      const route = routes[0]
      console.log('[InspectionService] 路线信息:', route)

      // 解析points_json
      let pointIds = []
      try {
        console.log('[InspectionService] 开始解析 points_json:', route.points_json)
        pointIds = route.points_json ? JSON.parse(route.points_json) : []
        console.log('[InspectionService] 解析后的点位ID数组:', pointIds)
      } catch (e) {
        console.error('[InspectionService] 解析points_json失败:', e)
        return []
      }

      if (pointIds.length === 0) {
        console.warn('[InspectionService] points_json 为空或解析后为空数组')
        return []
      }

      // 获取所有点位详细信息
      const points = []
      for (let i = 0; i < pointIds.length; i++) {
        const pointId = pointIds[i]
        console.log(`[InspectionService] 查询点位 ${i + 1}/${pointIds.length}, pointId:`, pointId)

        // 查询点位信息
        const pointSql = 'SELECT * FROM inspection_point WHERE point_id = ?'
        const pointResults = await DatabaseService._query(pointSql, [pointId])

        console.log(`[InspectionService] 点位查询结果:`, pointResults)

        if (pointResults.length > 0) {
          const point = pointResults[0]

          // 检查是否已巡检
          const isCompleted = await DatabaseService.isPointInspected(taskId, pointId)
          console.log(`[InspectionService] 点位 ${pointId} 完成状态:`, isCompleted)

          points.push({
            point_order: i + 1,
            ...point,
            is_completed: isCompleted ? 1 : 0
          })
        } else {
          console.warn(`[InspectionService] 未找到点位 ${pointId} 的详细信息`)
        }
      }

      console.log('[InspectionService] 最终返回的点位列表:', points)
      return points
    } catch (error) {
      console.error('[InspectionService] 获取路线点位列表失败:', error)
      return []
    }
  }

  /**
   * 检查NFC卡是否匹配
   *
   * @param {string} nfcUid - NFC卡UID
   * @param {number} expectedPointId - 期望的点位ID
   * @returns {Promise<boolean>}
   */
  async checkNfcCard(nfcUid, expectedPointId) {
    try {
      const sql = 'SELECT card_id FROM inspection_point WHERE point_id = ?'
      const results = await DatabaseService._query(sql, [expectedPointId])

      if (results.length === 0) {
        throw new Error('未找到对应点位')
      }

      const expectedCardId = results[0].card_id
      return nfcUid === expectedCardId
    } catch (error) {
      console.error('检查NFC卡失败:', error)
      return false
    }
  }

  /**
   * 保存巡检记录
   *
   * @param {Object} record - 巡检记录
   * @returns {Promise<number>} 返回插入的record_id
   */
  async saveInspectionRecord(record) {
    try {
      const recordId = await DatabaseService.saveInspectionRecord(record)
      return recordId
    } catch (error) {
      console.error('保存巡检记录失败:', error)
      throw error
    }
  }

  /**
   * 保存巡查项目结果
   *
   * @param {number} recordId - 巡检记录ID
   * @param {Array} results - 巡查项目结果数组
   * @returns {Promise<boolean>}
   */
  async saveInspectionItemResults(recordId, results) {
    try {
      await DatabaseService.saveItemResults(recordId, results)
      return true
    } catch (error) {
      console.error('保存巡查项目结果失败:', error)
      return false
    }
  }

  /**
   * 获取任务进度
   *
   * @param {number} taskId - 任务ID
   * @returns {Promise<Object>}
   */
  async getTaskProgress(taskId) {
    try {
      // 获取路线信息
      const route = await this.getRouteByTask(taskId)
      if (!route) {
        return { total: 0, completed: 0, percentage: 0 }
      }

      // 解析总点位数
      let totalPoints = 0
      try {
        const points = route.points_json ? JSON.parse(route.points_json) : []
        totalPoints = points.length
      } catch (e) {
        console.error('解析points_json失败:', e)
      }

      // 查询已完成点位数
      const sql = `
        SELECT COUNT(*) as count
        FROM inspection_record
        WHERE task_id = ?
      `
      const results = await DatabaseService._query(sql, [taskId])
      const completed = results[0]?.count || 0

      const percentage = totalPoints > 0 ? Math.round((completed / totalPoints) * 100) : 0

      return { total: totalPoints, completed, percentage }
    } catch (error) {
      console.error('获取任务进度失败:', error)
      return { total: 0, completed: 0, percentage: 0 }
    }
  }
}

export default new InspectionService()
