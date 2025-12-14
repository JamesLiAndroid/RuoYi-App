<template>
  <view class="empty-state">
    <view class="icon-wrapper">
      <text class="icon">{{ icon }}</text>
    </view>
    <text class="title">{{ title }}</text>
    <text class="description" v-if="description">{{ description }}</text>
    <button class="action-btn" v-if="actionText" @click="handleAction">
      {{ actionText }}
    </button>
  </view>
</template>

<script setup>
const props = defineProps({
  icon: {
    type: String,
    default: '📋'
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  actionText: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['action'])

function handleAction() {
  emit('action')
}
</script>

<style lang="scss" scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100rpx 40rpx;
  text-align: center;

  .icon-wrapper {
    width: 160rpx;
    height: 160rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f5f5f5;
    border-radius: 50%;
    margin-bottom: 40rpx;

    .icon {
      font-size: 80rpx;
    }
  }

  .title {
    font-size: 32rpx;
    font-weight: 500;
    color: #333;
    margin-bottom: 20rpx;
  }

  .description {
    font-size: 26rpx;
    color: #666;
    line-height: 1.6;
    margin-bottom: 60rpx;
  }

  .action-btn {
    padding: 20rpx 60rpx;
    background-color: #1890ff;
    color: #fff;
    border: none;
    border-radius: 40rpx;
    font-size: 28rpx;
  }
}
</style>
