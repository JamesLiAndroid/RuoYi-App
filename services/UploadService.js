/**
 * 数据上传服务
 * 功能：处理巡检记录、照片的离线数据上传
 * 支持：单条上传、批量上传、失败重试、进度回调
 *
 * @author James (Developer Agent)
 * @date 2025-11-25
 */

import { PointStatus } from '@/constants/PointStatus'

class UploadService {
  constructor() {
    this.db = null
    this.isUploading = false
    this.uploadQueue = []
    this.currentUploadTask = null
    this.uploadProgress = {
      total: 0,
      uploaded: 0,
      failed: 0,
      current: ''
    }
    this.listeners = []
    this.init()
  }

  /**
   * 初始化上传服务
   */
  async init() {
    await this.initDatabase()
    console.log('UploadService初始化完成')
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
   * 获取待上传记录
   * @returns {Promise<Array>} 待上传记录列表
   */
  async getPendingRecords() {
    try {
      await this.initDatabase()

      //#ifdef APP-PLUS
      const result = this.db.selectSync({
        name: 'inspection.db',
        sql: `
          SELECT r.*, t.task_name, p.point_name
          FROM inspection_record r
          LEFT JOIN inspection_task t ON r.task_id = t.task_id
          LEFT JOIN inspection_point p ON r.point_id = p.point_id
          WHERE r.upload_status = 'PENDING'
          ORDER BY r.check_time ASC
        `
      })
      //#endif

      //#ifdef H5
      const result = []
      //#endif

      console.log(`获取待上传记录: ${result.length}条`)
      return result
    } catch (error) {
      console.error('获取待上传记录失败:', error)
      return []
    }
  }

  /**
   * 上传单条记录
   * @param {Object} record - 巡检记录
   * @returns {Promise<Object>} 上传结果
   */
  async uploadRecord(record) {
    try {
      console.log('开始上传记录:', record.record_id)

      // 1. 查询关联的巡检记录项
      const items = await this.getRecordItems(record.record_id)

      // 2. 查询照片文件
      const photos = await this.getRecordPhotos(record.record_id)

      // 3. 构建上传数据包
      const uploadData = {
        record: {
          record_id: record.record_id,
          task_id: record.task_id,
          point_id: record.point_id,
          card_id: record.card_id,
          verification_method: record.verification_method,
          qr_code_content: record.qr_code_content,
          inspection_time: record.inspection_time,
          longitude: record.longitude,
          latitude: record.latitude,
          status: record.status,
          skip_reason: record.skip_reason,
          skip_remark: record.skip_remark,
          remark: record.remark
        },
        items: items.map(item => ({
          record_item_id: item.record_item_id,
          item_id: item.item_id,
          item_name: item.item_name,
          item_type: item.item_type,
          item_value: item.item_value,
          item_unit: item.item_unit,
          item_remark: item.item_remark,
          fill_time: item.fill_time
        })),
        photos: await this.preparePhotos(photos)
      }

      // 4. 上传到服务器（使用脚手架路径）
      console.log('发送上传请求...')
      const response = await uni.request({
        url: '/mobile/inspection-records/upload',
        method: 'POST',
        data: uploadData,
        timeout: 30000
      })

      if (response.statusCode === 200) {
        // 上传成功，标记为已上传
        await this.markAsUploaded(record.record_id)
        console.log('记录上传成功:', record.record_id)
        return { success: true, data: response.data }
      } else {
        // 上传失败
        const errorMsg = response.data?.msg || '上传失败'
        await this.markAsFailed(record.record_id, errorMsg)
        console.error('记录上传失败:', record.record_id, errorMsg)
        return { success: false, error: errorMsg }
      }
    } catch (error) {
      // 网络错误或其他异常
      const errorMsg = error.message || '网络错误'
      await this.markAsFailed(record.record_id, errorMsg)
      console.error('记录上传异常:', record.record_id, errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * 获取巡检记录项
   */
  async getRecordItems(recordId) {
    try {
      await this.initDatabase()

      //#ifdef APP-PLUS
      const result = this.db.selectSync({
        name: 'inspection.db',
        sql: `
          SELECT * FROM inspection_record_item
          WHERE record_id = ?
        `,
        values: [recordId]
      })
      //#endif

      //#ifdef H5
      const result = []
      //#endif

      return result
    } catch (error) {
      console.error('获取记录项失败:', error)
      return []
    }
  }

  /**
   * 获取巡检记录照片
   */
  async getRecordPhotos(recordId) {
    try {
      await this.initDatabase()

      //#ifdef APP-PLUS
      const result = this.db.selectSync({
        name: 'inspection.db',
        sql: `
          SELECT photo_paths, photo_count
          FROM inspection_record
          WHERE record_id = ?
        `,
        values: [recordId]
      })
      //#endif

      //#ifdef H5
      const result = []
      //#endif

      if (result.length === 0 || !result[0].photo_paths) {
        return []
      }

      const photoPaths = result[0].photo_paths.split(',')
      return photoPaths.map((path, index) => ({
        photo_index: index,
        photo_path: path
      }))
    } catch (error) {
      console.error('获取照片失败:', error)
      return []
    }
  }

  /**
   * 准备照片（转换为Base64）
   */
  async preparePhotos(photos) {
    const result = []
    for (const photo of photos) {
      try {
        //#ifdef APP-PLUS
        // 读取照片文件
        const fileContent = await uni.getFileSystemManager().readFile({
          filePath: photo.photo_path,
          encoding: 'base64'
        })

        result.push({
          photo_index: photo.photo_index,
          photo_name: photo.photo_path.split('/').pop(),
          photo_base64: `data:image/jpeg;base64,${fileContent}`
        })
        //#endif

        //#ifdef H5
        // H5环境下不处理照片
        //#endif
      } catch (error) {
        console.error('读取照片失败:', photo.photo_path, error)
      }
    }
    return result
  }

  /**
   * 标记记录为已上传
   */
  async markAsUploaded(recordId) {
    try {
      await this.initDatabase()
      const uploadTime = Date.now()

      //#ifdef APP-PLUS
      this.db.executeSync({
        name: 'inspection.db',
        sql: `
          UPDATE inspection_record
          SET upload_status = 'UPLOADED',
              upload_time = ?,
              upload_error = NULL,
              retry_count = 0
          WHERE record_id = ?
        `,
        values: [uploadTime, recordId]
      })
      //#endif

      //#ifdef H5
      // H5环境下不更新数据库
      //#endif

      console.log('记录标记为已上传:', recordId)
    } catch (error) {
      console.error('标记已上传失败:', error)
    }
  }

  /**
   * 标记记录为上传失败
   */
  async markAsFailed(recordId, errorMsg) {
    try {
      await this.initDatabase()
      const retryCount = await this.getRetryCount(recordId) + 1

      //#ifdef APP-PLUS
      this.db.executeSync({
        name: 'inspection.db',
        sql: `
          UPDATE inspection_record
          SET upload_status = 'FAILED',
              upload_error = ?,
              retry_count = ?
          WHERE record_id = ?
        `,
        values: [errorMsg, retryCount, recordId]
      })
      //#endif

      //#ifdef H5
      // H5环境下不更新数据库
      //#endif

      console.log('记录标记为上传失败:', recordId, '重试次数:', retryCount)
    } catch (error) {
      console.error('标记上传失败失败:', error)
    }
  }

  /**
   * 获取重试次数
   */
  async getRetryCount(recordId) {
    try {
      await this.initDatabase()

      //#ifdef APP-PLUS
      const result = this.db.selectSync({
        name: 'inspection.db',
        sql: `
          SELECT retry_count FROM inspection_record
          WHERE record_id = ?
        `,
        values: [recordId]
      })
      //#endif

      //#ifdef H5
      const result = []
      //#endif

      return result.length > 0 ? result[0].retry_count : 0
    } catch (error) {
      console.error('获取重试次数失败:', error)
      return 0
    }
  }

  /**
   * 批量上传所有记录
   * @param {Function} onProgress - 进度回调函数
   * @returns {Promise<Object>} 上传结果
   */
  async uploadAll(onProgress = null) {
    if (this.isUploading) {
      console.warn('已有上传任务正在执行')
      return { success: false, error: '上传任务正在执行中' }
    }

    try {
      this.isUploading = true
      const records = await this.getPendingRecords()

      this.uploadProgress = {
        total: records.length,
        uploaded: 0,
        failed: 0,
        current: ''
      }

      console.log(`开始批量上传，共${records.length}条记录`)

      // 逐个上传记录
      for (const record of records) {
        if (!this.isUploading) {
          console.log('上传任务被取消')
          break
        }

        this.uploadProgress.current = record.task_name || `任务${record.task_id}`
        this.notifyProgress()

        const result = await this.uploadRecord(record)

        if (result.success) {
          this.uploadProgress.uploaded++
        } else {
          this.uploadProgress.failed++
          console.error('上传失败:', result.error)
        }

        // 触发进度回调
        if (onProgress) {
          onProgress(this.uploadProgress)
        }

        // 短暂延迟，避免请求过于频繁
        await this.sleep(500)
      }

      console.log('批量上传完成', this.uploadProgress)
      return { success: true, result: this.uploadProgress }
    } catch (error) {
      console.error('批量上传失败:', error)
      return { success: false, error: error.message }
    } finally {
      this.isUploading = false
      this.uploadProgress.current = ''
      this.notifyProgress()
    }
  }

  /**
   * 取消上传任务
   */
  cancelUpload() {
    this.isUploading = false
    this.uploadProgress.current = '取消中...'
    this.notifyProgress()
    console.log('上传任务已取消')
  }

  /**
   * 重新上传失败记录
   * @param {Function} onProgress - 进度回调函数
   * @returns {Promise<Object>} 上传结果
   */
  async uploadFailedRecords(onProgress = null) {
    try {
      await this.initDatabase()

      //#ifdef APP-PLUS
      const records = this.db.selectSync({
        name: 'inspection.db',
        sql: `
          SELECT * FROM inspection_record
          WHERE upload_status = 'FAILED'
          ORDER BY check_time ASC
        `
      })
      //#endif

      //#ifdef H5
      const records = []
      //#endif

      console.log(`获取到${records.length}条失败记录，准备重新上传`)

      this.uploadProgress = {
        total: records.length,
        uploaded: 0,
        failed: 0,
        current: ''
      }

      for (const record of records) {
        if (!this.isUploading) {
          break
        }

        this.uploadProgress.current = record.task_name || `任务${record.task_id}`
        this.notifyProgress()

        const result = await this.uploadRecord(record)

        if (result.success) {
          this.uploadProgress.uploaded++
        } else {
          this.uploadProgress.failed++
        }

        if (onProgress) {
          onProgress(this.uploadProgress)
        }

        await this.sleep(500)
      }

      return { success: true, result: this.uploadProgress }
    } catch (error) {
      console.error('重新上传失败:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 清理已上传的旧数据
   */
  async cleanupUploadedData() {
    try {
      await this.initDatabase()
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)

      //#ifdef APP-PLUS
      const records = this.db.selectSync({
        name: 'inspection.db',
        sql: `
          SELECT record_id, photo_paths
          FROM inspection_record
          WHERE upload_status = 'UPLOADED'
            AND upload_time < ?
        `,
        values: [sevenDaysAgo]
      })
      //#endif

      //#ifdef H5
      const records = []
      //#endif

      console.log(`清理${records.length}条7天前的记录`)

      for (const record of records) {
        // 删除照片文件
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
              console.error('删除照片失败:', photoPath, error)
            }
          }
        }

        // 删除数据库记录
        try {
          //#ifdef APP-PLUS
          this.db.executeSync({
            name: 'inspection.db',
            sql: 'DELETE FROM inspection_record WHERE record_id = ?',
            values: [record.record_id]
          })

          this.db.executeSync({
            name: 'inspection.db',
            sql: 'DELETE FROM inspection_record_item WHERE record_id = ?',
            values: [record.record_id]
          })
          //#endif
        } catch (error) {
          console.error('删除记录失败:', record.record_id, error)
        }
      }

      console.log(`清理完成，删除${records.length}条记录`)
    } catch (error) {
      console.error('清理数据失败:', error)
    }
  }

  /**
   * 获取上传进度
   * @returns {Object} 当前上传进度
   */
  getUploadProgress() {
    return { ...this.uploadProgress }
  }

  /**
   * 监听上传进度变化
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消监听的函数
   */
  onProgressChange(callback) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback)
    }
  }

  /**
   * 通知进度变化
   */
  notifyProgress() {
    const progress = this.getUploadProgress()
    this.listeners.forEach(callback => {
      try {
        callback(progress)
      } catch (error) {
        console.error('进度监听器执行错误:', error)
      }
    })
  }

  /**
   * 工具方法：睡眠
   * @param {number} ms - 睡眠毫秒数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export default new UploadService()
