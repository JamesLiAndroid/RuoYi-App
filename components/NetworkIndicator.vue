<template>
  <view class="network-indicator" @click="handleClick">
    <u-icon :name="statusIcon" :color="statusColor" size="20"></u-icon>
    <text class="status-text" :style="{ color: statusColor }">{{ statusText }}</text>
  </view>
</template>

<script>
import NetworkService from '@/services/NetworkService'

export default {
  name: 'NetworkIndicator',
  data() {
    return {
      isOnline: false,
      serverReachable: false,
      networkType: 'none'
    }
  },
  computed: {
    statusIcon() {
      if (!this.isOnline) return 'wifi-off'
      if (!this.serverReachable) return 'cloud-offline'
      return 'wifi'
    },
    statusColor() {
      if (!this.isOnline || !this.serverReachable) return '#999999'
      return '#4CAF50'
    },
    statusText() {
      if (!this.isOnline) return '离线'
      if (!this.serverReachable) return '服务器不可达'
      return '在线'
    }
  },
  mounted() {
    // 初始化网络状态
    const status = NetworkService.getNetworkStatus()
    this.isOnline = status.isOnline
    this.serverReachable = status.serverReachable
    this.networkType = status.networkType

    // 监听网络状态变化
    this.unsubscribe = NetworkService.onNetworkStatusChange(this.onNetworkStatusChanged)
  },
  beforeUnmount() {
    // 取消监听
    if (this.unsubscribe) {
      this.unsubscribe()
    }
  },
  methods: {
    onNetworkStatusChanged(status) {
      this.isOnline = status.isOnline
      this.serverReachable = status.serverReachable
      this.networkType = status.networkType
    },
    handleClick() {
      const status = NetworkService.getNetworkStatus()

      if (status.isOnline && status.serverReachable) {
        // 显示在线信息
        uni.showModal({
          title: '网络状态',
          content: `已连接到服务器\n网络类型: ${NetworkService.getNetworkTypeText()}`,
          showCancel: false
        })
      } else {
        // 显示离线统计
        this.$emit('show-offline-data')
      }
    }
  }
}
</script>

<style scoped>
.network-indicator {
  display: flex;
  align-items: center;
  padding: 8rpx 16rpx;
  border-radius: 20rpx;
  background-color: rgba(255, 255, 255, 0.1);
}

.status-text {
  margin-left: 8rpx;
  font-size: 24rpx;
  font-weight: 500;
}
</style>
