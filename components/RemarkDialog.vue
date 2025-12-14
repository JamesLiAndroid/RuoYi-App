<template>
  <view v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
    <view class="dialog-content" @click.stop>
      <!-- 标题 -->
      <view class="dialog-header">
        <text class="dialog-title">{{ isEdit ? '编辑备注' : '添加备注' }}</text>
        <text class="close-icon" @click="handleClose">✕</text>
      </view>

      <!-- 备注内容 -->
      <view class="remark-section">
        <textarea
          class="remark-textarea"
          v-model="remarkText"
          :placeholder="placeholder"
          :maxlength="maxLength"
          :auto-height="true"
          @input="handleInput"
        />
        <text class="char-count">{{ remarkText.length }}/{{ maxLength }}</text>

        <!-- 提示信息 -->
        <view v-if="showHint" class="input-hint">
          <text class="hint-icon">💡</text>
          <text class="hint-text">{{ hintText }}</text>
        </view>
      </view>

      <!-- 错误提示 -->
      <text v-if="errorMessage" class="error-message">{{ errorMessage }}</text>

      <!-- 按钮组 -->
      <view class="dialog-footer">
        <button class="btn btn-cancel" @click="handleClose">取消</button>
        <button v-if="isEdit && remarkText" class="btn btn-delete" @click="handleDelete">删除</button>
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
import { REMARK_MAX_LENGTH } from '@/constants/PointStatus'
import remarkService from '@/services/RemarkService'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  recordId: {
    type: Number,
    default: null
  },
  initialRemark: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: '请输入备注内容...'
  }
})

const emit = defineEmits(['close', 'confirm', 'delete'])

// 响应式数据
const remarkText = ref('')
const errorMessage = ref('')
const maxLength = REMARK_MAX_LENGTH

// 计算属性
const isEdit = computed(() => {
  return props.initialRemark && props.initialRemark.length > 0
})

const showHint = computed(() => {
  return remarkText.value.length > 0 && remarkText.value.length < maxLength * 0.9
})

const hintText = computed(() => {
  if (remarkText.value.length > maxLength * 0.9) {
    return '备注内容即将达到上限'
  }
  return '备注将保存到本地，支持离线编辑'
})

const isValid = computed(() => {
  return remarkText.value.trim().length > 0 && remarkText.value.length <= maxLength
})

// 处理输入
function handleInput(event) {
  remarkText.value = event.detail.value
  errorMessage.value = ''
}

// 处理关闭
function handleClose() {
  // 清空输入
  remarkText.value = ''
  errorMessage.value = ''

  emit('close')
}

// 处理确认
async function handleConfirm() {
  // 验证
  if (!isValid.value) {
    if (!remarkText.value.trim()) {
      errorMessage.value = '备注内容不能为空'
    } else {
      errorMessage.value = `备注内容不能超过${maxLength}个字符`
    }
    return
  }

  // 使用服务验证
  const validation = remarkService.validateRemark(remarkText.value)

  if (!validation.valid) {
    errorMessage.value = validation.error
    return
  }

  // 触发确认事件
  emit('confirm', {
    recordId: props.recordId,
    remark: remarkText.value
  })

  // 清空并关闭
  handleClose()
}

// 处理删除
function handleDelete() {
  uni.showModal({
    title: '删除备注',
    content: '确定要删除这条备注吗？',
    showCancel: true,
    cancelText: '取消',
    confirmText: '删除',
    success: (res) => {
      if (res.confirm) {
        emit('delete', {
          recordId: props.recordId
        })
        handleClose()
      }
    }
  })
}

// 处理遮罩点击
function handleOverlayClick() {
  handleClose()
}

// 监听可见性变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    // 对话框打开时，加载初始备注
    remarkText.value = props.initialRemark || ''
  } else {
    // 对话框关闭时，清空输入
    remarkText.value = ''
    errorMessage.value = ''
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

// 备注内容
.remark-section {
  padding: 30rpx 40rpx;

  .remark-textarea {
    width: 100%;
    min-height: 300rpx;
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

    &.btn-delete {
      background-color: #ff4d4f;
      color: #fff;

      &:active {
        background-color: #d9363e;
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
