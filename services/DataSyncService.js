/**
 * 数据同步服务
 * 功能：检查数据版本、同步路线/点位/巡查项目/任务数据到本地SQLite
 * 支持：增量同步、批量同步、进度回调
 *
 * @author James (Developer Agent)
 * @date 2025-12-02
 */

import request from '@/utils/request'
import StorageService from '@/utils/StorageService'
import DatabaseService from '@/services/DatabaseService'

class DataSyncService {
  constructor() {
    this.syncProgress = {
      total: 0,
      current: 0,
      percentage: 0,
      currentTask: ''
    }
    this.progressCallback = null
  }

  /**
   * 设置进度回调函数
   * @param {Function} callback 回调函数，参数为进度对象
   */
  setProgressCallback(callback) {
    this.progressCallback = callback
  }

  /**
   * 更新进度
   * @param {number} current 当前进度
   * @param {string} taskName 当前任务名称
   */
  updateProgress(current, taskName) {
    this.syncProgress.current = current
    this.syncProgress.currentTask = taskName
    this.syncProgress.percentage = Math.round((current / this.syncProgress.total) * 100)

    if (this.progressCallback) {
      this.progressCallback(this.syncProgress)
    }
  }

  /**
   * 获取服务器数据版本
   * @returns {Promise<Object>} 版本信息对象
   */
  async getServerDataVersion() {
    try {
      const res = await request({
        url: '/mobile/data-version',
        method: 'get'
      })
      return res.data
    } catch (error) {
      console.error('获取数据版本失败:', error)
      throw error
    }
  }

  /**
   * 检查哪些表需要同步
   * @returns {Promise<Array>} 需要同步的表列表
   */
  async checkNeedSync() {
    const serverVersion = await this.getServerDataVersion()
    const localMetadata = StorageService.getSyncMetadata()

    const needsSync = []
    const tableMapping = {
      'routes_version': { key: 'routes', name: '巡检路线' },
      'points_version': { key: 'points', name: '巡检点位' },
      'items_version': { key: 'items', name: '巡查项目' },
      'tasks_version': { key: 'tasks', name: '巡检任务' }
    }

    for (const [versionKey, tableInfo] of Object.entries(tableMapping)) {
      const serverVer = serverVersion[versionKey]
      const localVer = localMetadata[tableInfo.key]

      if (!localVer || localVer !== serverVer) {
        needsSync.push({
          key: tableInfo.key,
          name: tableInfo.name,
          version: serverVer
        })
      }
    }

    return needsSync
  }

  /**
   * 执行数据同步
   * @param {Array} syncTables 需要同步的表列表
   * @returns {Promise<Object>} 同步结果
   */
  async syncData(syncTables) {
    this.syncProgress.total = syncTables.length
    this.syncProgress.current = 0

    const results = {
      success: [],
      failed: []
    }

    for (let i = 0; i < syncTables.length; i++) {
      const table = syncTables[i]
      this.updateProgress(i + 1, `正在同步${table.name}...`)

      try {
        await this.syncTable(table.key, table.version)
        results.success.push(table.name)
      } catch (error) {
        console.error(`同步${table.name}失败:`, error)
        results.failed.push({
          name: table.name,
          error: error.message
        })
      }
    }

    return results
  }

  /**
   * 同步单个表的数据
   * @param {string} tableKey 表键名
   * @param {string} version 版本号
   */
  async syncTable(tableKey, version) {
    let data = []

    // 根据表键名调用对应的API
    switch (tableKey) {
      case 'routes':
        data = await this.fetchRoutes()
        await this.saveRoutesToLocal(data)
        break
      case 'points':
        data = await this.fetchPoints()
        await this.savePointsToLocal(data)
        break
      case 'items':
        data = await this.fetchInspectionItems()
        await this.saveInspectionItemsToLocal(data)
        break
      case 'tasks':
        data = await this.fetchTasks()
        await this.saveTasksToLocal(data)
        break
      default:
        throw new Error(`未知的表键名: ${tableKey}`)
    }

    // 更新本地版本号
    this.updateLocalVersion(tableKey, version)
  }

  /**
   * 获取路线数据
   */
  async fetchRoutes() {
    const res = await request({
      url: '/mobile/routes',
      method: 'get'
    })
    return res.data
  }

  /**
   * 获取点位数据
   */
  async fetchPoints() {
    const res = await request({
      url: '/mobile/points',
      method: 'get'
    })
    return res.data
  }

  /**
   * 获取巡查项目数据
   */
  async fetchInspectionItems() {
    const res = await request({
      url: '/mobile/inspection-items',
      method: 'get'
    })
    return res.data
  }

  /**
   * 获取任务数据
   */
  async fetchTasks() {
    const res = await request({
      url: '/mobile/tasks',
      method: 'get'
    })
    return res.data
  }

  /**
   * 保存路线数据到本地 SQLite 数据库
   */
  async saveRoutesToLocal(data) {
    await DatabaseService.saveRoutes(data)
  }

  /**
   * 保存点位数据到本地 SQLite 数据库
   */
  async savePointsToLocal(data) {
    await DatabaseService.savePoints(data)
  }

  /**
   * 保存巡查项目数据到本地 SQLite 数据库
   */
  async saveInspectionItemsToLocal(data) {
    await DatabaseService.saveInspectionItems(data)
  }

  /**
   * 保存任务数据到本地 SQLite 数据库
   */
  async saveTasksToLocal(data) {
    await DatabaseService.saveTasks(data)
  }

  /**
   * 更新本地版本号
   * @param {string} tableKey 表键名
   * @param {string} version 版本号
   */
  updateLocalVersion(tableKey, version) {
    const metadata = StorageService.getSyncMetadata()
    metadata[tableKey] = version
    metadata[`${tableKey}_sync_time`] = new Date().toISOString()
    StorageService.saveSyncMetadata(metadata)
  }
}

// 导出单例
export default new DataSyncService()
