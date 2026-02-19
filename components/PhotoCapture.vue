<template>
  <view class="photo-capture">
    <!-- 照片展示区域（使用PhotoGallery组件） -->
    <PhotoGallery
      v-if="photos.length > 0"
      :photos="photos"
      :max-count="maxCount"
      :show-delete="true"
      :show-add-button="true"
      @delete="handleDeletePhoto"
      @add="handleTakePhoto"
    />

    <!-- 空状态（无照片时显示） -->
    <view v-else class="empty-state">
      <view class="empty-icon">📷</view>
      <text class="empty-text">{{ isMandatory ? '请拍摄至少1张照片' : '暂无照片' }}</text>
      <button class="btn-take-photo" @click="handleTakePhoto">
        <text class="btn-text">{{ isMandatory ? '立即拍照' : '拍照（可选）' }}</text>
      </button>
    </view>

    <!-- 照片提示信息 -->
    <view v-if="showTip" class="photo-tip">
      <text class="tip-icon">💡</text>
      <text class="tip-text">{{ tipText }}</text>
    </view>

    <!-- 相机权限引导弹窗 -->
    <view v-if="showPermissionGuide" class="permission-guide-overlay" @click="showPermissionGuide = false">
      <view class="guide-content" @click.stop>
        <text class="guide-title">需要相机权限</text>
        <text class="guide-desc">为了使用拍照功能，请开启相机权限</text>
        <view class="guide-actions">
          <button class="guide-btn guide-btn-cancel" @click="showPermissionGuide = false">取消</button>
          <button class="guide-btn guide-btn-confirm" @click="requestCameraPermission">去开启</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import PhotoGallery from './PhotoGallery.vue'
import photoCompressionService from '@/services/PhotoCompressionService'
import cameraPermissionService from '@/services/CameraPermissionService'

const props = defineProps({
  // 是否必须拍照
  isMandatory: {
    type: Boolean,
    default: false
  },
  // 最大照片数量
  maxCount: {
    type: Number,
    default: 9
  },
  // 是否显示提示
  showTip: {
    type: Boolean,
    default: true
  },
  // 提示文本
  tipText: {
    type: String,
    default: '建议拍摄清晰照片，每张照片不超过1MB'
  },
  // 初始照片列表
  initialPhotos: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['change', 'upload'])

// 响应式数据
const photos = ref([])
const showPermissionGuide = ref(false)

// 计算属性
const canAddPhoto = computed(() => {
  return photos.value.length < props.maxCount
})

// 初始化照片列表
watch(() => props.initialPhotos, (newVal) => {
  if (newVal && newVal.length > 0) {
    photos.value = newVal.map(path => ({
      path: path,
      compressed: false,
      compressing: false
    }))
  }
}, { immediate: true })

// 处理拍照
async function handleTakePhoto() {
  // 检查数量限制
  if (!canAddPhoto.value) {
    uni.showToast({
      title: `最多只能添加${props.maxCount}张照片`,
      icon: 'none'
    })
    return
  }

  // 检查相机权限
  const permission = await cameraPermissionService.checkPermission()
  if (!permission.isAuthorized) {
    showPermissionGuide.value = true
    return
  }

  // 调用相机拍照
  uni.chooseImage({
    count: 1,
    sizeType: ['original', 'compressed'],
    sourceType: ['camera'],
    success: async (res) => {
      const tempFilePath = res.tempFilePaths[0]

      // 添加照片到列表（标记为压缩中）
      const photoIndex = photos.value.length
      photos.value.push({
        path: tempFilePath,
        compressed: false,
        compressing: true
      })

      // 触发变更事件
      emitChange()

      // 异步压缩照片
      try {
        const compressResult = await photoCompressionService.compressPhoto(tempFilePath)

        if (compressResult.success) {
          // 更新照片路径
          photos.value[photoIndex].path = compressResult.compressedPath
          photos.value[photoIndex].compressed = true
          photos.value[photoIndex].compressing = false
          photos.value[photoIndex].originalSize = compressResult.originalSize
          photos.value[photoIndex].compressedSize = compressResult.compressedSize

          // 触发变更事件
          emitChange()

          // 显示压缩结果
          if (!compressResult.skipped) {
            uni.showToast({
              title: `压缩完成，节省${Math.round((1 - parseFloat(compressResult.compressionRatio)) * 100)}%空间`,
              icon: 'none',
              duration: 2000
            })
          }
        } else {
          // 压缩失败，保留原图
          photos.value[photoIndex].compressing = false
          console.error('照片压缩失败:', compressResult.error)
        }
      } catch (error) {
        // 压缩失败，保留原图
        photos.value[photoIndex].compressing = false
        console.error('照片压缩异常:', error)
      }
    },
    fail: (error) => {
      console.error('拍照失败:', error)

      // 用户取消拍照不提示错误
      if (error.errMsg && error.errMsg.includes('cancel')) {
        return
      }

      uni.showToast({
        title: '拍照失败',
        icon: 'none'
      })
    }
  })
}

// 处理删除照片（PhotoGallery组件已处理确认对话框）
function handleDeletePhoto(index) {
  // 删除照片
  photos.value.splice(index, 1)

  // 触发变更事件
  emitChange()
}

// 请求相机权限
async function requestCameraPermission() {
  try {
    const result = await cameraPermissionService.requestPermission()
    if (result.success) {
      showPermissionGuide.value = false
      // 权限获取成功，重新拍照
      handleTakePhoto()
    } else {
      uni.showModal({
        title: '权限被拒绝',
        content: '无法使用相机功能，请前往设置开启相机权限',
        showCancel: true,
        confirmText: '去设置',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            cameraPermissionService.openSetting()
          }
        }
      })
    }
  } catch (error) {
    console.error('请求相机权限失败:', error)
    uni.showToast({
      title: '获取权限失败',
      icon: 'none'
    })
  }
}

// 触发变更事件
function emitChange() {
  const photoPaths = photos.value.map(p => p.path)
  emit('change', photoPaths)
}

// 获取照片列表
function getPhotos() {
  return photos.value.map(p => p.path)
}

// 清空照片
function clearPhotos() {
  photos.value = []
  emitChange()
}

// 验证照片
function validate() {
  if (props.isMandatory && photos.value.length === 0) {
    return {
      valid: false,
      error: '请至少拍摄1张照片'
    }
  }

  return {
    valid: true,
    error: null
  }
}

// 暴露方法给父组件
defineExpose({
  getPhotos,
  clearPhotos,
  validate
})
</script>

<style lang="scss" scoped>
.photo-capture {
  padding: 20rpx;
}

// 空状态
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 20rpx;
  text-align: center;

  .empty-icon {
    font-size: 120rpx;
    margin-bottom: 20rpx;
  }

  .empty-text {
    font-size: 28rpx;
    color: #999;
    margin-bottom: 40rpx;
  }

  .btn-take-photo {
    width: 300rpx;
    height: 80rpx;
    border-radius: 40rpx;
    border: none;
    background-color: #1890ff;
    color: #fff;
    font-size: 28rpx;
    font-weight: 500;

    .btn-text {
      font-size: 28rpx;
    }

    &:active {
      background-color: #096dd9;
    }
  }
}

// 照片提示
.photo-tip {
  display: flex;
  align-items: flex-start;
  margin-top: 20rpx;
  padding: 20rpx;
  background-color: #e6f4ff;
  border-radius: 12rpx;
  border-left: 4rpx solid #1890ff;

  .tip-icon {
    font-size: 28rpx;
    margin-right: 12rpx;
  }

  .tip-text {
    font-size: 24rpx;
    color: #1890ff;
    line-height: 1.6;
    flex: 1;
  }
}

// 权限引导弹窗
.permission-guide-overlay {
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

.guide-content {
  background-color: #fff;
  border-radius: 24rpx;
  padding: 60rpx 40rpx 40rpx;
  width: 100%;
  max-width: 500rpx;
  text-align: center;

  .guide-title {
    display: block;
    font-size: 36rpx;
    font-weight: 500;
    color: #333;
    margin-bottom: 20rpx;
  }

  .guide-desc {
    display: block;
    font-size: 28rpx;
    color: #666;
    margin-bottom: 40rpx;
    line-height: 1.6;
  }

  .guide-actions {
    display: flex;
    gap: 20rpx;

    .guide-btn {
      flex: 1;
      height: 80rpx;
      border-radius: 40rpx;
      border: none;
      font-size: 28rpx;
      font-weight: 500;

      &.guide-btn-cancel {
        background-color: #f5f5f5;
        color: #666;

        &:active {
          background-color: #e8e8e8;
        }
      }

      &.guide-btn-confirm {
        background-color: #1890ff;
        color: #fff;

        &:active {
          background-color: #096dd9;
        }
      }
    }
  }
}
</style>
