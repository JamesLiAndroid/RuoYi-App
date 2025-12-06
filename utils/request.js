import config from '@/config'
import { getToken } from '@/utils/auth'
import errorCode from '@/utils/errorCode'
import { useUserStore } from '@/store/modules/user'
import { toast, showConfirm, tansParams } from '@/utils/common'
import StorageService from '@/utils/StorageService'

let timeout = 10000

/**
 * 获取基础URL
 * 优先使用用户在"通信配置"页面配置的服务器地址
 * 如果未配置，则使用默认的config.baseUrl
 */
function getBaseUrl() {
  const serverUrl = StorageService.getServerUrl()
  return serverUrl || config.baseUrl
}

const baseUrl = getBaseUrl()

const request = config => {
  // 是否需要设置 token
  // API调用时使用headers（复数），这里需要检查headers
  const isToken = (config.headers || {}).isToken === false

  // uni.request使用header（单数），需要统一
  // 如果传入的是headers（复数），需要合并到header（单数）
  config.header = config.header || {}

  // 添加token到header
  if (getToken() && !isToken) {
    config.header['Authorization'] = 'Bearer ' + getToken()
    // 重要：添加clientid到header，后端会验证clientid与token中的clientid是否一致
    config.header['clientid'] = '428a8310cd442757ae699df5d894f051'
  }

  // get请求映射params参数
  if (config.params) {
    let url = config.url + '?' + tansParams(config.params)
    url = url.slice(0, -1)
    config.url = url
  }

  // 打印调试信息
  console.log('========== API请求 ==========')
  console.log('URL:', config.url)
  console.log('Method:', config.method || 'get')
  console.log('Token:', getToken() ? '存在 (长度: ' + getToken().length + ')' : '不存在')
  console.log('isToken参数:', isToken)
  console.log('需要发送Token:', !isToken)
  console.log('请求Headers:', JSON.stringify(config.header))
  console.log('============================')

  return new Promise((resolve, reject) => {
    // 每次请求时动态获取 baseURL，确保使用最新的用户配置
    const currentBaseUrl = config.baseUrl || getBaseUrl()

    uni.request({
        method: config.method || 'get',
        timeout: config.timeout ||  timeout,
        url: currentBaseUrl + config.url,
        data: config.data,
        header: config.header,
        dataType: 'json'
      }).then(response => {
        const res = response
        const code = res.data.code || 200
        const msg = errorCode[code] || res.data.msg || errorCode['default']
        if (code === 401) {
          showConfirm('登录状态已过期，您可以继续留在该页面，或者重新登录?').then(res => {
            if (res.confirm) {
              useUserStore().logOut().then(res => {
                uni.reLaunch({ url: '/pages/login' })
              })
            }
          })
          reject('无效的会话，或者会话已过期，请重新登录。')
        } else if (code === 500) {
          toast(msg)
          reject('500')
        } else if (code !== 200) {
          toast(msg)
          reject(code)
        }
        resolve(res.data)
      })
      .catch(error => {
        let { message } = error
        if (message === 'Network Error') {
          message = '后端接口连接异常'
        } else if (message.includes('timeout')) {
          message = '系统接口请求超时'
        } else if (message.includes('Request failed with status code')) {
          message = '系统接口' + message.substr(message.length - 3) + '异常'
        }
        toast(message)
        reject(error)
      })
  })
}

export default request
