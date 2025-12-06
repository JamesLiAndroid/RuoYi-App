<template>
  <view class="normal-login-container">
    <!-- 右上角设置按钮 -->
    <view class="settings-btn" @click="handleSettings">
      <text class="settings-icon">⚙️</text>
    </view>

    <view class="logo-content align-center justify-center flex">
      <image style="width: 100rpx;height: 100rpx;" :src="globalConfig.appInfo.logo" mode="widthFix">
      </image>
      <text class="title">巡检系统登录</text>
    </view>
    <view class="login-form-content">
      <!-- 租户选择 -->
      <view class="input-item flex align-center" v-if="tenantEnabled">
        <view class="iconfont icon-company icon"></view>
        <picker mode="selector" :range="tenantList" range-key="companyName" :value="tenantIndex" @change="onTenantChange">
          <view class="input picker-input">
            {{ selectedTenantName || '请选择公司' }}
          </view>
        </picker>
      </view>

      <view class="input-item flex align-center">
        <view class="iconfont icon-user icon"></view>
        <input v-model="loginForm.username" class="input" type="text" placeholder="请输入账号" maxlength="30" />
      </view>
      <view class="input-item flex align-center">
        <view class="iconfont icon-password icon"></view>
        <input v-model="loginForm.password" type="password" class="input" placeholder="请输入密码" maxlength="20" />
      </view>
      <view class="input-item flex align-center" style="width: 60%;margin: 0px;" v-if="captchaEnabled">
        <view class="iconfont icon-code icon"></view>
        <input v-model="loginForm.code" type="number" class="input" placeholder="请输入验证码" maxlength="4" />
        <view class="login-code">
          <image :src="codeUrl" @click="getCode" class="login-code-img"></image>
        </view>
      </view>

      <!-- 记住密码 -->
      <view class="remember-password">
        <label class="checkbox-label">
          <checkbox value="remember" :checked="rememberPassword" @click="toggleRememberPassword" />
          <text>记住密码</text>
        </label>
      </view>

      <view class="action-btn">
        <button @click="handleLogin" class="login-btn cu-btn block bg-blue lg round">登录</button>
      </view>
      <view class="reg text-center" v-if="register">
        <text class="text-grey1">没有账号？</text>
        <text @click="handleUserRegister" class="text-blue">立即注册</text>
      </view>
      <view class="xieyi text-center">
        <text class="text-grey1">登录即代表同意</text>
        <text @click="handleUserAgrement" class="text-blue">《用户协议》</text>
        <text @click="handlePrivacy" class="text-blue">《隐私协议》</text>
      </view>
    </view>

  </view>
</template>

<script setup>
import { ref, computed, getCurrentInstance } from "vue"
import { onLoad, onShow } from "@dcloudio/uni-app"
import { getToken } from '@/utils/auth'
import { getCodeImg, getTenantList } from '@/api/login'
import { useConfigStore, useUserStore } from '@/store'
import StorageService from '@/utils/StorageService'
import DataSyncService from '@/services/DataSyncService'

const { proxy } = getCurrentInstance()
const globalConfig = useConfigStore().config
const codeUrl = ref("")
// 验证码开关
const captchaEnabled = ref(true)
// 租户开关
const tenantEnabled = ref(true)
// 用户注册开关
const register = ref(false)
// 记住密码
const rememberPassword = ref(true)

// 租户列表
const tenantList = ref([])
// 租户选择索引
const tenantIndex = ref(0)
// 当前选择的租户名称
const selectedTenantName = computed(() => {
  if (tenantList.value.length > 0 && tenantIndex.value >= 0) {
    return tenantList.value[tenantIndex.value]?.companyName
  }
  return ''
})

const loginForm = ref({
  tenantId: '',
  username: "",
  password: "",
  code: "",
  uuid: ""
})

// 标记验证码是否正在加载，防止重复请求
const isLoadingCaptcha = ref(false)

// 标记数据是否已加载（租户列表和验证码）
const isDataLoaded = ref(false)

// 页面加载
onLoad(() => {
  initLoginPage()
})

// 页面显示
onShow(() => {
  // 如果数据未加载，且服务器已配置，则加载数据
  if (!isDataLoaded.value && StorageService.isServerConfigured()) {
    loadLoginData()
  }
})

// 初始化登录页面
function initLoginPage() {
  // 1. 首先检查服务器配置
  if (!checkServerConfig()) {
    return  // 跳转后直接返回，不再执行后续逻辑
  }

  // 2. H5环境下，如果已经有Token，直接跳转到首页，不需要停留在登录页
  //#ifdef H5
  const token = getToken()

  if (token) {
    uni.reLaunch({ url: '/pages/index' })
    return
  }
  //#endif

  // 3. 加载登录数据
  loadLoginData()
}

// 加载登录数据（租户列表、验证码、保存的凭据）
function loadLoginData() {
  // 加载保存的用户名和密码
  loadSavedCredentials()

  // 初始化租户列表
  initTenantList()

  // 获取验证码（只在页面加载时调用一次）
  getCode()

  // 标记数据已加载
  isDataLoaded.value = true
}

// 检查服务器配置
function checkServerConfig() {
  if (!StorageService.isServerConfigured()) {
    //#ifdef H5
    // H5环境：未配置服务器，也跳转到通信配置页面
    uni.reLaunch({ url: '/pages/communication-config' })
    return false
    //#endif

    //#ifdef APP-PLUS
    // APP环境：未配置服务器，跳转到通信配置页面
    uni.reLaunch({ url: '/pages/communication-config' })
    return false
    //#endif
  }
  return true
}

// 加载保存的用户名和密码
function loadSavedCredentials() {
  const username = StorageService.getUsername()
  const password = StorageService.getPassword()
  const tenantId = uni.getStorageSync('tenantId')

  if (username) {
    loginForm.value.username = username
  }
  if (password) {
    loginForm.value.password = password
  }
  if (tenantId) {
    loginForm.value.tenantId = tenantId
  }
}

// 初始化租户列表
async function initTenantList() {
  try {
    const res = await getTenantList()
    const data = res.data || res

    tenantEnabled.value = data.tenantEnabled === undefined ? true : data.tenantEnabled

    if (tenantEnabled.value) {
      tenantList.value = data.voList || []

      if (tenantList.value.length > 0) {
        // 如果有保存的租户ID，尝试恢复选择
        const savedTenantId = uni.getStorageSync('tenantId')
        if (savedTenantId) {
          const index = tenantList.value.findIndex(t => t.tenantId === savedTenantId)
          if (index >= 0) {
            tenantIndex.value = index
            loginForm.value.tenantId = savedTenantId
          } else {
            // 没找到，使用第一个
            tenantIndex.value = 0
            loginForm.value.tenantId = tenantList.value[0].tenantId
          }
        } else {
          // 默认选择第一个租户
          tenantIndex.value = 0
          loginForm.value.tenantId = tenantList.value[0].tenantId
        }
      }
    }
  } catch (error) {
    console.error('获取租户列表失败:', error)
    tenantEnabled.value = false

    // 给用户明确提示
    uni.showToast({
      title: '获取租户列表失败，请检查网络或服务器配置',
      icon: 'none',
      duration: 3000
    })
  }
}

// 租户选择变化
function onTenantChange(e) {
  const index = e.detail.value
  tenantIndex.value = index
  if (tenantList.value[index]) {
    loginForm.value.tenantId = tenantList.value[index].tenantId
    // 保存租户选择
    uni.setStorageSync('tenantId', loginForm.value.tenantId)
  }
}

// 切换记住密码
function toggleRememberPassword() {
  rememberPassword.value = !rememberPassword.value
  if (!rememberPassword.value) {
    // 取消记住密码时，清除已保存的密码
    uni.removeStorageSync('password')
  }
}

// 设置按钮
function handleSettings() {
  uni.navigateTo({ url: '/pages/communication-config' })
}

// 用户注册
function handleUserRegister() {
  proxy.$tab.redirectTo(`/pages/register`)
}

// 隐私协议
function handlePrivacy() {
  let site = globalConfig.appInfo.agreements[0]
  proxy.$tab.navigateTo(`/pages/common/webview/index?title=${site.title}&url=${site.url}`)
}

// 用户协议
function handleUserAgrement() {
  let site = globalConfig.appInfo.agreements[1]
  proxy.$tab.navigateTo(`/pages/common/webview/index?title=${site.title}&url=${site.url}`)
}

// 获取图形验证码
function getCode() {
  // 防止重复请求
  if (isLoadingCaptcha.value) {
    return
  }

  isLoadingCaptcha.value = true

  getCodeImg().then(res => {
    // 注意：request.js返回的是res.data，所以需要访问res.data
    const data = res.data || res

    captchaEnabled.value = data.captchaEnabled === undefined ? true : data.captchaEnabled

    if (captchaEnabled.value) {
      // 正确的base64图片格式
      codeUrl.value = 'data:image/gif;base64,' + data.img
      loginForm.value.uuid = data.uuid
    }
  }).catch(error => {
    console.error('获取验证码失败:', error)
    captchaEnabled.value = false  // 获取失败时禁用验证码

    // 给用户明确提示
    uni.showToast({
      title: '获取验证码失败，请检查网络或服务器配置',
      icon: 'none',
      duration: 3000
    })
  }).finally(() => {
    isLoadingCaptcha.value = false
  })
}

// 登录方法
async function handleLogin() {
  // 检查服务器配置
  if (!checkServerConfig()) {
    return
  }

  if (loginForm.value.username === "") {
    proxy.$modal.msgError("请输入账号")
  } else if (loginForm.value.password === "") {
    proxy.$modal.msgError("请输入密码")
  } else if (loginForm.value.code === "" && captchaEnabled.value) {
    proxy.$modal.msgError("请输入验证码")
  } else {
    proxy.$modal.loading("登录中，请耐心等待...")
    pwdLogin()
  }
}

// 密码登录
async function pwdLogin() {
  try {
    await useUserStore().login(loginForm.value)
    proxy.$modal.closeLoading()

    // 登录成功，保存凭据
    if (rememberPassword.value) {
      StorageService.setUsername(loginForm.value.username)
      StorageService.setPassword(loginForm.value.password)
    }

    // 登录成功后，处理函数
    await loginSuccess()
  } catch (error) {
    console.error('登录失败:', error)
    if (captchaEnabled.value) {
      getCode()
    }
  }
}

// 登录成功后处理
async function loginSuccess() {
  try {
    // 获取移动端用户信息（适配移动端API）
    await useUserStore().getMobileUserInfo()

    // 检查数据版本
    await checkDataVersion()
  } catch (error) {
    console.error('获取用户信息失败:', error)
    proxy.$modal.msgError('获取用户信息失败')
  }
}

// 检查数据版本
async function checkDataVersion() {
  try {
    // 使用 DataSyncService 检查需要同步的表
    const needsSync = await DataSyncService.checkNeedSync()

    // 如果有更新，跳转到数据同步页面
    if (needsSync.length > 0) {
      proxy.$tab.reLaunch('/pages/data-sync')
    } else {
      // 无需同步，直接跳转到首页
      proxy.$tab.reLaunch('/pages/index')
    }
  } catch (error) {
    console.error('检查数据版本失败:', error)
    // 检查失败时，也跳转到数据同步页面（可能是首次使用）
    proxy.$tab.reLaunch('/pages/data-sync')
  }
}
</script>

<style lang="scss" scoped>
page {
  background-color: #ffffff;
}

.normal-login-container {
  width: 100%;
  position: relative;

  .settings-btn {
    position: absolute;
    top: 40rpx;
    right: 40rpx;
    width: 60rpx;
    height: 60rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f5f5f5;
    border-radius: 50%;
    z-index: 10;

    .settings-icon {
      font-size: 32rpx;
    }
  }

  .logo-content {
    width: 100%;
    font-size: 21px;
    text-align: center;
    padding-top: 15%;

    image {
      border-radius: 4px;
    }

    .title {
      margin-left: 10px;
    }
  }

  .login-form-content {
    text-align: center;
    margin: 20px auto;
    margin-top: 15%;
    width: 80%;

    .input-item {
      margin: 20px auto;
      background-color: #f5f6f7;
      height: 45px;
      border-radius: 20px;

      .icon {
        font-size: 38rpx;
        margin-left: 10px;
        color: #999;
      }

      .input {
        width: 100%;
        font-size: 14px;
        line-height: 20px;
        text-align: left;
        padding-left: 15px;
      }

      .picker-input {
        width: 100%;
        font-size: 14px;
        line-height: 20px;
        text-align: left;
        padding-left: 15px;
        color: #333;
      }

    }

    .remember-password {
      display: flex;
      justify-content: flex-start;
      margin: 20rpx 0;

      .checkbox-label {
        display: flex;
        align-items: center;
        font-size: 28rpx;
        color: #666;

        checkbox {
          margin-right: 15rpx;
        }
      }
    }

    .login-btn {
      margin-top: 40px;
      height: 45px;
    }

    .reg {
      margin-top: 15px;
    }

    .xieyi {
      color: #333;
      margin-top: 20px;
    }

    .login-code {
      height: 38px;
      float: right;

      .login-code-img {
        height: 38px;
        position: absolute;
        margin-left: 10px;
        width: 200rpx;
      }
    }
  }
}
</style>
