<template>
  <view class="status-tag" :class="statusClass">
    <text class="status-icon">{{ statusIcon }}</text>
    <text class="status-text">{{ statusText }}</text>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { PointStatus, PointStatusText, PointStatusColor } from '@/constants/PointStatus'

const props = defineProps({
  status: {
    type: String,
    default: PointStatus.PENDING,
    validator: (value) => {
      return Object.values(PointStatus).includes(value)
    }
  },
  size: {
    type: String,
    default: 'normal', // small, normal, large
    validator: (value) => {
      return ['small', 'normal', 'large'].includes(value)
    }
  }
})

// 计算属性
const statusClass = computed(() => {
  const classes = []

  // 状态类名
  if (props.status === PointStatus.PENDING) {
    classes.push('status-pending')
  } else if (props.status === PointStatus.COMPLETED) {
    classes.push('status-completed')
  } else if (props.status === PointStatus.SKIPPED) {
    classes.push('status-skipped')
  }

  // 尺寸类名
  if (props.size === 'small') {
    classes.push('size-small')
  } else if (props.size === 'large') {
    classes.push('size-large')
  }

  return classes.join(' ')
})

const statusIcon = computed(() => {
  switch (props.status) {
    case PointStatus.PENDING:
      return '⏳'
    case PointStatus.COMPLETED:
      return '✅'
    case PointStatus.SKIPPED:
      return '⚠️'
    default:
      return '○'
  }
})

const statusText = computed(() => {
  return PointStatusText[props.status] || '未知'
})

const statusColor = computed(() => {
  return PointStatusColor[props.status] || '#999'
})
</script>

<style lang="scss" scoped>
.status-tag {
  display: inline-flex;
  align-items: center;
  padding: 8rpx 16rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
  transition: all 0.3s;

  .status-icon {
    margin-right: 8rpx;
    font-size: 28rpx;
  }

  .status-text {
    line-height: 1;
  }

  // 尺寸变化
  &.size-small {
    padding: 4rpx 12rpx;
    font-size: 20rpx;

    .status-icon {
      font-size: 22rpx;
      margin-right: 4rpx;
    }
  }

  &.size-large {
    padding: 12rpx 24rpx;
    font-size: 28rpx;

    .status-icon {
      font-size: 32rpx;
      margin-right: 12rpx;
    }
  }

  // 待巡检状态
  &.status-pending {
    background-color: #fff1f0;
    color: #ff7875;
    border: 1rpx solid #ffccc7;
  }

  // 已完成状态
  &.status-completed {
    background-color: #f6ffed;
    color: #52c41a;
    border: 1rpx solid #b7eb8f;
  }

  // 已跳检状态
  &.status-skipped {
    background-color: #fff7e6;
    color: #faad14;
    border: 1rpx solid #ffd591;
  }
}
</style>
