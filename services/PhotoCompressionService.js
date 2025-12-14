/**
 * 照片压缩服务类 - 处理照片压缩、尺寸调整和格式转换
 * 支持条件编译：APP-PLUS（原生压缩）vs H5（Canvas压缩）
 */

class PhotoCompressionService {
  constructor() {
    // 压缩配置
    this.maxWidth = 1920 // 最大宽度
    this.maxHeight = 1080 // 最大高度
    this.maxSize = 1024 * 1024 // 最大文件大小（1MB）
    this.quality = 0.85 // JPEG压缩质量（85%）
    this.format = 'jpg' // 输出格式
  }

  /**
   * 压缩单张照片
   * @param {String} filePath - 原始照片路径
   * @returns {Promise<Object>} - 压缩结果 { success, compressedPath, originalSize, compressedSize, compressionRatio }
   */
  async compressPhoto(filePath) {
    try {
      // 获取原始文件信息
      const originalInfo = await this.getFileInfo(filePath)

      // 如果文件已经满足要求，直接返回
      if (originalInfo.size <= this.maxSize) {
        const imageInfo = await this.getImageInfo(filePath)
        if (imageInfo.width <= this.maxWidth && imageInfo.height <= this.maxHeight) {
          return {
            success: true,
            compressedPath: filePath,
            originalSize: originalInfo.size,
            compressedSize: originalInfo.size,
            compressionRatio: 1.0,
            skipped: true
          }
        }
      }

      // 执行压缩
      const compressedPath = await this.doCompress(filePath)

      // 获取压缩后文件信息
      const compressedInfo = await this.getFileInfo(compressedPath)

      return {
        success: true,
        compressedPath: compressedPath,
        originalSize: originalInfo.size,
        compressedSize: compressedInfo.size,
        compressionRatio: (compressedInfo.size / originalInfo.size).toFixed(2),
        skipped: false
      }

    } catch (error) {
      console.error('照片压缩失败:', error)
      return {
        success: false,
        error: error.message || '压缩失败'
      }
    }
  }

  /**
   * 批量压缩照片
   * @param {Array<String>} filePaths - 原始照片路径数组
   * @param {Function} progressCallback - 进度回调函数 (current, total) => {}
   * @returns {Promise<Array<Object>>} - 压缩结果数组
   */
  async compressPhotos(filePaths, progressCallback) {
    const results = []

    for (let i = 0; i < filePaths.length; i++) {
      const result = await this.compressPhoto(filePaths[i])
      results.push(result)

      if (progressCallback) {
        progressCallback(i + 1, filePaths.length)
      }
    }

    return results
  }

  /**
   * 执行实际压缩（平台特定）
   * @private
   */
  async doCompress(filePath) {
    //#ifdef APP-PLUS
    // APP环境：使用原生压缩API
    return new Promise((resolve, reject) => {
      plus.zip.compressImage({
        src: filePath,
        dst: this.getCompressedPath(filePath),
        width: this.maxWidth + 'px',
        height: this.maxHeight + 'px',
        quality: Math.floor(this.quality * 100),
        overwrite: true
      }, (event) => {
        resolve(event.target)
      }, (error) => {
        reject(new Error(error.message || '原生压缩失败'))
      })
    })
    //#endif

    //#ifdef H5
    // H5环境：使用Canvas压缩
    return await this.compressWithCanvas(filePath)
    //#endif
  }

  /**
   * Canvas压缩（H5环境）
   * @private
   */
  //#ifdef H5
  async compressWithCanvas(filePath) {
    return new Promise((resolve, reject) => {
      // 创建Image对象
      const img = new Image()
      img.crossOrigin = 'Anonymous'

      img.onload = () => {
        try {
          // 计算目标尺寸
          let { width, height } = this.calculateTargetSize(img.width, img.height)

          // 创建Canvas
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          // 绘制图片
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)

          // 转换为Blob
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Canvas转换失败'))
              return
            }

            // 保存到临时文件
            const compressedPath = this.getCompressedPath(filePath)
            const reader = new FileReader()

            reader.onload = () => {
              // 将Blob保存到文件系统（使用uni.saveFile）
              uni.saveFile({
                tempFilePath: URL.createObjectURL(blob),
                success: (res) => {
                  resolve(res.savedFilePath)
                },
                fail: (error) => {
                  reject(new Error(error.errMsg || '保存文件失败'))
                }
              })
            }

            reader.onerror = () => {
              reject(new Error('读取Blob失败'))
            }

            reader.readAsDataURL(blob)
          }, 'image/jpeg', this.quality)

        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => {
        reject(new Error('加载图片失败'))
      }

      img.src = filePath
    })
  }
  //#endif

  /**
   * 计算目标尺寸（保持宽高比）
   * @private
   */
  calculateTargetSize(width, height) {
    let targetWidth = width
    let targetHeight = height

    // 如果超过最大宽度
    if (targetWidth > this.maxWidth) {
      targetHeight = Math.floor(targetHeight * (this.maxWidth / targetWidth))
      targetWidth = this.maxWidth
    }

    // 如果超过最大高度
    if (targetHeight > this.maxHeight) {
      targetWidth = Math.floor(targetWidth * (this.maxHeight / targetHeight))
      targetHeight = this.maxHeight
    }

    return { width: targetWidth, height: targetHeight }
  }

  /**
   * 获取文件信息
   * @private
   */
  async getFileInfo(filePath) {
    return new Promise((resolve, reject) => {
      uni.getFileInfo({
        filePath: filePath,
        success: (res) => {
          resolve({
            size: res.size,
            path: filePath
          })
        },
        fail: (error) => {
          reject(new Error(error.errMsg || '获取文件信息失败'))
        }
      })
    })
  }

  /**
   * 获取图片信息
   * @private
   */
  async getImageInfo(filePath) {
    return new Promise((resolve, reject) => {
      uni.getImageInfo({
        src: filePath,
        success: (res) => {
          resolve({
            width: res.width,
            height: res.height,
            path: filePath,
            orientation: res.orientation,
            type: res.type
          })
        },
        fail: (error) => {
          reject(new Error(error.errMsg || '获取图片信息失败'))
        }
      })
    })
  }

  /**
   * 生成压缩后文件路径
   * @private
   */
  getCompressedPath(originalPath) {
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)

    //#ifdef APP-PLUS
    // APP环境：使用应用缓存目录
    return `${plus.io.PRIVATE_DOC}/compressed_${timestamp}_${randomStr}.jpg`
    //#endif

    //#ifdef H5
    // H5环境：使用临时文件路径
    return `${wx.env.USER_DATA_PATH}/compressed_${timestamp}_${randomStr}.jpg`
    //#endif
  }

  /**
   * 删除压缩文件（清理缓存）
   * @param {String} filePath - 压缩文件路径
   */
  async deleteCompressedFile(filePath) {
    try {
      await new Promise((resolve, reject) => {
        uni.removeSavedFile({
          filePath: filePath,
          success: resolve,
          fail: reject
        })
      })
      return true
    } catch (error) {
      console.error('删除压缩文件失败:', error)
      return false
    }
  }

  /**
   * 格式化文件大小
   * @param {Number} bytes - 字节数
   * @returns {String} - 格式化后的大小（如：1.5MB）
   */
  formatFileSize(bytes) {
    if (bytes < 1024) {
      return `${bytes}B`
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)}KB`
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
    }
  }

  /**
   * 获取压缩统计信息
   * @param {Array<Object>} compressResults - 压缩结果数组
   * @returns {Object} - 统计信息
   */
  getCompressionStats(compressResults) {
    const stats = {
      total: compressResults.length,
      success: 0,
      failed: 0,
      skipped: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      averageCompressionRatio: 0
    }

    compressResults.forEach(result => {
      if (result.success) {
        stats.success++
        if (result.skipped) {
          stats.skipped++
        }
        stats.totalOriginalSize += result.originalSize
        stats.totalCompressedSize += result.compressedSize
      } else {
        stats.failed++
      }
    })

    if (stats.success > 0) {
      stats.averageCompressionRatio = (stats.totalCompressedSize / stats.totalOriginalSize).toFixed(2)
    }

    return stats
  }

  /**
   * 验证照片是否符合要求
   * @param {String} filePath - 照片路径
   * @returns {Promise<Object>} - 验证结果 { valid, errors }
   */
  async validatePhoto(filePath) {
    const errors = []

    try {
      // 检查文件是否存在
      const fileInfo = await this.getFileInfo(filePath)

      // 检查文件大小
      if (fileInfo.size > this.maxSize * 2) {
        errors.push(`文件过大（${this.formatFileSize(fileInfo.size)}），建议不超过${this.formatFileSize(this.maxSize * 2)}`)
      }

      // 检查图片信息
      const imageInfo = await this.getImageInfo(filePath)

      // 检查图片格式
      if (!['jpg', 'jpeg', 'png', 'webp'].includes(imageInfo.type.toLowerCase())) {
        errors.push(`不支持的图片格式：${imageInfo.type}`)
      }

      // 检查图片尺寸
      if (imageInfo.width < 320 || imageInfo.height < 240) {
        errors.push(`图片分辨率过低（${imageInfo.width}×${imageInfo.height}）`)
      }

      return {
        valid: errors.length === 0,
        errors: errors,
        fileInfo: fileInfo,
        imageInfo: imageInfo
      }

    } catch (error) {
      return {
        valid: false,
        errors: ['文件无效或无法访问']
      }
    }
  }
}

// 单例模式
const photoCompressionService = new PhotoCompressionService()
export default photoCompressionService
