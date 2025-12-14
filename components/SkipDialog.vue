<template>
  <view v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
    <view class="dialog-content" @click.stop>
      <!-- 标题 -->
      <view class="dialog-header">
        <text class="dialog-title">跳检确认</text>
        <text class="close-icon" @click="handleClose">✕</text>
      </view>

      <!-- 点位信息 -->
      <view class="point-info">
        <view class="info-row">
          <text class="info-label">点位名称</text>
          <text class="info-value">{{ pointInfo?.point_name || '-' }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">点位编号</text>
          <text class="info-value">{{ pointInfo?.point_code || '-' }}</text>
        </view>
      </view>

      <!-- 跳检原因选择 -->
      <view class="reason-section">
        <text class="section-label">请选择跳检原因 <text class="required">*</text></text>
        <radio-group @change="handleReasonChange">
          <view
            v-for="reason in skipReasons"
            :key="reason.code"
            class="reason-item"
            :class="{ selected: selectedReason === reason.code }"
          >
            <radio
              :value="reason.code"
              :checked="selectedReason === reason.code"
              color="#1890ff"
            />
            <view class="reason-content">
              <text class="reason-name">{{ reason.name }}</text>
              <text class="reason-desc">{{ reason.description }}</text>
            </view>
          </view>
        </radio-group>
      </view>

      <!-- 跳检备注 -->
      <view class="remark-section">
        <text class="section-label">跳检说明（选填）</text>
        <textarea
          class="remark-textarea"
          v-model="skipRemark"
          placeholder="请输入具体的跳检说明..."
          :maxlength="maxLength"
          :auto-height="true"
          @input="handleRemarkInput"
        />
        <text class="char-count">{{ skipRemark.length }}/{{ maxLength }}</text>
      </view>

      <!-- 警告提示 -->
      <view v-if="showWarning" class="warning-message">
        <text class="warning-icon">⚠️</text>
        <text class="warning-text">{{ warningMessage }}</text>
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
          确认跳检
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { SkipReasons, SKIP_REASON_MAX_LENGTH } from '@/constants/PointStatus'
import skipValidationService from '@/services/SkipValidationService'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  taskId: {
    type: Number,
    default: null
  },
  pointInfo: {
    type: Object,
    default: null
  },
  routeId: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['close', 'confirm'])

// 响应式数据
const selectedReason = ref('')
const skipRemark = ref('')
const errorMessage = ref('')
const warningMessage = ref('')
const showWarning = ref(false)
const maxLength = SKIP_REASON_MAX_LENGTH
const skipReasons = SkipReasons

// 计算属性
const isValid = computed(() => {
  return selectedReason.value && selectedReason.value.length > 0
})

// 处理原因选择
function handleReasonChange(event) {
  selectedReason.value = event.detail.value
  errorMessage.value = ''

  // 如果选择"其他原因"，建议填写备注
  if (selectedReason.value === 'OTHER') {
    showWarning.value = true
    warningMessage.value = '选择"其他原因"时，建议填写具体的跳检说明'
  } else {
    showWarning.value = false
  }
}

// 处理备注输入
function handleRemarkInput(event) {
  skipRemark.value = event.detail.value
}

// 处理关闭
function handleClose() {
  // 清空输入
  selectedReason.value = ''
  skipRemark.value = ''
  errorMessage.value = ''
  showWarning.value = false

  emit('close')
}

// 处理确认
async function handleConfirm() {
  // 验证
  if (!isValid.value) {
    errorMessage.value = '请选择跳检原因'
    return
  }

  // 验证备注长度
  if (skipRemark.value.length > maxLength) {
    errorMessage.value = `跳检说明不能超过${maxLength}个字符`
    return
  }

  // 使用验证服务进行综合验证
  if (props.taskId && props.pointInfo?.point_id && props.routeId) {
    try {
      uni.showLoading({ title: '验证中...' })

      const validation = await skipValidationService.validateSkipOperation(
        props.taskId,
        props.pointInfo.point_id,
        props.routeId
      )

      uni.hideLoading()

      if (!validation.valid) {
        errorMessage.value = validation.error
        return
      }

      // 显示警告信息（如果有）
      if (validation.warnings && validation.warnings.length > 0) {
        uni.showModal({
          title: '温馨提示',
          content: validation.warnings.join('\n'),
          showCancel: true,
          cancelText: '取消',
          confirmText: '继续跳检',
          success: (res) => {
            if (res.confirm) {
              submitSkip()
            }
          }
        })
        return
      }
    } catch (error) {
      uni.hideLoading()
      console.error('验证跳检操作失败:', error)
      errorMessage.value = '验证失败，请重试'
      return
    }
  }

  // 直接提交跳检
  submitSkip()
}

// 提交跳检
function submitSkip() {
  // 构建跳检数据
  const skipData = {
    taskId: props.taskId,
    pointId: props.pointInfo?.point_id,
    skipReason: selectedReason.value,
    skipRemark: skipRemark.value || null
  }

  // 触发确认事件
  emit('confirm', skipData)

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
    // 对话框关闭时，清空输入
    selectedReason.value = ''
    skipRemark.value = ''
    errorMessage.value = ''
    showWarning.value = false
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
    max-width: 640rpx;
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

// 点位信息
.point-info {
  padding: 20rpx 40rpx;
  background-color: #f5f5f5;

  .info-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8rpx;

    &:last-child {
      margin-bottom: 0;
    }

    .info-label {
      font-size: 26rpx;
      color: #666;
    }

    .info-value {
      font-size: 26rpx;
      color: #333;
      font-weight: 500;
    }
  }
}

// 跳检原因
.reason-section {
  padding: 30rpx 40rpx;

  .section-label {
    display: block;
    font-size: 28rpx;
    color: #333;
    margin-bottom: 20rpx;
    font-weight: 500;

    .required {
      color: #ff4d4f;
    }
  }

  .reason-item {
    display: flex;
    padding: 24rpx 20rpx;
    border: 2rpx solid #e8e8e8;
    border-radius: 12rpx;
    margin-bottom: 16rpx;
    transition: all 0.3s;

    &.selected {
      border-color: #1890ff;
      background-color: #e6f4ff;
    }

    &:last-child {
      margin-bottom: 0;
    }

    radio {
      margin-right: 16rpx;
      margin-top: 4rpx;
    }

    .reason-content {
      flex: 1;
      display: flex;
      flex-direction: column;

      .reason-name {
        font-size: 28rpx;
        color: #333;
        font-weight: 500;
        margin-bottom: 8rpx;
      }

      .reason-desc {
        font-size: 24rpx;
        color: #999;
        line-height: 1.6;
      }
    }
  }
}

// 跳检备注
.remark-section {
  padding: 0 40rpx 30rpx;

  .section-label {
    display: block;
    font-size: 28rpx;
    color: #333;
    margin-bottom: 16rpx;
    font-weight: 500;
  }

  .remark-textarea {
    width: 100%;
    min-height: 150rpx;
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
}

// 警告提示
.warning-message {
  display: flex;
  align-items: flex-start;
  margin: 0 40rpx 20rpx;
  padding: 16rpx;
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
    flex: 1;
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
      background-color: #faad14;
      color: #fff;

      &:active {
        background-color: #d48806;
      }

      &[disabled] {
        background-color: #d9d9d9;
        color: #999;
      }
    }
  }
}
</style>
