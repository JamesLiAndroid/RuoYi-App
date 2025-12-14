<template>
  <view class="task-list-container">
    <!-- 顶部标题栏 -->
    <view class="header">
      <!-- 左侧：网络状态 -->
      <view class="network-status" :class="{ offline: !isOnline }">
        <text class="status-icon">{{ isOnline ? '📶' : '📴' }}</text>
        <text class="status-text">{{ isOnline ? '在线' : '离线' }}</text>
      </view>

      <!-- 中间：日期 -->
      <view class="date-section">
        <text class="current-date">{{ currentDate }}</text>
        <text class="weekday">{{ currentWeekday }}</text>
      </view>

      <!-- 右侧：操作按钮 -->
      <view class="action-section">
        <view class="refresh-btn" @click="handleRefresh">
          <text class="refresh-icon">🔄</text>
        </view>
        <view class="upload-btn" @click="handleUpload">
          <text class="upload-icon">⬆️</text>
          <text class="upload-count" v-if="pendingUploadCount > 0">{{ pendingUploadCount }}</text>
        </view>
      </view>
    </view>

    <!-- 筛选器 -->
    <view class="filter-section">
      <!-- 日期选择器 -->
      <view class="date-picker">
        <text class="label">日期：</text>
        <picker mode="date" :value="selectedDate" @change="handleDateChange">
          <view class="picker-value">
            <text>{{ formatDate(selectedDate) }}</text>
            <text class="arrow">▼</text>
          </view>
        </picker>
      </view>

      <!-- 状态筛选 - 改为一行显示 -->
      <view class="status-filter-inline">
        <text class="label">状态：</text>
        <view class="chip-group">
          <view
            v-for="status in statusOptions"
            :key="status.value"
            class="chip"
            :class="{ active: selectedStatus === status.value }"
            @click="handleStatusChange(status.value)"
          >
            <text>{{ status.label }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 任务列表 -->
    <scroll-view class="task-list" scroll-y="true" @scrolltolower="handleLoadMore">
      <view v-if="loading" class="loading">
        <text>加载中...</text>
      </view>

      <view v-else-if="filteredTasks.length === 0" class="empty-state">
        <EmptyState
          :icon="emptyState.icon"
          :title="emptyState.title"
          :description="emptyState.description"
        />
      </view>

      <view v-else class="task-cards">
        <TaskCard
          v-for="task in filteredTasks"
          :key="task.task_id"
          :task="task"
          @start="handleStartInspection"
          @continue="handleContinueInspection"
          @view="handleViewDetails"
        />
      </view>
    </scroll-view>

    <!-- 上传数据对话框 -->
    <uni-popup ref="uploadPopup" type="dialog">
      <uni-popup-dialog
        :title="uploadDialog.title"
        :content="uploadDialog.content"
        :confirm-text="uploadDialog.confirmText"
        @confirm="handleConfirmUpload"
      />
    </uni-popup>
  </view>
</template>

<script setup>
import { ref, getCurrentInstance, computed } from "vue"
import { onLoad, onShow, onPullDownRefresh } from "@dcloudio/uni-app"
import { useConfigStore } from '@/store'
import TaskService from '@/services/TaskService'
import InspectionService from '@/services/InspectionService'
import OfflineDataService from '@/services/OfflineDataService'
import TaskCard from '@/components/TaskCard.vue'
import EmptyState from '@/components/EmptyState.vue'

const { proxy } = getCurrentInstance()
const globalConfig = useConfigStore().config

// 数据状态
const tasks = ref([])
const loading = ref(false)
const selectedDate = ref(getTodayDate())
const selectedStatus = ref('ALL')
const pendingUploadCount = ref(0)

// 网络状态
const isOnline = ref(true)

// 分页
const currentPage = ref(1)
const pageSize = ref(20)
const hasMore = ref(true)

// 筛选选项
const statusOptions = [
  { value: 'ALL', label: '全部' },
  { value: 'NOT_STARTED', label: '未开始' },
  { value: 'IN_PROGRESS', label: '进行中' },
  { value: 'COMPLETED', label: '已完成' }
]

// 上传对话框
const uploadPopup = ref(null)
const uploadDialog = ref({
  title: '上传离线数据',
  content: '',
  confirmText: '开始上传'
})

// 计算属性
const filteredTasks = computed(() => {
  return tasks.value
})

const currentDate = computed(() => {
  const date = new Date()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${month}-${day}`
})

const currentWeekday = computed(() => {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const date = new Date()
  return `周${weekdays[date.getDay()]}`
})

const emptyState = computed(() => {
  if (tasks.value.length === 0) {
    return {
      icon: '📋',
      title: '今天暂无巡检任务',
      description: '请选择其他日期查看任务'
    }
  }
  return {
    icon: '🔍',
    title: '未找到符合条件的任务',
    description: '请尝试调整筛选条件'
  }
})

// 页面加载
onLoad(() => {
  initNetworkStatus()
  loadTasks()
  loadPendingUploadCount()
})

onShow(() => {
  // 页面显示时刷新数据
  loadTasks()
})

// 下拉刷新
onPullDownRefresh(() => {
  refreshTasks()
})

// 初始化网络状态
function initNetworkStatus() {
  uni.onNetworkStatusChange((res) => {
    isOnline.value = res.isConnected
  })
  isOnline.value = uni.getNetworkTypeSync() !== 'none'
}

// 获取今天的日期字符串
function getTodayDate() {
  const date = new Date()
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 格式化日期显示
function formatDate(dateStr) {
  if (!dateStr) return '请选择'
  const date = new Date(dateStr)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${month}月${day}日`
}

// 加载任务列表
async function loadTasks() {
  if (loading.value) return
  loading.value = true

  try {
    const data = await TaskService.getTaskList(selectedDate.value, selectedStatus.value)
    tasks.value = data
  } catch (error) {
    console.error('加载任务列表失败:', error)
    uni.showToast({
      title: '加载任务失败',
      icon: 'error'
    })
  } finally {
    loading.value = false
  }
}

// 刷新任务列表
async function refreshTasks() {
  try {
    currentPage.value = 1
    await loadTasks()
    uni.showToast({
      title: '刷新成功',
      icon: 'success'
    })
  } catch (error) {
    console.error('刷新失败:', error)
  } finally {
    uni.stopPullDownRefresh()
  }
}

// 加载更多
async function handleLoadMore() {
  if (!hasMore.value || loading.value) return
  // TODO: 实现分页加载
}

// 加载待上传记录数
async function loadPendingUploadCount() {
  try {
    const count = await OfflineDataService.getPendingUploadCount()
    pendingUploadCount.value = count.total
  } catch (error) {
    console.error('加载待上传记录数失败:', error)
    pendingUploadCount.value = 0
  }
}

// 刷新按钮
function handleRefresh() {
  refreshTasks()
}

// 上传按钮
async function handleUpload() {
  // 查询待上传数据数量
  await loadPendingUploadCount()

  if (pendingUploadCount.value === 0) {
    uni.showToast({
      title: '暂无待上传数据',
      icon: 'none'
    })
    return
  }

  uploadDialog.value.content = `发现 ${pendingUploadCount.value} 条待上传记录，是否立即上传？`
  uploadPopup.value.open()
}

// 确认上传
function handleConfirmUpload() {
  // TODO: 实现数据上传逻辑
  uni.showToast({
    title: '开始上传...',
    icon: 'none'
  })
}

// 日期改变
function handleDateChange(e) {
  selectedDate.value = e.detail.value
  loadTasks()
}

// 状态改变
function handleStatusChange(status) {
  selectedStatus.value = status
  loadTasks()
}

// 开始巡检
function handleStartInspection(task) {
  console.log('[TaskList] handleStartInspection 被调用，任务ID:', task.task_id, '任务名称:', task.route_name)

  // 检查任务日期是否为今天
  const today = getTodayDate()
  if (task.task_date !== today) {
    uni.showModal({
      title: '无法开始巡检',
      content: '只能开始当天的巡检任务',
      showCancel: false,
      confirmText: '知道了'
    })
    return
  }

  uni.showModal({
    title: '开始巡检',
    content: `确定要开始巡检【${task.route_name}】吗？`,
    success: async (res) => {
      console.log('[TaskList] Modal 响应:', res)

      if (res.confirm) {
        console.log('[TaskList] 用户确认开始巡检，调用 InspectionService.startInspection...')

        const success = await InspectionService.startInspection(task.task_id)

        console.log('[TaskList] InspectionService.startInspection 返回结果:', success)

        if (success) {
          // 更新任务状态
          console.log('[TaskList] 开始巡检成功，更新任务状态为 IN_PROGRESS')
          task.task_status = 'IN_PROGRESS'
        } else {
          console.error('[TaskList] 开始巡检失败，success 为 false')
        }
      } else {
        console.log('[TaskList] 用户取消开始巡检')
      }
    }
  })
}

// 继续巡检
function handleContinueInspection(task) {
  InspectionService.continueInspection(task.task_id)
}

// 查看详情
function handleViewDetails(task) {
  // 检查NFC是否可用
  // #ifdef APP-PLUS
  if (!plus || !plus.nfc) {
    uni.showModal({
      title: 'NFC不可用',
      content: '当前设备不支持NFC功能，无法进行巡检。请更换支持NFC的设备。',
      showCancel: false,
      confirmText: '知道了'
    })
    return
  }

  // 检查NFC是否已启用
  plus.nfc.isEnabled({
    success: () => {
      // NFC已启用，跳转到任务详情
      uni.navigateTo({
        url: `/pages/task/TaskDetail?taskId=${task.task_id}`
      })
    },
    fail: () => {
      // NFC未启用
      uni.showModal({
        title: 'NFC未启用',
        content: '请在系统设置中开启NFC功能后再进行巡检',
        showCancel: true,
        cancelText: '取消',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) {
            // 打开系统设置
            plus.runtime.openURL('settings://nfc')
          }
        }
      })
    }
  })
  // #endif

  // #ifndef APP-PLUS
  uni.showToast({
    title: 'NFC功能仅在App中可用',
    icon: 'none'
  })
  // #endif
}
</script>

<style lang="scss" scoped>
.task-list-container {
  min-height: 100vh;
  background-color: #f5f5f5;
}

// 顶部标题栏
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 40rpx;
  background-color: #fff;
  border-bottom: 1rpx solid #e0e0e0;

  // 左侧：网络状态
  .network-status {
    display: flex;
    align-items: center;
    gap: 8rpx;
    padding: 8rpx 16rpx;
    background-color: #f0f9ff;
    border-radius: 20rpx;

    .status-icon {
      font-size: 24rpx;
    }

    .status-text {
      font-size: 22rpx;
      color: #1890ff;
      font-weight: 500;
    }

    &.offline {
      background-color: #fff1f0;

      .status-text {
        color: #ff4d4f;
      }
    }
  }

  // 中间：日期
  .date-section {
    text-align: center;
    flex: 1;

    .current-date {
      display: block;
      font-size: 36rpx;
      font-weight: bold;
      color: #1890ff;
    }

    .weekday {
      display: block;
      font-size: 24rpx;
      color: #666;
    }
  }

  // 右侧：操作按钮
  .action-section {
    display: flex;
    align-items: center;
    gap: 20rpx;

    .refresh-btn,
    .upload-btn {
      width: 60rpx;
      height: 60rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #f5f5f5;
      border-radius: 50%;
      position: relative;

      .refresh-icon,
      .upload-icon {
        font-size: 32rpx;
      }

      .upload-count {
        position: absolute;
        top: -10rpx;
        right: -10rpx;
        width: 32rpx;
        height: 32rpx;
        background-color: #ff4d4f;
        color: #fff;
        border-radius: 50%;
        font-size: 20rpx;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  }
}

// 筛选器
.filter-section {
  padding: 30rpx 40rpx;
  background-color: #fff;
  margin-bottom: 20rpx;

  .date-picker {
    display: flex;
    align-items: center;
    margin-bottom: 20rpx;

    .label {
      font-size: 28rpx;
      color: #333;
      margin-right: 20rpx;
    }

    .picker-value {
      display: flex;
      align-items: center;
      padding: 15rpx 30rpx;
      background-color: #f5f5f5;
      border-radius: 8rpx;
      font-size: 28rpx;
      color: #1890ff;

      .arrow {
        margin-left: 10rpx;
        font-size: 20rpx;
      }
    }
  }

  // 状态筛选 - 单行显示
  .status-filter-inline {
    display: flex;
    align-items: center;

    .label {
      font-size: 28rpx;
      color: #333;
      margin-right: 20rpx;
      white-space: nowrap;
    }

    .chip-group {
      display: flex;
      gap: 15rpx;
      flex-wrap: nowrap;
      overflow-x: auto;

      .chip {
        padding: 12rpx 30rpx;
        background-color: #f5f5f5;
        border-radius: 20rpx;
        font-size: 26rpx;
        color: #666;
        white-space: nowrap;

        &.active {
          background-color: #1890ff;
          color: #fff;
        }
      }
    }
  }
}

// 任务列表
.task-list {
  flex: 1;
  height: calc(100vh - 500rpx);

  .loading {
    text-align: center;
    padding: 60rpx;
    color: #666;
  }

  .empty-state {
    padding: 100rpx 40rpx;
  }

  .task-cards {
    padding: 0 40rpx 40rpx;
  }
}
</style>
