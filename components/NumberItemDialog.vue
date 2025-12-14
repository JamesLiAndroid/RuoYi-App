<template>
  <view v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
    <view class="dialog-content" @click.stop>
      <!-- 标题 -->
      <view class="dialog-header">
        <text class="dialog-title">{{ item?.item_name || '数值型项目' }}</text>
        <text class="close-icon" @click="handleClose">✕</text>
      </view>

      <!-- 项目信息 -->
      <view class="item-info">
        <view class="info-row">
          <text class="info-label">项目类型</text>
          <text class="info-value">数值型</text>
        </view>
        <view v-if="item?.required" class="info-row">
          <text class="required-badge">必填</text>
        </view>
        <view v-if="hasRange" class="info-row">
          <text class="info-label">正常范围</text>
          <text class="info-value range-value">{{ rangeText }}</text>
        </view>
      </view>

      <!-- 数值输入 -->
      <view class="input-section">
        <text class="section-label">请输入数值</text>
        <view class="input-group">
          <input
            class="number-input"
            v-model="inputValue"
            type="digit"
            :placeholder="`请输入${item?.item_name || '数值'}`"
            @input="handleInput"
            @blur="handleBlur"
          />
          <text v-if="item?.unit" class="input-unit">{{ item.unit }}</text>
        </view>

        <!-- 范围提示 -->
        <view v-if="showRangeHint" class="range-hint" :class="{ warning: isOutOfRange }">
          <text class="hint-icon">{{ isOutOfRange ? '⚠️' : '💡' }}</text>
          <text class="hint-text">{{ rangeHintText }}</text>
        </view>
      </view>

      <!-- 异常说明（仅当超出范围时显示） -->
      <view v-if="isOutOfRange" class="abnormal-section">
        <text class="section-label">异常说明</text>
        <textarea
          class="abnormal-textarea"
          v-model="abnormalRemark"
          placeholder="请描述具体异常情况（可选）"
          maxlength="200"
          :auto-height="true"
        />
        <text class="char-count">{{ abnormalRemark.length }}/200</text>
      </view>

      <!-- 错误提示 -->
      <text v-if="errorMessage" class="error-message">{{ errorMessage }}</text>

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
import inspectionItemService from '@/services/InspectionItemService'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  item: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'confirm'])

// 响应式数据
const inputValue = ref('')
const abnormalRemark = ref('')
const errorMessage = ref('')

// 计算属性
const hasRange = computed(() => {
  return props.item && (
    props.item.min_value !== null && props.item.min_value !== undefined ||
    props.item.max_value !== null && props.item.max_value !== undefined
  )
})

const rangeText = computed(() => {
  if (!props.item) return ''

  const min = props.item.min_value
  const max = props.item.max_value
  const unit = props.item.unit || ''

  if (min !== null && min !== undefined && max !== null && max !== undefined) {
    return `${min}${unit} ~ ${max}${unit}`
  } else if (min !== null && min !== undefined) {
    return `≥ ${min}${unit}`
  } else if (max !== null && max !== undefined) {
    return `≤ ${max}${unit}`
  }

  return ''
})

const numericValue = computed(() => {
  return parseFloat(inputValue.value)
})

const isOutOfRange = computed(() => {
  if (!inputValue.value || isNaN(numericValue.value)) {
    return false
  }

  const min = props.item?.min_value
  const max = props.item?.max_value

  if (min !== null && min !== undefined && numericValue.value < min) {
    return true
  }
  if (max !== null && max !== undefined && numericValue.value > max) {
    return true
  }

  return false
})

const showRangeHint = computed(() => {
  return hasRange.value && inputValue.value
})

const rangeHintText = computed(() => {
  if (!inputValue.value) return ''

  if (isOutOfRange.value) {
    return `数值超出正常范围，请检查！正常范围：${rangeText.value}`
  } else {
    return `数值在正常范围内`
  }
})

const isValid = computed(() => {
  // 必填项检查
  if (props.item?.required && !inputValue.value) {
    return false
  }

  // 数值格式检查
  if (inputValue.value && isNaN(numericValue.value)) {
    return false
  }

  return true
})

// 处理输入
function handleInput(event) {
  inputValue.value = event.detail.value
  errorMessage.value = ''
}

// 处理失焦
function handleBlur() {
  // 验证数值格式
  if (inputValue.value && isNaN(numericValue.value)) {
    errorMessage.value = '请输入有效的数值'
  }
}

// 处理关闭
function handleClose() {
  // 清空输入
  inputValue.value = ''
  abnormalRemark.value = ''
  errorMessage.value = ''

  emit('close')
}

// 处理确认
function handleConfirm() {
  // 验证
  if (!isValid.value) {
    if (!inputValue.value) {
      errorMessage.value = '请输入数值'
    } else {
      errorMessage.value = '请输入有效的数值'
    }
    return
  }

  // 使用服务验证
  const validation = inspectionItemService.validateNumericItem(props.item, numericValue.value)

  if (!validation.valid) {
    errorMessage.value = validation.error
    return
  }

  // 构建结果对象
  const result = {
    itemId: props.item.item_id,
    itemName: props.item.item_name,
    itemType: 'numeric',
    actualValue: numericValue.value.toString(),
    isAbnormal: validation.isAbnormal || isOutOfRange.value,
    abnormalRemark: isOutOfRange.value ? abnormalRemark.value : null
  }

  // 触发确认事件
  emit('confirm', result)

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
    max-height: 80vh;
    overflow-y: auto;
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
    flex: 1;
  }

  .close-icon {
    font-size: 40rpx;
    color: #999;
    padding: 10rpx;
  }
}

// 项目信息
.item-info {
  padding: 20rpx 40rpx;
  background-color: #f5f5f5;

  .info-row {
    display: flex;
    align-items: center;
    margin-bottom: 8rpx;

    &:last-child {
      margin-bottom: 0;
    }

    .info-label {
      font-size: 24rpx;
      color: #666;
      margin-right: 16rpx;
    }

    .info-value {
      font-size: 24rpx;
      color: #333;

      &.range-value {
        font-family: monospace;
        font-weight: 500;
        color: #1890ff;
      }
    }

    .required-badge {
      display: inline-block;
      padding: 4rpx 12rpx;
      background-color: #ff4d4f;
      color: #fff;
      border-radius: 8rpx;
      font-size: 20rpx;
    }
  }
}

// 数值输入
.input-section {
  padding: 30rpx 40rpx;

  .section-label {
    display: block;
    font-size: 26rpx;
    color: #333;
    margin-bottom: 16rpx;
    font-weight: 500;
  }

  .input-group {
    display: flex;
    align-items: center;
    position: relative;

    .number-input {
      flex: 1;
      height: 80rpx;
      padding: 0 24rpx;
      border: 2rpx solid #e8e8e8;
      border-radius: 12rpx;
      font-size: 32rpx;
      color: #333;
      background-color: #fafafa;

      &:focus {
        border-color: #1890ff;
        background-color: #fff;
      }
    }

    .input-unit {
      position: absolute;
      right: 24rpx;
      font-size: 28rpx;
      color: #999;
      pointer-events: none;
    }
  }

  .range-hint {
    display: flex;
    align-items: flex-start;
    margin-top: 16rpx;
    padding: 16rpx;
    background-color: #e6f4ff;
    border-radius: 12rpx;
    border-left: 4rpx solid #1890ff;

    &.warning {
      background-color: #fff7e6;
      border-left-color: #faad14;

      .hint-text {
        color: #faad14;
      }
    }

    .hint-icon {
      font-size: 28rpx;
      margin-right: 12rpx;
      line-height: 1.6;
    }

    .hint-text {
      font-size: 24rpx;
      color: #1890ff;
      line-height: 1.6;
      flex: 1;
    }
  }
}

// 异常说明
.abnormal-section {
  padding: 0 40rpx 30rpx;

  .section-label {
    display: block;
    font-size: 26rpx;
    color: #333;
    margin-bottom: 16rpx;
    font-weight: 500;
  }

  .abnormal-textarea {
    width: 100%;
    min-height: 120rpx;
    padding: 20rpx;
    border: 2rpx solid #e8e8e8;
    border-radius: 12rpx;
    font-size: 28rpx;
    color: #333;
    background-color: #fafafa;
    line-height: 1.6;

    &:focus {
      border-color: #ff4d4f;
      background-color: #fff;
    }
  }

  .char-count {
    display: block;
    text-align: right;
    font-size: 24rpx;
    color: #999;
    margin-top: 8rpx;
  }
}

// 错误提示
.error-message {
  display: block;
  font-size: 24rpx;
  color: #ff4d4f;
  margin: 0 40rpx 20rpx;
  line-height: 1.6;
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
