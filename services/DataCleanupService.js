/**
 * 数据清理服务
 * 功能：定期清理已上传的旧数据、失败记录管理
 * 支持：定时清理、自动清理策略、清理统计
 *
 * @author James (Developer Agent)
 * @date 2025-11-25
 */

import UploadService from './UploadService'

class DataCleanupService {
  constructor() {
    this.db = null
    this.cleanupTimer = null
    this.init()
  }

  /**
   * 初始化数据清理服务
   */
  init() {
    this.initDatabase()
    console.log('DataCleanupService初始化完成')
  }

  /**
   * 初始化数据库连接
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
   * 清理已上传的旧数据（超过7天）
   * 保守策略：保留已上传记录7天
   */
  async cleanupOldUploadedData() {
    try {
      await this.initDatabase()
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)

      console.log('开始清理7天前的已上传数据...')

      //#ifdef APP-PLUS
      // 查询需要清理的记录
      const records = this.db.selectSync({
        name: 'inspection.db',
        sql: `
          SELECT record_id, photo_paths, upload_time
          FROM inspection_record
          WHERE upload_status = 'UPLOADED'
            AND upload_time < ?
          ORDER BY upload_time ASC
        `,
        values: [sevenDaysAgo]
      })
      //#endif

      //#ifdef H5
      const records = []
      //#endif

      let cleanedCount = 0
      let totalPhotos = 0

      for (const record of records) {
        try {
          // 删除照片文件
          let photoDeletedCount = 0
          if (record.photo_paths) {
            const photoPaths = record.photo_paths.split(',')
            totalPhotos += photoPaths.length

            for (const photoPath of photoPaths) {
              try {
                //#ifdef APP-PLUS
                uni.getFileSystemManager().unlink({
                  filePath: photoPath
                })
                //#endif

                photoDeletedCount++
              } catch (error) {
                console.error('删除照片文件失败:', photoPath, error)
              }
            }
          }

          // 删除巡检记录项
          try {
            //#ifdef APP-PLUS
            this.db.executeSync({
              name: 'inspection.db',
              sql: 'DELETE FROM inspection_record_item WHERE record_id = ?',
              values: [record.record_id]
            })
            //#endif
          } catch (error) {
            console.error('删除记录项失败:', record.record_id, error)
          }

          // 删除巡检记录
          try {
            //#ifdef APP-PLUS
            this.db.executeSync({
              name: 'inspection.db',
              sql: 'DELETE FROM inspection_record WHERE record_id = ?',
              values: [record.record_id]
            })
            //#endif

            cleanedCount++
            console.log(`已清理记录: ${record.record_id}, 照片: ${photoDeletedCount}张`)
          } catch (error) {
            console.error('删除记录失败:', record.record_id, error)
          }

        } catch (error) {
          console.error('清理记录异常:', record.record_id, error)
        }
      }

      console.log(`清理完成: 共清理${cleanedCount}条记录, ${totalPhotos}张照片`)
      return {
        success: true,
        cleanedRecords: cleanedCount,
        cleanedPhotos: totalPhotos
      }
    } catch (error) {
      console.error('清理旧数据失败:', error)
      return {
        success: false,
        error: error.message,
        cleanedRecords: 0,
        cleanedPhotos: 0
      }
    }
  }

  /**
   * 清空失败记录
   * 清理所有上传失败的记录（谨慎操作）
   */
  async cleanupFailedRecords() {
    try {
      await this.initDatabase()

      console.log('开始清理失败记录...')

      //#ifdef APP-PLUS
      // 先统计失败记录数量
      const failedCountResult = this.db.selectSync({
        name: 'inspection.db',
        sql: `
          SELECT COUNT(*) as count
          FROM inspection_record
          WHERE upload_status = 'FAILED'
        `
      })

      const failedCount = failedCountResult[0]?.count || 0

      if (failedCount === 0) {
        console.log('没有失败记录需要清理')
        return { success: true, cleanedRecords: 0 }
      }

      console.log(`发现${failedCount}条失败记录，开始清理...`)

      // 查询失败记录的照片路径
      const failedRecords = this.db.selectSync({
        name: 'inspection.db',
        sql: `
          SELECT record_id, photo_paths
          FROM inspection_record
          WHERE upload_status = 'FAILED'
        `
      })

      // 删除照片文件
      for (const record of failedRecords) {
        if (record.photo_paths) {
          const photoPaths = record.photo_paths.split(',')
          for (const photoPath of photoPaths) {
            try {
              //#ifdef APP-PLUS
              uni.getFileSystemManager().unlink({
                filePath: photoPath
              })
              //#endif
            } catch (error) {
              console.error('删除失败记录照片失败:', photoPath, error)
            }
          }
        }
      }

      // 删除失败记录
      this.db.executeSync({
        name: 'inspection.db',
        sql: 'DELETE FROM inspection_record_item WHERE record_id IN (SELECT record_id FROM inspection_record WHERE upload_status = "FAILED")'
      })

      this.db.executeSync({
        name: 'inspection.db',
        sql: 'DELETE FROM inspection_record WHERE upload_status = "FAILED"'
      })
      //#endif

      console.log(`失败记录清理完成: 共清理${failedCount}条`)
      return {
        success: true,
        cleanedRecords: failedCount
      }
    } catch (error) {
      console.error('清理失败记录失败:', error)
      return {
        success: false,
        error: error.message,
        cleanedRecords: 0
      }
    }
  }

  /**
   * 获取数据统计信息
   * @returns {Promise<Object>} 数据统计
   */
  async getDataStatistics() {
    try {
      await this.initDatabase()

      //#ifdef APP-PLUS
      // 总记录数
      const totalResult = this.db.selectSync({
        name: 'inspection.db',
        sql: 'SELECT COUNT(*) as count FROM inspection_record'
      })

      // 待上传记录数
      const pendingResult = this.db.selectSync({
        name: 'inspection.db',
        sql: 'SELECT COUNT(*) as count FROM inspection_record WHERE upload_status = "PENDING"'
      })

      // 已上传记录数
      const uploadedResult = this.db.selectSync({
        name: 'inspection.db',
        sql: 'SELECT COUNT(*) as count FROM inspection_record WHERE upload_status = "UPLOADED"'
      })

      // 失败记录数
      const failedResult = this.db.selectSync({
        name: 'inspection.db',
        sql: 'SELECT COUNT(*) as count FROM inspection_record WHERE upload_status = "FAILED"'
      })

      // 7天内上传记录数
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
      const recentResult = this.db.selectSync({
        name: 'inspection.db',
        sql: 'SELECT COUNT(*) as count FROM inspection_record WHERE upload_status = "UPLOADED" AND upload_time >= ?',
        values: [sevenDaysAgo]
      })

      // 总照片数
      const photosResult = this.db.selectSync({
        name: 'inspection.db',
        sql: 'SELECT SUM(photo_count) as total FROM inspection_record'
      })

      // 计算数据大小（估算）
      const totalPhotos = photosResult[0]?.total || 0
      const estimatedSize = totalPhotos * 1024 * 1024 // 估算1MB/照片

      const stats = {
        totalRecords: totalResult[0]?.count || 0,
        pendingRecords: pendingResult[0]?.count || 0,
        uploadedRecords: uploadedResult[0]?.count || 0,
        failedRecords: failedResult[0]?.count || 0,
        recentUploadedRecords: recentResult[0]?.count || 0,
        totalPhotos: totalPhotos,
        estimatedSize: Math.round(estimatedSize / 1024 / 1024), // MB
        oldestUploadTime: null // TODO: 查询最早上传时间
      }
      //#endif

      //#ifdef H5
      const stats = {
        totalRecords: 0,
        pendingRecords: 0,
        uploadedRecords: 0,
        failedRecords: 0,
        recentUploadedRecords: 0,
        totalPhotos: 0,
        estimatedSize: 0,
        oldestUploadTime: null
      }
      //#endif

      console.log('数据统计信息:', stats)
      return stats
    } catch (error) {
      console.error('获取数据统计失败:', error)
      return {
        totalRecords: 0,
        pendingRecords: 0,
        uploadedRecords: 0,
        failedRecords: 0,
        recentUploadedRecords: 0,
        totalPhotos: 0,
        estimatedSize: 0,
        oldestUploadTime: null
      }
    }
  }

  /**
   * 获取可以清理的数据量
   * @returns {Promise<Object>} 可清理数据统计
   */
  async getCleanupStatistics() {
    try {
      await this.initDatabase()
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)

      //#ifdef APP-PLUS
      // 7天前的已上传记录
      const oldUploadedResult = this.db.selectSync({
        name: 'inspection.db',
        sql: 'SELECT COUNT(*) as count FROM inspection_record WHERE upload_status = "UPLOADED" AND upload_time < ?',
        values: [sevenDaysAgo]
      })

      // 失败记录
      const failedRecordsResult = this.db.selectSync({
        name: 'inspection.db',
        sql: 'SELECT COUNT(*) as count FROM inspection_record WHERE upload_status = "FAILED"'
      })
      //#endif

      //#ifdef H5
      const oldUploadedResult = [{ count: 0 }]
      const failedRecordsResult = [{ count: 0 }]
      //#endif

      return {
        oldUploadedRecords: oldUploadedResult[0]?.count || 0,
        failedRecords: failedRecordsResult[0]?.count || 0,
        totalCleanable: (oldUploadedResult[0]?.count || 0) + (failedRecordsResult[0]?.count || 0)
      }
    } catch (error) {
      console.error('获取清理统计失败:', error)
      return {
        oldUploadedRecords: 0,
        failedRecords: 0,
        totalCleanable: 0
      }
    }
  }

  /**
   * 启动定时清理任务
   * 每天凌晨3点自动清理
   */
  startScheduledCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    // 每小时检查一次
    this.cleanupTimer = setInterval(() => {
      const now = new Date()
      // 检查是否是凌晨3点
      if (now.getHours() === 3 && now.getMinutes() === 0) {
        console.log('执行定时清理任务...')
        this.cleanupOldUploadedData()
      }
    }, 60000) // 每分钟检查一次

    console.log('定时清理任务已启动（每天凌晨3点执行）')
  }

  /**
   * 停止定时清理任务
   */
  stopScheduledCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
      console.log('定时清理任务已停止')
    }
  }

  /**
   * 执行完整清理
   * 包含清理旧数据和失败记录
   */
  async performFullCleanup() {
    console.log('开始执行完整数据清理...')

    const uploadService = new UploadService()
    const uploadResult = await uploadService.cleanupUploadedData()

    const oldDataResult = await this.cleanupOldUploadedData()

    const failedResult = await this.cleanupFailedRecords()

    const result = {
      success: true,
      uploadService: uploadResult,
      oldData: oldDataResult,
      failedRecords: failedResult,
      totalCleaned: (uploadResult.cleanedRecords || 0) +
                   (oldDataResult.cleanedRecords || 0) +
                   (failedResult.cleanedRecords || 0),
      totalPhotos: (oldDataResult.cleanedPhotos || 0)
    }

    console.log('完整清理完成:', result)
    return result
  }

  /**
   * 获取清理建议
   * @returns {Promise<Object>} 清理建议
   */
  async getCleanupRecommendations() {
    const stats = await this.getDataStatistics()
    const cleanupStats = await this.getCleanupStatistics()

    const recommendations = []

    // 如果有7天前的数据，建议清理
    if (cleanupStats.oldUploadedRecords > 0) {
      recommendations.push({
        type: 'old_data',
        message: `发现${cleanupStats.oldUploadedRecords}条7天前的已上传记录，建议清理以节省存储空间`,
        priority: 'low',
        estimatedSpace: cleanupStats.oldUploadedRecords * 1024 * 1024 // 估算1MB/记录
      })
    }

    // 如果有失败记录，建议清理或重新上传
    if (cleanupStats.failedRecords > 0) {
      recommendations.push({
        type: 'failed_records',
        message: `发现${cleanupStats.failedRecords}条上传失败的记录，建议重新上传或清理`,
        priority: 'high',
        estimatedSpace: cleanupStats.failedRecords * 1024 * 1024
      })
    }

    // 如果待上传数据过多
    if (stats.pendingRecords > 50) {
      recommendations.push({
        type: 'pending_data',
        message: `发现${stats.pendingRecords}条待上传记录，建议及时上传`,
        priority: 'medium'
      })
    }

    return recommendations
  }
}

export default new DataCleanupService()
