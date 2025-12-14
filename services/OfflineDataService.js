/**
 * 离线数据管理服务
 * 负责统计和管理本地待上传的巡检记录
 *
 * @author James (Developer Agent)
 * @date 2025-12-13
 */

import DatabaseService from '@/utils/DatabaseService'

class OfflineDataService {
  /**
   * 获取待上传记录数
   * 统计所有sync_status为PENDING的记录
   *
   * @returns {Promise<Object>} { records: 记录数, results: 结果数, total: 总数 }
   */
  async getPendingUploadCount() {
    try {
      // #ifdef APP-PLUS
      const recordSql = `
        SELECT COUNT(*) as count
        FROM inspection_record
        WHERE sync_status = 'PENDING'
      `

      const recordResult = await DatabaseService._query(recordSql)
      const recordCount = recordResult.length > 0 ? recordResult[0].count : 0

      // 统计待上传的巡查项目结果
      const resultSql = `
        SELECT COUNT(*) as count
        FROM inspection_item_result
        WHERE sync_status = 'PENDING'
      `

      const resultResult = await DatabaseService._query(resultSql)
      const resultCount = resultResult.length > 0 ? resultResult[0].count : 0

      return {
        records: recordCount,
        results: resultCount,
        total: recordCount + resultCount
      }
      // #endif

      // #ifdef H5
      console.warn('[OfflineDataService] H5环境不支持本地数据库')
      return {
        records: 0,
        results: 0,
        total: 0
      }
      // #endif
    } catch (error) {
      console.error('[OfflineDataService] 获取待上传记录数失败:', error)
      return {
        records: 0,
        results: 0,
        total: 0
      }
    }
  }

  /**
   * 获取待上传的记录列表
   * 返回所有待上传的巡检记录详情
   *
   * @param {number} limit - 限制返回数量（可选）
   * @returns {Promise<Array>} 记录列表
   */
  async getPendingRecords(limit = null) {
    try {
      // #ifdef APP-PLUS
      let sql = `
        SELECT
          ir.*,
          it.task_code,
          ip.point_name,
          ip.point_code
        FROM inspection_record ir
        LEFT JOIN inspection_task it ON ir.task_id = it.task_id
        LEFT JOIN inspection_point ip ON ir.point_id = ip.point_id
        WHERE ir.sync_status = 'PENDING'
        ORDER BY ir.inspection_time DESC
      `

      if (limit) {
        sql += ` LIMIT ${limit}`
      }

      const records = await DatabaseService._query(sql)

      // 为每条记录获取关联的巡查项目结果
      for (let record of records) {
        const resultSql = `
          SELECT * FROM inspection_item_result
          WHERE record_id = ?
        `
        record.results = await DatabaseService._query(resultSql, [record.record_id])
      }

      return records
      // #endif

      // #ifdef H5
      console.warn('[OfflineDataService] H5环境不支持本地数据库')
      return []
      // #endif
    } catch (error) {
      console.error('[OfflineDataService] 获取待上传记录失败:', error)
      return []
    }
  }

  /**
   * 标记记录为已同步
   * 更新记录的sync_status为SYNCED
   *
   * @param {Array<number>} recordIds - 记录ID列表
   * @returns {Promise<boolean>} 是否成功
   */
  async markAsSynced(recordIds) {
    if (!recordIds || recordIds.length === 0) {
      return true
    }

    try {
      // #ifdef APP-PLUS
      const placeholders = recordIds.map(() => '?').join(',')
      const sql = `
        UPDATE inspection_record
        SET sync_status = 'SYNCED',
            sync_time = datetime('now', 'localtime')
        WHERE record_id IN (${placeholders})
      `

      await DatabaseService._executeSQL(sql, recordIds)

      // 同时更新关联的巡查项目结果
      const resultSql = `
        UPDATE inspection_item_result
        SET sync_status = 'SYNCED',
            sync_time = datetime('now', 'localtime')
        WHERE record_id IN (${placeholders})
      `

      await DatabaseService._executeSQL(resultSql, recordIds)

      console.log(`[OfflineDataService] 已标记 ${recordIds.length} 条记录为已同步`)
      return true
      // #endif

      // #ifdef H5
      console.warn('[OfflineDataService] H5环境不支持本地数据库')
      return false
      // #endif
    } catch (error) {
      console.error('[OfflineDataService] 标记记录为已同步失败:', error)
      return false
    }
  }

  /**
   * 标记记录为同步失败
   * 更新记录的sync_status为FAILED
   *
   * @param {Array<number>} recordIds - 记录ID列表
   * @param {string} errorMessage - 错误信息
   * @returns {Promise<boolean>} 是否成功
   */
  async markAsFailed(recordIds, errorMessage = '') {
    if (!recordIds || recordIds.length === 0) {
      return true
    }

    try {
      // #ifdef APP-PLUS
      const placeholders = recordIds.map(() => '?').join(',')
      const sql = `
        UPDATE inspection_record
        SET sync_status = 'FAILED'
        WHERE record_id IN (${placeholders})
      `

      await DatabaseService._executeSQL(sql, recordIds)

      console.log(`[OfflineDataService] 已标记 ${recordIds.length} 条记录为同步失败: ${errorMessage}`)
      return true
      // #endif

      // #ifdef H5
      console.warn('[OfflineDataService] H5环境不支持本地数据库')
      return false
      // #endif
    } catch (error) {
      console.error('[OfflineDataService] 标记记录为同步失败失败:', error)
      return false
    }
  }

  /**
   * 清理已同步的记录
   * 删除sync_status为SYNCED且超过指定天数的记录
   *
   * @param {number} days - 保留天数，默认30天
   * @returns {Promise<number>} 删除的记录数
   */
  async cleanSyncedRecords(days = 30) {
    try {
      // #ifdef APP-PLUS
      const sql = `
        DELETE FROM inspection_record
        WHERE sync_status = 'SYNCED'
        AND sync_time < datetime('now', '-${days} day', 'localtime')
      `

      await DatabaseService._executeSQL(sql)

      // 同时清理孤立的巡查项目结果
      const resultSql = `
        DELETE FROM inspection_item_result
        WHERE record_id NOT IN (SELECT record_id FROM inspection_record)
      `

      await DatabaseService._executeSQL(resultSql)

      console.log(`[OfflineDataService] 已清理超过${days}天的已同步记录`)
      return 0 // SQLite不直接返回affected rows
      // #endif

      // #ifdef H5
      console.warn('[OfflineDataService] H5环境不支持本地数据库')
      return 0
      // #endif
    } catch (error) {
      console.error('[OfflineDataService] 清理已同步记录失败:', error)
      return 0
    }
  }

  /**
   * 获取离线数据统计信息
   * 返回各状态的记录统计
   *
   * @returns {Promise<Object>} 统计信息
   */
  async getStatistics() {
    try {
      // #ifdef APP-PLUS
      const sql = `
        SELECT
          sync_status,
          COUNT(*) as count
        FROM inspection_record
        GROUP BY sync_status
      `

      const result = await DatabaseService._query(sql)

      const statistics = {
        pending: 0,
        synced: 0,
        failed: 0,
        total: 0
      }

      result.forEach(row => {
        statistics.total += row.count
        if (row.sync_status === 'PENDING') {
          statistics.pending = row.count
        } else if (row.sync_status === 'SYNCED') {
          statistics.synced = row.count
        } else if (row.sync_status === 'FAILED') {
          statistics.failed = row.count
        }
      })

      return statistics
      // #endif

      // #ifdef H5
      console.warn('[OfflineDataService] H5环境不支持本地数据库')
      return {
        pending: 0,
        synced: 0,
        failed: 0,
        total: 0
      }
      // #endif
    } catch (error) {
      console.error('[OfflineDataService] 获取统计信息失败:', error)
      return {
        pending: 0,
        synced: 0,
        failed: 0,
        total: 0
      }
    }
  }
}

// 导出单例
const offlineDataService = new OfflineDataService()
export default offlineDataService
