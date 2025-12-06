import { getToken } from '@/utils/auth'

// 登录页面
const loginPage = "/pages/login"

// 页面白名单（无需Token即可访问）
const whiteList = [
  '/pages/login',
  '/pages/register',
  '/pages/communication-config',  // ✅ 添加通信配置页面到白名单
  '/pages/common/webview/index'
]

// 检查地址白名单
function checkWhite(url) {
  const path = url.split('?')[0]
  return whiteList.indexOf(path) !== -1
}

// 页面跳转验证拦截器
let list = ["navigateTo", "redirectTo", "reLaunch", "switchTab"]
list.forEach(item => {
  uni.addInterceptor(item, {
    invoke(to) {
      // 白名单页面直接放行（包括login和communication-config）
      if (checkWhite(to.url)) {
        return true
      }

      // 非白名单页面需要Token
      if (getToken()) {
        return true
      } else {
        // 无Token且不在白名单，跳转到登录页
        uni.reLaunch({ url: loginPage })
        return false
      }
    },
    fail(err) {
      console.log(err)
    }
  })
})
