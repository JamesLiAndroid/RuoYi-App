/**
 * 任务数据服务
 * 负责移动端巡检任务的查询和管理
 *
 * @author James (Developer Agent)
 * @date 2025-11-25
 */

import DatabaseService from '@/utils/DatabaseService'
import ApiService from '@/utils/ApiService'

class TaskService {
  /**
   * 获取任务列表
   * 支持按日期和状态筛选
   *
   * @param {string} date - 任务日期（格式：YYYY-MM-DD，可选）
   * @param {string} status - 任务状态（可选：NOT_STARTED, IN_PROGRESS, COMPLETED）
   * @returns {Promise<Array>} 任务列表
   */
  async getTaskList(date = null, status = null) {
    try {
      // 首先尝试从服务器获取
      const serverData = await this.getServerTaskList(date, status)
      if (serverData && serverData.length > 0) {
        // 如果服务器有数据，返回服务器数据
        return serverData
      }

      // 如果服务器无数据，从本地SQLite获取
      return await this.getLocalTaskList(date, status)
    } catch (error) {
      console.error('获取任务列表失败:', error)
      // 如果服务器请求失败，从本地获取
      return await this.getLocalTaskList(date, status)
    }
  }

  /**
   * 从服务器获取任务列表
   *
   * @param {string} date - 任务日期
   * @param {string} status - 任务状态
   * @returns {Promise<Array>}
   */
  async getServerTaskList(date, status) {
    try {
      // 手动构建查询参数（不使用URLSearchParams，兼容uni-app环境）
      const params = []
      if (date) params.push(`date=${date}`)
      if (status && status !== 'ALL') params.push(`status=${status}`)

      const queryString = params.length > 0 ? '?' + params.join('&') : ''
      const url = `/mobile/tasks${queryString}`

      // 使用ApiService发送请求
      const response = await ApiService.get(url)

      // 转换服务器返回的数据格式
      if (response && Array.isArray(response)) {
        return response.map(task => this.mapTaskRecord(task))
      }

      return []
    } catch (error) {
      console.error('[TaskService] 从服务器获取任务列表失败:', error)
      return []
    }
  }

  /**
   * 从本地SQLite获取任务列表
   *
   * @param {string} date - 任务日期
   * @param {string} status - 任务状态
   * @returns {Promise<Array>}
   */
  async getLocalTaskList(date, status) {
    let sql = `
      SELECT
        t.*,
        r.route_name,
        r.route_code,
        r.points_json,
        (SELECT COUNT(*) FROM inspection_record ir WHERE ir.task_id = t.task_id) as completed_points
      FROM inspection_task t
      LEFT JOIN inspection_route r ON t.route_id = r.route_id
      WHERE 1=1
    `

    const params = []

    if (date) {
      sql += ' AND t.task_date = ?'
      params.push(date)
    }

    if (status && status !== 'ALL') {
      sql += ' AND t.task_status = ?'
      params.push(status)
    }

    sql += `
      ORDER BY
        CASE t.task_status
          WHEN 'IN_PROGRESS' THEN 1
          WHEN 'NOT_STARTED' THEN 2
          WHEN 'COMPLETED' THEN 3
        END,
        t.planned_start_time DESC
    `

    return await DatabaseService._query(sql, params).then(results => {
      return results.map(this.mapTaskRecord.bind(this))
    })
  }

  /**
   * 获取任务详情
   *
   * @param {number} taskId - 任务ID
   * @returns {Promise<Object>}
   */
  async getTaskDetail(taskId) {
    try {
      console.log('[TaskService] getTaskDetail 开始, taskId:', taskId)

      // 首先尝试从服务器获取
      const serverData = await this.getServerTaskDetail(taskId)
      if (serverData) {
        console.log('[TaskService] 从服务器获取任务详情成功:', serverData)
        return serverData
      }

      console.log('[TaskService] 服务器无数据，从本地数据库获取')

      // 如果服务器无数据，从本地SQLite获取
      const localData = await this.getLocalTaskDetail(taskId)
      console.log('[TaskService] 从本地数据库获取任务详情结果:', localData)
      return localData
    } catch (error) {
      console.error('[TaskService] 获取任务详情失败:', error)
      // 如果服务器请求失败，从本地获取
      const localData = await this.getLocalTaskDetail(taskId)
      console.log('[TaskService] 异常时从本地数据库获取任务详情结果:', localData)
      return localData
    }
  }

  /**
   * 从服务器获取任务详情
   *
   * @param {number} taskId - 任务ID
   * @returns {Promise<Object>}
   */
  async getServerTaskDetail(taskId) {
    try {
      const response = await ApiService.get(`/mobile/tasks/${taskId}`)

      // 转换服务器返回的数据格式
      if (response) {
        return this.mapTaskRecord(response)
      }

      return null
    } catch (error) {
      console.error('[TaskService] 从服务器获取任务详情失败:', error)
      return null
    }
  }

  /**
   * 从本地SQLite获取任务详情
   *
   * @param {number} taskId - 任务ID
   * @returns {Promise<Object>}
   */
  async getLocalTaskDetail(taskId) {
    console.log('[TaskService] getLocalTaskDetail 开始查询, taskId:', taskId)

    let sql = `
      SELECT
        t.*,
        r.route_name,
        r.route_code,
        r.points_json,
        (SELECT COUNT(*) FROM inspection_record ir WHERE ir.task_id = t.task_id) as completed_points
      FROM inspection_task t
      LEFT JOIN inspection_route r ON t.route_id = r.route_id
      WHERE t.task_id = ?
    `

    const results = await DatabaseService._query(sql, [taskId])
    console.log('[TaskService] 本地数据库查询结果:', results)

    if (results.length > 0) {
      const mapped = this.mapTaskRecord(results[0])
      console.log('[TaskService] 映射后的任务记录:', mapped)
      return mapped
    }

    console.warn('[TaskService] 本地数据库中未找到任务')
    return null
  }

  /**
   * 开始巡检
   *
   * @param {number} taskId - 任务ID
   * @returns {Promise<boolean>}
   */
  async startInspection(taskId) {
    try {
      // 调用服务器API
      const response = await ApiService.post(`/mobile/tasks/${taskId}/start`)

      if (response) {
        // 更新本地数据
        await this.updateLocalTaskStatus(taskId, 'IN_PROGRESS')
        return true
      }
      return false
    } catch (error) {
      console.error('[TaskService] 开始巡检失败:', error)
      // 网络失败时，更新本地数据
      await this.updateLocalTaskStatus(taskId, 'IN_PROGRESS')
      return true
    }
  }

  /**
   * 继续巡检
   *
   * @param {number} taskId - 任务ID
   * @returns {Promise<Object>}
   */
  async continueInspection(taskId) {
    try {
      const response = await ApiService.get(`/mobile/tasks/${taskId}/continue`)
      return response || { currentPointIndex: 1 }
    } catch (error) {
      console.error('[TaskService] 继续巡检失败:', error)
      return { currentPointIndex: 1 }
    }
  }

  /**
   * 退出巡检
   *
   * @param {number} taskId - 任务ID
   * @returns {Promise<boolean>}
   */
  async exitInspection(taskId) {
    try {
      const response = await ApiService.post(`/mobile/tasks/${taskId}/exit`)
      return response ? true : false
    } catch (error) {
      console.error('[TaskService] 退出巡检失败:', error)
      return false
    }
  }

  /**
   * 更新本地任务状态
   *
   * @param {number} taskId - 任务ID
   * @param {string} status - 任务状态
   * @returns {Promise<void>}
   */
  async updateLocalTaskStatus(taskId, status) {
    const sql = `
      UPDATE inspection_task
      SET task_status = ?, actual_start_time = ?
      WHERE task_id = ?
    `

    const params = [
      status,
      new Date().toISOString(),
      taskId
    ]

    await DatabaseService._executeSQL(sql, params)
  }

  /**
   * 计算任务进度
   *
   * @param {Object} task - 任务对象
   * @returns {Object} 进度信息
   */
  calculateProgress(task) {
    // 优先从 total_points 或 pointCount 获取总点位数
    let totalPoints = task.total_points || task.pointCount || 0

    // 如果没有，尝试从points_json中解析
    if (totalPoints === 0 && task.points_json) {
      try {
        const points = JSON.parse(task.points_json)
        totalPoints = Array.isArray(points) ? points.length : 0
      } catch (e) {
        console.error('解析points_json失败:', e)
      }
    }

    const completed = task.completed_points || 0
    const percentage = totalPoints > 0 ? Math.round((completed / totalPoints) * 100) : 0

    return {
      completed,
      total: totalPoints,
      percentage,
      statusText: `${completed}/${totalPoints}`
    }
  }

  /**
   * 映射任务记录
   * 将服务器返回的驼峰命名转换为下划线命名，并添加进度信息
   *
   * @param {Object} record - 原始记录
   * @returns {Object} 映射后的记录
   */
  mapTaskRecord(record) {
    // 处理驼峰命名和下划线命名的兼容
    const task = {
      task_id: record.taskId || record.task_id,
      task_code: record.taskCode || record.task_code,
      route_id: record.routeId || record.route_id,
      route_name: record.routeName || record.route_name,
      route_code: record.routeCode || record.route_code,
      inspector_id: record.inspectorId || record.inspector_id,
      inspector_name: record.inspectorName || record.inspector_name,
      task_date: record.taskDate || record.task_date,
      task_status: record.status || record.taskStatus || record.task_status,
      planned_start_time: record.plannedStartTime || record.planned_start_time,
      planned_end_time: record.plannedEndTime || record.planned_end_time,
      actual_start_time: record.actualStartTime || record.actual_start_time,
      actual_end_time: record.actualEndTime || record.actual_end_time,
      current_point_index: record.currentPointIndex || record.current_point_index || 0,
      total_points: record.totalPoints || record.total_points || record.pointCount || 0,
      points_json: record.pointsJson || record.points_json,
      completed_points: record.completedPoints || record.completed_points || 0,
      sync_time: record.syncTime || record.sync_time,
      version: record.version
    }

    // 计算进度
    const progress = this.calculateProgress(task)

    // 构建嵌套的 route 和 task 对象（InspectionPage 需要）
    return {
      ...task,
      progress,
      // 添加嵌套的 route 对象
      route: {
        route_id: task.route_id,
        route_name: task.route_name,
        route_code: task.route_code,
        points_json: task.points_json
      },
      // 添加嵌套的 task 对象
      task: {
        task_id: task.task_id,
        task_code: task.task_code,
        task_date: task.task_date,
        task_status: task.task_status,
        time_slot: this.extractTimeSlot(task.planned_start_time, task.planned_end_time)
      }
    }
  }

  /**
   * 从开始和结束时间提取时段信息
   * @param {String} startTime - 开始时间
   * @param {String} endTime - 结束时间
   * @returns {String} 时段描述（如"08:00-12:00"）
   */
  extractTimeSlot(startTime, endTime) {
    if (!startTime || !endTime) return ''

    try {
      // 提取时间部分（HH:MM）
      const start = startTime.substring(11, 16) // "2024-01-01 08:00:00" -> "08:00"
      const end = endTime.substring(11, 16)
      return `${start}-${end}`
    } catch (e) {
      return ''
    }
  }

  /**
   * 获取任务统计信息
   *
   * @param {string} date - 任务日期（可选）
   * @returns {Promise<Object>}
   */
  async getTaskStatistics(date = null) {
    try {
      const url = `/mobile/tasks/statistics${date ? '?date=' + date : ''}`
      const response = await ApiService.get(url)

      if (response) {
        return response
      }
    } catch (error) {
      console.error('[TaskService] 获取任务统计失败:', error)
    }

    // 默认返回0
    return {
      total: 0,
      notStarted: 0,
      inProgress: 0,
      completed: 0
    }
  }
}

export default new TaskService()
