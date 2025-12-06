<template>
  <view class="data-sync-container">
    <!-- 同步说明页面 -->
    <view v-if="currentStep === 'description'" class="sync-description">
      <view class="icon">🔄</view>
      <text class="title">检测到数据更新</text>
      <text class="content">
        为确保数据准确性，必须同步最新数据后才能开始巡检
      </text>

      <!-- 更新说明 -->
      <view class="update-info" v-if="updateInfo">
        <text class="update-title">本次更新内容：</text>
        <view class="update-item" v-for="item in updateInfo.items" :key="item.table">
          <text class="item-icon">{{ item.icon }}</text>
          <text class="item-name">{{ item.name }}</text>
          <text class="item-status" :class="{ updated: item.hasUpdate }">
            {{ item.hasUpdate ? '有更新' : '已是最新' }}
          </text>
        </view>
      </view>

      <view class="warning">
        <text class="warning-icon">⚠️</text>
        <text class="warning-text">
          同步过程中请勿关闭应用或切换网络
        </text>
      </view>

      <button class="sync-btn" @click="startSync" :disabled="isStarting">
        {{ isStarting ? '准备中...' : '开始同步' }}
      </button>
    </view>

    <!-- 同步进度页面 -->
    <view v-if="currentStep === 'progress'" class="sync-progress">
      <view class="progress-header">
        <text class="progress-title">数据同步中...</text>
        <text class="progress-percentage">{{ syncProgress.percentage }}%</text>
      </view>

      <!-- 总体进度条 -->
      <view class="progress-bar">
        <view class="progress-inner" :style="{ width: syncProgress.percentage + '%' }"></view>
      </view>

      <!-- 同步项列表 -->
      <view class="sync-items">
        <view
          class="sync-item"
          v-for="item in syncItems"
          :key="item.key"
          :class="{ active: item.status === 'syncing' }"
        >
          <view class="item-header">
            <text class="item-icon">{{ item.icon }}</text>
            <text class="item-name">{{ item.name }}</text>
            <text class="item-status" :class="item.status">
              {{ getStatusText(item.status) }}
            </text>
          </view>

          <!-- 单项进度条 -->
          <view class="item-progress" v-if="item.status === 'syncing'">
            <view class="item-progress-bar">
              <view class="item-progress-inner" :style="{ width: item.progress + '%' }"></view>
            </view>
            <text class="item-progress-text">{{ item.progress }}%</text>
          </view>

          <!-- 错误信息 -->
          <view class="item-error" v-if="item.status === 'error'">
            <text class="error-text">{{ item.error }}</text>
            <text class="retry-text" @click="retrySyncItem(item.key)">点击重试</text>
          </view>
        </view>
      </view>

      <!-- 底部操作按钮 -->
      <view class="progress-actions">
        <button
          v-if="syncProgress.isCompleted && syncProgress.hasError"
          class="retry-btn"
          @click="retryAllSync"
        >
          重新同步
        </button>
        <button
          v-if="syncProgress.isCompleted && !syncProgress.hasError"
          class="success-btn"
          @click="completeSync"
        >
          开始巡检
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, getCurrentInstance } from "vue"
import { onLoad } from "@dcloudio/uni-app"
import ApiService from '@/utils/ApiService'
import DatabaseService from '@/utils/DatabaseService'
import StorageService from '@/utils/StorageService'

const { proxy } = getCurrentInstance()

// 当前步骤：description | progress
const currentStep = ref('description')

// 是否正在开始同步
const isStarting = ref(false)

// 更新信息
const updateInfo = ref(null)

// 同步进度
const syncProgress = ref({
  percentage: 0,
  isCompleted: false,
  hasError: false
})

// 同步项列表
const syncItems = ref([
  { key: 'routes', name: '巡检路线', icon: '🗺️', status: 'pending', progress: 0 },
  { key: 'points', name: '巡检点位', icon: '📍', status: 'pending', progress: 0 },
  { key: 'items', name: '巡查项目', icon: '📝', status: 'pending', progress: 0 },
  { key: 'tasks', name: '巡检任务', icon: '✅', status: 'pending', progress: 0 }
])

// 页面加载
onLoad(() => {
  checkForUpdates()
})

// 检查更新
async function checkForUpdates() {
  try {
    // 获取服务器版本
    const serverVersion = await ApiService.get('/mobile/data-version')
    const localMetadata = StorageService.getSyncMetadata()

    // 检查哪些表需要更新
    const updateItems = []
    for (const [table, version] of Object.entries(serverVersion)) {
      const localVersion = localMetadata[table] || null
      const hasUpdate = localVersion !== version

      // 转换表名为显示名称
      const tableNames = {
        'routes_version': { name: '巡检路线', icon: '🗺️' },
        'points_version': { name: '巡检点位', icon: '📍' },
        'items_version': { name: '巡查项目', icon: '📝' },
        'tasks_version': { name: '巡检任务', icon: '✅' }
      }

      if (tableNames[table]) {
        updateItems.push({
          table,
          name: tableNames[table].name,
          icon: tableNames[table].icon,
          hasUpdate
        })
      }
    }

    updateInfo.value = {
      items: updateItems
    }
  } catch (error) {
    console.error('检查更新失败:', error)
    uni.showToast({
      title: '检查更新失败: ' + error.message,
      icon: 'error'
    })
  }
}

// 开始同步
async function startSync() {
  if (isStarting.value) return

  isStarting.value = true

  try {
    // 初始化数据库
    await DatabaseService.init()

    // 切换到进度页面
    currentStep.value = 'progress'

    // 开始同步数据
    await syncAllData()
  } catch (error) {
    console.error('初始化失败:', error)
    uni.showToast({
      title: '初始化失败: ' + error.message,
      icon: 'error'
    })
  } finally {
    isStarting.value = false
  }
}

// 同步所有数据
async function syncAllData() {
  const serverVersion = await ApiService.get('/mobile/data-version')
  const localMetadata = StorageService.getSyncMetadata()
  let completedItems = 0
  let errorCount = 0

  for (const item of syncItems.value) {
    const versionKey = `${item.key}_version`
    const serverVersionValue = serverVersion[versionKey]
    const localVersionValue = localMetadata[versionKey]

    // 如果版本相同，跳过
    if (serverVersionValue === localVersionValue) {
      item.status = 'completed'
      completedItems++
      continue
    }

    // 开始同步
    item.status = 'syncing'
    updateOverallProgress(completedItems, syncItems.value.length)

    try {
      await syncItemData(item, serverVersionValue)
      item.status = 'completed'
      completedItems++
      errorCount = 0 // 重置错误计数
    } catch (error) {
      console.error(`同步${item.name}失败:`, error)
      item.status = 'error'
      item.error = error.message
      errorCount++
    }

    updateOverallProgress(completedItems, syncItems.value.length)
  }

  // 标记同步完成
  syncProgress.value.isCompleted = true
  syncProgress.value.hasError = errorCount > 0
}

// 同步单个数据项
async function syncItemData(item, serverVersion) {
  try {
    let data = []

    // 根据数据类型获取数据
    switch (item.key) {
      case 'routes':
        data = await ApiService.get('/mobile/routes')
        item.progress = 20
        await DatabaseService.syncRoutes(data)
        item.progress = 100
        updateMetadata('routes_version', serverVersion)
        break

      case 'points':
        data = await ApiService.get('/mobile/points')
        item.progress = 20
        await DatabaseService.syncPoints(data)
        item.progress = 100
        updateMetadata('points_version', serverVersion)
        break

      case 'items':
        data = await ApiService.get('/mobile/inspection-items')
        item.progress = 20
        await DatabaseService.syncItems(data)
        item.progress = 100
        updateMetadata('items_version', serverVersion)
        break

      case 'tasks':
        data = await ApiService.get('/mobile/tasks')
        item.progress = 20
        await DatabaseService.syncTasks(data)
        item.progress = 100
        updateMetadata('tasks_version', serverVersion)
        break

      default:
        throw new Error('未知的数据类型')
    }
  } catch (error) {
    throw new Error(`同步${item.name}失败: ${error.message}`)
  }
}

// 更新总体进度
function updateOverallProgress(completed, total) {
  const percentage = Math.round((completed / total) * 100)
  syncProgress.value.percentage = percentage
}

// 更新同步元数据（不替换整个对象）
function updateMetadata(key, value) {
  const metadata = StorageService.getSyncMetadata()
  metadata[key] = value
  metadata[`${key}_sync_time`] = new Date().toISOString()
  StorageService.setSyncMetadata(metadata)
}

// 获取状态文本
function getStatusText(status) {
  const statusMap = {
    'pending': '等待中',
    'syncing': '同步中',
    'completed': '已完成',
    'error': '同步失败'
  }
  return statusMap[status] || status
}

// 重试单个同步项
async function retrySyncItem(key) {
  const item = syncItems.value.find(i => i.key === key)
  if (!item || item.status !== 'error') return

  item.status = 'syncing'
  item.error = ''

  try {
    const serverVersion = await ApiService.get('/mobile/data-version')
    const versionKey = `${item.key}_version`
    const serverVersionValue = serverVersion[versionKey]

    await syncItemData(item, serverVersionValue)
    item.status = 'completed'
  } catch (error) {
    item.status = 'error'
    item.error = error.message
  }

  // 检查是否所有项都完成
  const allCompleted = syncItems.value.every(i => i.status === 'completed')
  const hasError = syncItems.value.some(i => i.status === 'error')

  if (allCompleted) {
    syncProgress.value.isCompleted = true
    syncProgress.value.hasError = hasError
  }
}

// 重试所有同步
async function retryAllSync() {
  // 重置所有失败的项目
  for (const item of syncItems.value) {
    if (item.status === 'error') {
      item.status = 'pending'
      item.progress = 0
      item.error = ''
    }
  }

  syncProgress.value.isCompleted = false
  syncProgress.value.hasError = false
  syncProgress.value.percentage = 0

  // 重新开始同步
  await syncAllData()
}

// 完成同步
function completeSync() {
  uni.showToast({
    title: '同步完成',
    icon: 'success'
  })

  // 跳转到首页
  setTimeout(() => {
    uni.reLaunch({ url: '/pages/index' })
  }, 500)
}
</script>

<style lang="scss" scoped>
.data-sync-container {
  min-height: 100vh;
  background-color: #f5f5f5;
}

// 同步说明页面
.sync-description {
  padding: 80rpx 40rpx;
  text-align: center;

  .icon {
    font-size: 120rpx;
    margin-bottom: 30rpx;
  }

  .title {
    display: block;
    font-size: 40rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 20rpx;
  }

  .content {
    display: block;
    font-size: 28rpx;
    color: #666;
    line-height: 1.6;
    margin-bottom: 40rpx;
  }

  .update-info {
    background-color: #fff;
    border-radius: 12rpx;
    padding: 30rpx;
    margin-bottom: 40rpx;
    text-align: left;

    .update-title {
      display: block;
      font-size: 28rpx;
      font-weight: 500;
      color: #333;
      margin-bottom: 20rpx;
    }

    .update-item {
      display: flex;
      align-items: center;
      padding: 20rpx 0;
      border-bottom: 1rpx solid #f0f0f0;

      &:last-child {
        border-bottom: none;
      }

      .item-icon {
        font-size: 32rpx;
        margin-right: 20rpx;
      }

      .item-name {
        flex: 1;
        font-size: 28rpx;
        color: #333;
      }

      .item-status {
        font-size: 24rpx;
        color: #999;

        &.updated {
          color: #52c41a;
        }
      }
    }
  }

  .warning {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #fff3cd;
    border-radius: 8rpx;
    padding: 20rpx;
    margin-bottom: 40rpx;

    .warning-icon {
      font-size: 28rpx;
      margin-right: 15rpx;
    }

    .warning-text {
      font-size: 24rpx;
      color: #856404;
    }
  }

  .sync-btn {
    width: 100%;
    height: 88rpx;
    background-color: #1890ff;
    color: #fff;
    border: none;
    border-radius: 8rpx;
    font-size: 28rpx;
    font-weight: 500;

    &:disabled {
      background-color: #d9d9d9;
    }
  }
}

// 同步进度页面
.sync-progress {
  padding: 60rpx 40rpx;

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30rpx;

    .progress-title {
      font-size: 36rpx;
      font-weight: bold;
      color: #333;
    }

    .progress-percentage {
      font-size: 32rpx;
      font-weight: bold;
      color: #1890ff;
    }
  }

  .progress-bar {
    height: 12rpx;
    background-color: #f0f0f0;
    border-radius: 6rpx;
    overflow: hidden;
    margin-bottom: 40rpx;

    .progress-inner {
      height: 100%;
      background-color: #1890ff;
      border-radius: 6rpx;
      transition: width 0.3s ease;
    }
  }

  .sync-items {
    background-color: #fff;
    border-radius: 12rpx;
    padding: 30rpx;
    margin-bottom: 40rpx;
  }

  .sync-item {
    padding: 30rpx 0;
    border-bottom: 1rpx solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }

    &.active {
      background-color: #f8f9fa;
      margin: 0 -30rpx;
      padding: 30rpx;
      border-radius: 8rpx;
    }

    .item-header {
      display: flex;
      align-items: center;
      margin-bottom: 20rpx;

      .item-icon {
        font-size: 36rpx;
        margin-right: 20rpx;
      }

      .item-name {
        flex: 1;
        font-size: 28rpx;
        color: #333;
        font-weight: 500;
      }

      .item-status {
        font-size: 24rpx;
        padding: 8rpx 16rpx;
        border-radius: 20rpx;

        &.pending {
          color: #999;
          background-color: #f5f5f5;
        }

        &.syncing {
          color: #1890ff;
          background-color: #e6f4ff;
        }

        &.completed {
          color: #52c41a;
          background-color: #f6ffed;
        }

        &.error {
          color: #ff4d4f;
          background-color: #fff2f0;
        }
      }
    }

    .item-progress {
      .item-progress-bar {
        height: 8rpx;
        background-color: #f0f0f0;
        border-radius: 4rpx;
        overflow: hidden;
        margin-bottom: 10rpx;

        .item-progress-inner {
          height: 100%;
          background-color: #1890ff;
          border-radius: 4rpx;
          transition: width 0.3s ease;
        }
      }

      .item-progress-text {
        font-size: 24rpx;
        color: #1890ff;
      }
    }

    .item-error {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background-color: #fff2f0;
      border-radius: 8rpx;
      padding: 20rpx;

      .error-text {
        flex: 1;
        font-size: 24rpx;
        color: #ff4d4f;
        margin-right: 20rpx;
      }

      .retry-text {
        font-size: 24rpx;
        color: #1890ff;
        text-decoration: underline;
      }
    }
  }

  .progress-actions {
    display: flex;
    justify-content: center;

    .retry-btn,
    .success-btn {
      width: 100%;
      height: 88rpx;
      border-radius: 8rpx;
      font-size: 28rpx;
      font-weight: 500;
      border: none;
    }

    .retry-btn {
      background-color: #faad14;
      color: #fff;
    }

    .success-btn {
      background-color: #52c41a;
      color: #fff;
    }
  }
}
</style>
