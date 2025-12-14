<template>
  <view v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
    <view class="dialog-content" @click.stop>
      <!-- 标题 -->
      <view class="dialog-header">
        <text class="dialog-title">手动输入点位码</text>
        <text class="close-icon" @click="handleClose">✕</text>
      </view>

      <!-- 说明 -->
      <view class="dialog-description">
        <text>请输入巡检点位码，或手动输入二维码内容</text>
      </view>

      <!-- 输入区域 -->
      <view class="input-section">
        <view class="input-group">
          <text class="input-label">点位码</text>
          <textarea
            class="input-field"
            v-model="pointCode"
            placeholder="请输入点位码，如：INSPECT|P12345|C04A2B3C4D5E6F7"
            maxlength="50"
            :auto-height="true"
            @input="handleInput"
          />
        </view>

        <!-- 错误提示 -->
        <text v-if="errorMessage" class="error-message">{{ errorMessage }}</text>

        <!-- 格式示例 -->
        <view class="example-section">
          <text class="example-label">格式示例：</text>
          <text class="example-text">{{ formatExample }}</text>
        </view>

        <!-- 扫码统计 -->
        <view v-if="usageWarning" class="usage-warning">
          <text class="warning-icon">⚠️</text>
          <text class="warning-text">{{ usageWarning }}</text>
        </view>
      </view>

      <!-- 按钮组 -->
      <view class="dialog-footer">
        <button class="btn btn-cancel" @click="handleClose">取消</button>
        <button
          class="btn btn-confirm"
          :disabled="!isValid"
          @click="handleConfirm"
        >
          确认
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import qrCodeService from '@/services/QrCodeService'
import antiSpamService from '@/services/AntiSpamService'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'confirm'])

// 响应式数据
const pointCode = ref('')
const errorMessage = ref('')

// 计算属性
const formatExample = computed(() => {
  return qrCodeService.getFormatExample()
})

const isValid = computed(() => {
  const validation = qrCodeService.validateFormat(pointCode.value)
  return validation.isValid
})

const usageWarning = computed(() => {
  return antiSpamService.getUsageWarningMessage()
})

// 处理输入
function handleInput() {
  errorMessage.value = ''
}

// 处理关闭
function handleClose() {
  // 清空输入
  pointCode.value = ''
  errorMessage.value = ''

  emit('close')
}

// 处理确认
function handleConfirm() {
  if (!isValid.value) {
    const validation = qrCodeService.validateFormat(pointCode.value)
    errorMessage.value = qrCodeService.getErrorMessage(validation.error)
    return
  }

  // 解析点位码
  const parseResult = qrCodeService.parse(pointCode.value.trim().toUpperCase())

  if (!parseResult.success) {
    errorMessage.value = parseResult.message
    return
  }

  // 记录扫码（手动输入也算一次扫码）
  antiSpamService.recordScan(parseResult.rawContent)

  // 触发确认事件
  emit('confirm', parseResult)

  // 清空并关闭
  handleClose()
}

// 处理遮罩点击
function handleOverlayClick() {
  handleClose()
}

// 监听可见性变化
watch(() => props.visible, (newVal) => {
  if (!newVal) {
    handleClose()
  }
})
</script>

<style lang="scss" scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 60rpx;

  .dialog-content {
    background-color: #fff;
    border-radius: 24rpx;
    width: 100%;
    max-width: 600rpx;
    overflow: hidden;
    animation: slideIn 0.3s ease-out;
  }
}

@keyframes slideIn {
  from {
    transform: translateY(100rpx);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 40rpx 40rpx 20rpx;
  border-bottom: 1rpx solid #f0f0f0;

  .dialog-title {
    font-size: 32rpx;
    font-weight: 500;
    color: #333;
  }

  .close-icon {
    font-size: 40rpx;
    color: #999;
    padding: 10rpx;
  }
}

.dialog-description {
  padding: 30rpx 40rpx 0;

  text {
    font-size: 26rpx;
    color: #666;
    line-height: 1.6;
  }
}

.input-section {
  padding: 30rpx 40rpx;

  .input-group {
    margin-bottom: 20rpx;

    .input-label {
      display: block;
      font-size: 26rpx;
      color: #333;
      margin-bottom: 16rpx;
      font-weight: 500;
    }

    .input-field {
      width: 100%;
      min-height: 120rpx;
      padding: 24rpx;
      border: 2rpx solid #e8e8e8;
      border-radius: 12rpx;
      font-size: 28rpx;
      color: #333;
      background-color: #fafafa;
      line-height: 1.6;

      &:focus {
        border-color: #52c41a;
        background-color: #fff;
      }
    }
  }

  .error-message {
    display: block;
    font-size: 24rpx;
    color: #ff4d4f;
    margin-top: 16rpx;
    line-height: 1.6;
  }

  .example-section {
    margin-top: 24rpx;
    padding: 20rpx;
    background-color: #f5f5f5;
    border-radius: 12rpx;

    .example-label {
      font-size: 24rpx;
      color: #666;
      margin-right: 12rpx;
    }

    .example-text {
      font-size: 24rpx;
      color: #999;
      font-family: monospace;
      word-break: break-all;
    }
  }

  .usage-warning {
    display: flex;
    align-items: flex-start;
    margin-top: 24rpx;
    padding: 20rpx;
    background-color: #fff7e6;
    border-radius: 12rpx;
    border-left: 4rpx solid #faad14;

    .warning-icon {
      font-size: 28rpx;
      margin-right: 12rpx;
      line-height: 1.6;
    }

    .warning-text {
      font-size: 24rpx;
      color: #faad14;
      line-height: 1.6;
    }
  }
}

.dialog-footer {
  display: flex;
  padding: 30rpx 40rpx 40rpx;
  border-top: 1rpx solid #f0f0f0;
  gap: 20rpx;

  .btn {
    flex: 1;
    height: 80rpx;
    border-radius: 40rpx;
    border: none;
    font-size: 28rpx;
    font-weight: 500;

    &.btn-cancel {
      background-color: #f5f5f5;
      color: #666;

      &:active {
        background-color: #e8e8e8;
      }
    }

    &.btn-confirm {
      background-color: #52c41a;
      color: #fff;

      &:active {
        background-color: #389e0d;
      }

      &[disabled] {
        background-color: #d9d9d9;
        color: #999;
      }
    }
  }
}
</style>
