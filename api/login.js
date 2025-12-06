import request from '@/utils/request'

// 登录方法
export function login(username, password, code, uuid, tenantId) {
  const data = {
    username,
    password,
    code,
    uuid,
    tenantId,  // 添加租户ID
    clientId: '428a8310cd442757ae699df5d894f051',  // 使用指定的client_id
    grantType: 'password'   // 授权类型
  }
  return request({
    'url': '/auth/login',
    headers: {
      isToken: false
    },
    'method': 'post',
    'data': data
  })
}

// 注册方法
export function register(data) {
  return request({
    url: '/register',
    headers: {
      isToken: false
    },
    method: 'post',
    data: data
  })
}

// 获取用户详细信息
export function getInfo() {
  return request({
    'url': '/getInfo',
    'method': 'get'
  })
}

// 获取移动端用户详细信息（适配移动端）
export function getMobileUserInfo() {
  return request({
    'url': '/system/user/mobile-info',
    'method': 'get'
  })
}

// 退出方法
export function logout() {
  return request({
    'url': '/logout',
    'method': 'post'
  })
}

// 获取验证码
export function getCodeImg() {
  return request({
    'url': '/auth/code',  // 修正：使用正确的验证码API路径
    headers: {
      isToken: false
    },
    method: 'get',
    timeout: 20000
  })
}

// 获取租户列表
export function getTenantList() {
  return request({
    'url': '/auth/tenant/list',
    headers: {
      isToken: false
    },
    method: 'get',
    timeout: 20000
  })
}
