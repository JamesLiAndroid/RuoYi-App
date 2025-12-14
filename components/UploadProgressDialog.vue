<template>
  <u-popup v-model="showDialog" mode="center" border-radius="8" :mask-close-able="false">
    <view class="upload-dialog">
      <view class="dialog-header">
        <text class="header-title">正在上传离线数据</text>
      </view>

      <view class="dialog-content">
        <!-- 进度条 -->
        <u-line-progress
          :percentage="percentage"
          active-color="#007AFF"
          height="8"
          inactive-color="#E5E5E5"
          :show-text="true"
        ></u-line-progress>

        <!-- 进度统计 -->
        <view class="progress-stats">
          <text class="progress-text">
            已上传 {{ progress.uploaded }}/{{ progress.total }} 条记录
          </text>
          <text class="progress-percentage">{{ percentage }}%</text>
        </view>

        <!-- 当前上传项 -->
        <view class="current-item" v-if="progress.current">
          <text class="current-label">正在上传:</text>
          <text class="current-value">{{ progress.current }}</text>
        </view>

        <!-- 失败统计 -->
        <view class="failed-stats" v-if="progress.failed > 0">
          <u-icon name="warning" color="#FF5722" size="16"></u-icon>
          <text class="failed-text">失败 {{ progress.failed }} 条</text>
        </view>

        <!-- 上传日志 -->
        <scroll-view class="upload-log" scroll-y :show-scrollbar="false">
          <view
            v-for="(log, index) in uploadLogs"
            :key="index"
            class="log-item"
            :class="{ 'log-success': log.success, 'log-failed': !log.success }"
          >
            <u-icon
              :name="log.success ? 'checkmark' : 'close'"
              :color="log.success ? '#4CAF50' : '#FF5722'"
              size="14"
            ></u-icon>
            <text class="log-message">{{ log.message }}</text>
          </view>
        </scroll-view>
      </view>

      <view class="dialog-actions">
        <u-button size="normal" @click="handleRunInBackground">
          在后台运行
        </u-button>
        <u-button size="normal" type="error" @click="handleCancel">
          取消上传
        </u-button>
      </view>
    </view>
  </u-popup>
</template>

<script>
import UploadService from '@/services/UploadService'

export default {
  name: 'UploadProgressDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    autoStart: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      showDialog: false,
      uploadLogs: [],
      unsubscribe: null,
      isUploading: false
    }
  },
  computed: {
    progress() {
      return UploadService.getUploadProgress()
    },
    percentage() {
      if (this.progress.total === 0) return 0
      return Math.round((this.progress.uploaded / this.progress.total) * 100)
    }
  },
  watch: {
    visible(newVal) {
      this.showDialog = newVal
      if (newVal && this.autoStart && !this.isUploading) {
        this.startUpload()
      }
    }
  },
  methods: {
    async startUpload() {
      if (this.isUploading) {
        console.log('上传已在进行中')
        return
      }

      this.isUploading = true
      this.uploadLogs = []

      try {
        const result = await UploadService.uploadAll(this.onProgressUpdate)

        this.addLog(`上传完成: 成功${result.result.uploaded}条, 失败${result.result.failed}条`, result.success)

        if (result.success) {
          uni.showToast({
            title: '上传完成',
            icon: 'success'
          })
          this.$emit('upload-success', result.result)
        } else {
          uni.showToast({
            title: '上传失败',
            icon: 'error'
          })
          this.$emit('upload-failed', result)
        }
      } catch (error) {
        console.error('上传异常:', error)
        this.addLog(`上传异常: ${error.message}`, false)
        this.$emit('upload-error', error)
      } finally {
        this.isUploading = false
        this.$emit('update:visible', false)
      }
    },
    onProgressUpdate(progress) {
      // 添加上传日志
      if (progress.uploaded > 0 || progress.failed > 0) {
        const message = progress.failed > 0
          ? `已上传 ${progress.uploaded} 条，失败 ${progress.failed} 条`
          : `已上传 ${progress.uploaded} 条`

        this.addLog(message, progress.failed === 0)
      }
    },
    addLog(message, success = true) {
      const timestamp = new Date().toLocaleTimeString()
      const logMessage = `[${timestamp}] ${message}`

      this.uploadLogs.push({
        message: logMessage,
        success: success,
        timestamp: Date.now()
      })

      // 保持最近20条日志
      if (this.uploadLogs.length > 20) {
        this.uploadLogs.shift()
      }

      // 自动滚动到底部
      this.$nextTick(() => {
        // 滚动逻辑在scroll-view中处理
      })
    },
    handleRunInBackground() {
      this.addLog('切换到后台运行', true)
      this.$emit('update:visible', false)
      this.$emit('background-upload')
    },
    handleCancel() {
      uni.showModal({
        title: '确认取消',
        content: '确定要取消上传吗？',
        success: (res) => {
          if (res.confirm) {
            UploadService.cancelUpload()
            this.isUploading = false
            this.addLog('用户取消了上传', false)
            this.$emit('update:visible', false)
            this.$emit('upload-canceled')
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.upload-dialog {
  width: 640rpx;
  max-height: 80vh;
  padding: 32rpx;
  background-color: #ffffff;
  border-radius: 16rpx;
}

.dialog-header {
  margin-bottom: 32rpx;
  text-align: center;
}

.header-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333333;
}

.dialog-content {
  margin-bottom: 32rpx;
}

.progress-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24rpx;
}

.progress-text {
  font-size: 28rpx;
  color: #666666;
}

.progress-percentage {
  font-size: 28rpx;
  font-weight: bold;
  color: #007AFF;
}

.current-item {
  margin-top: 24rpx;
  padding: 16rpx;
  background-color: #F5F5F5;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
}

.current-label {
  font-size: 24rpx;
  color: #999999;
  margin-right: 12rpx;
}

.current-value {
  font-size: 24rpx;
  color: #333333;
  flex: 1;
}

.failed-stats {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  padding: 12rpx;
  background-color: #FFF3E0;
  border-radius: 8rpx;
}

.failed-text {
  margin-left: 8rpx;
  font-size: 24rpx;
  color: #FF5722;
}

.upload-log {
  margin-top: 24rpx;
  max-height: 300rpx;
  padding: 16rpx;
  background-color: #F9F9F9;
  border-radius: 8rpx;
}

.log-item {
  display: flex;
  align-items: center;
  padding: 8rpx 0;
  border-bottom: 1rpx solid #EEEEEE;
}

.log-item:last-child {
  border-bottom: none;
}

.log-message {
  margin-left: 12rpx;
  font-size: 24rpx;
  color: #666666;
}

.log-success .log-message {
  color: #4CAF50;
}

.log-failed .log-message {
  color: #FF5722;
}

.dialog-actions {
  display: flex;
  gap: 24rpx;
}

.dialog-actions button {
  flex: 1;
}
</style>
