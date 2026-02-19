<template>
  <view class="upload-settings-page">
    <view class="settings-section">
      <view class="section-title">上传策略</view>

      <!-- 仅WiFi上传 -->
      <view class="setting-item">
        <view class="setting-info">
          <view class="setting-label">仅WiFi上传</view>
          <view class="setting-desc">开启后仅在WiFi网络下自动上传，避免消耗移动数据流量</view>
        </view>
        <u-switch
          v-model="settings.wifiOnly"
          active-color="#007AFF"
          @change="handleWifiOnlyChange"
        ></u-switch>
      </view>

      <!-- 自动上传 -->
      <view class="setting-item">
        <view class="setting-info">
          <view class="setting-label">自动上传</view>
          <view class="setting-desc">开启后检测到网络连接时自动上传待上传数据</view>
        </view>
        <u-switch
          v-model="settings.autoUpload"
          active-color="#007AFF"
          @change="handleAutoUploadChange"
        ></u-switch>
      </view>
    </view>

    <view class="settings-section">
      <view class="section-title">数据管理</view>

      <!-- 上传完成后删除本地数据 -->
      <view class="setting-item">
        <view class="setting-info">
          <view class="setting-label">上传后删除本地数据</view>
          <view class="setting-desc">开启后上传成功立即删除，关闭后保留7天自动清理</view>
        </view>
        <u-switch
          v-model="settings.deleteAfterUpload"
          active-color="#007AFF"
          @change="handleDeleteAfterUploadChange"
        ></u-switch>
      </view>
    </view>

    <view class="settings-section">
      <view class="section-title">上传重试</view>

      <!-- 上传失败自动重试次数 -->
      <view class="setting-item clickable" @click="showRetryPicker = true">
        <view class="setting-info">
          <view class="setting-label">失败自动重试次数</view>
          <view class="setting-desc">上传失败后自动重试的次数</view>
        </view>
        <view class="setting-value">
          <text class="value-text">{{ getRetryText(settings.retryCount) }}</text>
          <u-icon name="arrow-right" color="#999999" size="16"></u-icon>
        </view>
      </view>
    </view>

    <!-- 当前网络状态 -->
    <view class="network-status-section">
      <view class="status-header">
        <u-icon name="wifi" :color="networkStatusColor" size="20"></u-icon>
        <text class="status-title">当前网络状态</text>
      </view>
      <view class="status-info">
        <view class="status-item">
          <text class="status-label">网络类型:</text>
          <text class="status-value">{{ networkTypeText }}</text>
        </view>
        <view class="status-item">
          <text class="status-label">服务器状态:</text>
          <text class="status-value" :style="{ color: serverStatusColor }">
            {{ serverStatusText }}
          </text>
        </view>
        <view class="status-item">
          <text class="status-label">允许上传:</text>
          <text class="status-value" :style="{ color: canUploadColor }">
            {{ canUploadText }}
          </text>
        </view>
      </view>
    </view>

    <!-- 重置按钮 -->
    <view class="reset-section">
      <u-button
        type="default"
        size="normal"
        plain
        @click="handleReset"
      >
        恢复默认设置
      </u-button>
    </view>

    <!-- 重试次数选择器 -->
    <u-picker
      v-model="showRetryPicker"
      :columns="retryOptions"
      @confirm="handleRetryConfirm"
      @cancel="showRetryPicker = false"
    ></u-picker>
  </view>
</template>

<script>
import NetworkService from '@/services/NetworkService'

export default {
  name: 'UploadSettingsPage',
  data() {
    return {
      settings: {
        wifiOnly: true,           // 仅WiFi上传，默认开启
        autoUpload: false,        // 自动上传，默认关闭
        deleteAfterUpload: false, // 上传后删除，默认关闭
        retryCount: 3             // 重试次数，默认3次
      },
      showRetryPicker: false,
      retryOptions: [
        [
          { label: '不重试', value: 0 },
          { label: '重试1次', value: 1 },
          { label: '重试3次', value: 3 },
          { label: '重试5次', value: 5 }
        ]
      ],
      networkStatus: {
        isOnline: false,
        networkType: 'none',
        serverReachable: false
      }
    }
  },
  computed: {
    networkTypeText() {
      const types = {
        'wifi': 'WiFi',
        '2g': '2G',
        '3g': '3G',
        '4g': '4G',
        '5g': '5G',
        'none': '无网络',
        'unknown': '未知'
      }
      return types[this.networkStatus.networkType] || '未知'
    },
    networkStatusColor() {
      return this.networkStatus.isOnline ? '#4CAF50' : '#999999'
    },
    serverStatusText() {
      if (!this.networkStatus.isOnline) return '离线'
      return this.networkStatus.serverReachable ? '已连接' : '不可达'
    },
    serverStatusColor() {
      if (!this.networkStatus.isOnline) return '#999999'
      return this.networkStatus.serverReachable ? '#4CAF50' : '#FF5722'
    },
    canUploadText() {
      const canUpload = NetworkService.canUpload(this.settings.wifiOnly)
      return canUpload ? '是' : '否'
    },
    canUploadColor() {
      const canUpload = NetworkService.canUpload(this.settings.wifiOnly)
      return canUpload ? '#4CAF50' : '#FF5722'
    }
  },
  mounted() {
    this.loadSettings()
    this.loadNetworkStatus()
    this.startNetworkMonitoring()
  },
  beforeUnmount() {
    this.stopNetworkMonitoring()
  },
  methods: {
    /**
     * 加载设置
     */
    loadSettings() {
      try {
        const savedSettings = uni.getStorageSync('upload_settings')
        if (savedSettings) {
          this.settings = {
            ...this.settings,
            ...JSON.parse(savedSettings)
          }
        }
        console.log('上传设置加载完成:', this.settings)
      } catch (error) {
        console.error('加载设置失败:', error)
      }
    },

    /**
     * 保存设置
     */
    saveSettings() {
      try {
        uni.setStorageSync('upload_settings', JSON.stringify(this.settings))
        console.log('上传设置保存成功:', this.settings)

        uni.showToast({
          title: '设置已保存',
          icon: 'success'
        })
      } catch (error) {
        console.error('保存设置失败:', error)
        uni.showToast({
          title: '保存失败',
          icon: 'error'
        })
      }
    },

    /**
     * 加载网络状态
     */
    loadNetworkStatus() {
      const status = NetworkService.getNetworkStatus()
      this.networkStatus = {
        isOnline: status.isOnline,
        networkType: status.networkType,
        serverReachable: status.serverReachable
      }
    },

    /**
     * 开始网络监听
     */
    startNetworkMonitoring() {
      this.unsubscribe = NetworkService.onNetworkStatusChange((status) => {
        this.networkStatus = {
          isOnline: status.isOnline,
          networkType: status.networkType,
          serverReachable: status.serverReachable
        }
      })
    },

    /**
     * 停止网络监听
     */
    stopNetworkMonitoring() {
      if (this.unsubscribe) {
        this.unsubscribe()
      }
    },

    /**
     * 仅WiFi上传开关变化
     */
    handleWifiOnlyChange(value) {
      console.log('仅WiFi上传设置变更:', value)
      this.saveSettings()
    },

    /**
     * 自动上传开关变化
     */
    handleAutoUploadChange(value) {
      console.log('自动上传设置变更:', value)
      this.saveSettings()

      if (value) {
        uni.showModal({
          title: '提示',
          content: '开启自动上传后，检测到网络连接时将自动上传待上传数据',
          showCancel: false
        })
      }
    },

    /**
     * 上传后删除开关变化
     */
    handleDeleteAfterUploadChange(value) {
      console.log('上传后删除设置变更:', value)

      if (value) {
        uni.showModal({
          title: '警告',
          content: '开启后上传成功将立即删除本地数据，无法恢复。建议保持关闭状态。',
          confirmText: '确认开启',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              this.saveSettings()
            } else {
              this.settings.deleteAfterUpload = false
            }
          }
        })
      } else {
        this.saveSettings()
      }
    },

    /**
     * 重试次数确认
     */
    handleRetryConfirm(value) {
      const selectedValue = value[0].value
      this.settings.retryCount = selectedValue
      this.saveSettings()
      this.showRetryPicker = false
    },

    /**
     * 获取重试次数文本
     */
    getRetryText(count) {
      if (count === 0) return '不重试'
      return `重试${count}次`
    },

    /**
     * 恢复默认设置
     */
    handleReset() {
      uni.showModal({
        title: '确认重置',
        content: '确定要恢复默认设置吗？',
        success: (res) => {
          if (res.confirm) {
            this.settings = {
              wifiOnly: true,
              autoUpload: false,
              deleteAfterUpload: false,
              retryCount: 3
            }
            this.saveSettings()
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.upload-settings-page {
  min-height: 100vh;
  background-color: #F5F5F5;
  padding: 24rpx;
  padding-bottom: 120rpx;
}

.settings-section {
  background-color: #FFFFFF;
  border-radius: 16rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

.section-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 24rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #EEEEEE;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #F5F5F5;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item.clickable {
  cursor: pointer;
}

.setting-info {
  flex: 1;
  margin-right: 24rpx;
}

.setting-label {
  font-size: 28rpx;
  font-weight: 500;
  color: #333333;
  margin-bottom: 8rpx;
}

.setting-desc {
  font-size: 24rpx;
  color: #999999;
  line-height: 1.5;
}

.setting-value {
  display: flex;
  align-items: center;
}

.value-text {
  font-size: 28rpx;
  color: #666666;
  margin-right: 8rpx;
}

.network-status-section {
  background-color: #FFFFFF;
  border-radius: 16rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

.status-header {
  display: flex;
  align-items: center;
  margin-bottom: 24rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #EEEEEE;
}

.status-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333333;
  margin-left: 12rpx;
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12rpx 0;
}

.status-label {
  font-size: 28rpx;
  color: #666666;
}

.status-value {
  font-size: 28rpx;
  font-weight: 500;
  color: #333333;
}

.reset-section {
  padding: 0 32rpx;
}
</style>
