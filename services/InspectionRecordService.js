/**
 * 巡检记录服务 - 保存NFC验证记录、巡检数据到本地SQLite
 * 支持离线模式，数据状态跟踪（待同步/已同步）
 */

import LocationService from './LocationService'

class InspectionRecordService {
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
   * 保存NFC读卡记录
   * @param {Object} recordData - 记录数据
   * @returns {Object} 保存结果
   */
  async saveNfcRecord(recordData) {
    try {
      await this.initDatabase()

      const {
        taskId,
        pointId,
        nfcUid,
        inspectorId = 1, // 默认巡检员ID
        verificationMethod = 'NFC',
        qrCodeContent = null, // 二维码内容
        imageUrls = null, // 照片路径（逗号分隔）
        videoUrls = null, // 视频路径（逗号分隔）
        remark = null, // 备注
        location = null
      } = recordData

      const now = new Date().toISOString()

      //#ifdef APP-PLUS
      const sql = `
        INSERT INTO inspection_record (
          task_id, point_id, inspector_id, verification_method,
          nfc_uid, qr_code_content, inspection_time,
          image_urls, video_urls, remark,
          longitude, latitude,
          status, sync_status, create_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING', ?)
      `

      const result = plus.sqlite.executeSqlSync({
        db: this.db,
        sql: sql,
        arguments: [
          taskId, pointId, inspectorId, verificationMethod,
          nfcUid, qrCodeContent, now,
          imageUrls, videoUrls, remark,
          location ? location.longitude : null,
          location ? location.latitude : null,
          now
        ]
      })

      // 获取插入的记录ID
      const recordId = result.id || this.getLastInsertRowId()
      //#endif

      //#ifdef H5
      // H5环境模拟
      const recordId = Date.now()
      //#endif

      console.log('巡检记录保存成功:', { recordId, taskId, pointId, nfcUid, verificationMethod, imageCount: imageUrls ? imageUrls.split(',').length : 0 })

      return {
        success: true,
        recordId: recordId,
        message: '记录保存成功'
      }

    } catch (error) {
      console.error('保存巡检记录失败:', error)
      return {
        success: false,
        error: '保存记录失败: ' + (error.message || '未知错误')
      }
    }
  }

  /**
   * 保存巡检项目结果
   * @param {number} recordId - 记录ID
   * @param {Array} results - 项目结果数组
   * @returns {Object} 保存结果
   */
  async saveInspectionResults(recordId, results) {
    try {
      await this.initDatabase()

      //#ifdef APP-PLUS
      await plus.sqlite.executeSqlSync({
        db: this.db,
        sql: 'BEGIN TRANSACTION'
      })

      try {
        for (const result of results) {
          const sql = `
            INSERT INTO inspection_item_result (
              record_id, item_id, item_name, item_type,
              actual_value, is_abnormal, abnormal_remark,
              sync_status, create_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
          `

          await plus.sqlite.executeSqlSync({
            db: this.db,
            sql: sql,
            arguments: [
              recordId,
              result.itemId,
              result.itemName,
              result.itemType,
              result.actualValue,
              result.isAbnormal ? 1 : 0,
              result.abnormalRemark || null,
              new Date().toISOString()
            ]
          })
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

      //#ifdef H5
      // H5环境模拟
      //#endif

      console.log(`项目结果保存成功: ${results.length}项`)

      return {
        success: true,
        message: `保存${results.length}项结果成功`
      }

    } catch (error) {
      console.error('保存项目结果失败:', error)
      return {
        success: false,
        error: '保存结果失败: ' + (error.message || '未知错误')
      }
    }
  }

  /**
   * 获取巡检记录详情
   * @param {number} recordId - 记录ID
   * @returns {Object} 记录详情
   */
  async getRecordDetail(recordId) {
    try {
      await this.initDatabase()

      //#ifdef APP-PLUS
      // 查询记录基本信息
      const recordSql = `
        SELECT * FROM inspection_record WHERE record_id = ?
      `
      const records = plus.sqlite.selectSqlSync({
        db: this.db,
        sql: recordSql,
        arguments: [recordId]
      })

      if (records.length === 0) {
        return null
      }

      // 查询项目结果
      const resultSql = `
        SELECT * FROM inspection_item_result
        WHERE record_id = ?
        ORDER BY item_id
      `
      const results = plus.sqlite.selectSqlSync({
        db: this.db,
        sql: resultSql,
        arguments: [recordId]
      })

      return {
        record: records[0],
        results: results
      }
      //#endif

      //#ifdef H5
      return {
        record: {
          record_id: recordId,
          task_id: 1,
          point_id: 1,
          nfc_uid: 'MOCK_UID',
          inspection_time: new Date().toISOString()
        },
        results: []
      }
      //#endif

    } catch (error) {
      console.error('获取记录详情失败:', error)
      return null
    }
  }

  /**
   * 获取任务的所有记录
   * @param {number} taskId - 任务ID
   * @returns {Array} 记录列表
   */
  async getTaskRecords(taskId) {
    try {
      await this.initDatabase()

      //#ifdef APP-PLUS
      const sql = `
        SELECT ir.*, p.point_name, p.point_code
        FROM inspection_record ir
        LEFT JOIN inspection_point p ON ir.point_id = p.point_id
        WHERE ir.task_id = ?
        ORDER BY ir.inspection_time DESC
      `

      const result = plus.sqlite.selectSqlSync({
        db: this.db,
        sql: sql,
        arguments: [taskId]
      })

      return result || []
      //#endif

      //#ifdef H5
      return []
      //#endif

    } catch (error) {
      console.error('获取任务记录失败:', error)
      return []
    }
  }

  /**
   * 完成巡检记录（AC2）
   * @param {Object} data - 完成数据
   * @returns {Object} 保存结果
   */
  async completeRecord(data) {
    try {
      await this.initDatabase()

      const {
        recordId,
        status = 'COMPLETED',
        imageUrls = null,
        photoCount = 0,
        inspectionTime = new Date().toISOString()
      } = data

      //#ifdef APP-PLUS
      const sql = `
        UPDATE inspection_record
        SET status = ?,
            image_urls = ?,
            photo_count = ?,
            inspection_time = ?,
            update_time = ?
        WHERE record_id = ?
      `

      await plus.sqlite.executeSqlSync({
        db: this.db,
        sql: sql,
        arguments: [
          status,
          imageUrls,
          photoCount,
          inspectionTime,
          new Date().toISOString(),
          recordId
        ]
      })
      //#endif

      console.log('巡检记录完成:', { recordId, status, photoCount })

      return {
        success: true,
        message: '记录完成成功'
      }

    } catch (error) {
      console.error('完成巡检记录失败:', error)
      return {
        success: false,
        error: '完成记录失败: ' + (error.message || '未知错误')
      }
    }
  }

  /**
   * 更新照片路径和数量（AC2）
   * @param {number} recordId - 记录ID
   * @param {string} imageUrls - 照片路径（逗号分隔）
   * @param {number} photoCount - 照片数量
   * @returns {Object} 保存结果
   */
  async updatePhotoUrls(recordId, imageUrls, photoCount) {
    try {
      await this.initDatabase()

      //#ifdef APP-PLUS
      const sql = `
        UPDATE inspection_record
        SET image_urls = ?,
            photo_count = ?,
            update_time = ?
        WHERE record_id = ?
      `

      await plus.sqlite.executeSqlSync({
        db: this.db,
        sql: sql,
        arguments: [
          imageUrls,
          photoCount,
          new Date().toISOString(),
          recordId
        ]
      })
      //#endif

      console.log('照片路径更新成功:', { recordId, photoCount })

      return {
        success: true,
        message: '照片路径更新成功'
      }

    } catch (error) {
      console.error('更新照片路径失败:', error)
      return {
        success: false,
        error: '更新照片路径失败: ' + (error.message || '未知错误')
      }
    }
  }

  /**
   * 标记记录为已同步
   * @param {number} recordId - 记录ID
   */
  async markAsSynced(recordId) {
    try {
      await this.initDatabase()

      const now = new Date().toISOString()

      //#ifdef APP-PLUS
      await plus.sqlite.executeSqlSync({
        db: this.db,
        sql: `
          UPDATE inspection_record
          SET sync_status = 'SYNCED', sync_time = ?
          WHERE record_id = ?
        `,
        arguments: [now, recordId]
      })

      await plus.sqlite.executeSqlSync({
        db: this.db,
        sql: `
          UPDATE inspection_item_result
          SET sync_status = 'SYNCED', sync_time = ?
          WHERE record_id = ?
        `,
        arguments: [now, recordId]
      })
      //#endif

      console.log('记录标记为已同步:', recordId)

    } catch (error) {
      console.error('标记同步状态失败:', error)
    }
  }

  /**
   * 获取待同步的记录数量
   * @returns {Object} 统计信息
   */
  async getPendingSyncCount() {
    try {
      await this.initDatabase()

      //#ifdef APP-PLUS
      const recordSql = `
        SELECT COUNT(*) as count FROM inspection_record
        WHERE sync_status = 'PENDING'
      `

      const resultRecords = plus.sqlite.selectSqlSync({
        db: this.db,
        sql: recordSql
      })

      const recordSql2 = `
        SELECT COUNT(*) as count FROM inspection_item_result
        WHERE sync_status = 'PENDING'
      `

      const resultItems = plus.sqlite.selectSqlSync({
        db: this.db,
        sql: recordSql2
      })

      return {
        records: resultRecords[0]?.count || 0,
        items: resultItems[0]?.count || 0,
        total: (resultRecords[0]?.count || 0) + (resultItems[0]?.count || 0)
      }
      //#endif

      //#ifdef H5
      return {
        records: 0,
        items: 0,
        total: 0
      }
      //#endif

    } catch (error) {
      console.error('获取待同步数量失败:', error)
      return {
        records: 0,
        items: 0,
        total: 0
      }
    }
  }

  /**
   * 删除已同步的记录（清理本地数据）
   * @param {number} days - 保留天数
   */
  async cleanSyncedRecords(days = 30) {
    try {
      await this.initDatabase()

      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      const cutoffStr = cutoffDate.toISOString()

      //#ifdef APP-PLUS
      await plus.sqlite.executeSqlSync({
        db: this.db,
        sql: `
          DELETE FROM inspection_item_result
          WHERE record_id IN (
            SELECT record_id FROM inspection_record
            WHERE sync_status = 'SYNCED' AND sync_time < ?
          )
        `,
        arguments: [cutoffStr]
      })

      await plus.sqlite.executeSqlSync({
        db: this.db,
        sql: `
          DELETE FROM inspection_record
          WHERE sync_status = 'SYNCED' AND sync_time < ?
        `,
        arguments: [cutoffStr]
      })
      //#endif

      console.log(`清理${days}天前的已同步记录完成`)

    } catch (error) {
      console.error('清理记录失败:', error)
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
const inspectionRecordService = new InspectionRecordService()
export default inspectionRecordService
