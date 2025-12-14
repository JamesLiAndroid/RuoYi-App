<template>
  <view class="scan-mode-switch">
    <text class="label">{{ label }}</text>
    <view class="switch-container">
      <!-- NFC模式 -->
      <view
        class="mode-item"
        :class="{ active: currentMode === 'nfc' }"
        @click="switchMode('nfc')"
      >
        <text class="mode-icon">{{ isNfcSupported ? '📡' : '❌' }}</text>
        <text class="mode-text">NFC模式</text>
      </view>

      <!-- 二维码模式 -->
      <view
        class="mode-item"
        :class="{ active: currentMode === 'qrcode' }"
        @click="switchMode('qrcode')"
      >
        <text class="mode-icon">📱</text>
        <text class="mode-text">二维码</text>
      </view>

      <!-- 手动输入模式 -->
      <view
        class="mode-item"
        :class="{ active: currentMode === 'manual' }"
        @click="switchMode('manual')"
      >
        <text class="mode-icon">✏️</text>
        <text class="mode-text">手动输入</text>
      </view>
    </view>

    <!-- NFC状态提示 -->
    <view v-if="currentMode === 'nfc'" class="nfc-status">
      <text class="status-text" :class="{ disabled: !isNfcEnabled }">
        {{ nfcStatusText }}
      </text>
      <button
        v-if="!isNfcEnabled && isNfcSupported"
        class="btn-enable"
        @click="handleEnableNfc"
      >
        开启NFC
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import nfcService from '@/services/NfcService'

const props = defineProps({
  label: {
    type: String,
    default: '扫码模式'
  },
  defaultMode: {
    type: String,
    default: 'nfc' // nfc, qrcode, manual
  }
})

const emit = defineEmits(['modeChange'])

// 响应式数据
const currentMode = ref(props.defaultMode)
const isNfcSupported = ref(false)
const isNfcEnabled = ref(false)

// 计算属性
const nfcStatusText = computed(() => {
  if (!isNfcSupported.value) {
    return '当前设备不支持NFC功能'
  }
  if (!isNfcEnabled.value) {
    return 'NFC功能未开启'
  }
  return '请将NFC卡靠近手机顶部'
})

// 初始化
onMounted(() => {
  checkNfcStatus()
})

// 检查NFC状态
function checkNfcStatus() {
  isNfcSupported.value = nfcService.isNfcSupported()
  isNfcEnabled.value = nfcService.isNfcEnabled()
}

// 切换模式
function switchMode(mode) {
  if (mode === 'nfc' && !isNfcSupported.value) {
    uni.showToast({
      title: '当前设备不支持NFC',
      icon: 'none'
    })
    return
  }

  currentMode.value = mode
  emit('modeChange', mode)
}

// 开启NFC设置
function handleEnableNfc() {
  uni.showModal({
    title: '开启NFC',
    content: '请前往系统设置中开启NFC功能',
    confirmText: '前往设置',
    success: (res) => {
      if (res.confirm) {
        nfcService.openNfcSettings()
      }
    }
  })
}

//#ifdef APP-PLUS
// 监听NFC状态变化
plus.globalEvent.addEventListener('NFC_STATUS_CHANGED', () => {
  checkNfcStatus()
})
//#endif
</script>

<style lang="scss" scoped>
.scan-mode-switch {
  background-color: #fff;
  padding: 30rpx;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);

  .label {
    font-size: 28rpx;
    color: #333;
    font-weight: 500;
    margin-bottom: 24rpx;
    display: block;
  }

  .switch-container {
    display: flex;
    gap: 20rpx;
    justify-content: space-between;

    .mode-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 30rpx 20rpx;
      border: 2rpx solid #e8e8e8;
      border-radius: 16rpx;
      background-color: #fafafa;
      transition: all 0.3s ease;

      &.active {
        border-color: #1890ff;
        background-color: #e6f4ff;

        .mode-text {
          color: #1890ff;
          font-weight: 500;
        }
      }

      .mode-icon {
        font-size: 60rpx;
        margin-bottom: 16rpx;
      }

      .mode-text {
        font-size: 24rpx;
        color: #666;
        text-align: center;
      }
    }
  }

  .nfc-status {
    margin-top: 24rpx;
    padding: 20rpx;
    background-color: #f5f5f5;
    border-radius: 12rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;

    .status-text {
      font-size: 26rpx;
      color: #52c41a;

      &.disabled {
        color: #faad14;
      }
    }

    .btn-enable {
      padding: 12rpx 32rpx;
      background-color: #1890ff;
      color: #fff;
      border: none;
      border-radius: 24rpx;
      font-size: 24rpx;
    }
  }
}
</style>
