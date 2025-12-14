<template>
  <view v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
    <view class="dialog-content" @click.stop>
      <!-- 标题 -->
      <view class="dialog-header">
        <text class="dialog-title">{{ item?.item_name || '文本型项目' }}</text>
        <text class="close-icon" @click="handleClose">✕</text>
      </view>

      <!-- 项目信息 -->
      <view class="item-info">
        <view class="info-row">
          <text class="info-label">项目类型</text>
          <text class="info-value">文本型</text>
        </view>
        <view v-if="item?.required" class="info-row">
          <text class="required-badge">必填</text>
        </view>
      </view>

      <!-- 文本输入 -->
      <view class="input-section">
        <text class="section-label">请输入内容</text>
        <textarea
          class="text-textarea"
          v-model="textValue"
          :placeholder="`请输入${item?.item_name || '内容'}`"
          maxlength="500"
          :auto-height="true"
          @input="handleInput"
        />
        <text class="char-count">{{ textValue.length }}/500</text>

        <!-- 提示信息 -->
        <view v-if="showHint" class="input-hint" :class="{ warning: hasAbnormalKeyword }">
          <text class="hint-icon">{{ hasAbnormalKeyword ? '⚠️' : '💡' }}</text>
          <text class="hint-text">{{ hintText }}</text>
        </view>
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
const textValue = ref('')
const errorMessage = ref('')

// 计算属性
const hasAbnormalKeyword = computed(() => {
  if (!textValue.value) return false

  const abnormalKeywords = ['异常', '故障', '损坏', '失效', '问题', '错误']
  return abnormalKeywords.some(keyword => textValue.value.includes(keyword))
})

const showHint = computed(() => {
  return textValue.value.length > 0
})

const hintText = computed(() => {
  if (hasAbnormalKeyword.value) {
    return '检测到异常关键词，请确认填写正确'
  } else if (textValue.value.length > 450) {
    return '文本内容即将达到上限，请精简描述'
  } else {
    return '文本内容正常'
  }
})

const isValid = computed(() => {
  // 必填项检查
  if (props.item?.required && !textValue.value) {
    return false
  }

  // 长度检查
  if (textValue.value.length > 500) {
    return false
  }

  return true
})

// 处理输入
function handleInput(event) {
  textValue.value = event.detail.value
  errorMessage.value = ''
}

// 处理关闭
function handleClose() {
  // 清空输入
  textValue.value = ''
  errorMessage.value = ''

  emit('close')
}

// 处理确认
function handleConfirm() {
  // 验证
  if (!isValid.value) {
    if (!textValue.value) {
      errorMessage.value = '请输入内容'
    } else {
      errorMessage.value = '文本内容超过500字符'
    }
    return
  }

  // 使用服务验证
  const validation = inspectionItemService.validateTextItem(props.item, textValue.value)

  if (!validation.valid) {
    errorMessage.value = validation.error
    return
  }

  // 构建结果对象
  const result = {
    itemId: props.item.item_id,
    itemName: props.item.item_name,
    itemType: 'text',
    actualValue: textValue.value,
    isAbnormal: validation.isAbnormal || hasAbnormalKeyword.value,
    abnormalRemark: hasAbnormalKeyword.value ? textValue.value : null
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

// 文本输入
.input-section {
  padding: 30rpx 40rpx;

  .section-label {
    display: block;
    font-size: 26rpx;
    color: #333;
    margin-bottom: 16rpx;
    font-weight: 500;
  }

  .text-textarea {
    width: 100%;
    min-height: 200rpx;
    padding: 20rpx;
    border: 2rpx solid #e8e8e8;
    border-radius: 12rpx;
    font-size: 28rpx;
    color: #333;
    background-color: #fafafa;
    line-height: 1.6;

    &:focus {
      border-color: #1890ff;
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

  .input-hint {
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
