<template>
  <view v-if="visible" class="nfc-guide-overlay" @click="handleOverlayClick">
    <view class="guide-container" @click.stop>
      <!-- 关闭按钮 -->
      <view class="guide-close">
        <text class="close-btn" @click="handleClose">✕</text>
      </view>

      <!-- NFC图标动画 -->
      <view class="nfc-animation">
        <view class="nfc-icon">
          <text class="nfc-symbol">📡</text>
          <view class="wave wave1"></view>
          <view class="wave wave2"></view>
          <view class="wave wave3"></view>
        </view>
      </view>

      <!-- 引导文字 -->
      <view class="guide-content">
        <text class="guide-title">{{ title }}</text>
        <text class="guide-subtitle">{{ subtitle }}</text>
      </view>

      <!-- 提示信息 -->
      <view class="tip-box" v-if="tipMessage">
        <text class="tip-icon">💡</text>
        <text class="tip-text">{{ tipMessage }}</text>
      </view>

      <!-- 操作按钮 -->
      <view class="guide-actions">
        <button class="btn btn-primary" @click="handleConfirm">
          {{ confirmText }}
        </button>
        <button class="btn btn-secondary" v-if="showCancel" @click="handleCancel">
          {{ cancelText }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '准备NFC读卡'
  },
  subtitle: {
    type: String,
    default: '请将NFC卡靠近手机顶部，保持1-2秒'
  },
  tipMessage: {
    type: String,
    default: ''
  },
  confirmText: {
    type: String,
    default: '知道了'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  showCancel: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'confirm', 'cancel'])

// 处理关闭
function handleClose() {
  emit('close')
}

// 处理确认
function handleConfirm() {
  emit('confirm')
}

// 处理取消
function handleCancel() {
  emit('cancel')
}

// 处理遮罩点击
function handleOverlayClick() {
  emit('close')
}
</script>

<style lang="scss" scoped>
.nfc-guide-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9998;
  padding: 60rpx;
}

.guide-container {
  background-color: #fff;
  border-radius: 32rpx;
  padding: 60rpx 40rpx 40rpx;
  width: 100%;
  max-width: 600rpx;
  text-align: center;
  position: relative;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateY(100rpx) scale(0.9);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

.guide-close {
  position: absolute;
  top: 20rpx;
  right: 20rpx;

  .close-btn {
    font-size: 40rpx;
    color: #999;
    padding: 10rpx 20rpx;
  }
}

.nfc-animation {
  margin: 40rpx 0;

  .nfc-icon {
    position: relative;
    width: 160rpx;
    height: 160rpx;
    margin: 0 auto;

    .nfc-symbol {
      font-size: 100rpx;
      position: relative;
      z-index: 10;
    }

    .wave {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 160rpx;
      height: 160rpx;
      border: 4rpx solid #1890ff;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      opacity: 0;
    }

    .wave1 {
      animation: wave-animation 1.5s infinite ease-out;
    }

    .wave2 {
      animation: wave-animation 1.5s infinite ease-out 0.5s;
    }

    .wave3 {
      animation: wave-animation 1.5s infinite ease-out 1s;
    }
  }
}

@keyframes wave-animation {
  0% {
    transform: translate(-50%, -50%) scale(0.5);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.5);
    opacity: 0;
  }
}

.guide-content {
  margin-bottom: 40rpx;

  .guide-title {
    display: block;
    font-size: 36rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 20rpx;
  }

  .guide-subtitle {
    display: block;
    font-size: 28rpx;
    color: #666;
    line-height: 1.6;
  }
}

.tip-box {
  display: inline-flex;
  align-items: center;
  padding: 24rpx 32rpx;
  background-color: #e6f4ff;
  border-radius: 16rpx;
  margin-bottom: 40rpx;
  max-width: 500rpx;

  .tip-icon {
    font-size: 32rpx;
    margin-right: 16rpx;
  }

  .tip-text {
    font-size: 26rpx;
    color: #1890ff;
    line-height: 1.6;
  }
}

.guide-actions {
  display: flex;
  gap: 20rpx;
  justify-content: center;

  .btn {
    min-width: 200rpx;
    height: 80rpx;
    border-radius: 40rpx;
    border: none;
    font-size: 28rpx;
    font-weight: 500;

    &.btn-primary {
      background-color: #1890ff;
      color: #fff;

      &:active {
        background-color: #096dd9;
      }
    }

    &.btn-secondary {
      background-color: #f5f5f5;
      color: #666;

      &:active {
        background-color: #e8e8e8;
      }
    }
  }
}
</style>
