<template>
  <view class="offline-data-page">
    <!-- 统计卡片 -->
    <view class="stats-card">
      <view class="stat-header">
        <text class="stat-title">离线数据统计</text>
        <u-icon name="info" color="#999999" size="18" @click="showStatisticsHelp"></u-icon>
      </view>

      <view class="stats-grid">
        <view class="stat-item pending">
          <text class="stat-value">{{ statistics.pendingRecords }}</text>
          <text class="stat-label">待上传记录</text>
        </view>

        <view class="stat-item uploaded">
          <text class="stat-value">{{ statistics.uploadedRecords }}</text>
          <text class="stat-label">已上传记录</text>
        </view>

        <view class="stat-item failed">
          <text class="stat-value">{{ statistics.failedRecords }}</text>
          <text class="stat-label">失败记录</text>
        </view>

        <view class="stat-item photos">
          <text class="stat-value">{{ statistics.totalPhotos }}</text>
          <text class="stat-label">照片数量</text>
        </view>
      </view>

      <view class="storage-info">
        <text class="storage-text">预计占用存储: {{ formatFileSize(statistics.estimatedSize) }}</text>
      </view>
    </view>

    <!-- 待上传记录列表 -->
    <view class="record-section">
      <view class="section-header">
        <text class="section-title">待上传记录</text>
        <text class="record-count" v-if="pendingRecords.length > 0">
          共{{ pendingRecords.length }}条
        </text>
      </view>

      <view v-if="pendingRecords.length === 0" class="empty-state">
        <u-icon name="checkmark" color="#4CAF50" size="80"></u-icon>
        <text class="empty-text">暂无待上传数据</text>
      </view>

      <view v-else class="record-list">
        <view
          v-for="record in pendingRecords"
          :key="record.record_id"
          class="record-item"
        >
          <view class="record-main">
            <view class="record-header">
              <text class="record-title">
                {{ record.task_name || `任务 ${record.task_id}` }}
              </text>
              <u-tag
                :type="getStatusType(record.upload_status)"
                size="mini"
              >
                {{ getStatusText(record.upload_status) }}
              </u-tag>
            </view>

            <view class="record-info">
              <text class="record-point">
                {{ record.point_name || `点位 ${record.point_id}` }}
              </text>
              <text class="record-time">
                {{ formatDateTime(record.check_time) }}
              </text>
            </view>

            <view class="record-meta" v-if="record.photo_count > 0">
              <u-icon name="photo" color="#999999" size="14"></u-icon>
              <text class="meta-text">{{ record.photo_count }}张照片</text>
            </view>
          </view>

          <view class="record-actions">
            <u-button
              size="mini"
              type="primary"
              plain
              @click="uploadSingleRecord(record)"
            >
              上传
            </u-button>
            <u-button
              size="mini"
              type="error"
              plain
              @click="deleteRecord(record)"
            >
              删除
            </u-button>
          </view>
        </view>
      </view>
    </view>

    <!-- 失败记录列表 -->
    <view class="failed-section" v-if="failedRecords.length > 0">
      <view class="section-header">
        <text class="section-title">上传失败记录</text>
        <text class="record-count">共{{ failedRecords.length }}条</text>
      </view>

      <view class="record-list">
        <view
          v-for="record in failedRecords"
          :key="record.record_id"
          class="record-item failed-item"
        >
          <view class="record-main">
            <view class="record-header">
              <text class="record-title">
                {{ record.task_name || `任务 ${record.task_id}` }}
              </text>
              <u-tag type="error" size="mini">上传失败</u-tag>
            </view>

            <view class="record-info">
              <text class="record-point">
                {{ record.point_name || `点位 ${record.point_id}` }}
              </text>
              <text class="record-time">
                {{ formatDateTime(record.check_time) }}
              </text>
            </view>

            <view class="error-message" v-if="record.upload_error">
              <u-icon name="warning" color="#FF5722" size="14"></u-icon>
              <text class="error-text">{{ record.upload_error }}</text>
            </view>

            <view class="retry-info" v-if="record.retry_count > 0">
              <text class="retry-text">已重试{{ record.retry_count }}次</text>
            </view>
          </view>

          <view class="record-actions">
            <u-button
              size="mini"
              type="warning"
              plain
              @click="retryRecord(record)"
            >
              重试
            </u-button>
            <u-button
              size="mini"
              type="error"
              plain
              @click="deleteRecord(record)"
            >
              删除
            </u-button>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部操作按钮 -->
    <view class="bottom-actions">
      <u-button
        type="primary"
        size="normal"
        shape="circle"
        :disabled="pendingRecords.length === 0"
        @click="uploadAll"
      >
        全部上传 ({{ pendingRecords.length }})
      </u-button>

      <view class="secondary-actions">
        <u-button
          size="normal"
          plain
          v-if="failedRecords.length > 0"
          @click="retryFailed"
        >
          重试失败记录
        </u-button>

        <u-button
          size="normal"
          plain
          @click="showCleanupDialog"
        >
          清理数据
        </u-button>
      </view>
    </view>

    <!-- 上传进度对话框 -->
    <upload-progress-dialog
      :visible="showUploadDialog"
      @update:visible="showUploadDialog = false"
      @upload-success="onUploadSuccess"
      @upload-failed="onUploadFailed"
    ></upload-progress-dialog>

    <!-- 清理数据对话框 -->
    <u-modal
      v-model="showCleanupModal"
      title="清理数据"
      :content="cleanupModalContent"
      @confirm="performCleanup"
    ></u-modal>
  </view>
</template>

<script>
import UploadService from '@/services/UploadService'
import DataCleanupService from '@/services/DataCleanupService'
import UploadProgressDialog from '@/components/UploadProgressDialog.vue'

export default {
  name: 'OfflineDataPage',
  components: {
    UploadProgressDialog
  },
  data() {
    return {
      pendingRecords: [],
      failedRecords: [],
      statistics: {
        totalRecords: 0,
        pendingRecords: 0,
        uploadedRecords: 0,
        failedRecords: 0,
        totalPhotos: 0,
        estimatedSize: 0
      },
      showUploadDialog: false,
      showCleanupModal: false,
      cleanupModalContent: ''
    }
  },
  mounted() {
    this.loadData()
  },
  methods: {
    /**
     * 加载数据
     */
    async loadData() {
      uni.showLoading({
        title: '加载中...'
      })

      try {
        // 加载待上传记录
        this.pendingRecords = await UploadService.getPendingRecords()

        // 加载统计数据
        this.statistics = await DataCleanupService.getDataStatistics()

        // 加载失败记录（从统计数据中推断，或单独查询）
        // TODO: 实际应该从服务中获取失败记录列表
        this.failedRecords = []

        console.log('离线数据加载完成', {
          pending: this.pendingRecords.length,
          statistics: this.statistics
        })
      } catch (error) {
        console.error('加载数据失败:', error)
        uni.showToast({
          title: '加载失败',
          icon: 'error'
        })
      } finally {
        uni.hideLoading()
      }
    },

    /**
     * 上传所有待上传记录
     */
    async uploadAll() {
      if (this.pendingRecords.length === 0) {
        uni.showToast({
          title: '暂无待上传数据',
          icon: 'none'
        })
        return
      }

      this.showUploadDialog = true
    },

    /**
     * 上传单条记录
     */
    async uploadSingleRecord(record) {
      uni.showLoading({
        title: '上传中...'
      })

      try {
        const result = await UploadService.uploadRecord(record)

        if (result.success) {
          uni.showToast({
            title: '上传成功',
            icon: 'success'
          })

          // 刷新数据
          await this.loadData()
        } else {
          uni.showToast({
            title: result.error || '上传失败',
            icon: 'error'
          })
        }
      } catch (error) {
        console.error('上传失败:', error)
        uni.showToast({
          title: '上传失败',
          icon: 'error'
        })
      } finally {
        uni.hideLoading()
      }
    },

    /**
     * 重试失败记录
     */
    async retryFailed() {
      if (this.failedRecords.length === 0) {
        uni.showToast({
          title: '暂无失败记录',
          icon: 'none'
        })
        return
      }

      uni.showModal({
        title: '确认重试',
        content: `确定要重试${this.failedRecords.length}条失败记录吗？`,
        success: async (res) => {
          if (res.confirm) {
            uni.showLoading({
              title: '重试中...'
            })

            try {
              const result = await UploadService.uploadFailedRecords()

              if (result.success) {
                uni.showToast({
                  title: '重试完成',
                  icon: 'success'
                })

                await this.loadData()
              } else {
                uni.showToast({
                  title: '重试失败',
                  icon: 'error'
                })
              }
            } catch (error) {
              console.error('重试失败:', error)
              uni.showToast({
                title: '重试失败',
                icon: 'error'
              })
            } finally {
              uni.hideLoading()
            }
          }
        }
      })
    },

    /**
     * 重试单条失败记录
     */
    async retryRecord(record) {
      uni.showLoading({
        title: '重试中...'
      })

      try {
        const result = await UploadService.uploadRecord(record)

        if (result.success) {
          uni.showToast({
            title: '重试成功',
            icon: 'success'
          })

          await this.loadData()
        } else {
          uni.showToast({
            title: result.error || '重试失败',
            icon: 'error'
          })
        }
      } catch (error) {
        console.error('重试失败:', error)
        uni.showToast({
          title: '重试失败',
          icon: 'error'
        })
      } finally {
        uni.hideLoading()
      }
    },

    /**
     * 删除记录
     */
    deleteRecord(record) {
      uni.showModal({
        title: '确认删除',
        content: '确定要删除该记录吗？此操作不可恢复。',
        success: async (res) => {
          if (res.confirm) {
            try {
              // TODO: 实现删除记录逻辑
              uni.showToast({
                title: '删除成功',
                icon: 'success'
              })

              await this.loadData()
            } catch (error) {
              console.error('删除失败:', error)
              uni.showToast({
                title: '删除失败',
                icon: 'error'
              })
            }
          }
        }
      })
    },

    /**
     * 显示清理数据对话框
     */
    showCleanupDialog() {
      this.cleanupModalContent = '清理将删除所有7天前的已上传记录和失败记录，确定继续吗？'
      this.showCleanupModal = true
    },

    /**
     * 执行数据清理
     */
    async performCleanup() {
      uni.showLoading({
        title: '清理中...'
      })

      try {
        const result = await DataCleanupService.performFullCleanup()

        if (result.success) {
          uni.showToast({
            title: `清理完成，删除${result.totalCleaned}条记录`,
            icon: 'success'
          })

          await this.loadData()
        } else {
          uni.showToast({
            title: '清理失败',
            icon: 'error'
          })
        }
      } catch (error) {
        console.error('清理失败:', error)
        uni.showToast({
          title: '清理失败',
          icon: 'error'
        })
      } finally {
        uni.hideLoading()
      }
    },

    /**
     * 获取状态类型
     */
    getStatusType(status) {
      const types = {
        'PENDING': 'info',
        'UPLOADING': 'primary',
        'UPLOADED': 'success',
        'FAILED': 'error'
      }
      return types[status] || 'info'
    },

    /**
     * 获取状态文本
     */
    getStatusText(status) {
      const texts = {
        'PENDING': '待上传',
        'UPLOADING': '上传中',
        'UPLOADED': '已上传',
        'FAILED': '上传失败'
      }
      return texts[status] || '未知'
    },

    /**
     * 格式化文件大小
     */
    formatFileSize(sizeInMB) {
      if (sizeInMB < 1024) {
        return `${sizeInMB} MB`
      } else {
        return `${(sizeInMB / 1024).toFixed(2)} GB`
      }
    },

    /**
     * 格式化日期时间
     */
    formatDateTime(timestamp) {
      if (!timestamp) return ''
      const date = new Date(timestamp)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hour = String(date.getHours()).padStart(2, '0')
      const minute = String(date.getMinutes()).padStart(2, '0')

      return `${year}-${month}-${day} ${hour}:${minute}`
    },

    /**
     * 显示统计帮助
     */
    showStatisticsHelp() {
      uni.showModal({
        title: '统计说明',
        content: `待上传记录: 尚未上传到服务器的数据\n已上传记录: 已成功上传的数据\n失败记录: 上传失败的记录\n照片数量: 所有记录中的照片总数`,
        showCancel: false
      })
    },

    /**
     * 上传成功回调
     */
    onUploadSuccess(result) {
      console.log('上传完成:', result)
      this.loadData()
    },

    /**
     * 上传失败回调
     */
    onUploadFailed(result) {
      console.log('上传失败:', result)
      this.loadData()
    }
  }
}
</script>

<style scoped>
.offline-data-page {
  padding: 24rpx;
  background-color: #F5F5F5;
  min-height: 100vh;
}

.stats-card {
  background-color: #FFFFFF;
  border-radius: 16rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.stat-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333333;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
  margin-bottom: 24rpx;
}

.stat-item {
  text-align: center;
  padding: 24rpx;
  border-radius: 12rpx;
  background-color: #F9F9F9;
}

.stat-item.pending {
  border: 2rpx solid #E3F2FD;
  background-color: #E3F2FD;
}

.stat-item.uploaded {
  border: 2rpx solid #E8F5E9;
  background-color: #E8F5E9;
}

.stat-item.failed {
  border: 2rpx solid #FFEBEE;
  background-color: #FFEBEE;
}

.stat-item.photos {
  border: 2rpx solid #FFF3E0;
  background-color: #FFF3E0;
}

.stat-value {
  font-size: 40rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 12rpx;
  display: block;
}

.stat-label {
  font-size: 24rpx;
  color: #666666;
}

.storage-info {
  text-align: center;
  padding-top: 16rpx;
  border-top: 1rpx solid #EEEEEE;
}

.storage-text {
  font-size: 24rpx;
  color: #999999;
}

.record-section,
.failed-section {
  background-color: #FFFFFF;
  border-radius: 16rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333333;
}

.record-count {
  font-size: 24rpx;
  color: #999999;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
}

.empty-text {
  margin-top: 24rpx;
  font-size: 28rpx;
  color: #999999;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.record-item {
  padding: 24rpx;
  border: 1rpx solid #EEEEEE;
  border-radius: 12rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.record-item.failed-item {
  border-color: #FFCDD2;
  background-color: #FFEBEE;
}

.record-main {
  flex: 1;
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.record-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333333;
  flex: 1;
  margin-right: 16rpx;
}

.record-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.record-point {
  font-size: 24rpx;
  color: #666666;
  flex: 1;
}

.record-time {
  font-size: 24rpx;
  color: #999999;
}

.record-meta {
  display: flex;
  align-items: center;
  margin-bottom: 8rpx;
}

.meta-text {
  margin-left: 8rpx;
  font-size: 24rpx;
  color: #999999;
}

.error-message {
  display: flex;
  align-items: center;
  margin-bottom: 8rpx;
}

.error-text {
  margin-left: 8rpx;
  font-size: 24rpx;
  color: #FF5722;
  flex: 1;
}

.retry-info {
  margin-top: 8rpx;
}

.retry-text {
  font-size: 24rpx;
  color: #FF9800;
}

.record-actions {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-left: 16rpx;
}

.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24rpx;
  background-color: #FFFFFF;
  border-top: 1rpx solid #EEEEEE;
}

.secondary-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
}

.secondary-actions button {
  flex: 1;
}
</style>
