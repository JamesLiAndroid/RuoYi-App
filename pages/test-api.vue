<template>
  <view class="container">
    <view class="title">API测试页面</view>

    <view class="section">
      <text class="label">当前服务器地址：</text>
      <text class="value">{{ serverUrl || '未配置' }}</text>
    </view>

    <view class="section">
      <button @click="testHealth" class="btn">测试健康检查 (/health)</button>
      <view v-if="healthResult" class="result">{{ healthResult }}</view>
    </view>

    <view class="section">
      <button @click="testCaptcha" class="btn">测试验证码 (/auth/code)</button>
      <view v-if="captchaResult" class="result">{{ captchaResult }}</view>
      <image v-if="captchaImg" :src="captchaImg" class="captcha-img"></image>
    </view>

    <view class="section">
      <button @click="goBack" class="btn-back">返回登录页</button>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import StorageService from '@/utils/StorageService'
import { getCodeImg } from '@/api/login'
import request from '@/utils/request'

const serverUrl = ref('')
const healthResult = ref('')
const captchaResult = ref('')
const captchaImg = ref('')

onMounted(() => {
  serverUrl.value = StorageService.getServerUrl()
})

// 测试健康检查
async function testHealth() {
  try {
    healthResult.value = '请求中...'
    const res = await request({
      url: '/health',
      method: 'get',
      headers: {
        isToken: false
      }
    })
    healthResult.value = JSON.stringify(res, null, 2)
  } catch (error) {
    healthResult.value = '错误: ' + error.message
  }
}

// 测试验证码
async function testCaptcha() {
  try {
    captchaResult.value = '请求中...'
    const res = await getCodeImg()

    // 注意：request.js返回的是res.data，所以需要访问res.data
    const data = res.data || res
    captchaResult.value = `验证码UUID: ${data.uuid}\n是否启用: ${data.captchaEnabled}`

    if (data.captchaEnabled && data.img) {
      captchaImg.value = 'data:image/gif;base64,' + data.img
    }
  } catch (error) {
    captchaResult.value = '错误: ' + (error.message || JSON.stringify(error))
    console.error('验证码测试失败:', error)
  }
}

function goBack() {
  uni.navigateBack()
}
</script>

<style scoped>
.container {
  padding: 40rpx;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  text-align: center;
  margin-bottom: 40rpx;
}

.section {
  margin-bottom: 40rpx;
  padding: 20rpx;
  background-color: #f5f5f5;
  border-radius: 10rpx;
}

.label {
  font-weight: bold;
  color: #333;
}

.value {
  color: #666;
  margin-left: 10rpx;
}

.btn {
  width: 100%;
  background-color: #007aff;
  color: white;
  border: none;
  padding: 20rpx;
  border-radius: 10rpx;
  margin-bottom: 20rpx;
}

.btn-back {
  width: 100%;
  background-color: #999;
  color: white;
  border: none;
  padding: 20rpx;
  border-radius: 10rpx;
}

.result {
  margin-top: 20rpx;
  padding: 20rpx;
  background-color: white;
  border-radius: 10rpx;
  font-size: 24rpx;
  word-break: break-all;
  white-space: pre-wrap;
}

.captcha-img {
  width: 200rpx;
  height: 80rpx;
  margin-top: 20rpx;
  border: 1px solid #ddd;
}
</style>
