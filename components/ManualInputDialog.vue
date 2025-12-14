<template>
  <view v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
    <view class="dialog-content" @click.stop>
      <!-- 标题 -->
      <view class="dialog-header">
        <text class="dialog-title">手动输入卡ID</text>
        <text class="close-icon" @click="handleClose">✕</text>
      </view>

      <!-- 说明 -->
      <view class="dialog-description">
        <text>请输入NFC卡背面的卡号，或者手动输入卡ID</text>
      </view>

      <!-- 输入区域 -->
      <view class="input-section">
        <view class="input-group">
          <text class="input-label">卡ID</text>
          <input
            class="input-field"
            v-model="cardId"
            placeholder="请输入8-20位卡ID（十六进制）"
            maxlength="20"
            @input="handleInput"
          />
        </view>

        <!-- 错误提示 -->
        <text v-if="errorMessage" class="error-message">{{ errorMessage }}</text>

        <!-- 示例 -->
        <view class="example-section">
          <text class="example-label">示例：</text>
          <text class="example-text">04A2B3C4D5E6F7</text>
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

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'confirm'])

// 响应式数据
const cardId = ref('')
const errorMessage = ref('')

// 计算属性
const isValid = computed(() => {
  return cardId.value.length >= 8 && isValidHex(cardId.value)
})

// 验证十六进制
function isValidHex(str) {
  return /^[0-9A-Fa-f]+$/.test(str)
}

// 处理输入
function handleInput() {
  errorMessage.value = ''

  // 自动转换为大写
  cardId.value = cardId.value.toUpperCase()

  // 验证格式
  if (cardId.value.length > 0 && !isValidHex(cardId.value)) {
    errorMessage.value = '只能输入十六进制字符（0-9, A-F）'
  }

  if (cardId.value.length > 20) {
    errorMessage.value = '卡ID长度不能超过20位'
  }
}

// 处理关闭
function handleClose() {
  // 清空输入
  cardId.value = ''
  errorMessage.value = ''

  emit('close')
}

// 处理确认
function handleConfirm() {
  if (!isValid.value) {
    errorMessage.value = '请输入有效的卡ID'
    return
  }

  // 触发确认事件
  emit('confirm', cardId.value.toUpperCase())

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
      height: 88rpx;
      padding: 0 24rpx;
      border: 2rpx solid #e8e8e8;
      border-radius: 12rpx;
      font-size: 28rpx;
      color: #333;
      background-color: #fafafa;

      &:focus {
        border-color: #1890ff;
        background-color: #fff;
      }
    }
  }

  .error-message {
    display: block;
    font-size: 24rpx;
    color: #ff4d4f;
    margin-top: 16rpx;
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
      background-color: #1890ff;
      color: #fff;

      &:active {
        background-color: #096dd9;
      }

      &[disabled] {
        background-color: #d9d9d9;
        color: #999;
      }
    }
  }
}
</style>
