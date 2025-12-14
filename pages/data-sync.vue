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
import DatabaseDiagnostic from '@/utils/DatabaseDiagnostic'

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
    // #ifdef H5
    // H5环境直接显示提示，不加载数据版本
    console.warn('[DataSync] H5环境，跳过版本检查')
    updateInfo.value = {
      items: [
        { table: 'routes', name: '巡检路线', icon: '🗺️', hasUpdate: false },
        { table: 'points', name: '巡检点位', icon: '📍', hasUpdate: false },
        { table: 'items', name: '巡查项目', icon: '📝', hasUpdate: false },
        { table: 'tasks', name: '巡检任务', icon: '✅', hasUpdate: false }
      ]
    }
    return
    // #endif

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
        'routesVersion': { name: '巡检路线', icon: '🗺️' },
        'pointsVersion': { name: '巡检点位', icon: '📍' },
        'itemsVersion': { name: '巡查项目', icon: '📝' },
        'tasksVersion': { name: '巡检任务', icon: '✅' }
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

  console.log('[DataSync] 开始同步流程...')
  console.log('[DataSync] 当前环境信息:', {
    // #ifdef H5
    platform: 'H5'
    // #endif
    // #ifdef APP-PLUS
    platform: 'APP-PLUS'
    // #endif
    // #ifdef MP-WEIXIN
    platform: 'MP-WEIXIN'
    // #endif
  })

  isStarting.value = true

  try {
    // 检查运行环境
    // #ifdef H5
    console.warn('[DataSync] H5环境不支持完整的数据同步功能')
    uni.showModal({
      title: '环境提示',
      content: 'H5环境暂不支持离线数据同步功能，请在真机或模拟器上测试',
      showCancel: false,
      success: () => {
        // 模拟同步成功，直接跳转到任务列表
        uni.reLaunch({ url: '/pages/index/TaskList' })
      }
    })
    return
    // #endif

    console.log('[DataSync] 正在初始化数据库...')

    // 添加超时控制
    const initPromise = DatabaseService.init()
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('数据库初始化超时（10秒），请检查运行环境或重试'))
      }, 10000)
    })

    // 使用Promise.race进行超时控制
    await Promise.race([initPromise, timeoutPromise])

    console.log('[DataSync] 数据库初始化成功，切换到进度页面')

    // 切换到进度页面
    currentStep.value = 'progress'

    console.log('[DataSync] 开始同步数据...')

    // 开始同步数据
    await syncAllData()

    console.log('[DataSync] 数据同步完成')
  } catch (error) {
    console.error('[DataSync] 同步失败:', error)

    // 显示更友好的错误提示
    let errorMsg = error.message || '同步失败'

    // 判断是否是环境问题
    if (errorMsg.includes('H5环境') || errorMsg.includes('不支持SQLite')) {
      errorMsg = 'H5浏览器不支持离线功能，请在手机APP或模拟器中测试'
    } else if (errorMsg.includes('plus对象')) {
      errorMsg = 'APP环境未就绪，请在真机或HBuilderX模拟器中运行'
    }

    uni.showModal({
      title: '同步失败',
      content: errorMsg,
      showCancel: true,
      cancelText: '取消',
      confirmText: '重试',
      success: (res) => {
        if (res.confirm) {
          // 用户点击重试，重置状态后重新同步
          currentStep.value = 'description'
          isStarting.value = false
        } else {
          // 用户取消，返回登录页
          uni.navigateBack()
        }
      }
    })

    // 重置状态
    currentStep.value = 'description'
  } finally {
    console.log('[DataSync] 重置isStarting状态')
    isStarting.value = false
  }
}

// 同步所有数据
async function syncAllData() {
  console.log('[DataSync] syncAllData: 开始获取服务器版本...')

  try {
    const serverVersion = await ApiService.get('/mobile/data-version')
    console.log('[DataSync] 服务器版本:', serverVersion)

    const localMetadata = StorageService.getSyncMetadata()
    console.log('[DataSync] 本地元数据:', localMetadata)

    let completedItems = 0
    let errorCount = 0

    for (const item of syncItems.value) {
      console.log(`[DataSync] 处理同步项: ${item.name}`)

      const versionKey = `${item.key}_version`
      const serverVersionValue = serverVersion[versionKey]
      const localVersionValue = localMetadata[versionKey]

      console.log(`[DataSync] ${item.name} - 服务器版本: ${serverVersionValue}, 本地版本: ${localVersionValue}`)

      // 如果版本相同，跳过
      if (serverVersionValue === localVersionValue) {
        console.log(`[DataSync] ${item.name} 版本相同，跳过同步`)
        item.status = 'completed'
        completedItems++
        continue
      }

      // 开始同步
      console.log(`[DataSync] ${item.name} 开始同步...`)
      item.status = 'syncing'
      updateOverallProgress(completedItems, syncItems.value.length)

      try {
        await syncItemData(item, serverVersionValue)
        item.status = 'completed'
        completedItems++
        errorCount = 0 // 重置错误计数
        console.log(`[DataSync] ${item.name} 同步成功`)
      } catch (error) {
        console.error(`[DataSync] 同步${item.name}失败:`, error)
        item.status = 'error'
        item.error = error.message
        errorCount++
      }

      updateOverallProgress(completedItems, syncItems.value.length)
    }

    // 标记同步完成
    syncProgress.value.isCompleted = true
    syncProgress.value.hasError = errorCount > 0

    console.log('[DataSync] syncAllData: 所有同步任务完成')

    // 运行数据库诊断，验证同步结果
    console.log('\n========== 同步完成后运行诊断 ==========')
    await DatabaseDiagnostic.diagnose()

    // 额外验证：检查任务和路线的关联
    console.log('\n========== 验证任务-路线关联 ==========')
    try {
      const tasks = await DatabaseService.findAll('inspection_task')
      console.log('[DataSync] 任务总数:', tasks.length)

      if (tasks.length > 0) {
        const firstTask = tasks[0]
        console.log('[DataSync] 第一个任务:', firstTask)
        console.log('[DataSync] 第一个任务的route_id:', firstTask.route_id, '类型:', typeof firstTask.route_id)

        // 尝试查询对应的路线
        const route = await DatabaseService.findById('inspection_route', firstTask.route_id, 'route_id')
        console.log('[DataSync] 查询对应路线结果:', route)

        // 如果找不到，列出所有路线的ID
        if (!route) {
          const allRoutes = await DatabaseService.findAll('inspection_route')
          console.log('[DataSync] ⚠️ 找不到对应路线！所有路线ID列表:')
          allRoutes.forEach(r => {
            console.log(`  - route_id: ${r.route_id} (类型: ${typeof r.route_id}), route_name: ${r.route_name}`)
          })
        }
      }
    } catch (error) {
      console.error('[DataSync] 验证任务-路线关联失败:', error)
    }
    console.log('========== 诊断完成 ==========\n')
  } catch (error) {
    console.error('[DataSync] syncAllData 失败:', error)
    throw error
  }
}

// 同步单个数据项
async function syncItemData(item, serverVersion) {
  console.log(`[DataSync] syncItemData: ${item.name} 开始`)

  try {
    let data = []

    // 根据数据类型获取数据
    switch (item.key) {
      case 'routes':
        console.log(`[DataSync] 获取路线数据...`)
        data = await ApiService.get('/mobile/routes')
        console.log(`[DataSync] 获取到 ${data.length} 条路线数据`)
        item.progress = 20
        await DatabaseService.syncRoutes(data)
        item.progress = 100
        updateMetadata('routes', serverVersion)
        break

      case 'points':
        console.log(`[DataSync] 获取点位数据...`)
        data = await ApiService.get('/mobile/points')
        console.log(`[DataSync] 获取到 ${data.length} 条点位数据`)
        item.progress = 20
        await DatabaseService.syncPoints(data)
        item.progress = 100
        updateMetadata('points', serverVersion)
        break

      case 'items':
        console.log(`[DataSync] 获取巡查项目数据...`)
        data = await ApiService.get('/mobile/inspection-items')
        console.log(`[DataSync] 获取到 ${data.length} 条项目数据`)
        item.progress = 20
        await DatabaseService.syncItems(data)
        item.progress = 100
        updateMetadata('items', serverVersion)
        break

      case 'tasks':
        console.log(`[DataSync] 获取任务数据...`)
        data = await ApiService.get('/mobile/tasks')
        console.log(`[DataSync] 获取到 ${data.length} 条任务数据`)
        item.progress = 20
        await DatabaseService.syncTasks(data)
        item.progress = 100
        updateMetadata('tasks', serverVersion)
        break

      default:
        throw new Error('未知的数据类型')
    }

    console.log(`[DataSync] syncItemData: ${item.name} 完成`)
  } catch (error) {
    console.error(`[DataSync] syncItemData: ${item.name} 失败:`, error)
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

  // 跳转到任务列表首页
  setTimeout(() => {
    uni.reLaunch({ url: '/pages/index/TaskList' })
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
