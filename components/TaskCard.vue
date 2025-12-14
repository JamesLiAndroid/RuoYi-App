<template>
  <view class="task-card" :class="statusClass">
    <!-- 卡片头部 -->
    <view class="card-header">
      <text class="route-name">{{ task.route_name || '未命名路线' }}</text>
      <view class="status-tag" :class="statusClass">
        <text>{{ statusText }}</text>
      </view>
    </view>

    <!-- 任务信息 -->
    <view class="task-info">
      <view class="info-item">
        <text class="info-label">任务日期：</text>
        <text class="info-value">{{ formatDate(task.task_date) }}</text>
      </view>
      <view class="info-item">
        <text class="info-label">路线编号：</text>
        <text class="info-value">{{ task.route_code || '-' }}</text>
      </view>
    </view>

    <!-- 进度信息 -->
    <view class="progress-section">
      <view class="progress-header">
        <text class="progress-label">点位进度</text>
        <text class="progress-text">{{ task.progress.statusText }}</text>
      </view>
      <view class="progress-bar">
        <view class="progress-inner" :style="{ width: task.progress.percentage + '%' }"></view>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="action-buttons">
      <button
        v-if="task.task_status === 'NOT_STARTED'"
        class="btn btn-primary"
        @click="handleStart"
      >
        <text>开始巡检</text>
      </button>

      <button
        v-if="task.task_status === 'IN_PROGRESS'"
        class="btn btn-warning"
        @click="handleContinue"
      >
        <text>继续巡检</text>
      </button>

      <button
        v-if="task.task_status === 'COMPLETED'"
        class="btn btn-secondary"
        @click="handleView"
      >
        <text>查看详情</text>
      </button>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import TaskService from '@/services/TaskService'

const props = defineProps({
  task: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['start', 'continue', 'view'])

// 计算属性
const statusClass = computed(() => {
  return props.task.task_status?.toLowerCase() || 'not_started'
})

const statusText = computed(() => {
  const statusMap = {
    'NOT_STARTED': '未开始',
    'IN_PROGRESS': '进行中',
    'COMPLETED': '已完成'
  }
  return statusMap[props.task.task_status] || '未知'
})

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
  return `${month}月${day}日 周${weekday}`
}

// 处理开始巡检
function handleStart() {
  emit('start', props.task)
}

// 处理继续巡检
function handleContinue() {
  emit('continue', props.task)
}

// 处理查看详情
function handleView() {
  emit('view', props.task)
}
</script>

<style lang="scss" scoped>
.task-card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);

  &.not_started {
    border-left: 8rpx solid #d9d9d9;
  }

  &.in_progress {
    border-left: 8rpx solid #1890ff;
  }

  &.completed {
    border-left: 8rpx solid #52c41a;
  }
}

// 卡片头部
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 30rpx;

  .route-name {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
    flex: 1;
  }

  .status-tag {
    padding: 8rpx 20rpx;
    border-radius: 20rpx;
    font-size: 24rpx;
    font-weight: 500;

    &.not_started {
      background-color: #f5f5f5;
      color: #666;
    }

    &.in_progress {
      background-color: #e6f4ff;
      color: #1890ff;
    }

    &.completed {
      background-color: #f6ffed;
      color: #52c41a;
    }
  }
}

// 任务信息
.task-info {
  margin-bottom: 30rpx;

  .info-item {
    display: flex;
    margin-bottom: 15rpx;

    &:last-child {
      margin-bottom: 0;
    }

    .info-label {
      font-size: 26rpx;
      color: #666;
      width: 160rpx;
    }

    .info-value {
      font-size: 26rpx;
      color: #333;
      flex: 1;
    }
  }
}

// 进度信息
.progress-section {
  margin-bottom: 30rpx;

  .progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 15rpx;

    .progress-label {
      font-size: 26rpx;
      color: #666;
    }

    .progress-text {
      font-size: 26rpx;
      color: #333;
      font-weight: 500;
    }
  }

  .progress-bar {
    height: 16rpx;
    background-color: #f0f0f0;
    border-radius: 8rpx;
    overflow: hidden;

    .progress-inner {
      height: 100%;
      background-color: #1890ff;
      border-radius: 8rpx;
      transition: width 0.3s ease;
    }
  }
}

// 操作按钮
.action-buttons {
  .btn {
    width: 100%;
    height: 80rpx;
    border-radius: 40rpx;
    border: none;
    font-size: 28rpx;
    font-weight: 500;

    &.btn-primary {
      background-color: #1890ff;
      color: #fff;
    }

    &.btn-warning {
      background-color: #faad14;
      color: #fff;
    }

    &.btn-secondary {
      background-color: #f5f5f5;
      color: #666;
    }
  }
}
</style>
