<template>
  <view v-if="visible" class="scanner-container">
    <!-- 全屏扫描界面 -->
    <view class="scan-overlay">
      <!-- 顶部标题栏 -->
      <view class="scan-header">
        <button class="back-btn" @click="handleCancel">
          <text class="icon">←</text>
        </button>
        <text class="title">扫描二维码</text>
        <view class="header-right"></view>
      </view>

      <!-- 扫描框区域 -->
      <view class="scan-frame-container">
        <view class="scan-frame">
          <!-- 四角定位线 -->
          <view class="corner top-left"></view>
          <view class="corner top-right"></view>
          <view class="corner bottom-left"></view>
          <view class="corner bottom-right"></view>

          <!-- 扫描线动画 -->
          <view class="scan-line" :class="{ scanning: isScanning }"></view>
        </view>

        <!-- 提示文字 -->
        <view class="scan-hint">
          <text class="hint-text">{{ hintText }}</text>
          <text class="distance-text">{{ distanceText }}</text>
        </view>
      </view>

      <!-- 底部操作区 -->
      <view class="scan-footer">
        <button
          class="scan-btn"
          :class="{ scanning: isScanning }"
          :disabled="isScanning"
          @click="handleScanCode"
        >
          <text v-if="!isScanning" class="btn-text">点击扫描</text>
          <text v-else class="btn-text">正在识别...</text>
        </button>

        <!-- 使用说明 -->
        <view class="usage-tip">
          <text class="tip-text">💡 提示：将二维码对准扫描框，距离15-30cm</text>
        </view>
      </view>

      <!-- 权限引导 -->
      <view v-if="showPermissionGuide" class="permission-guide">
        <view class="guide-content">
          <text class="guide-title">需要相机权限</text>
          <text class="guide-desc">为了使用二维码扫描功能，请开启相机权限</text>
          <button class="guide-btn" @click="requestPermission">去开启</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import cameraPermissionService from '@/services/CameraPermissionService'
import antiSpamService from '@/services/AntiSpamService'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  hintText: {
    type: String,
    default: '请将二维码对准扫描框'
  }
})

const emit = defineEmits(['close', 'success', 'error'])

// 响应式数据
const isScanning = ref(false)
const showPermissionGuide = ref(false)
const lastScanTime = ref(0)
const failedScanCount = ref(0) // AC14: 失败计数

// 距离提示文本
const distanceText = '距离15-30cm效果最佳'

// 监听可见性变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    initScanner()
  } else {
    cleanup()
  }
})

// 初始化扫描器
async function initScanner() {
  // 检查权限
  const permission = await cameraPermissionService.checkPermission()
  if (!permission.isAuthorized) {
    showPermissionGuide.value = true
    return
  }

  showPermissionGuide.value = false

  // AC14: 首次使用引导
  const hasShownGuide = uni.getStorageSync('qrcode_guide_shown')
  if (!hasShownGuide) {
    uni.showModal({
      title: '扫码说明',
      content: '将二维码对准扫描框，距离15-30cm，保持稳定。如光线不足，请到明亮处扫码。',
      showCancel: false,
      confirmText: '知道了',
      success: () => {
        uni.setStorageSync('qrcode_guide_shown', true)
      }
    })
  }
}

// 请求权限
async function requestPermission() {
  try {
    const result = await cameraPermissionService.requestPermission()
    if (result.success) {
      showPermissionGuide.value = false
    } else {
      emit('error', {
        type: 'PERMISSION_DENIED',
        message: result.message
      })
    }
  } catch (error) {
    console.error('请求权限失败:', error)
    emit('error', {
      type: 'PERMISSION_ERROR',
      message: '请求权限失败'
    })
  }
}

// 处理扫描
async function handleScanCode() {
  // 防抖检查
  const now = Date.now()
  if (now - lastScanTime.value < 1000) {
    return
  }
  lastScanTime.value = now

  // 防刷检查
  const limitCheck = antiSpamService.checkScanLimit()
  if (!limitCheck.allowed) {
    uni.showToast({
      title: limitCheck.message,
      icon: 'none',
      duration: 2000
    })
    return
  }

  if (isScanning.value) return

  isScanning.value = true

  try {
    // 扫码API调用
    uni.scanCode({
      scanType: ['qrCode'],
      onlyFromCamera: true,
      scanType: ['qrCode', 'barCode', 'datamatrix', 'pdf417'],
      success: (res) => {
        console.log('扫码成功:', res.result)

        // 记录扫码
        antiSpamService.recordScan(res.result)

        // 触发成功事件
        emit('success', res.result)
      },
      fail: (err) => {
        console.error('扫码失败:', err)
        isScanning.value = false

        // 用户取消扫码不报错
        if (err.errMsg && err.errMsg.includes('cancel')) {
          return
        }

        // AC14: 失败计数和光线检测
        failedScanCount.value++
        if (failedScanCount.value >= 3) {
          uni.showToast({
            title: '光线不足，请到明亮处扫码',
            icon: 'none',
            duration: 3000
          })
          failedScanCount.value = 0
        }

        emit('error', {
          type: 'SCAN_FAILED',
          message: '扫码失败，请重试',
          error: err
        })
      },
      complete: () => {
        // 重置扫描状态
        setTimeout(() => {
          isScanning.value = false
        }, 500)
      }
    })
  } catch (error) {
    console.error('扫码异常:', error)
    isScanning.value = false
    emit('error', {
      type: 'SCAN_ERROR',
      message: '扫码异常：' + (error.message || '未知错误'),
      error: error
    })
  }
}

// 处理取消
function handleCancel() {
  // 重置状态
  isScanning.value = false
  lastScanTime.value = 0

  // 触发关闭事件
  emit('close')
}

// 清理资源
function cleanup() {
  isScanning.value = false
}

// 组件卸载时清理
onUnmounted(() => {
  cleanup()
})
</script>

<style lang="scss" scoped>
.scanner-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #000;
  z-index: 9999;
}

.scan-overlay {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

// 顶部标题栏
.scan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 40rpx 30rpx;
  background-color: rgba(0, 0, 0, 0.8);

  .back-btn {
    width: 60rpx;
    height: 60rpx;
    border: none;
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 30rpx;
    display: flex;
    align-items: center;
    justify-content: center;

    .icon {
      font-size: 40rpx;
      color: #fff;
      font-weight: bold;
    }
  }

  .title {
    flex: 1;
    text-align: center;
    font-size: 32rpx;
    color: #fff;
    font-weight: 500;
  }

  .header-right {
    width: 60rpx;
  }
}

// 扫描框区域
.scan-frame-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.scan-frame {
  position: relative;
  width: 500rpx;
  height: 500rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.3);

  .corner {
    position: absolute;
    width: 40rpx;
    height: 40rpx;
    border: 6rpx solid #52c41a;

    &.top-left {
      top: -2rpx;
      left: -2rpx;
      border-right: none;
      border-bottom: none;
    }

    &.top-right {
      top: -2rpx;
      right: -2rpx;
      border-left: none;
      border-bottom: none;
    }

    &.bottom-left {
      bottom: -2rpx;
      left: -2rpx;
      border-right: none;
      border-top: none;
    }

    &.bottom-right {
      bottom: -2rpx;
      right: -2rpx;
      border-left: none;
      border-top: none;
    }
  }

  .scan-line {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    height: 4rpx;
    background: linear-gradient(90deg, transparent, #52c41a, transparent);
    opacity: 0;

    &.scanning {
      animation: scan-line 2s linear infinite;
      opacity: 1;
    }
  }
}

@keyframes scan-line {
  0% {
    top: 0;
    opacity: 1;
  }
  50% {
    top: 50%;
    opacity: 1;
  }
  100% {
    top: 100%;
    opacity: 0;
  }
}

// 提示文字
.scan-hint {
  margin-top: 60rpx;
  text-align: center;

  .hint-text {
    display: block;
    font-size: 32rpx;
    color: #fff;
    margin-bottom: 16rpx;
  }

  .distance-text {
    display: block;
    font-size: 26rpx;
    color: rgba(255, 255, 255, 0.7);
  }
}

// 底部操作区
.scan-footer {
  padding: 60rpx 30rpx;
  background-color: rgba(0, 0, 0, 0.8);

  .scan-btn {
    width: 100%;
    height: 88rpx;
    border-radius: 44rpx;
    border: none;
    background-color: #52c41a;
    color: #fff;
    font-size: 32rpx;
    font-weight: 500;
    margin-bottom: 30rpx;

    &:disabled {
      background-color: #d9d9d9;
      color: #999;
    }

    &.scanning {
      background-color: #1890ff;
    }

    .btn-text {
      font-size: 32rpx;
    }
  }

  .usage-tip {
    text-align: center;

    .tip-text {
      font-size: 24rpx;
      color: rgba(255, 255, 255, 0.6);
    }
  }
}

// 权限引导
.permission-guide {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;

  .guide-content {
    background-color: #fff;
    border-radius: 24rpx;
    padding: 60rpx 40rpx;
    margin: 60rpx;
    text-align: center;

    .guide-title {
      display: block;
      font-size: 36rpx;
      font-weight: 500;
      color: #333;
      margin-bottom: 20rpx;
    }

    .guide-desc {
      display: block;
      font-size: 28rpx;
      color: #666;
      margin-bottom: 40rpx;
      line-height: 1.6;
    }

    .guide-btn {
      width: 100%;
      height: 80rpx;
      border-radius: 40rpx;
      border: none;
      background-color: #1890ff;
      color: #fff;
      font-size: 28rpx;
      font-weight: 500;
    }
  }
}
</style>
