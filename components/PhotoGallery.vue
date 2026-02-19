<template>
  <view class="photo-gallery">
    <!-- 照片网格 -->
    <view v-if="photos.length > 0" class="photos-grid">
      <view
        v-for="(photo, index) in photos"
        :key="index"
        class="photo-item"
        @click="handlePreviewPhoto(index)"
      >
        <image
          class="photo-image"
          :src="photo.path || photo"
          mode="aspectFill"
        />
        <view
          v-if="showDelete"
          class="photo-delete"
          @click.stop="handleDeletePhoto(index)"
        >
          <text class="delete-icon">✕</text>
        </view>
        <view v-if="photo.compressing" class="photo-compressing">
          <text class="compress-text">压缩中...</text>
        </view>
      </view>

      <!-- 添加照片按钮（在已有照片后面） -->
      <view
        v-if="showAddButton && photos.length < maxCount"
        class="photo-add-btn"
        @click="handleAddPhoto"
      >
        <text class="add-icon">+</text>
        <text class="add-text">添加照片</text>
      </view>
    </view>

    <!-- 空状态（无照片时显示） -->
    <view v-else-if="showEmpty" class="empty-state">
      <view class="empty-icon">📷</view>
      <text class="empty-text">{{ emptyText }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // 照片列表（支持字符串数组或对象数组）
  photos: {
    type: Array,
    default: () => []
  },
  // 最大照片数量
  maxCount: {
    type: Number,
    default: 9
  },
  // 是否显示删除按钮
  showDelete: {
    type: Boolean,
    default: true
  },
  // 是否显示添加按钮
  showAddButton: {
    type: Boolean,
    default: false
  },
  // 是否显示空状态
  showEmpty: {
    type: Boolean,
    default: false
  },
  // 空状态文本
  emptyText: {
    type: String,
    default: '暂无照片'
  }
})

const emit = defineEmits(['preview', 'delete', 'add'])

// 处理预览照片
function handlePreviewPhoto(index) {
  // 提取照片路径（支持字符串或对象）
  const photoPaths = props.photos.map(p => {
    return typeof p === 'string' ? p : (p.path || p)
  })

  const currentPhoto = photoPaths[index]

  uni.previewImage({
    urls: photoPaths,
    current: currentPhoto
  })

  // 触发预览事件
  emit('preview', index)
}

// 处理删除照片
function handleDeletePhoto(index) {
  uni.showModal({
    title: '删除照片',
    content: '确定要删除这张照片吗？',
    showCancel: true,
    cancelText: '取消',
    confirmText: '删除',
    success: (res) => {
      if (res.confirm) {
        // 触发删除事件
        emit('delete', index)

        uni.showToast({
          title: '已删除',
          icon: 'success'
        })
      }
    }
  })
}

// 处理添加照片
function handleAddPhoto() {
  emit('add')
}
</script>

<style lang="scss" scoped>
.photo-gallery {
  width: 100%;
}

// 照片网格
.photos-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
}

.photo-item {
  position: relative;
  width: 100%;
  padding-top: 100%; // 保持1:1宽高比
  border-radius: 12rpx;
  overflow: hidden;

  .photo-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .photo-delete {
    position: absolute;
    top: 8rpx;
    right: 8rpx;
    width: 48rpx;
    height: 48rpx;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;

    .delete-icon {
      font-size: 32rpx;
      color: #fff;
      font-weight: bold;
    }
  }

  .photo-compressing {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;

    .compress-text {
      font-size: 24rpx;
      color: #fff;
    }
  }
}

// 添加照片按钮
.photo-add-btn {
  position: relative;
  width: 100%;
  padding-top: 100%; // 保持1:1宽高比
  border: 2rpx dashed #d9d9d9;
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #fafafa;

  .add-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -80%);
    font-size: 60rpx;
    color: #999;
  }

  .add-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, 40%);
    font-size: 24rpx;
    color: #999;
  }

  &:active {
    background-color: #f0f0f0;
  }
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
  }
}
</style>
