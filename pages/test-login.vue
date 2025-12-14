<template>
  <view class="container">
    <view class="title">登录测试页面</view>

    <!-- 测试表单 -->
    <view class="section">
      <view class="label">服务器地址：</view>
      <input v-model="serverUrl" class="input" placeholder="http://localhost:8080" />
    </view>

    <view class="section">
      <view class="label">客户端ID：</view>
      <input v-model="clientId" class="input" value="app" />
    </view>

    <view class="section">
      <view class="label">用户名：</view>
      <input v-model="username" class="input" placeholder="admin" />
    </view>

    <view class="section">
      <view class="label">密码：</view>
      <input v-model="password" type="password" class="input" placeholder="admin123" />
    </view>

    <view class="section">
      <view class="label">验证码：</view>
      <view class="captcha-row">
        <input v-model="code" class="input captcha-input" placeholder="验证码" />
        <image v-if="captchaImg" :src="captchaImg" @click="getCaptcha" class="captcha-img"></image>
      </view>
    </view>

    <!-- 测试按钮 -->
    <view class="section">
      <button @click="testLogin" class="btn">测试登录</button>
      <button @click="getCaptcha" class="btn btn-secondary">刷新验证码</button>
    </view>

    <!-- 测试结果 -->
    <view v-if="testResult" class="result">
      <view class="result-title">测试结果：</view>
      <view class="result-content">{{ testResult }}</view>
    </view>

    <!-- 调试信息 -->
    <view v-if="debugInfo" class="debug">
      <view class="debug-title">调试信息：</view>
      <view class="debug-content">{{ debugInfo }}</view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import StorageService from '@/utils/StorageService'
import { getCodeImg } from '@/api/login'
import request from '@/utils/request'

const serverUrl = ref('')
const clientId = ref('428a8310cd442757ae699df5d894f051')  // 使用数据库中app客户端的client_key
const username = ref('admin')
const password = ref('admin123')
const code = ref('')
const uuid = ref('')
const captchaImg = ref('')
const testResult = ref('')
const debugInfo = ref('')

onMounted(() => {
  serverUrl.value = StorageService.getServerUrl() || 'http://localhost:8080'
  getCaptcha()
})

// 获取验证码
async function getCaptcha() {
  try {
    debugInfo.value = '正在获取验证码...'
    const res = await getCodeImg()
    const data = res.data || res

    if (data.captchaEnabled && data.img) {
      captchaImg.value = 'data:image/gif;base64,' + data.img
      uuid.value = data.uuid
      debugInfo.value = `验证码获取成功\nUUID: ${data.uuid}`
    } else {
      debugInfo.value = '验证码已禁用'
    }
  } catch (error) {
    debugInfo.value = '获取验证码失败: ' + error.message
  }
}

// 测试登录
async function testLogin() {
  try {
    testResult.value = ''
    debugInfo.value = ''

    // 1. 保存服务器地址
    StorageService.setServerUrl(serverUrl.value)
    debugInfo.value += '服务器地址已设置\n'

    // 2. 构造登录数据
    const loginData = {
      username: username.value,
      password: password.value,
      code: code.value,
      uuid: uuid.value,
      clientId: clientId.value,
      grantType: 'password'
    }

    debugInfo.value += '登录数据: ' + JSON.stringify(loginData, null, 2) + '\n'

    // 3. 发送登录请求
    const res = await request({
      url: '/auth/login',
      method: 'post',
      data: loginData,
      headers: {
        isToken: false
      }
    })

    debugInfo.value += '登录响应: ' + JSON.stringify(res, null, 2) + '\n'

    // 4. 提取token
    const loginInfo = res.data || res
    const token = loginInfo.access_token || loginInfo.token

    if (token) {
      testResult.value = '✅ 登录成功！\nToken: ' + token.substring(0, 50) + '...'
      StorageService.setToken(token)
      debugInfo.value += 'Token已保存到localStorage\n'
    } else {
      testResult.value = '❌ 登录失败：响应中未包含token'
      debugInfo.value += '错误：未找到access_token或token字段\n'
    }
  } catch (error) {
    testResult.value = '❌ 登录失败'
    debugInfo.value += '错误详情: ' + JSON.stringify(error, null, 2)
    console.error('登录测试失败:', error)
  }
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
  margin-bottom: 30rpx;
}

.label {
  font-weight: bold;
  margin-bottom: 10rpx;
  color: #333;
}

.input {
  width: 100%;
  padding: 20rpx;
  border: 1px solid #ddd;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.captcha-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.captcha-input {
  flex: 1;
}

.captcha-img {
  width: 200rpx;
  height: 80rpx;
  border: 1px solid #ddd;
  border-radius: 8rpx;
}

.btn {
  width: 100%;
  background-color: #007aff;
  color: white;
  border: none;
  padding: 20rpx;
  border-radius: 10rpx;
  margin-bottom: 20rpx;
  font-size: 32rpx;
}

.btn-secondary {
  background-color: #6c757d;
}

.result {
  margin-top: 40rpx;
  padding: 30rpx;
  background-color: #f0f9ff;
  border-radius: 10rpx;
  border-left: 4px solid #007aff;
}

.result-title {
  font-weight: bold;
  font-size: 32rpx;
  color: #007aff;
  margin-bottom: 20rpx;
}

.result-content {
  font-size: 28rpx;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.debug {
  margin-top: 30rpx;
  padding: 30rpx;
  background-color: #f8f9fa;
  border-radius: 10rpx;
  border: 1px solid #dee2e6;
}

.debug-title {
  font-weight: bold;
  font-size: 28rpx;
  color: #6c757d;
  margin-bottom: 20rpx;
}

.debug-content {
  font-size: 24rpx;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: monospace;
  color: #495057;
}
</style>
