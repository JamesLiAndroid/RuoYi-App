<template>
  <view class="inspection-page">
    <!-- 顶部导航栏 -->
    <view class="nav-bar">
      <button class="nav-btn" @click="handleBack">
        <text class="btn-icon">←</text>
      </button>
      <text class="nav-title">{{ routeName || '巡检中...' }}</text>
      <view class="nav-right">
        <NetworkIndicator @show-offline-data="handleShowOfflineData"></NetworkIndicator>
        <button class="nav-btn" @click="showMoreMenu = !showMoreMenu">
          <text class="btn-icon">⋮</text>
        </button>
      </view>
    </view>

    <!-- 更多菜单弹窗 -->
    <view v-if="showMoreMenu" class="more-menu">
      <view class="menu-item" @click="handleViewRoutePoints">
        <text>查看路线点位</text>
      </view>
      <view class="menu-item" @click="handleExitInspection">
        <text>退出巡检</text>
      </view>
    </view>

    <!-- 巡检进度卡片 -->
    <view class="progress-card">
      <view class="progress-header">
        <text class="progress-label">当前点位进度</text>
        <text class="progress-text">{{ currentPointIndex }}/{{ totalPoints }} ({{ progressPercentage }}%)</text>
      </view>
      <view class="progress-bar">
        <view class="progress-inner" :style="{ width: progressPercentage + '%' }"></view>
      </view>
      <view class="task-info">
        <text class="info-item">日期：{{ taskDate }}</text>
        <text class="info-item">时段：{{ timeSlot }}</text>
      </view>
    </view>

    <!-- 当前点位信息卡片 -->
    <view class="point-card">
      <view class="point-header">
        <text class="point-number">第{{ currentPointIndex }}个点位</text>
        <text class="point-status" :class="{ matched: isMatched, unmatched: !isMatched }">
          {{ isMatched ? '✅ 已验证' : '⏳ 待验证' }}
        </text>
      </view>

      <view class="point-info">
        <view class="info-row">
          <text class="info-label">点位名称：</text>
          <text class="info-value">{{ currentPoint?.point_name || '请读取NFC卡' }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">点位编号：</text>
          <text class="info-value">{{ currentPoint?.point_code || '-' }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">设备类型：</text>
          <text class="info-value">{{ currentPoint?.device_type || '-' }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">卡ID：</text>
          <text class="info-value" :class="{ 'card-id': currentPoint?.card_id }">
            {{ currentPoint?.card_id || '未读取' }}
          </text>
        </view>
        <view v-if="isMandatoryPhoto" class="mandatory-photo">
          <text class="photo-label">必须拍照</text>
        </view>
      </view>
    </view>

    <!-- 扫描模式切换 -->
    <ScanModeSwitch
      label="请选择验证方式"
      :default-mode="scanMode"
      @mode-change="handleModeChange"
    />

    <!-- NFC未开启警告 -->
    <view v-if="scanMode === 'nfc' && !isNfcEnabled" class="nfc-warning">
      <text class="warning-icon">⚠️</text>
      <text class="warning-text">NFC未开启</text>
      <view class="warning-actions">
        <button class="warning-btn warning-btn-primary" @click="handleGoEnableNfc">去开启</button>
        <button class="warning-btn warning-btn-secondary" @click="handleSwitchToQrCode">切换扫码</button>
      </view>
    </view>

    <!-- 使用警告提示 -->
    <view v-if="usageWarning" class="usage-warning">
      <text class="warning-icon">⚠️</text>
      <text class="warning-text">{{ usageWarning }}</text>
    </view>

    <!-- 巡查项目列表 -->
    <view class="inspection-items-card">
      <text class="card-title">巡查项目</text>
      <view v-if="inspectionItems.length === 0" class="empty-items">
        <text>请先验证点位后再查看巡查项目</text>
      </view>
      <view v-else class="items-list">
        <view
          v-for="item in inspectionItems"
          :key="item.item_id"
          class="item-card"
          @click="handleItemClick(item)"
        >
          <view class="item-header">
            <text class="item-name">{{ item.item_name }}</text>
            <text class="item-type-badge">{{ itemTypeText[item.item_type] }}</text>
          </view>
          <view class="item-status">
            <text class="status-text" :class="{ completed: item.isCompleted }">
              {{ item.isCompleted ? '✅ 已填写' : '⏳ 未填写' }}
            </text>
          </view>
        </view>
      </view>
    </view>

    <!-- 照片拍摄卡片 -->
    <view v-if="isMatched" class="photo-card">
      <text class="card-title">
        拍摄照片
        <text v-if="isMandatoryPhoto" class="mandatory-badge">必拍</text>
      </text>
      <PhotoCapture
        ref="photoCaptureRef"
        :is-mandatory="isMandatoryPhoto"
        :max-count="9"
        :show-tip="true"
        tip-text="建议拍摄清晰照片，每张照片不超过1MB"
        @change="handlePhotoChange"
      />
    </view>

    <!-- 底部操作按钮 -->
    <view class="bottom-actions">
      <!-- NFC模式按钮 -->
      <button
        v-if="scanMode === 'nfc' && !isMatched"
        class="btn btn-primary btn-nfc"
        :disabled="!isNfcEnabled"
        @click="handleStartScan"
      >
        <text>读取NFC卡</text>
      </button>

      <!-- 二维码模式按钮 -->
      <button
        v-if="scanMode === 'qrcode' && !isMatched"
        class="btn btn-qrcode"
        @click="handleStartScan"
      >
        <text>扫描二维码</text>
      </button>

      <button
        v-if="isMatched"
        class="btn btn-add-remark"
        @click="handleAddRemark"
      >
        {{ currentRemark ? '编辑备注' : '添加备注' }}
      </button>

      <button
        v-if="!isMatched"
        class="btn btn-skip"
        @click="handleSkipPoint"
      >
        跳过点位
      </button>

      <button
        v-if="isMatched && canCompletePoint"
        class="btn btn-success"
        @click="handleCompletePoint"
      >
        完成当前点位
      </button>
    </view>

    <!-- NFC引导弹窗 -->
    <NfcGuide
      :visible="showNfcGuide"
      title="准备NFC读卡"
      subtitle="请将NFC卡靠近手机顶部，保持1-2秒"
      tip-message="如果读卡失败，请尝试重新靠近或使用手动输入"
      confirm-text="知道了"
      @close="showNfcGuide = false"
      @confirm="showNfcGuide = false"
    />

    <!-- 手动输入对话框（NFC） -->
    <ManualInputDialog
      :visible="showManualDialog"
      @close="showManualDialog = false"
      @confirm="handleManualInput"
    />

    <!-- 手动输入点位码对话框（二维码） -->
    <ManualPointCodeDialog
      :visible="showManualPointCodeDialog"
      @close="showManualPointCodeDialog = false"
      @confirm="handleManualPointCodeInput"
    />

    <!-- 二维码扫描界面 -->
    <QrCodeScanner
      :visible="showQrCodeScanner"
      hint-text="请将二维码对准扫描框"
      @close="showQrCodeScanner = false"
      @success="handleQrCodeSuccess"
      @error="handleQrCodeError"
    />

    <!-- 路线点位列表对话框 -->
    <view v-if="showRoutePointsDialog" class="dialog-overlay" @click="showRoutePointsDialog = false">
      <view class="dialog-content" @click.stop>
        <view class="dialog-header">
          <text class="dialog-title">路线点位列表</text>
          <text class="close-btn" @click="showRoutePointsDialog = false">✕</text>
        </view>

        <view class="points-list">
          <view
            v-for="point in routePoints"
            :key="point.point_id"
            class="point-item"
            :class="{ active: point.point_id === currentPoint?.point_id }"
          >
            <view class="point-order">
              <text>{{ point.point_order }}</text>
            </view>
            <view class="point-details">
              <text class="point-name">{{ point.point_name }}</text>
              <text class="point-code">{{ point.point_code }}</text>
              <text class="point-type">{{ point.device_type }}</text>
            </view>
            <view class="point-status">
              <text v-if="isPointCompleted(point.point_id)" class="completed-icon">✅</text>
              <text v-else class="pending-icon">○</text>
            </view>
          </view>
        </view>

        <view class="dialog-footer">
          <text class="stats-text">
            总点位数：{{ totalPoints }} | 已检：{{ completedPoints }} | 未检：{{ totalPoints - completedPoints }}
          </text>
        </view>
      </view>
    </view>

    <!-- 状态型项目填写对话框 -->
    <StatusItemDialog
      :visible="showStatusItemDialog"
      :item="currentEditingItem"
      @close="showStatusItemDialog = false"
      @confirm="handleItemResultConfirm"
    />

    <!-- 数值型项目填写对话框 -->
    <NumberItemDialog
      :visible="showNumberItemDialog"
      :item="currentEditingItem"
      @close="showNumberItemDialog = false"
      @confirm="handleItemResultConfirm"
    />

    <!-- 文本型项目填写对话框 -->
    <TextItemDialog
      :visible="showTextItemDialog"
      :item="currentEditingItem"
      @close="showTextItemDialog = false"
      @confirm="handleItemResultConfirm"
    />

    <!-- 备注对话框 -->
    <RemarkDialog
      :visible="showRemarkDialog"
      :record-id="currentRecordId"
      :initial-remark="currentRemark"
      placeholder="请输入备注内容，支持最多1000个字符..."
      @close="showRemarkDialog = false"
      @confirm="handleRemarkConfirm"
      @delete="handleRemarkDelete"
    />

    <!-- 跳检对话框 -->
    <SkipDialog
      :visible="showSkipDialog"
      :task-id="taskId"
      :point-info="currentPoint"
      :route-id="currentPoint?.route_id"
      @close="showSkipDialog = false"
      @confirm="handleSkipConfirm"
    />
  </view>
</template>

<script setup>
import { ref, onUnmounted, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import ScanModeSwitch from '@/components/ScanModeSwitch.vue'
import ManualInputDialog from '@/components/ManualInputDialog.vue'
import ManualPointCodeDialog from '@/components/ManualPointCodeDialog.vue'
import NfcGuide from '@/components/NfcGuide.vue'
import QrCodeScanner from '@/components/QrCodeScanner.vue'
import PhotoCapture from '@/components/PhotoCapture.vue'
import StatusItemDialog from '@/components/StatusItemDialog.vue'
import NumberItemDialog from '@/components/NumberItemDialog.vue'
import TextItemDialog from '@/components/TextItemDialog.vue'
import RemarkDialog from '@/components/RemarkDialog.vue'
import SkipDialog from '@/components/SkipDialog.vue'
import PointStatusTag from '@/components/PointStatusTag.vue'
import NetworkIndicator from '@/components/NetworkIndicator.vue'
import TaskService from '@/services/TaskService'
import InspectionService from '@/services/InspectionService'
import nfcService from '@/services/NfcService'
import pointMatchingService from '@/services/PointMatchingService'
import inspectionRecordService from '@/services/InspectionRecordService'
import inspectionItemService from '@/services/InspectionItemService'
import qrCodeService from '@/services/QrCodeService'
import cameraPermissionService from '@/services/CameraPermissionService'
import antiSpamService from '@/services/AntiSpamService'
import remarkService from '@/services/RemarkService'
import skipService from '@/services/SkipService'
import skipValidationService from '@/services/SkipValidationService'
import { PointStatus } from '@/constants/PointStatus'
import DatabaseDiagnostic from '@/utils/DatabaseDiagnostic'
import DatabaseService from '@/utils/DatabaseService'
import QuickDiagnostic from '@/utils/QuickDiagnostic'

// 响应式数据
const showMoreMenu = ref(false)
const showNfcGuide = ref(false)
const showManualDialog = ref(false)
const showManualPointCodeDialog = ref(false)
const showRoutePointsDialog = ref(false)
const showQrCodeScanner = ref(false)
const showStatusItemDialog = ref(false)
const showNumberItemDialog = ref(false)
const showTextItemDialog = ref(false)
const showRemarkDialog = ref(false)
const showSkipDialog = ref(false)
const scanMode = ref(nfcService.getScanMode())
const verificationMethod = ref('NFC') // 当前验证方式：NFC 或 QRCODE
const currentEditingItem = ref(null) // 当前编辑的项目
const photoCaptureRef = ref(null) // 照片拍摄组件引用
const currentPhotos = ref([]) // 当前照片列表
const itemResults = ref([]) // 项目结果列表
const currentRemark = ref('') // 当前备注内容
const currentRecordId = ref(null) // 当前巡检记录ID

// 任务和点位数据（初始值为null，在onLoad中赋值）
const taskId = ref(null)
const routeId = ref(null)  // 当前路线ID
const routeName = ref('')
const taskDate = ref('')
const timeSlot = ref('')
const totalPoints = ref(0)
const currentPointIndex = ref(1)
const currentPoint = ref(null)
const routePoints = ref([])
const inspectionItems = ref([])
const isMatched = ref(false)
const isMandatoryPhoto = ref(false)

// 计算属性
const progressPercentage = computed(() => {
  if (totalPoints.value === 0) return 0
  return Math.round((currentPointIndex.value / totalPoints.value) * 100)
})

const canCompletePoint = computed(() => {
  // 检查必拍照片
  if (isMandatoryPhoto.value && currentPhotos.value.length === 0) {
    return false
  }

  // 检查必填项目
  return inspectionItems.value.every(item => item.isCompleted)
})

const completedPoints = computed(() => {
  // 计算已完成的点位数量
  return routePoints.value.filter(point => point.is_completed === 1).length
})

const usageWarning = computed(() => {
  return antiSpamService.getUsageWarningMessage()
})

const isNfcEnabled = computed(() => {
  return nfcService.isNfcEnabled()
})

// 项目类型映射
const itemTypeText = {
  'status': '状态型',
  'numeric': '数值型',
  'text': '文本型'
}

// 生命周期
onLoad((options) => {
  console.log('[InspectionPage] onLoad 接收到的参数:', options)

  // 从URL参数中获取taskId
  if (options.taskId) {
    taskId.value = parseInt(options.taskId)
    console.log('[InspectionPage] 设置 taskId:', taskId.value)
  } else {
    console.error('[InspectionPage] 未接收到 taskId 参数')
    uni.showToast({
      title: '缺少任务ID',
      icon: 'error'
    })
    return
  }

  // 初始化数据
  initData()
})

onUnmounted(() => {
  // 清理NFC监听
  nfcService.stopReading()
})

// 初始化数据
async function initData() {
  try {
    console.log('[InspectionPage] 开始初始化数据, taskId:', taskId.value)

    // 运行快速诊断
    await QuickDiagnostic.run()

    // 如果有taskId，检查该任务的数据完整性
    if (taskId.value) {
      await QuickDiagnostic.checkTask(taskId.value)
    }

    // AC10: 启动时检测NFC状态
    const nfcRecommendation = nfcService.getStartupRecommendation()
    if (nfcRecommendation.action === 'prompt_choice') {
      uni.showModal({
        title: '选择验证方式',
        content: 'NFC未开启，建议开启NFC以获得最佳体验。您也可以使用二维码扫描方式',
        showCancel: true,
        confirmText: '去开启',
        cancelText: '使用二维码',
        success: (res) => {
          if (res.confirm) {
            handleGoEnableNfc()
          } else {
            nfcService.switchScanMode('qrcode')
          }
        }
      })
    }

    // 获取任务详情
    const taskDetail = await TaskService.getTaskDetail(taskId.value)
    console.log('[InspectionPage] ========== 任务详情诊断 ==========')
    console.log('[InspectionPage] 任务详情完整数据:', JSON.stringify(taskDetail, null, 2))
    console.log('[InspectionPage] taskDetail 类型:', typeof taskDetail)
    console.log('[InspectionPage] taskDetail.route:', taskDetail?.route)
    console.log('[InspectionPage] taskDetail.route?.route_id:', taskDetail?.route?.route_id)
    console.log('[InspectionPage] taskDetail.route_id:', taskDetail?.route_id)
    console.log('[InspectionPage] ========== 诊断完成 ==========')

    if (taskDetail) {
      routeName.value = taskDetail.route?.route_name || taskDetail.route_name || ''
      taskDate.value = taskDetail.task?.task_date || taskDetail.task_date || ''
      timeSlot.value = taskDetail.task?.time_slot || ''

      console.log('[InspectionPage] 任务信息已设置:', {
        routeName: routeName.value,
        taskDate: taskDate.value,
        timeSlot: timeSlot.value,
        'taskDetail.route?.route_id': taskDetail.route?.route_id,
        'taskDetail.route_id': taskDetail.route_id
      })
    } else {
      console.error('[InspectionPage] 任务详情为空')
      uni.showToast({
        title: '任务不存在',
        icon: 'error'
      })
      return
    }

    // 获取路线点位 - 使用更灵活的路线ID获取方式
    const actualRouteId = taskDetail?.route?.route_id || taskDetail?.route_id
    console.log('[InspectionPage] 实际使用的路线ID:', actualRouteId)

    // 保存路线ID到ref
    routeId.value = actualRouteId

    if (actualRouteId) {
      console.log('[InspectionPage] 开始获取路线点位, routeId:', actualRouteId)
      console.log('[InspectionPage] taskId:', taskId.value)

      // 直接测试数据库查询
      console.log('[InspectionPage] === 开始直接测试数据库 ===')
      try {
        // 测试1：检查数据库初始化状态
        const dbInitialized = DatabaseService.isInitialized
        console.log('[InspectionPage] 数据库初始化状态:', dbInitialized)

        // 测试2：查询所有路线
        const allRoutes = await DatabaseService.findAll('inspection_route')
        console.log('[InspectionPage] 数据库中的所有路线:', allRoutes)
        console.log('[InspectionPage] 路线数量:', allRoutes.length)

        if (allRoutes.length > 0) {
          console.log('[InspectionPage] 第一条路线:', allRoutes[0])
        }

        // 测试3：查询指定路线
        const specificRoute = await DatabaseService.findById('inspection_route', actualRouteId, 'route_id')
        console.log('[InspectionPage] 查询指定路线 (route_id=' + actualRouteId + '):', specificRoute)

        // 测试4：查询所有点位
        const allPoints = await DatabaseService.findAll('inspection_point')
        console.log('[InspectionPage] 数据库中的所有点位:', allPoints)
        console.log('[InspectionPage] 点位数量:', allPoints.length)

        if (allPoints.length > 0) {
          console.log('[InspectionPage] 前3个点位:', allPoints.slice(0, 3))
        }
      } catch (testError) {
        console.error('[InspectionPage] 数据库测试失败:', testError)
      }
      console.log('[InspectionPage] === 数据库测试完成 ===')

      try {
        routePoints.value = await InspectionService.getRoutePoints(taskId.value, actualRouteId)

        console.log('[InspectionPage] 获取路线点位结果:', routePoints.value)
        console.log('[InspectionPage] 点位数量:', routePoints.value.length)
      } catch (error) {
        console.error('[InspectionPage] 获取路线点位失败:', error)
        console.error('[InspectionPage] 错误堆栈:', error.stack)
        routePoints.value = []
      }

      totalPoints.value = routePoints.value.length

      // 设置当前路线ID（用于扫码匹配）
      nfcService.setCurrentRoute(actualRouteId)
    } else {
      console.error('[InspectionPage] 路线ID不存在')
    }

    // 获取当前点位（首次巡检为第一个点位）
    if (routePoints.value.length > 0) {
      currentPoint.value = routePoints.value[0]
      console.log('[InspectionPage] 设置当前点位:', currentPoint.value)
    } else {
      console.warn('[InspectionPage] 路线点位列表为空')
    }

    // 加载巡查项目（验证点位后）
    // await loadInspectionItems(currentPoint.value.point_id)

    // 首次进入时，自动显示路线点位列表3秒，让用户有个概览
    if (routePoints.value.length > 0) {
      showRoutePointsDialog.value = true

      // 3秒后自动关闭
      setTimeout(() => {
        showRoutePointsDialog.value = false

        // 显示提示消息
        uni.showToast({
          title: `本次巡检共${totalPoints.value}个点位`,
          icon: 'none',
          duration: 2000
        })
      }, 3000)
    }

  } catch (error) {
    console.error('[InspectionPage] 初始化数据失败:', error)
    uni.showToast({
      title: '加载失败: ' + (error.message || '未知错误'),
      icon: 'error'
    })
  }
}

// 处理扫描模式切换
function handleModeChange(mode) {
  scanMode.value = mode
  nfcService.switchScanMode(mode)

  if (mode === 'nfc' && !nfcService.isNfcEnabled()) {
    uni.showToast({
      title: 'NFC未启用，请先开启',
      icon: 'none'
    })
  }

  // 切换模式后，重置验证状态
  isMatched.value = false
  verificationMethod.value = mode.toUpperCase()
}

// 处理去开启NFC
function handleGoEnableNfc() {
  // 跳转到系统NFC设置页面
  // #ifdef APP-PLUS
  const main = plus.android.runtimeMainActivity()
  const Intent = plus.android.importClass('android.content.Intent')
  const Settings = plus.android.importClass('android.provider.Settings')
  const intent = new Intent(Settings.ACTION_NFC_SETTINGS)
  main.startActivity(intent)
  // #endif
}

// 处理切换到二维码模式
function handleSwitchToQrCode() {
  scanMode.value = 'qrcode'
  nfcService.switchScanMode('qrcode')
  verificationMethod.value = 'QRCODE'

  uni.showToast({
    title: '已切换到二维码扫描模式',
    icon: 'success'
  })
}

// 开始扫描
function handleStartScan() {
  if (scanMode.value === 'nfc') {
    handleNfcScan()
  } else if (scanMode.value === 'qrcode') {
    handleQrScan()
  } else if (scanMode.value === 'manual') {
    // 手动输入模式（NFC和二维码都支持）
    if (verificationMethod.value === 'NFC') {
      showManualDialog.value = true
    } else {
      showManualPointCodeDialog.value = true
    }
  }
}

// NFC扫描
function handleNfcScan() {
  showNfcGuide.value = true

  nfcService.startReading(
    async (uid) => {
      console.log('NFC读卡成功:', uid)
      await handleCardScanned(uid)
    },
    (error) => {
      console.error('NFC读卡失败:', error)
      uni.showToast({
        title: error,
        icon: 'none'
      })
    }
  )
}

// 二维码扫描
function handleQrScan() {
  // 检查相机权限
  cameraPermissionService.checkPermission().then(async (permission) => {
    if (!permission.isAuthorized) {
      // 显示权限引导
      cameraPermissionService.showPermissionDenied(
        () => handleQrScan(), // 重试
        () => showManualPointCodeDialog.value = true // 手动输入
      )
      return
    }

    // 打开扫码界面
    showQrCodeScanner.value = true
  })
}

// 处理二维码扫描成功
async function handleQrCodeSuccess(result) {
  console.log('二维码扫描成功:', result)
  showQrCodeScanner.value = false

  try {
    uni.showLoading({ title: '验证中...' })

    // 使用nfcService处理扫码结果
    const scanResult = await nfcService.onScanSuccess(result, 'QRCODE')

    if (!scanResult.success) {
      uni.hideLoading()
      handleScanError(scanResult)
      return
    }

    // 验证通过
    uni.hideLoading()
    isMatched.value = true
    verificationMethod.value = 'QRCODE'
    currentPoint.value = scanResult.point

    // AC9: 设置强制拍照标志
    isMandatoryPhoto.value = currentPoint.value.is_photo_required === 1

    // 保存验证记录
    await saveVerificationRecord(scanResult.cardId, 'QRCODE', result)

    // 加载巡查项目
    await loadInspectionItems(currentPoint.value.point_id)

    uni.showToast({
      title: '验证成功（扫码）',
      icon: 'success'
    })

  } catch (error) {
    console.error('处理扫码结果失败:', error)
    uni.hideLoading()
    uni.showToast({
      title: '验证失败',
      icon: 'error'
    })
  }
}

// 处理二维码扫描错误
function handleQrCodeError(error) {
  console.error('二维码扫描错误:', error)

  if (error.type === 'PERMISSION_DENIED' || error.type === 'PERMISSION_ERROR') {
    // 权限问题，引导用户手动输入
    uni.showModal({
      title: '相机权限被拒绝',
      content: '无法使用相机扫描二维码。您可以：\n\n1. 前往设置开启相机权限\n2. 使用手动输入点位码',
      showCancel: true,
      confirmText: '去设置',
      cancelText: '手动输入',
      success: (res) => {
        if (res.confirm) {
          cameraPermissionService.openSetting()
        } else {
          showManualPointCodeDialog.value = true
        }
      }
    })
  } else if (error.type === 'SCAN_FAILED' || error.type === 'SCAN_ERROR') {
    // 扫码失败，提供重试和手动输入选项
    uni.showModal({
      title: '扫码失败',
      content: error.message || '扫码失败，请重试或使用手动输入',
      showCancel: true,
      confirmText: '重试',
      cancelText: '手动输入',
      success: (res) => {
        if (res.confirm) {
          showQrCodeScanner.value = true
        } else {
          showManualPointCodeDialog.value = true
        }
      }
    })
  }
}

// 处理手动输入点位码
async function handleManualPointCodeInput(parseResult) {
  console.log('手动输入点位码:', parseResult)
  showManualPointCodeDialog.value = false

  try {
    uni.showLoading({ title: '验证中...' })

    // 使用nfcService处理扫码结果
    const scanResult = await nfcService.onScanSuccess(parseResult.rawContent, 'QRCODE')

    if (!scanResult.success) {
      uni.hideLoading()
      handleScanError(scanResult)
      return
    }

    // 验证通过
    uni.hideLoading()
    isMatched.value = true
    verificationMethod.value = 'QRCODE'
    currentPoint.value = scanResult.point

    // AC9: 设置强制拍照标志
    isMandatoryPhoto.value = currentPoint.value.is_photo_required === 1

    // 保存验证记录
    await saveVerificationRecord(scanResult.cardId, 'QRCODE', parseResult.rawContent)

    // 加载巡查项目
    await loadInspectionItems(currentPoint.value.point_id)

    uni.showToast({
      title: '验证成功（手动输入）',
      icon: 'success'
    })

  } catch (error) {
    console.error('处理手动输入失败:', error)
    uni.hideLoading()
    uni.showToast({
      title: '验证失败',
      icon: 'error'
    })
  }
}

// 统一处理扫码错误
function handleScanError(scanResult) {
  if (scanResult.code === 'CARD_NOT_BOUND') {
    // 卡未绑定
    uni.showModal({
      title: '验证失败',
      content: scanResult.error || '该卡ID未绑定到当前路线的任何点位',
      showCancel: false,
      confirmText: '知道了'
    })
  } else if (scanResult.code === 'ORDER_INVALID') {
    // 顺序错误
    const expected = scanResult.expectedPoint
    uni.showModal({
      title: '顺序错误',
      content: scanResult.error,
      showCancel: true,
      cancelText: '取消',
      confirmText: '跳转到该点位',
      success: (res) => {
        if (res.confirm && expected) {
          // 跳转到指定点位（跳检功能）
          jumpToPoint(expected.point_id)
        }
      }
    })
  } else if (scanResult.error === 'ANTI_SPAM') {
    // 防刷限制
    uni.showToast({
      title: scanResult.message,
      icon: 'none',
      duration: 3000
    })
  } else {
    // 其他错误
    uni.showModal({
      title: '验证失败',
      content: scanResult.message || '验证失败，请重试',
      showCancel: false,
      confirmText: '知道了'
    })
  }
}

// 处理卡片扫描
async function handleCardScanned(cardId) {
  try {
    // AC13: 验证卡ID格式
    if (!cardId || cardId.trim() === '') {
      uni.showModal({
        title: '读卡失败',
        content: '无效的NFC卡，请更换卡后重试',
        showCancel: false,
        confirmText: '知道了'
      })
      return
    }

    // AC13: 验证卡ID长度（通常为14-20个字符）
    if (cardId.length < 6 || cardId.length > 30) {
      uni.showModal({
        title: '读卡失败',
        content: '卡片数据异常，无法识别',
        showCancel: false,
        confirmText: '知道了'
      })
      return
    }

    uni.showLoading({ title: '验证中...' })

    // 匹配点位 - 使用保存的routeId
    console.log('[InspectionPage] 开始匹配点位, cardId:', cardId, 'routeId:', routeId.value)

    if (!routeId.value) {
      uni.hideLoading()
      uni.showToast({
        title: '路线ID未设置，无法匹配点位',
        icon: 'none'
      })
      return
    }

    const matchResult = await pointMatchingService.matchPoint(cardId, routeId.value)

    if (!matchResult.success) {
      uni.hideLoading()

      if (matchResult.code === 'CARD_NOT_BOUND') {
        // 卡未绑定
        uni.showModal({
          title: '卡片验证失败',
          content: matchResult.error || '卡片未绑定到任何点位',
          showCancel: false
        })
      } else if (matchResult.code === 'ORDER_INVALID') {
        // 顺序错误
        uni.showModal({
          title: '顺序错误',
          content: matchResult.error || '请按照路线顺序进行巡检',
          showCancel: false
        })
      } else {
        uni.showModal({
          title: '匹配失败',
          content: matchResult.error || '点位匹配失败',
          showCancel: false
        })
      }

      return
    }

    // 验证通过
    uni.hideLoading()

    // AC6: 检查该点位是否已巡检过
    const inspectedCheck = await DatabaseService.selectSync({
      sql: `SELECT inspection_time FROM inspection_record
            WHERE task_id = ? AND point_id = ?
            ORDER BY inspection_time DESC LIMIT 1`,
      params: [taskId.value, matchResult.point.point_id]
    })

    if (inspectedCheck && inspectedCheck.length > 0) {
      const lastInspectionTime = new Date(inspectedCheck[0].inspection_time)
      const minutesAgo = Math.floor((Date.now() - lastInspectionTime.getTime()) / 60000)

      // 显示确认对话框
      const confirmResult = await new Promise((resolve) => {
        uni.showModal({
          title: '重复巡检提示',
          content: `该点位已巡检过(${minutesAgo}分钟前)，确定要重新巡检吗？`,
          showCancel: true,
          cancelText: '跳过',
          confirmText: '重新巡检',
          success: (res) => resolve(res.confirm)
        })
      })

      if (!confirmResult) {
        // 用户选择跳过，跳到下一点位
        if (currentPointIndex.value < totalPoints.value) {
          currentPointIndex.value++
          currentPoint.value = routePoints.value.find(p => p.point_order === currentPointIndex.value)
          uni.showToast({
            title: '已跳过，进入下一点位',
            icon: 'none'
          })
        }
        return
      }
    }

    isMatched.value = true
    currentPoint.value = matchResult.point

    // AC9: 设置强制拍照标志
    isMandatoryPhoto.value = currentPoint.value.is_photo_required === 1

    // AC12: 检查点位顺序
    const expectedOrder = currentPointIndex.value
    const actualOrder = currentPoint.value.point_order

    if (actualOrder !== expectedOrder) {
      // 顺序不对，显示提醒对话框
      const continueResult = await new Promise((resolve) => {
        uni.showModal({
          title: '⚠️ 点位顺序提醒',
          content: `当前应巡检第${expectedOrder}个点位，您读取的是第${actualOrder}个点位，是否跳过第${expectedOrder}个点位？`,
          showCancel: true,
          cancelText: '返回巡检第' + expectedOrder + '个',
          confirmText: '继续巡检第' + actualOrder + '个',
          success: (res) => resolve(res.confirm)
        })
      })

      if (!continueResult) {
        // 用户选择返回巡检应该巡检的点位
        isMatched.value = false
        currentPoint.value = routePoints.value.find(p => p.point_order === expectedOrder)
        uni.showToast({
          title: `请读取第${expectedOrder}个点位的NFC卡`,
          icon: 'none',
          duration: 2000
        })
        return
      }

      // 用户选择继续巡检当前点位，需要跳检前面的点位
      try {
        uni.showLoading({ title: '处理中...' })

        // 跳检前面所有未巡检的点位
        for (let i = expectedOrder; i < actualOrder; i++) {
          const skipPoint = routePoints.value.find(p => p.point_order === i)
          if (skipPoint) {
            await skipService.skipPoint({
              taskId: taskId.value,
              pointId: skipPoint.point_id,
              skipReason: 'order_skip',
              skipReasonText: '未按顺序巡检',
              skipRemark: `自动跳检：用户直接巡检了第${actualOrder}个点位`,
              inspectorId: 1 // TODO: 从用户信息获取
            })
          }
        }

        // 更新当前点位索引
        currentPointIndex.value = actualOrder

        uni.hideLoading()
      } catch (error) {
        console.error('跳检失败:', error)
        uni.hideLoading()
        uni.showToast({
          title: '跳检失败',
          icon: 'error'
        })
        return
      }
    }

    // 保存验证记录
    await saveVerificationRecord(cardId)

    // 加载巡查项目
    await loadInspectionItems(currentPoint.value.point_id)

    uni.showToast({
      title: '验证成功',
      icon: 'success'
    })

  } catch (error) {
    console.error('处理卡片扫描失败:', error)
    uni.hideLoading()
    uni.showToast({
      title: '验证失败',
      icon: 'error'
    })
  }
}

// 处理手动输入
async function handleManualInput(cardId) {
  await handleCardScanned(cardId)
}

// 显示顺序错误对话框
function showOrderErrorDialog(matchResult) {
  const expected = matchResult.expectedPoint
  uni.showModal({
    title: '顺序错误',
    content: matchResult.error,
    showCancel: true,
    cancelText: '取消',
    confirmText: '跳转到该点位',
    success: (res) => {
      if (res.confirm && expected) {
        // 跳转到指定点位（跳检功能）
        jumpToPoint(expected.point_id)
      }
    }
  })
}

// 跳转到指定点位（跳检）
async function jumpToPoint(pointId) {
  try {
    const fromPoint = currentPoint.value.point_id
    const jumpResult = await pointMatchingService.jumpToPoint(fromPoint, pointId)

    if (jumpResult.success) {
      currentPoint.value = routePoints.value.find(p => p.point_id === pointId)
      currentPointIndex.value = currentPoint.value.point_order

      uni.showToast({
        title: `已跳转到第${currentPoint.value.point_order}个点位`,
        icon: 'none'
      })
    }
  } catch (error) {
    console.error('跳检失败:', error)
    uni.showToast({
      title: '跳检失败',
      icon: 'error'
    })
  }
}

// 保存验证记录
async function saveVerificationRecord(cardId, method = 'NFC', content = '') {
  try {
    const recordData = {
      taskId: taskId.value,
      pointId: currentPoint.value.point_id,
      nfcUid: cardId,
      verificationMethod: method,
      qrCodeContent: method === 'QRCODE' ? content : null
    }

    const result = await inspectionRecordService.saveNfcRecord(recordData)

    // 保存记录ID，用于后续备注功能
    if (result.success && result.recordId) {
      currentRecordId.value = result.recordId
      console.log('记录ID已保存:', currentRecordId.value)
    }
  } catch (error) {
    console.error('保存验证记录失败:', error)
  }
}

// 加载巡查项目
async function loadInspectionItems(pointId) {
  // 模拟加载项目
  // 实际项目中应从数据库或API加载
  inspectionItems.value = [
    {
      item_id: 1,
      item_name: '设备外观检查',
      item_type: 'status',
      isCompleted: false
    },
    {
      item_id: 2,
      item_name: '温度检查',
      item_type: 'numeric',
      isCompleted: false
    },
    {
      item_id: 3,
      item_name: '异常记录',
      item_type: 'text',
      isCompleted: false
    }
  ]
}

// 处理项目点击
function handleItemClick(item) {
  if (!isMatched.value) {
    uni.showToast({
      title: '请先验证点位',
      icon: 'none'
    })
    return
  }

  // 设置当前编辑项目
  currentEditingItem.value = item

  // 根据项目类型打开对应对话框
  switch (item.item_type) {
    case 'status':
      showStatusItemDialog.value = true
      break
    case 'numeric':
      showNumberItemDialog.value = true
      break
    case 'text':
      showTextItemDialog.value = true
      break
    default:
      uni.showToast({
        title: '未知的项目类型',
        icon: 'none'
      })
  }
}

// 处理项目结果确认
async function handleItemResultConfirm(result) {
  try {
    // AC2: 立即保存到数据库
    await inspectionItemService.saveItemResult({
      recordId: currentRecordId.value,
      itemId: result.itemId,
      itemName: result.itemName,
      itemType: result.itemType,
      actualValue: result.actualValue,
      isAbnormal: result.isAbnormal ? 1 : 0,
      abnormalRemark: result.abnormalRemark
    })

    // 保存到内存数组（用于UI显示）
    itemResults.value.push(result)

    // 标记项目为已完成
    const item = inspectionItems.value.find(i => i.item_id === result.itemId)
    if (item) {
      item.isCompleted = true
      item.actualValue = result.actualValue
      item.isAbnormal = result.isAbnormal
      item.abnormalRemark = result.abnormalRemark
    }

    uni.showToast({
      title: '已保存',
      icon: 'success'
    })
  } catch (error) {
    console.error('保存项目结果失败:', error)
    uni.showToast({
      title: '保存失败',
      icon: 'error'
    })
  }
}

// 处理照片变更
async function handlePhotoChange(photos) {
  try {
    // 更新内存数组
    currentPhotos.value = photos

    // AC2: 立即保存照片路径到数据库
    if (currentRecordId.value) {
      const imageUrls = photos.join(',')
      const result = await inspectionRecordService.updatePhotoUrls(
        currentRecordId.value,
        imageUrls,
        photos.length
      )

      if (!result.success) {
        console.error('保存照片路径失败:', result.error)
      }
    }
  } catch (error) {
    console.error('处理照片变更失败:', error)
  }
}

// 检查点位是否已完成
function isPointCompleted(pointId) {
  // 从 routePoints 中查找该点位，返回其 is_completed 状态
  const point = routePoints.value.find(p => p.point_id === pointId)
  return point ? point.is_completed === 1 : false
}

// 处理返回
function handleBack() {
  uni.showModal({
    title: '退出巡检',
    content: '当前巡检任务尚未完成，确定要退出吗？',
    showCancel: true,
    cancelText: '取消',
    confirmText: '确定退出',
    success: (res) => {
      if (res.confirm) {
        // 退出巡检
        uni.navigateBack()
      }
    }
  })
}

// 处理查看路线点位
function handleViewRoutePoints() {
  showMoreMenu.value = false
  showRoutePointsDialog.value = true
}

// 处理退出巡检
function handleExitInspection() {
  showMoreMenu.value = false
  handleBack()
}

// 处理网络状态显示离线数据
function handleShowOfflineData() {
  uni.navigateTo({
    url: '/pages/offline-data/index'
  })
}

// 处理添加备注
async function handleAddRemark() {
  if (!isMatched.value || !currentRecordId.value) {
    uni.showToast({
      title: '请先完成点位验证',
      icon: 'none'
    })
    return
  }

  // 获取当前备注内容
  try {
    const remarkResult = await remarkService.getRemark(currentRecordId.value)
    if (remarkResult.success) {
      currentRemark.value = remarkResult.remark || ''
    }
  } catch (error) {
    console.error('获取备注失败:', error)
  }

  showRemarkDialog.value = true
}

// 处理完成点位
function handleCompletePoint() {
  // 验证必拍照片
  if (isMandatoryPhoto.value && photoCaptureRef.value) {
    const photoValidation = photoCaptureRef.value.validate()
    if (!photoValidation.valid) {
      uni.showToast({
        title: photoValidation.error,
        icon: 'none'
      })
      return
    }
  }

  // 验证必填项目
  const incompleteItems = inspectionItems.value.filter(item => item.required && !item.isCompleted)
  if (incompleteItems.length > 0) {
    uni.showToast({
      title: `还有${incompleteItems.length}个必填项目未完成`,
      icon: 'none'
    })
    return
  }

  uni.showModal({
    title: '完成点位',
    content: '确定要完成当前点位吗？',
    showCancel: true,
    cancelText: '取消',
    confirmText: '确定',
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '保存中...' })

          // 保存照片路径（逗号分隔）
          const imageUrls = currentPhotos.value.join(',')

          // AC2: 完成巡检记录（更新status、照片路径、照片数量）
          const completeResult = await inspectionRecordService.completeRecord({
            recordId: currentRecordId.value,
            status: 'COMPLETED',
            imageUrls: imageUrls,
            photoCount: currentPhotos.value.length,
            inspectionTime: new Date().toISOString()
          })

          if (!completeResult.success) {
            throw new Error(completeResult.error || '完成记录失败')
          }

          // 注意：项目结果已经在handleItemResultConfirm中实时保存，这里不需要再保存

          uni.hideLoading()

          // 跳转到下一点位
          if (currentPointIndex.value < totalPoints.value) {
            currentPointIndex.value++
            currentPoint.value = routePoints.value.find(p => p.point_order === currentPointIndex.value)
            isMatched.value = false
            inspectionItems.value = []
            itemResults.value = []
            currentPhotos.value = []

            // 清空照片组件
            if (photoCaptureRef.value) {
              photoCaptureRef.value.clearPhotos()
            }

            uni.showToast({
              title: '已完成，进入下一点位',
              icon: 'success'
            })
          } else {
            // 所有点位已完成
            uni.showModal({
              title: '巡检完成',
              content: '恭喜！所有点位巡检已完成',
              showCancel: false,
              confirmText: '确定',
              success: () => {
                uni.navigateBack()
              }
            })
          }
        } catch (error) {
          console.error('保存点位数据失败:', error)
          uni.hideLoading()
          uni.showToast({
            title: '保存失败',
            icon: 'error'
          })
        }
      }
    }
  })
}

// 处理备注确认
async function handleRemarkConfirm(remarkData) {
  try {
    uni.showLoading({ title: '保存中...' })

    const result = await remarkService.saveRemark(remarkData.recordId, remarkData.remark)

    uni.hideLoading()

    if (result.success) {
      currentRemark.value = remarkData.remark
      uni.showToast({
        title: '备注保存成功',
        icon: 'success'
      })
    } else {
      uni.showToast({
        title: result.error || '保存失败',
        icon: 'error'
      })
    }
  } catch (error) {
    console.error('保存备注失败:', error)
    uni.hideLoading()
    uni.showToast({
      title: '保存失败',
      icon: 'error'
    })
  }
}

// 处理备注删除
async function handleRemarkDelete(remarkData) {
  try {
    uni.showLoading({ title: '删除中...' })

    const result = await remarkService.deleteRemark(remarkData.recordId)

    uni.hideLoading()

    if (result.success) {
      currentRemark.value = ''
      uni.showToast({
        title: '备注删除成功',
        icon: 'success'
      })
    } else {
      uni.showToast({
        title: result.error || '删除失败',
        icon: 'error'
      })
    }
  } catch (error) {
    console.error('删除备注失败:', error)
    uni.hideLoading()
    uni.showToast({
      title: '删除失败',
      icon: 'error'
    })
  }
}

// 处理跳检按钮点击
async function handleSkipPoint() {
  if (!currentPoint.value) {
    uni.showToast({
      title: '请选择要跳检的点位',
      icon: 'none'
    })
    return
  }

  // 验证是否可以跳检
  try {
    uni.showLoading({ title: '验证中...' })

    const validation = await skipValidationService.canSkipPoint(
      taskId.value,
      currentPoint.value.point_id
    )

    uni.hideLoading()

    if (!validation.valid) {
      uni.showModal({
        title: '无法跳检',
        content: validation.error,
        showCancel: false,
        confirmText: '知道了'
      })
      return
    }

    // 打开跳检对话框
    showSkipDialog.value = true

  } catch (error) {
    console.error('验证跳检失败:', error)
    uni.hideLoading()
    uni.showToast({
      title: '验证失败',
      icon: 'error'
    })
  }
}

// 处理跳检确认
async function handleSkipConfirm(skipData) {
  try {
    uni.showLoading({ title: '保存中...' })

    // 补充巡检员ID
    skipData.inspectorId = 1 // TODO: 从用户信息获取真实的巡检员ID

    const result = await skipService.skipPoint(skipData)

    uni.hideLoading()

    if (result.success) {
      uni.showToast({
        title: '跳检成功',
        icon: 'success'
      })

      // 跳转到下一点位
      if (currentPointIndex.value < totalPoints.value) {
        currentPointIndex.value++
        currentPoint.value = routePoints.value.find(p => p.point_order === currentPointIndex.value)
        isMatched.value = false
        inspectionItems.value = []
        itemResults.value = []
        currentPhotos.value = []
        currentRemark.value = ''
        currentRecordId.value = null

        // 清空照片组件
        if (photoCaptureRef.value) {
          photoCaptureRef.value.clearPhotos()
        }

        uni.showToast({
          title: '已跳过，进入下一点位',
          icon: 'none'
        })
      } else {
        // 所有点位已处理完成
        uni.showModal({
          title: '任务完成',
          content: '所有点位已处理完成',
          showCancel: false,
          confirmText: '确定',
          success: () => {
            uni.navigateBack()
          }
        })
      }
    } else {
      uni.showToast({
        title: result.error || '跳检失败',
        icon: 'error'
      })
    }
  } catch (error) {
    console.error('跳检失败:', error)
    uni.hideLoading()
    uni.showToast({
      title: '跳检失败',
      icon: 'error'
    })
  }
}
</script>

<style lang="scss" scoped>
.inspection-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 150rpx; // 给底部按钮留空间
}

// 顶部导航栏
.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 30rpx;
  background-color: #1890ff;
  color: #fff;

  .nav-btn {
    width: 60rpx;
    height: 60rpx;
    border: none;
    background-color: transparent;
    color: #fff;

    .btn-icon {
      font-size: 40rpx;
      font-weight: bold;
    }
  }

  .nav-title {
    flex: 1;
    text-align: center;
    font-size: 32rpx;
    font-weight: 500;
  }

  .nav-right {
    display: flex;
    align-items: center;
    gap: 16rpx;
  }
}

// 更多菜单
.more-menu {
  position: absolute;
  top: 100rpx;
  right: 30rpx;
  background-color: #fff;
  border-radius: 12rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.15);
  z-index: 1000;

  .menu-item {
    padding: 24rpx 40rpx;
    border-bottom: 1rpx solid #f0f0f0;
    font-size: 28rpx;

    &:last-child {
      border-bottom: none;
    }

    &:active {
      background-color: #f5f5f5;
    }
  }
}

// 进度卡片
.progress-card {
  background-color: #fff;
  margin: 20rpx;
  padding: 30rpx;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);

  .progress-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20rpx;

    .progress-label {
      font-size: 28rpx;
      color: #333;
    }

    .progress-text {
      font-size: 28rpx;
      color: #1890ff;
      font-weight: 500;
    }
  }

  .progress-bar {
    height: 16rpx;
    background-color: #f0f0f0;
    border-radius: 8rpx;
    overflow: hidden;
    margin-bottom: 20rpx;

    .progress-inner {
      height: 100%;
      background-color: #1890ff;
      border-radius: 8rpx;
      transition: width 0.3s ease;
    }
  }

  .task-info {
    display: flex;
    gap: 30rpx;

    .info-item {
      font-size: 24rpx;
      color: #666;
    }
  }
}

// 点位卡片
.point-card {
  background-color: #fff;
  margin: 20rpx;
  padding: 30rpx;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);

  .point-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 24rpx;

    .point-number {
      font-size: 32rpx;
      font-weight: 500;
      color: #333;
    }

    .point-status {
      font-size: 24rpx;
      padding: 8rpx 16rpx;
      border-radius: 20rpx;

      &.matched {
        background-color: #f6ffed;
        color: #52c41a;
      }

      &.unmatched {
        background-color: #fff1f0;
        color: #ff7875;
      }
    }
  }

  .point-info {
    .info-row {
      display: flex;
      margin-bottom: 16rpx;

      .info-label {
        font-size: 26rpx;
        color: #666;
        width: 160rpx;
      }

      .info-value {
        font-size: 26rpx;
        color: #333;
        flex: 1;

        &.card-id {
          font-family: monospace;
          font-weight: 500;
        }
      }
    }

    .mandatory-photo {
      margin-top: 20rpx;

      .photo-label {
        display: inline-block;
        padding: 8rpx 20rpx;
        background-color: #fff2f0;
        color: #ff4d4f;
        border-radius: 20rpx;
        font-size: 24rpx;
        font-weight: 500;
      }
    }
  }
}

// 巡查项目卡片
.inspection-items-card {
  background-color: #fff;
  margin: 20rpx;
  padding: 30rpx;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);

  .card-title {
    font-size: 28rpx;
    font-weight: 500;
    color: #333;
    margin-bottom: 24rpx;
    display: block;
  }

  .empty-items {
    padding: 60rpx 20rpx;
    text-align: center;
    color: #999;
    font-size: 26rpx;
  }

  .items-list {
    .item-card {
      padding: 24rpx;
      border: 1rpx solid #f0f0f0;
      border-radius: 12rpx;
      margin-bottom: 16rpx;

      &:active {
        background-color: #f5f5f5;
      }

      .item-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 12rpx;

        .item-name {
          font-size: 28rpx;
          color: #333;
          font-weight: 500;
        }

        .item-type-badge {
          padding: 4rpx 12rpx;
          background-color: #e6f4ff;
          color: #1890ff;
          border-radius: 12rpx;
          font-size: 22rpx;
        }
      }

      .item-status {
        .status-text {
          font-size: 24rpx;
          color: #999;

          &.completed {
            color: #52c41a;
          }
        }
      }
    }
  }
}

// 照片拍摄卡片
.photo-card {
  background-color: #fff;
  margin: 20rpx;
  padding: 30rpx;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);

  .card-title {
    font-size: 28rpx;
    font-weight: 500;
    color: #333;
    margin-bottom: 24rpx;
    display: block;

    .mandatory-badge {
      display: inline-block;
      padding: 4rpx 12rpx;
      background-color: #ff4d4f;
      color: #fff;
      border-radius: 12rpx;
      font-size: 20rpx;
      margin-left: 12rpx;
    }
  }
}

// 底部操作按钮
.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx;
  background-color: #fff;
  box-shadow: 0 -4rpx 12rpx rgba(0, 0, 0, 0.08);
  display: flex;
  gap: 20rpx;

  .btn {
    height: 80rpx;
    border-radius: 40rpx;
    border: none;
    font-size: 28rpx;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &.btn-nfc {
      flex: 2;
      background-color: #1890ff;
      color: #fff;

      &:disabled {
        background-color: #d9d9d9;
        color: #999;
      }
    }

    &.btn-qrcode {
      flex: 2;
      background-color: #52c41a;
      color: #fff;

      &:disabled {
        background-color: #d9d9d9;
        color: #999;
      }
    }

    &.btn-add-remark {
      flex: 1;
      background-color: #f5f5f5;
      color: #666;
    }

    &.btn-skip {
      flex: 1;
      background-color: #faad14;
      color: #fff;
      min-width: 160rpx;

      &:active {
        background-color: #d48806;
      }
    }

    &.btn-success {
      flex: 2;
      background-color: #52c41a;
      color: #fff;
    }
  }
}

// NFC未开启警告
.nfc-warning {
  display: flex;
  align-items: center;
  margin: 20rpx;
  padding: 20rpx;
  background-color: #fff3cd;
  border-radius: 12rpx;
  border-left: 4rpx solid #faad14;

  .warning-icon {
    font-size: 32rpx;
    margin-right: 16rpx;
  }

  .warning-text {
    font-size: 26rpx;
    color: #856404;
    flex: 1;
  }

  .warning-actions {
    display: flex;
    gap: 12rpx;
  }

  .warning-btn {
    padding: 8rpx 20rpx;
    border-radius: 20rpx;
    font-size: 24rpx;
    border: none;
    white-space: nowrap;

    &.warning-btn-primary {
      background-color: #1890ff;
      color: #fff;
    }

    &.warning-btn-secondary {
      background-color: #f0f0f0;
      color: #666;
    }
  }
}

// 使用警告提示
.usage-warning {
  display: flex;
  align-items: center;
  margin: 20rpx;
  padding: 20rpx;
  background-color: #fff7e6;
  border-radius: 12rpx;
  border-left: 4rpx solid #faad14;

  .warning-icon {
    font-size: 32rpx;
    margin-right: 16rpx;
  }

  .warning-text {
    font-size: 24rpx;
    color: #faad14;
    line-height: 1.6;
    flex: 1;
  }
}

// 路线点位对话框
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60rpx;
}

.dialog-content {
  background-color: #fff;
  border-radius: 24rpx;
  width: 100%;
  max-height: 80vh;
  overflow: hidden;

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 30rpx 40rpx;
    border-bottom: 1rpx solid #f0f0f0;

    .dialog-title {
      font-size: 32rpx;
      font-weight: 500;
      color: #333;
    }

    .close-btn {
      font-size: 40rpx;
      color: #999;
      padding: 10rpx;
    }
  }

  .points-list {
    max-height: 60vh;
    overflow-y: auto;

    .point-item {
      display: flex;
      align-items: center;
      padding: 30rpx 40rpx;
      border-bottom: 1rpx solid #f0f0f0;

      &.active {
        background-color: #e6f4ff;
      }

      .point-order {
        width: 60rpx;
        height: 60rpx;
        border-radius: 50%;
        background-color: #f0f0f0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24rpx;
        color: #333;
        margin-right: 24rpx;
      }

      .point-details {
        flex: 1;

        .point-name {
          display: block;
          font-size: 28rpx;
          color: #333;
          margin-bottom: 8rpx;
        }

        .point-code,
        .point-type {
          display: block;
          font-size: 24rpx;
          color: #999;
          margin-bottom: 4rpx;
        }
      }

      .point-status {
        font-size: 32rpx;

        .completed-icon {
          color: #52c41a;
        }

        .pending-icon {
          color: #d9d9d9;
        }
      }
    }
  }

  .dialog-footer {
    padding: 30rpx 40rpx;
    text-align: center;
    border-top: 1rpx solid #f0f0f0;

    .stats-text {
      font-size: 26rpx;
      color: #666;
    }
  }
}
</style>
