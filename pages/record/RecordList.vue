<template>
  <view class="record-list-container">
    <view class="empty-state">
      <view class="icon">📋</view>
      <text class="title">巡检记录</text>
      <text class="description">此功能将在后续Story中实现</text>
      <text class="hint">敬请期待...</text>
    </view>
  </view>
</template>

<script setup>
import { onLoad } from "@dcloudio/uni-app"

onLoad(() => {
  console.log('巡检记录页面加载（预留）')
})
</script>

<style lang="scss" scoped>
.record-list-container {
  min-height: 100vh;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-state {
  text-align: center;
  padding: 80rpx 40rpx;

  .icon {
    font-size: 120rpx;
    margin-bottom: 30rpx;
  }

  .title {
    display: block;
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 20rpx;
  }

  .description {
    display: block;
    font-size: 28rpx;
    color: #666;
    margin-bottom: 15rpx;
  }

  .hint {
    display: block;
    font-size: 24rpx;
    color: #999;
  }
}
</style>
