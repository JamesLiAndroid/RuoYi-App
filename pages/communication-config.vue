<template>
  <view class="communication-config-container">
    <!-- 顶部标题 -->
    <view class="header">
      <image class="logo" :src="globalConfig.appInfo.logo" mode="widthFix"></image>
      <text class="title">通信配置</text>
      <text class="subtitle">请配置服务器地址以连接巡检系统</text>
    </view>

    <!-- 配置表单 -->
    <view class="config-form">
      <!-- 服务器地址 -->
      <view class="form-item">
        <text class="label required">服务器地址</text>
        <view class="input-group">
          <input
            v-model="configForm.serverUrl"
            class="input"
            type="text"
            placeholder="http://域名或IP:端口"
            maxlength="200"
          />
          <view class="scan-btn" @click="handleScanQR">
            <text class="scan-icon">📷</text>
          </view>
        </view>
        <text class="helper-text">示例：http://192.168.1.100:8080 或 https://inspection.company.com</text>
      </view>

      <!-- 连接测试按钮 -->
      <view class="form-item">
        <button
          class="test-btn"
          :class="{ 'testing': isTesting }"
          :disabled="isTesting || !configForm.serverUrl"
          @click="handleTestConnection"
        >
          <text v-if="!isTesting">🔍 测试连接</text>
          <text v-else>测试中...</text>
        </button>
        <view class="test-result" v-if="testResult">
          <text class="result-icon">{{ testResult.success ? '✅' : '❌' }}</text>
          <text class="result-text" :class="{ success: testResult.success, error: !testResult.success }">
            {{ testResult.message }}
          </text>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="action-buttons">
        <button class="btn-exit" @click="handleExit">退出</button>
        <button class="btn-save" :disabled="!configForm.serverUrl" @click="handleSave">保存配置</button>
      </view>
    </view>

    <!-- 版本信息 -->
    <view class="footer">
      <text class="version">{{ globalConfig.appInfo.name }} v{{ globalConfig.appInfo.version }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, getCurrentInstance } from "vue"
import { onLoad } from "@dcloudio/uni-app"
import { useConfigStore } from '@/store'
import StorageService from '@/utils/StorageService'
import ApiService from '@/utils/ApiService'

const { proxy } = getCurrentInstance()
const globalConfig = useConfigStore().config

// 表单数据
const configForm = ref({
  serverUrl: ''
})

// 测试状态
const isTesting = ref(false)

// 测试结果
const testResult = ref(null)

// 页面加载
onLoad(() => {
  loadConfig()
})

// 加载配置
function loadConfig() {
  configForm.value.serverUrl = StorageService.getServerUrl()
}

// 扫描二维码
function handleScanQR() {
  uni.scanCode({
    scanType: ['qrCode'],
    success: (res) => {
      try {
        const data = JSON.parse(res.result)
        if (data.server_url) {
          configForm.value.serverUrl = data.server_url
        }
        uni.showToast({
          title: '二维码解析成功',
          icon: 'success'
        })
      } catch (error) {
        uni.showToast({
          title: '二维码格式错误',
          icon: 'error'
        })
      }
    },
    fail: (error) => {
      console.error('二维码扫描失败:', error)
      uni.showToast({
        title: '扫描失败',
        icon: 'error'
      })
    }
  })
}

// 测试连接
async function handleTestConnection() {
  if (!configForm.value.serverUrl) {
    uni.showToast({
      title: '请先输入服务器地址',
      icon: 'none'
    })
    return
  }

  isTesting.value = true
  testResult.value = null

  try {
    // 验证URL格式
    if (!configForm.value.serverUrl.startsWith('http://') && !configForm.value.serverUrl.startsWith('https://')) {
      throw new Error('服务器地址必须以http://或https://开头')
    }

    // 调用测试连接
    const result = await ApiService.testConnection(configForm.value.serverUrl)
    testResult.value = result
  } catch (error) {
    testResult.value = {
      success: false,
      message: error.message || '连接测试失败'
    }
  } finally {
    isTesting.value = false
  }
}

// 保存配置
function handleSave() {
  // 表单验证
  if (!configForm.value.serverUrl) {
    uni.showToast({
      title: '请输入服务器地址',
      icon: 'none'
    })
    return
  }

  // 验证URL格式
  if (!configForm.value.serverUrl.startsWith('http://') && !configForm.value.serverUrl.startsWith('https://')) {
    uni.showToast({
      title: '服务器地址格式不正确',
      icon: 'none'
    })
    return
  }

  // 保存配置
  try {
    // 保存到StorageService
    StorageService.setServerUrl(configForm.value.serverUrl)

    uni.showToast({
      title: '配置保存成功',
      icon: 'success'
    })

    // 跳转到登录页面
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login' })
    }, 500)
  } catch (error) {
    console.error('保存配置失败:', error)
    uni.showToast({
      title: '保存失败',
      icon: 'error'
    })
  }
}

// 退出应用
function handleExit() {
  uni.showModal({
    title: '提示',
    content: '确定要退出应用吗？',
    success: (res) => {
      if (res.confirm) {
        // 退出应用
        // #ifdef APP-PLUS
        plus.runtime.quit()
        // #endif

        // #ifdef H5
        uni.showToast({
          title: 'H5环境无法退出应用',
          icon: 'none'
        })
        // #endif
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.communication-config-container {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding: 40rpx 30rpx;
}

// 顶部标题
.header {
  text-align: center;
  margin-bottom: 60rpx;

  .logo {
    width: 120rpx;
    height: 120rpx;
    border-radius: 8rpx;
    margin-bottom: 20rpx;
  }

  .title {
    display: block;
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 10rpx;
  }

  .subtitle {
    display: block;
    font-size: 24rpx;
    color: #999;
  }
}

// 配置表单
.config-form {
  background-color: #fff;
  border-radius: 12rpx;
  padding: 40rpx 30rpx;
}

.form-item {
  margin-bottom: 40rpx;

  .label {
    display: block;
    font-size: 28rpx;
    color: #333;
    margin-bottom: 15rpx;
    font-weight: 500;

    &.required::after {
      content: '*';
      color: #ff4d4f;
      margin-left: 8rpx;
    }
  }

  .input-group {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input {
    flex: 1;
    height: 88rpx;
    border: 1rpx solid #dcdcdc;
    border-radius: 8rpx;
    padding: 0 24rpx;
    font-size: 28rpx;
    color: #333;
    background-color: #fff;

    &:focus {
      border-color: #1890ff;
    }
  }

  .scan-btn {
    width: 88rpx;
    height: 88rpx;
    margin-left: 20rpx;
    background-color: #f0f0f0;
    border-radius: 8rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1rpx solid #dcdcdc;

    .scan-icon {
      font-size: 40rpx;
    }
  }

  .helper-text {
    display: block;
    font-size: 24rpx;
    color: #999;
    margin-top: 10rpx;
    line-height: 1.5;
  }

  .test-btn {
    width: 100%;
    height: 88rpx;
    background-color: #1890ff;
    color: #fff;
    border: none;
    border-radius: 8rpx;
    font-size: 28rpx;
    font-weight: 500;
    margin-bottom: 20rpx;

    &:disabled {
      background-color: #d9d9d9;
      color: #999;
    }

    &.testing {
      background-color: #d9d9d9;
    }
  }

  .test-result {
    display: flex;
    align-items: center;
    padding: 15rpx;
    background-color: #f5f5f5;
    border-radius: 8rpx;

    .result-icon {
      font-size: 32rpx;
      margin-right: 15rpx;
    }

    .result-text {
      font-size: 26rpx;
      flex: 1;

      &.success {
        color: #52c41a;
      }

      &.error {
        color: #ff4d4f;
      }
    }
  }
}

// 操作按钮
.action-buttons {
  display: flex;
  justify-content: space-between;
  margin-top: 60rpx;

  button {
    width: 48%;
    height: 88rpx;
    border-radius: 8rpx;
    font-size: 28rpx;
    font-weight: 500;

    &.btn-exit {
      background-color: #fff;
      color: #666;
      border: 1rpx solid #dcdcdc;
    }

    &.btn-save {
      background-color: #52c41a;
      color: #fff;
      border: none;

      &:disabled {
        background-color: #d9d9d9;
      }
    }
  }
}

// 底部版本信息
.footer {
  text-align: center;
  margin-top: 60rpx;

  .version {
    font-size: 24rpx;
    color: #999;
  }
}
</style>
